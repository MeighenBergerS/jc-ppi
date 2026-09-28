"""
test_email_submissions.py — Tests for scripts/papers/email_submissions.py.
Run with: python3 -m unittest discover -s tests -p "test_*.py"
(npm test runs it too.)
"""

import email
import email.policy
import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "papers"))

import email_submissions as es  # noqa: E402


def message(raw):
    return email.message_from_string(raw.lstrip(), policy=email.policy.default)


def parse_issue_form(body):
    """The paper bot's own parser, parseIssueForm() in lib.js, run in Node."""
    script = (
        "import('./scripts/papers/lib.js').then((m) => "
        "console.log(JSON.stringify(m.parseIssueForm(process.argv[1]))))"
    )
    out = subprocess.run(
        ["node", "-e", script, body], cwd=ROOT, capture_output=True, text=True, check=True
    )
    return json.loads(out.stdout)


PLAIN = """
From: Jane Doe <jane@example.org>
To: club@example.org
Subject: 2609.12345
Message-ID: <abc@example.org>
Content-Type: text/plain; charset=utf-8

A neat result on sterile neutrinos, @everyone should see it.

--
Jane Doe
PhD student
"""


class FieldLabels(unittest.TestCase):
    def test_match_the_issue_form_and_lib_js(self):
        form = (ROOT / ".github" / "ISSUE_TEMPLATE" / "1-paper.yml").read_text()
        lib = (ROOT / "scripts" / "papers" / "lib.js").read_text()
        for label in (es.FIELD_ARXIV, es.FIELD_WHY):
            self.assertIn(f"label: {label}", form)
        for label in (es.FIELD_ARXIV, es.FIELD_WHY, es.FIELD_NAME):
            self.assertIn(f"'{label}'", lib)

    def test_club_name_comes_from_config(self):
        self.assertEqual(es.club_name(), "Iowa Particles & Plots Journal Club")


class FindArxivId(unittest.TestCase):
    def test_bare_ids_and_links(self):
        cases = {
            "2609.12345": "2609.12345",
            "Paper: 2609.12345v2 please": "2609.12345v2",
            "https://arxiv.org/abs/2301.00001": "2301.00001",
            "arxiv.org/pdf/2301.00001v3": "2301.00001v3",
            "hep-ph/9901123": "hep-ph/9901123",
            "708.1137": "708.1137",
        }
        for subject, want in cases.items():
            self.assertEqual(es.find_arxiv_id(subject), want, subject)

    def test_none_without_an_id(self):
        for subject in ("", "Hello", "Question about Friday", None):
            self.assertIsNone(es.find_arxiv_id(subject))

    def test_replies(self):
        self.assertTrue(es.is_reply("Re: 2609.12345"))
        self.assertTrue(es.is_reply("  RE:hello"))
        self.assertFalse(es.is_reply("2609.12345"))
        self.assertFalse(es.is_reply("Relic abundance 2609.12345"))


class Bodies(unittest.TestCase):
    def test_signature_and_quotes_are_dropped(self):
        body = es.clean_body(
            "Great paper.\n\n> quoted line\nSecond line.\n\nOn Mon, Jane wrote:\n> old\n"
        )
        self.assertEqual(body, "Great paper.\n\nSecond line.")
        self.assertEqual(es.clean_body("Why.\n-- \nJane"), "Why.")

    def test_long_bodies_are_cut(self):
        self.assertEqual(len(es.clean_body("x" * 5000)), es.MAX_WHY_CHARS)

    def test_plain_part_preferred(self):
        msg = message(PLAIN)
        self.assertIn("sterile neutrinos", es.message_text(msg))

    def test_html_only(self):
        msg = message(
            """
From: a@example.org
Subject: 2609.12345
Content-Type: text/html; charset=utf-8

<p>Nice <b>result</b> &amp; clear.</p><script>x()</script>
"""
        )
        self.assertEqual(es.clean_body(es.message_text(msg)), "Nice result & clear.")


class Senders(unittest.TestCase):
    def test_display_name_never_address(self):
        self.assertEqual(es.sender_name(message(PLAIN)), "Jane Doe")
        self.assertEqual(es.sender_name(message("From: jane@example.org\n\nx")), "Guest")
        self.assertEqual(
            es.sender_name(message('From: "jane@example.org" <jane@example.org>\n\nx')), "Guest"
        )

    def test_automatic_mail(self):
        self.assertTrue(es.is_automatic(message("From: x@y.org\nAuto-Submitted: auto-replied\n\nx")))
        self.assertTrue(es.is_automatic(message("From: MAILER-DAEMON@y.org\n\nx")))
        self.assertTrue(es.is_automatic(message("From: x@y.org\nList-Id: <l.y.org>\n\nx")))
        self.assertFalse(es.is_automatic(message(PLAIN)))


class IssueBody(unittest.TestCase):
    def test_form_layout_the_bot_reads(self):
        body = es.issue_body("2609.12345", "Why.\n\nTwo lines.", "Jane Doe", "k1")
        self.assertTrue(body.startswith("<!-- jc-ppi:emailed k1 -->"))
        self.assertEqual(
            parse_issue_form(body),
            {
                es.FIELD_ARXIV: "2609.12345",
                es.FIELD_WHY: "Why.\n\nTwo lines.",
                es.FIELD_NAME: "Jane Doe",
            },
        )

    def test_external_text_is_made_safe(self):
        body = es.issue_body(
            "2609.12345", "<img src=x> @everyone\n### Fake field", "<b>Eve</b>", "k"
        )
        self.assertNotIn("<img", body)
        self.assertNotIn("<b>", body)
        self.assertNotIn(" @everyone", body)
        self.assertIn("\\### Fake field", body)
        # The bot still sees exactly the three real fields
        self.assertEqual(
            sorted(parse_issue_form(body)), sorted([es.FIELD_ARXIV, es.FIELD_WHY, es.FIELD_NAME])
        )

    def test_empty_why(self):
        self.assertIn("_No response_", es.issue_body("2609.12345", "", "Guest", "k"))

    def test_message_key_is_stable(self):
        msg = message(PLAIN)
        self.assertEqual(es.message_key(msg), es.message_key(message(PLAIN)))
        self.assertEqual(len(es.message_key(msg)), 16)


class Reply(unittest.TestCase):
    def test_threads_and_links_the_issue(self):
        reply = es.reply_message(
            message(PLAIN), "club@example.org", "The Club", "https://github.com/o/r/issues/9"
        )
        self.assertEqual(reply["To"], "Jane Doe <jane@example.org>")
        self.assertEqual(reply["Subject"], "Re: 2609.12345")
        self.assertEqual(reply["In-Reply-To"], "<abc@example.org>")
        self.assertIn("https://github.com/o/r/issues/9", reply.get_content())

    def test_approval_comment_mentions_maintainers_only(self):
        text = es.approval_comment("@Eve", ["alice"])
        self.assertIn("@alice", text)
        self.assertNotIn(" @Eve", text)
        self.assertIn("needs approval", text)


if __name__ == "__main__":
    unittest.main()
