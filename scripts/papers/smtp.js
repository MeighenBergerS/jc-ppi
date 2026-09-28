/* ============================================================
   scripts/papers/smtp.js — Minimal SMTP client for plain emails
   ============================================================
   Sends plain-text UTF-8 emails over implicit TLS (Gmail:
   smtp.gmail.com, port 465) with AUTH PLAIN, without npm
   dependencies. Used by roundup-email.js.
   ============================================================ */

import { connect as tlsConnect } from 'node:tls';

const EMAIL_RE = /^[^\s<>()@,;:"\\]+@[^\s<>()@,;:"\\]+\.[^\s<>()@,;:"\\]+$/;

/** True for a plain address (user@example.org) that is safe in a header. */
export function isEmail(text) {
  return EMAIL_RE.test(text ?? '');
}

/** A header value, RFC 2047-encoded when it isn't plain ASCII. */
export function encodeHeader(text) {
  if (/^[\x20-\x7e]*$/.test(text)) return text;
  return `=?utf-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`;
}

/**
 * A complete message (headers and base64 body, CRLF line ends) ready for DATA.
 * @param {{from: string, fromName?: string, to: string, subject: string, text: string, date?: Date}} msg
 */
export function formatMessage({ from, fromName = '', to, subject, text, date = new Date() }) {
  for (const address of [from, to]) {
    if (!isEmail(address)) throw new Error('Not a plain email address');
  }
  const name = fromName.replace(/["\\\r\n]/g, '');
  const sender = /^[\x20-\x7e]*$/.test(name) ? `"${name}"` : encodeHeader(name);
  const body = Buffer.from(text.replace(/\r?\n/g, '\r\n'), 'utf8')
    .toString('base64')
    .replace(/.{1,76}/g, '$&\r\n');
  return [
    `From: ${name ? `${sender} ` : ''}<${from}>`,
    `To: <${to}>`,
    `Subject: ${encodeHeader(subject.replace(/[\r\n]+/g, ' '))}`,
    `Date: ${date.toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    body,
  ].join('\r\n');
}

/** Reads SMTP replies ("250-..." continuation lines, then "250 ...") from a socket. */
function _replyReader(socket) {
  let buffer = '';
  let lines = [];
  const ready = [];
  const waiting = [];
  let failure = null;

  const settle = (reply) => (waiting.length ? waiting.shift().resolve(reply) : ready.push(reply));
  socket.setEncoding('utf8');
  socket.on('data', (chunk) => {
    buffer += chunk;
    let i;
    while ((i = buffer.indexOf('\r\n')) !== -1) {
      const line = buffer.slice(0, i);
      buffer = buffer.slice(i + 2);
      lines.push(line);
      if (/^\d{3}(?: |$)/.test(line)) {
        settle({ code: Number(line.slice(0, 3)), text: lines.join('\n') });
        lines = [];
      }
    }
  });
  const fail = (err) => {
    failure = err;
    while (waiting.length) waiting.shift().reject(err);
  };
  socket.on('error', fail);
  socket.on('close', () => fail(new Error('SMTP connection closed')));

  return () => {
    if (ready.length) return Promise.resolve(ready.shift());
    if (failure) return Promise.reject(failure);
    return new Promise((resolve, reject) => waiting.push({ resolve, reject }));
  };
}

/**
 * Sends messages over one SMTP connection. A message the server refuses is
 * reported in `failed` and the rest are still sent; a login or connection
 * failure throws.
 * @param {{host: string, port: number, user: string, pass: string,
 *          messages: {from, fromName?, to, subject, text}[], connect?: Function}} options
 *   `connect(host, port)` returns a connected socket; the default is TLS.
 * @returns {Promise<{sent: number, failed: {index: number, code: number}[]}>}
 *   `code` is the server's reply code, or 0 for a message that was not valid.
 */
export async function sendMail({ host, port, user, pass, messages, connect }) {
  const socket = connect
    ? connect(host, port)
    : tlsConnect({ host, port, servername: host, minVersion: 'TLSv1.2' });
  const next = _replyReader(socket);

  // `label` names the command in errors, so the password never appears in one.
  async function command(line, expect, label = line.split(' ')[0]) {
    if (line !== null) socket.write(`${line}\r\n`);
    const reply = await next();
    if (!expect.includes(reply.code)) {
      const err = new Error(`SMTP ${label}: ${reply.code}`);
      err.code = reply.code;
      throw err;
    }
    return reply;
  }

  const result = { sent: 0, failed: [] };
  try {
    await command(null, [220], 'greeting');
    await command('EHLO jc-ppi', [250]);
    const token = Buffer.from(`\0${user}\0${pass}`, 'utf8').toString('base64');
    await command(`AUTH PLAIN ${token}`, [235], 'AUTH');

    for (const [index, msg] of messages.entries()) {
      let data;
      try {
        data = formatMessage(msg);
      } catch {
        result.failed.push({ index, code: 0 }); // not sent: a bad address
        continue;
      }
      try {
        await command(`MAIL FROM:<${msg.from}>`, [250]);
        await command(`RCPT TO:<${msg.to}>`, [250, 251]);
        await command('DATA', [354]);
        await command(`${data}\r\n.`, [250], 'message');
        result.sent++;
      } catch (err) {
        if (!err.code) throw err;
        result.failed.push({ index, code: err.code });
        await command('RSET', [250]);
      }
    }
    await command('QUIT', [221]);
  } finally {
    socket.end();
  }
  return result;
}
