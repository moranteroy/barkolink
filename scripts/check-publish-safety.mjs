import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

// Local pre-publish guard. Reports locations/categories only, never secret values.
const mode = process.argv[2] || 'index';
if (!['working', 'index', 'history'].includes(mode))
  throw new Error('Use working, index, or history.');
// --git-only inspects repository blobs without reading local environment/credential files.
const gitOnly = process.argv.includes('--git-only');
function git(args, input) {
  const result = spawnSync('git', args, { input, windowsHide: true, maxBuffer: 128 * 1024 * 1024 });
  if (result.status !== 0)
    throw new Error('Git inventory/read failed; secret-bearing output was suppressed.');
  return result.stdout;
}
const knownSecrets = new Set();
for (const file of gitOnly
  ? []
  : fs.readdirSync('.').filter((file) => file.startsWith('.env') && file !== '.env.example')) {
  if (!fs.statSync(file).isFile()) continue;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_]\w*)\s*=\s*(.*?)\s*$/);
    if (!match || !/(KEY|TOKEN|SECRET|PASSWORD)/i.test(match[1])) continue;
    const value = match[2].replace(/^['"]|['"]$/g, '');
    if (value.length >= 12) knownSecrets.add(value);
  }
}
const staffReceipt = '.audit/batangas-staff-credentials.json';
if (!gitOnly && fs.existsSync(staffReceipt))
  for (const account of JSON.parse(fs.readFileSync(staffReceipt, 'utf8')))
    if (account.password) knownSecrets.add(account.password);
const rules = [
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{35,})\b/g],
  ['Supabase private token/key', /\b(?:sbp_[a-f0-9]{32,}|sb_secret_[A-Za-z0-9_-]{20,})\b/g],
  [
    'payment secret key',
    /\b(?:sk_live_[A-Za-z0-9]{20,}|sk_test_[A-Za-z0-9]{20,}|rk_live_[A-Za-z0-9]{20,})\b/g,
  ],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ['Google API key', /\bAIza[A-Za-z0-9_-]{35}\b/g],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/g],
  [
    'credential in connection URL',
    /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s/:"']+:[^\s/@"']+@/g,
  ],
];
const forbidden =
  /(?:^|\/)(?:\.audit|\.backups|node_modules|dist|\.aws|\.ssh|\.codex|\.agents)(?:\/|$)|(?:^|\/)\.env(?!\.example$)(?:\.|$)|(?:^|\/)(?:credentials\.json|service-account[^/]*\.json|[^/]*firebase-adminsdk[^/]*\.json)|\.(?:pem|key|p12|pfx|jks|keystore|tfstate|apk|aab)$/i;
const findings = [];
let scanned = 0,
  totalBytes = 0;
function scan(file, bytes, object) {
  scanned++;
  totalBytes += bytes.length;
  const location = object ? `${file} [${object.slice(0, 12)}]` : file;
  if (forbidden.test(file))
    findings.push({ file: location, category: 'private/generated file path' });
  if (
    mode !== 'history' &&
    /(?:^|\/)\.env|(?:^|\/)docs\/research\/|(?:^|\/)chapter[- _]?[13](?:\D|$)|\.(?:docx?|docm|dotx?|dotm)$|barkolink-(?:feature-screenshots|system-overview)/i.test(
      file,
    )
  )
    findings.push({
      file: location,
      category: 'excluded local environment or presentation document',
    });
  if (bytes.includes(0)) return;
  const content = bytes.toString('utf8');
  for (const secret of knownSecrets)
    if (content.includes(secret))
      findings.push({ file: location, category: 'matches a local credential value' });
  for (const [category, pattern] of rules) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern))
      findings.push({
        file: location,
        line: content.slice(0, match.index).split('\n').length,
        category,
      });
  }
  for (const match of content.matchAll(
    /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{20,}\b/g,
  )) {
    try {
      const payload = JSON.parse(Buffer.from(match[0].split('.')[1], 'base64url').toString());
      findings.push({
        file: location,
        line: content.slice(0, match.index).split('\n').length,
        category:
          payload.role === 'service_role' ? 'service-role JWT' : 'embedded JWT (review required)',
      });
    } catch {
      /* Not an encoded JSON JWT. */
    }
  }
}
function scanObjects(objects) {
  if (!objects.length) return;
  const batch = git(['cat-file', '--batch'], objects.map((item) => item.object).join('\n') + '\n');
  let offset = 0;
  for (const item of objects) {
    const newline = batch.indexOf(10, offset);
    if (newline < 0) throw new Error('Incomplete Git object header.');
    const header = batch.subarray(offset, newline).toString().split(' ');
    const size = Number(header[2]);
    if (header[0] !== item.object || header[1] !== 'blob' || !Number.isSafeInteger(size))
      throw new Error('Unexpected Git object; scan stopped.');
    const start = newline + 1,
      end = start + size;
    if (end >= batch.length || batch[end] !== 10) throw new Error('Incomplete Git object body.');
    scan(item.file, batch.subarray(start, end), mode === 'history' ? item.object : undefined);
    offset = end + 1;
  }
  if (offset !== batch.length) throw new Error('Unexpected trailing Git data.');
}
if (mode === 'history') {
  const objects = git(['rev-list', '--objects', '--all'])
    .toString()
    .trim()
    .split('\n')
    .filter(Boolean);
  const inventory = git(
    ['cat-file', '--batch-check=%(objectname) %(objecttype)'],
    objects.map((line) => line.split(' ')[0]).join('\n') + '\n',
  )
    .toString()
    .trim()
    .split('\n');
  const blobs = [];
  for (let i = 0; i < objects.length; i++)
    if (inventory[i]?.endsWith(' blob')) {
      const split = objects[i].indexOf(' '),
        object = objects[i].slice(0, split),
        file = objects[i].slice(split + 1);
      blobs.push({ file, object });
    }
  scanObjects(blobs);
} else if (mode === 'index') {
  const entries = git(['ls-files', '--stage', '-z'])
    .toString()
    .split('\0')
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(/^(\d+) ([a-f0-9]+) (\d)\t([\s\S]+)$/);
      if (!match || match[3] !== '0' || match[1] === '160000')
        throw new Error('Index contains an unresolved entry or submodule; review required.');
      return { object: match[2], file: match[4] };
    });
  scanObjects(entries);
} else {
  const files = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard'])
    .toString()
    .split('\0')
    .filter(Boolean);
  for (const file of new Set(files)) {
    if (mode === 'working' && !fs.existsSync(file)) continue;
    const bytes = fs.readFileSync(file);
    scan(file, bytes);
  }
}
const result = { mode, scanned, totalBytes, findings, checkedAt: new Date().toISOString() };
fs.mkdirSync('.audit', { recursive: true });
fs.writeFileSync(`.audit/publish-safety-${mode}.json`, JSON.stringify(result, null, 2));
console.log(
  JSON.stringify(
    {
      ...result,
      findings: findings.slice(0, 30),
      findingsCount: findings.length,
      reportPath: `.audit/publish-safety-${mode}.json`,
    },
    null,
    2,
  ),
);
if (findings.length) process.exitCode = 1;
