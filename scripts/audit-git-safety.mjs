import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

// Reports locations/types only. Never print matched credential values or blob contents.
function git(args, input) {
  const result = spawnSync('git', args, { input, maxBuffer: 256 * 1024 * 1024 })
  if (result.status !== 0) throw new Error(`Git read failed: ${args[0]} (${result.error?.code || result.status}); response omitted.`)
  return result.stdout
}
const privateValues = []
for (const file of fs.readdirSync('.').filter(name => name.startsWith('.env') && name !== '.env.example')) {
  if (!fs.existsSync(file)) continue
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z_0-9]*)\s*=\s*(.+)$/)
    if (match && /TOKEN|PASSWORD|SECRET|SERVICE_ROLE|KEY/.test(match[1]) && !match[1].startsWith('VITE_')) {
      const value = match[2].trim().replace(/^['"]|['"]$/g, '')
      if (value.length >= 8) privateValues.push(value)
    }
  }
}
if (process.env.BARKOLINK_DEMO_PASSWORD) privateValues.push(process.env.BARKOLINK_DEMO_PASSWORD)
const forbidden = filename => /(^|\/)(node_modules|\.backups|\.audit|\.aws|\.ssh|\.codex|\.agents|\.vercel|dist|coverage)(\/|$)/.test(filename)
  || /(^|\/)\.env(?!\.example$)(?:\.|$)/.test(filename)
  || /^docs\/screenshots\//.test(filename)
  || /(?:\.apk|\.aab|\.keystore|\.jks|\.p12|\.pfx|\.log)$/.test(filename)
  || /^android\/.*(?:\/build\/|\/assets\/public\/|\/assets\/capacitor\.)/.test(filename)
  || /^android\/local\.properties$/.test(filename)
const patterns = [
  ['Supabase management token', /sbp_[a-zA-Z0-9]{20,}/g],
  ['Supabase secret key', /sb_secret_[a-zA-Z0-9_-]{12,}/g],
  ['PayMongo secret key', /sk_(?:test|live)_[a-zA-Z0-9]{24,}/g],
  ['GitHub token', /(?:gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{30,})/g],
  ['AWS access key identifier', /(?:AKIA|ASIA)[A-Z0-9]{16}/g],
  ['Slack token', /xox[baprs]-[A-Za-z0-9-]{20,}/g],
  ['Hosted database password URL', /postgres(?:ql)?:\/\/[^\s/:]+:[^\s@]{8,}@(?!localhost|127\.0\.0\.1)[^\s/'"]+/g],
  ['AWS secret access key', /aws_secret_access_key[\s"']*[:=][\s"']*[A-Za-z0-9+/]{40}/gi],
  ['Private key material', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],
]
function scan(buffer) {
  const text = buffer.toString('utf8')
  const found = new Set()
  for (const value of privateValues) if (text.includes(value)) found.add('Exact configured private value')
  for (const [label, pattern] of patterns) { pattern.lastIndex = 0; if (pattern.test(text)) found.add(label) }
  for (const match of text.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
    try {
      const claims = JSON.parse(Buffer.from(match[0].split('.')[1], 'base64url').toString('utf8'))
      if (claims.role === 'service_role') found.add('Privileged service-role JWT')
    } catch { /* Ignore placeholder JWTs and unrelated examples. */ }
  }
  return [...found]
}
const scope = process.argv[2] || 'origin/main'
const tree = git(['ls-tree', '-r', '--name-only', scope]).toString('utf8').trim().split('\n').filter(Boolean)
const candidates = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']).toString('utf8').split('\0').filter(Boolean)
const working = [], forbiddenWorking = []
for (const file of candidates) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue
  if (forbidden(file)) forbiddenWorking.push(file)
  for (const type of scan(fs.readFileSync(file))) working.push({ file, type })
}
// An index blob can differ from both HEAD and the current file on disk.
const index = git(['ls-files', '--stage', '-z']).toString('utf8').split('\0').filter(Boolean).map(entry => {
  const at = entry.indexOf('\t'); const [, oid, stage] = entry.slice(0, at).split(' ');
  return { oid, stage, file: entry.slice(at + 1) };
})
const indexFindings = [], forbiddenIndexPaths = []
for (const entry of index) {
  if (forbidden(entry.file)) forbiddenIndexPaths.push(entry.file)
  for (const type of scan(git(['cat-file', 'blob', entry.oid]))) indexFindings.push({ file: entry.file, stage: entry.stage, type })
}
const objects = git(['rev-list', '--objects', '--all']).toString('utf8').trim().split('\n').map(line => {
  const at = line.indexOf(' '); return { oid: at < 0 ? line : line.slice(0, at), file: at < 0 ? '' : line.slice(at + 1) }
})
const metadata = git(['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'], objects.map(obj => obj.oid).join('\n') + '\n').toString('utf8').trim().split('\n')
const blobs = metadata.flatMap((line, i) => line.split(' ')[1] === 'blob' ? [{ ...objects[i], size: Number(line.split(' ')[2]) }] : [])
const batch = git(['cat-file', '--batch'], blobs.map(obj => obj.oid).join('\n') + '\n')
const history = [], vendorExamples = []
let completeVendorKeys = 0
let offset = 0
for (const blob of blobs) {
  const end = batch.indexOf(10, offset)
  const header = batch.subarray(offset, end).toString('utf8').split(' ')
  const size = Number(header[2]); offset = end + 1
  if (header[0] !== blob.oid || !Number.isFinite(size)) throw new Error('Unexpected Git batch response.')
  const contents = batch.subarray(offset, offset + size); offset += size + 1
  for (const type of scan(contents)) {
    const record = { file: blob.file, blob: blob.oid.slice(0, 12), type }
    if (blob.file.includes('node_modules/') && type === 'Private key material') {
      const normalized = contents.toString('utf8').replaceAll('\\n', '\n').replaceAll('\\r', '\r')
      const complete = /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----\s+[A-Za-z0-9+/=\r\n]{64,}\s+-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/.test(normalized)
      if (complete) { completeVendorKeys++; history.push(record) }
      else vendorExamples.push({ ...record, type: 'SDK private-key format marker or documentation placeholder; no complete key' })
    }
    else history.push(record)
  }
}
const report = {
  scope, currentRemoteFiles: tree.length, remoteForbiddenPaths: tree.filter(forbidden),
  remoteDependencyFiles: tree.filter(file => file.includes('node_modules/')).length,
  eligibleWorkingFiles: candidates.length, forbiddenWorkingPaths: forbiddenWorking, workingFindings: working,
  indexFilesScanned: index.length, forbiddenIndexPaths, indexFindings, historyScope: 'all local and fetched remote refs',
  historyBlobsScanned: blobs.length, historyFindings: history, historicalVendorPatternFindings: vendorExamples,
  historyDependencyBlobs: blobs.filter(blob => blob.file.includes('node_modules/')).length,
  completeHistoricalVendorPrivateKeys: completeVendorKeys,
  exactPrivateValuesChecked: privateValues.length,
}
fs.mkdirSync('.audit', { recursive: true })
fs.writeFileSync(path.join('.audit', 'git-safety-report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report))
if (working.length || history.length || report.remoteForbiddenPaths.length || forbiddenWorking.length || indexFindings.length || forbiddenIndexPaths.length) process.exitCode = 2
