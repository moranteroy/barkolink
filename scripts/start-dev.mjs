import { spawn, execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

const root = fileURLToPath(new URL('../', import.meta.url))
const children = []
let closing = false
function stop(code = 0) {
  if (closing) return
  closing = true
  process.exitCode = code
  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue
    if (process.platform === 'win32') execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true }, () => {})
    else child.kill('SIGTERM')
  }
}
function launch(relativePath, args = []) {
  const child = spawn(process.execPath, [fileURLToPath(new URL(relativePath, import.meta.url)), ...args], { cwd: root, stdio: 'inherit', windowsHide: true })
  children.push(child)
  child.on('error', error => { console.error(error.message); stop(1) })
  child.on('exit', code => { if (!closing) stop(code ?? 1) })
  return child
}
async function backendReady() {
  try {
    const response = await fetch('http://127.0.0.1:5001/barkolink-87e5e/asia-southeast1/generateTemporaryPassword', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: null }), signal: AbortSignal.timeout(1500),
    })
    const body = await response.json()
    return response.status === 403 && body.error?.status === 'PERMISSION_DENIED'
  } catch { return false }
}
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
try {
  if (!await backendReady()) {
    console.log('Starting account management backend…')
    launch('./start-functions-emulator.mjs')
    const deadline = Date.now() + 60000
    while (!closing && !await backendReady()) {
      if (Date.now() > deadline) throw new Error('Account backend did not start. Check the Functions emulator output above.')
      await delay(500)
    }
  } else console.log('Using the account management backend already running on port 5001.')
  if (!closing) launch('../node_modules/vite/bin/vite.js', process.argv.slice(2))
} catch (error) { console.error(error.message); stop(1) }
