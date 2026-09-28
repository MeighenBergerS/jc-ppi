"""
scripts/papers/email_submissions.py — Papers brought by email
==============================================================
Run by .github/workflows/email-submissions.yml. Reads new mail in
the club Gmail over IMAP and turns each email whose subject holds an
arXiv ID or link into a paper issue: the body is "Why this paper?",
the sender's display name the name shown on the site. Every emailed
paper waits for a maintainer ("needs approval"), who is assigned so
GitHub emails them. The sender gets a reply with the issue link.

Handled mail gets the Gmail label jc-ppi/processed; mail without an
arXiv ID in the subject, replies ("Re: …") and automatic mail get
jc-ppi/skipped and no reply, for a maintainer to look at. Sender
addresses never reach the issue, and the Actions log is public, so
this prints counts and issue numbers only.

Python standard library only.

Environment:
  GMAIL_ADDRESS, GMAIL_APP_PASSWORD  The club Gmail account (secrets).
  GITHUB_TOKEN, GITHUB_REPOSITORY    To open issues and start the paper bot.
  DRY_RUN                            "true" only counts; nothing is changed.
"""

import email
import email.policy
import hashlib
import html
import imaplib
import json
import os
import re
import smtplib
import sys
import urllib.request
from email.message import EmailMessage
from email.utils import make_msgid, parseaddr
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# Field labels of .github/ISSUE_TEMPLATE/1-paper.yml and FIELDS in lib.js;
# tests/test_email_submissions.py checks they match.
FIELD_ARXIV = "arXiv ID or link"
FIELD_WHY = "Why this paper?"
FIELD_NAME = "Name to show on the site"

LABEL_PAPER = "paper"
LABEL_NEEDS_APPROVAL = "needs approval"
GMAIL_PROCESSED = "jc-ppi/processed"
GMAIL_SKIPPED = "jc-ppi/skipped"
MARKER = "<!-- jc-ppi:emailed {} -->"

MAX_PER_RUN = 20
MAX_WHY_CHARS = 2000
MAX_NAME_CHARS = 80

# ── Parsing (pure) ───────────────────────────────────────────

ARXIV_RE = re.compile(
    r"(?:arxiv\.org/(?:abs|pdf)/)?"
    r"(\d{3,4}\.\d{4,5}(?:v\d+)?|[a-z-]+(?:\.[A-Z]{2})?/\d{7}(?:v\d+)?)",
    re.IGNORECASE,
)


def find_arxiv_id(subject):
    """The first arXiv ID or link in a subject line, as written, or None."""
    m = ARXIV_RE.search(subject or "")
    return m.group(1) if m else None


def is_reply(subject):
    """True for replies, which are conversations rather than new papers."""
    return bool(re.match(r"\s*(re|aw|sv)\s*:", subject or "", re.IGNORECASE))


