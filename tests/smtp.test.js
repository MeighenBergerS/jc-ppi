/**
 * smtp.test.js — Tests for the minimal SMTP client in scripts/papers/smtp.js.
 * Run with: node --test tests/smtp.test.js
 *
 * sendMail() talks to a fake SMTP server on localhost over plain TCP.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, connect } from 'node:net';

import { isEmail, encodeHeader, formatMessage, sendMail } from '../scripts/papers/smtp.js';

const msg = (over = {}) => ({
  from: 'club@example.org',
  fromName: 'Iowa Particles & Plots Journal Club',
  to: 'alice@example.org',
  subject: 'Your September 2026 at journal club',
  text: 'Hello ✓\nSecond line\n',
  date: new Date('2026-10-01T15:00:00Z'),
  ...over,
});

/** Decodes the base64 body of a formatted message. */
const bodyOf = (data) =>
  Buffer.from(data.split('\r\n\r\n')[1].replace(/\r\n/g, ''), 'base64').toString('utf8');

// ── Addresses and headers ─────────────────────────────────────

describe('isEmail', () => {
  it('accepts plain addresses', () => {
    assert.equal(isEmail('alice@example.org'), true);
    assert.equal(isEmail('a.b+jc@uiowa.edu'), true);
  });

  it('rejects anything that could break a header', () => {
    for (const bad of [
      '',
      null,
      'alice',
      'a@b',
      'a b@c.org',
      'a@c.org\r\nBcc: x@y.org',
      '<a@c.org>',
    ]) {
      assert.equal(isEmail(bad), false, JSON.stringify(bad));
    }
  });
});

describe('encodeHeader', () => {
  it('leaves ASCII alone and encodes the rest', () => {
    assert.equal(encodeHeader('Plain subject'), 'Plain subject');
    assert.equal(encodeHeader('Über'), `=?utf-8?B?${Buffer.from('Über').toString('base64')}?=`);
  });
});

describe('formatMessage', () => {
  it('writes the headers and a base64 UTF-8 body with CRLF line ends', () => {
    const data = formatMessage(msg());
    const [head] = data.split('\r\n\r\n');
    assert.deepEqual(head.split('\r\n'), [
      'From: "Iowa Particles & Plots Journal Club" <club@example.org>',
      'To: <alice@example.org>',
      'Subject: Your September 2026 at journal club',
      'Date: Thu, 01 Oct 2026 15:00:00 GMT',
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: base64',
    ]);
    assert.equal(bodyOf(data), 'Hello ✓\r\nSecond line\r\n');
  });

  it('wraps the body at 76 characters', () => {
    const data = formatMessage(msg({ text: 'x'.repeat(500) }));
    const lines = data.split('\r\n\r\n')[1].split('\r\n').filter(Boolean);
    assert.ok(lines.every((l) => l.length <= 76));
  });

  it('keeps new lines out of the subject', () => {
    const data = formatMessage(msg({ subject: 'Hi\r\nBcc: x@y.org' }));
    assert.match(data, /^Subject: Hi Bcc: x@y\.org\r$/m);
  });

  it('throws on an address that is not plain', () => {
    assert.throws(() => formatMessage(msg({ to: 'a@b.org\r\nBcc: x@y.org' })));
  });
});

// ── sendMail against a fake server ────────────────────────────

/**
 * A fake SMTP server. `refuse` maps a recipient to a reply code for RCPT TO.
 * Resolves to { port, log, messages, close }.
 */
function fakeServer({ refuse = {}, authCode = 235 } = {}) {
  const log = [];
  const messages = [];
  const server = createServer((socket) => {
    let buffer = '';
    let inData = false;
    let data = [];
    const reply = (line) => socket.write(`${line}\r\n`);
    reply('220 fake ESMTP');
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let i;
      while ((i = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, i);
        buffer = buffer.slice(i + 2);
        if (inData) {
          if (line === '.') {
            inData = false;
            messages.push(data.join('\r\n'));
            data = [];
            reply('250 queued');
          } else data.push(line);
          continue;
        }
        log.push(line);
        const [verb] = line.split(/[ :]/);
        if (verb === 'EHLO') reply('250-fake\r\n250-AUTH PLAIN\r\n250 SMTPUTF8');
        else if (verb === 'AUTH') reply(`${authCode} auth`);
        else if (verb === 'MAIL') reply('250 ok');
        else if (verb === 'RCPT') {
          const to = line.match(/<(.*)>/)[1];
          reply(`${refuse[to] ?? 250} rcpt`);
        } else if (verb === 'DATA') {
          inData = true;
          reply('354 go ahead');
        } else if (verb === 'RSET') reply('250 reset');
        else if (verb === 'QUIT') {
          reply('221 bye');
          socket.end();
        } else reply('500 what');
      }
    });
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({
        port: server.address().port,
        log,
        messages,
        close: () => new Promise((r) => server.close(r)),
      })
    )
  );
}

const plain = (host, port) => connect(port, host);

describe('sendMail', () => {
  it('logs in once and sends every message', async () => {
    const server = await fakeServer();
    try {
      const result = await sendMail({
        host: '127.0.0.1',
        port: server.port,
        user: 'club@example.org',
        pass: 'secret',
        messages: [msg(), msg({ to: 'bob@example.org' })],
        connect: plain,
      });
      assert.deepEqual(result, { sent: 2, failed: [] });
      assert.equal(server.messages.length, 2);
      assert.equal(bodyOf(server.messages[0]), 'Hello ✓\r\nSecond line\r\n');
      const auth = server.log.find((l) => l.startsWith('AUTH PLAIN '));
      assert.equal(Buffer.from(auth.slice(11), 'base64').toString(), '\0club@example.org\0secret');
      assert.deepEqual(
        server.log.filter((l) => l.startsWith('RCPT')),
        ['RCPT TO:<alice@example.org>', 'RCPT TO:<bob@example.org>']
      );
      assert.equal(server.log.at(-1), 'QUIT');
    } finally {
      await server.close();
    }
  });

  it('reports a refused or invalid recipient and sends the rest', async () => {
    const server = await fakeServer({ refuse: { 'gone@example.org': 550 } });
    try {
      const result = await sendMail({
        host: '127.0.0.1',
        port: server.port,
        user: 'club@example.org',
        pass: 'secret',
        messages: [msg({ to: 'gone@example.org' }), msg({ to: 'not an address' }), msg()],
        connect: plain,
      });
      assert.deepEqual(result, {
        sent: 1,
        failed: [
          { index: 0, code: 550 },
          { index: 1, code: 0 },
        ],
      });
      assert.ok(server.log.includes('RSET'));
      assert.equal(server.messages.length, 1);
    } finally {
      await server.close();
    }
  });

  it('throws on a failed login without the password in the error', async () => {
    const server = await fakeServer({ authCode: 535 });
    try {
      await assert.rejects(
        sendMail({
          host: '127.0.0.1',
          port: server.port,
          user: 'club@example.org',
          pass: 'secret',
          messages: [msg()],
          connect: plain,
        }),
        (err) => err.message === 'SMTP AUTH: 535'
      );
      assert.equal(server.messages.length, 0);
    } finally {
      await server.close();
    }
  });
});
