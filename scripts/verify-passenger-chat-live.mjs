import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright-core';

const env = (file) =>
  Object.fromEntries(
    fs
      .readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .flatMap((line) => {
        const m = line.match(/^([A-Z_0-9]+)\s*=\s*(.*)$/);
        return m ? [[m[1], m[2].trim().replace(/^['"]|['"]$/g, '')]] : [];
      }),
  );
const config = env('.env.local'),
  management = env('.env.supabase-management');
const project = new URL(config.VITE_SUPABASE_URL).hostname.split('.')[0];
if (project !== 'utobfkfmuepuoseszxks') throw new Error('Unexpected test project.');
const response = await fetch(`https://api.supabase.com/v1/projects/${project}/api-keys`, {
  headers: { Authorization: `Bearer ${management.SUPABASE_ACCESS_TOKEN}` },
  signal: AbortSignal.timeout(30000),
});
if (!response.ok)
  throw new Error(`Could not obtain server-only test administration (${response.status}).`);
const keys = await response.json();
const secret =
  keys.find((k) => k.name === 'service_role')?.api_key ||
  keys.find((k) => k.type === 'secret')?.api_key;
if (!secret) throw new Error('Server-only test administration unavailable.');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(config.VITE_SUPABASE_URL, secret, options);
const client = createClient(
  config.VITE_SUPABASE_URL,
  config.VITE_SUPABASE_PUBLISHABLE_KEY || config.VITE_SUPABASE_ANON_KEY,
  options,
);
const root = path.resolve('dist');
const securityHeaders = JSON.parse(fs.readFileSync('vercel.json', 'utf8')).headers[0].headers;
const server = http.createServer((request, reply) => {
  const candidate = path.resolve(root, '.' + new URL(request.url, 'http://localhost').pathname);
  if (!candidate.startsWith(root + path.sep)) {
    reply.writeHead(404).end();
    return;
  }
  const file =
    fs.existsSync(candidate) && fs.statSync(candidate).isFile()
      ? candidate
      : path.join(root, 'index.html');
  const mime = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
  };
  for (const header of securityHeaders) reply.setHeader(header.key, header.value);
  reply.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  reply.end(fs.readFileSync(file));
});
let uid,
  browser,
  started = false;
try {
  const email = `chat-verification-${randomUUID()}@example.invalid`,
    password = randomBytes(24).toString('base64url');
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: 'PASSENGER' },
    user_metadata: { fullName: 'Temporary chatbot verification' },
  });
  if (created.error || !created.data.user)
    throw new Error('Could not create disposable passenger test account.');
  uid = created.data.user.id;
  console.log('Disposable passenger created for live chatbot verification; no email sent.');
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error || !signed.data.session) throw new Error('Disposable passenger sign-in failed.');
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  started = true;
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = [];
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addInitScript(
      ({ key, session }) => {
        localStorage.setItem(key, JSON.stringify(session));
        localStorage.setItem('barkolink-theme', 'dark');
      },
      { key: `sb-${project}-auth-token`, session: signed.data.session },
    );
    const page = await context.newPage(),
      errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/assistant`);
    const box = page.locator('#chat-question');
    await box.waitFor();
    assert.equal(await box.isEditable(), true);
    const question =
      width === 390
        ? 'Puwede bang i-scan ang screenshot ng QR ticket ko? Paano ito vine-verify?'
        : 'How do I pay for my booking?';
    await box.fill(question);
    assert.equal(await box.inputValue(), question);
    if (width === 390) {
      await box.press('Shift+Enter');
      assert.ok((await box.inputValue()).includes('\n'));
      await page.getByRole('button', { name: 'Send question', exact: true }).click();
    } else await box.press('Enter');
    await page.waitForFunction(
      () => document.querySelector('.chat-turn.assistant') || document.querySelector('.chat-error'),
      {},
      { timeout: 70000 },
    );
    const error = (await page.locator('.chat-error').count())
      ? await page.locator('.chat-error').textContent()
      : null;
    if (error) throw new Error(`Live ${width}px chat failed: ${error}`);
    assert.equal(
      await page.locator('.setup-note').count(),
      0,
      'The response must come from configured AI.',
    );
    const answer = (
      await page.locator('.chat-turn.assistant .message-body').last().textContent()
    )?.trim();
    assert.ok(answer && answer.length > 30, 'A meaningful live answer must be rendered.');
    if (width === 390)
      assert.doesNotMatch(
        answer,
        /screenshots? (?:are|is) (?:not accepted|not allowed|invalid)|hindi (?:tinatanggap|pinapayagan) (?:ang )?screenshots?|bawal (?:ang )?screenshot/i,
        'Do not invent a blanket screenshot ban.',
      );
    assert.ok(
      (await page.locator('.source-details').count()) > 0,
      'Live answer must include verified sources.',
    );
    assert.equal(await box.isEditable(), true);
    assert.deepEqual(errors, []);
    const turn = page.locator('.chat-turn.assistant').last();
    await turn.scrollIntoViewIfNeeded();
    fs.mkdirSync('.audit/chatbot-live', { recursive: true });
    await turn.screenshot({ path: `.audit/chatbot-live/answer-${width}.png` });
    results.push({
      width,
      typed: true,
      submit: width === 390 ? 'button; Shift+Enter preserved newline' : 'Enter',
      configuredAI: true,
      answer: answer.slice(0, 800),
      sources: await page.locator('.source-details').count(),
    });
    console.log(JSON.stringify(results.at(-1)));
    await context.close();
  }
  fs.writeFileSync(
    '.audit/chatbot-live/results.json',
    JSON.stringify({ project, results }, null, 2),
  );
} finally {
  await browser?.close();
  if (started) await new Promise((resolve) => server.close(resolve));
  if (uid) {
    await client.auth.signOut({ scope: 'local' });
    const removed = await admin.auth.admin.deleteUser(uid);
    if (removed.error)
      throw new Error('Disposable test account cleanup failed; follow-up required.');
    const profile = await admin.from('app_user').delete().eq('uid', uid);
    if (profile.error) throw new Error('Disposable profile cleanup failed; follow-up required.');
    console.log('Disposable test account, session, profile and chatbot allowance removed.');
  }
}