def html_to_text(markup):
    """Rough plain text from an HTML email body."""
    text = re.sub(r"(?is)<(script|style)\b.*?</\1>", "", markup)
    text = re.sub(r"(?i)<br\s*/?>|</p>|</div>|</li>", "\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    return html.unescape(text)


def clean_body(text):
    """The part of a body the sender wrote: no quoted reply, no signature."""
    lines = []
    for line in (text or "").replace("\r\n", "\n").split("\n"):
        if line.rstrip() in ("--", "-- "):
            break  # signature
        if re.match(r"\s*On .{0,200} wrote:\s*$", line):
            break  # the quoted message follows
        if line.lstrip().startswith(">"):
            continue
        lines.append(line.rstrip())
    body = re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()
    if len(body) > MAX_WHY_CHARS:
        body = body[: MAX_WHY_CHARS - 1].rstrip() + "…"
    return body


def message_text(msg):
    """A message's text: the text/plain part, else the HTML part as text."""
    for kind in ("plain", "html"):
        part = msg.get_body(preferencelist=(kind,))
        if part is None:
            continue
        try:
            content = part.get_content()
        except (LookupError, ValueError):  # unknown charset or broken encoding
            content = part.get_payload(decode=True).decode("utf-8", "replace")
        return content if kind == "plain" else html_to_text(content)
    return ""


def sender_name(msg):
    """The sender's display name, never their address; "Guest" without one."""
    name, address = parseaddr(str(msg.get("From", "")))
    name = re.sub(r"\s+", " ", name).strip().strip('"')
    if not name or "@" in name or name.lower() == address.lower():
        return "Guest"
    return name[:MAX_NAME_CHARS]


def is_automatic(msg):
    """True for bounces, auto-replies and mailing-list mail."""
    if str(msg.get("Auto-Submitted", "no")).lower() != "no":
        return True
    if msg.get("List-Id") or str(msg.get("Precedence", "")).lower() in ("bulk", "list", "junk"):
        return True
    _, address = parseaddr(str(msg.get("From", "")))
    return bool(re.match(r"(mailer-daemon|postmaster|no-?reply)@", address, re.IGNORECASE))


def safe_markdown(text):
    """External text made safe for an issue body, like safeText() in lib.js:
    no HTML, no @mentions, and no "### " lines that would break the form."""
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    text = text.replace("@", "@​")
    return re.sub(r"(?m)^(\s*)#", r"\1\\#", text)


def issue_body(arxiv, why, name, key):
    """An issue body in the paper form's layout, so the bot and site read it."""
    return "\n".join(
        [
            MARKER.format(key),
            f"### {FIELD_ARXIV}",
            "",
            safe_markdown(arxiv),
            "",
            f"### {FIELD_WHY}",
            "",
            safe_markdown(why) or "_No response_",
            "",
            f"### {FIELD_NAME}",
            "",
            safe_markdown(name),
            "",
        ]
    )


def message_key(msg):
    """A short, stable key for a message, to recognise it if it comes round again."""
    source = str(msg.get("Message-ID", "")) or (str(msg.get("Date", "")) + str(msg.get("Subject", "")))
    return hashlib.sha256(source.encode("utf-8")).hexdigest()[:16]


def approval_comment(name, maintainers):
    """The note on an emailed paper, asking the maintainers to approve it."""
    who = " ".join(f"@{m}" for m in maintainers)
    return (
        f"Brought by email by {safe_markdown(name)}. It shows on the website once a maintainer "
        f"approves it.\n\n{who}: to approve it, remove the `needs approval` label. Emailed papers "
        "always wait for approval."
    )


def reply_message(original, club_address, club_name, issue_url):
    """The reply to the sender, with the issue link."""
    reply = EmailMessage()
    reply["From"] = f"{club_name} <{club_address}>"
    reply["To"] = str(original.get("Reply-To") or original.get("From"))
    subject = str(original.get("Subject", "")).strip()
    reply["Subject"] = subject if is_reply(subject) else f"Re: {subject}"
    if original.get("Message-ID"):
        reply["In-Reply-To"] = str(original["Message-ID"])
        reply["References"] = str(original["Message-ID"])
    reply["Message-ID"] = make_msgid(domain=club_address.split("@")[-1])
    reply.set_content(
        "Thanks for bringing a paper!\n\n"
        f"It's here: {issue_url}\n\n"
        "A maintainer approves emailed papers before they show on the website, usually "
        "within a day. To bring another, send a new email with the arXiv ID or link as the "
        "subject and a line on why in the body.\n\n"
        f"— {club_name}\n"
    )
    return reply


def club_name():
    """CONFIG.clubName, read from site/assets/js/config.js."""
    text = (ROOT / "site" / "assets" / "js" / "config.js").read_text()
    return re.search(r"clubName:\s*'([^']+)'", text).group(1)


def maintainers():
    """GitHub usernames from .github/paper-maintainers.txt."""
    text = (ROOT / ".github" / "paper-maintainers.txt").read_text()
    return [l.split("#")[0].strip() for l in text.splitlines() if l.split("#")[0].strip()]


# ── GitHub ───────────────────────────────────────────────────


def github(method, path, token, repo, body=None):
    url = path if path.startswith("https://") else f"https://api.github.com/repos/{repo}{path}"
    req = urllib.request.Request(
        url,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        data = res.read()
        return json.loads(data) if data else None


def already_opened(token, repo, key):
    """The issue for this message, if an earlier run opened it already."""
    marker = MARKER.format(key)
    for issue in github("GET", f"/issues?labels={LABEL_PAPER}&state=all&per_page=100", token, repo):
        if marker in (issue.get("body") or ""):
            return issue
    return None


# ── Main ─────────────────────────────────────────────────────


def main():
    address = os.environ.get("GMAIL_ADDRESS", "")
    password = os.environ.get("GMAIL_APP_PASSWORD", "")
    token = os.environ.get("GITHUB_TOKEN", "")
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    dry_run = os.environ.get("DRY_RUN", "true") != "false"
    if not address or not password:
        sys.exit("Set the GMAIL_ADDRESS and GMAIL_APP_PASSWORD secrets.")
    if not dry_run and not (token and repo):
        sys.exit("GITHUB_TOKEN and GITHUB_REPOSITORY are needed to open issues.")

    imap = imaplib.IMAP4_SSL("imap.gmail.com")
    imap.login(address, password)
    for label in (GMAIL_PROCESSED, GMAIL_SKIPPED):
        imap.create(label)  # "already exists" is fine
    imap.select("INBOX")
    query = f'"in:inbox -label:{GMAIL_PROCESSED} -label:{GMAIL_SKIPPED} -from:me"'
    _, data = imap.uid("SEARCH", "X-GM-RAW", query)
    uids = data[0].split()[:MAX_PER_RUN]

    opened, skipped = [], 0
    for uid in uids:
        _, fetched = imap.uid("FETCH", uid, "(BODY.PEEK[])")
        msg = email.message_from_bytes(fetched[0][1], policy=email.policy.default)
        subject = str(msg.get("Subject", ""))
        arxiv = find_arxiv_id(subject)

        if not arxiv or is_reply(subject) or is_automatic(msg):
            skipped += 1
            if not dry_run:
                imap.uid("STORE", uid, "+X-GM-LABELS", f'("{GMAIL_SKIPPED}")')
            continue
        if dry_run:
            opened.append(None)
            continue

        key = message_key(msg)
        issue = already_opened(token, repo, key)
        if issue is None:
            name = sender_name(msg)
            team = maintainers()
            issue = github(
                "POST",
                "/issues",
                token,
                repo,
                {
                    "title": f"Paper: {arxiv}",
                    "body": issue_body(arxiv, clean_body(message_text(msg)), name, key),
                    "labels": [LABEL_PAPER, LABEL_NEEDS_APPROVAL],
                    "assignees": team,
                },
            )
            github("POST", f"/issues/{issue['number']}/comments", token, repo, {"body": approval_comment(name, team)})
            with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
                smtp.login(address, password)
                smtp.send_message(reply_message(msg, address, club_name(), issue["html_url"]))
        imap.uid("STORE", uid, "+X-GM-LABELS", f'("{GMAIL_PROCESSED}")')
        opened.append(issue["number"])

    imap.logout()
    print(f"{len(uids)} new emails: {len(opened)} papers, {skipped} skipped.")
    if dry_run:
        print('Dry run (DRY_RUN is not "false"): nothing was changed.')
        return
    if opened:
        print("Opened: " + ", ".join(f"#{n}" for n in opened))
        # Issues opened with the workflow token don't start other workflows,
        # so start the paper bot to fill in their metadata.
        github(
            "POST",
            "/actions/workflows/papers.yml/dispatches",
            token,
            repo,
            {"ref": "main", "inputs": {"scope": "open"}},
        )


if __name__ == "__main__":
    main()
