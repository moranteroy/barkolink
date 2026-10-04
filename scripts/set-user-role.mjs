import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const [emailArg, roleArg] = process.argv.slice(2)
const allowedRoles = new Set(['PASSENGER', 'TICKETING', 'BOARDING', 'ADMIN'])
const email = emailArg?.trim().toLowerCase()
const role = roleArg?.trim().toUpperCase()

if (!email || !role || !allowedRoles.has(role)) {
  console.error('Usage: node scripts/set-user-role.mjs <account-email> <PASSENGER|TICKETING|BOARDING|ADMIN>')
  process.exit(1)
}

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'barkolink-87e5e'
const projectRoot = fileURLToPath(new URL('../', import.meta.url))
initializeApp({ credential: applicationDefault(), projectId })

let user
try {
  const auth = getAuth()
  user = await auth.getUserByEmail(email)
  await auth.setCustomUserClaims(user.uid, { ...user.customClaims, role })
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

const tempDir = mkdtempSync(join(tmpdir(), 'barkolink-role-'))
try {
  const varsPath = join(tempDir, 'variables.json')
  writeFileSync(varsPath, JSON.stringify({ uid: user.uid, role }), 'utf8')
  const firebaseCli = resolve(projectRoot, 'node_modules/firebase-tools/lib/bin/firebase.js')
  const childEnv = { ...process.env, CI: '1', NO_UPDATE_NOTIFIER: '1' }
  delete childEnv.XDG_CONFIG_HOME
  delete childEnv.DEBUG
  delete childEnv.FIREBASE_DEBUG_MODE
  execFileSync(process.execPath, [
    firebaseCli,
    'dataconnect:execute',
    'dataconnect/admin/manage_user_role.gql',
    'SetUserRole',
    '--vars',
    `@${varsPath}`,
    '--project',
    projectId,
    '--non-interactive',
  ], { cwd: projectRoot, env: childEnv, stdio: 'inherit' })
  console.log(`Assigned ${role} to ${email} in Firebase Authentication and PostgreSQL.`)
} catch (error) {
  console.error('The Firebase Auth role was set, but the PostgreSQL role update failed. Re-run this command after fixing the SQL Connect error.')
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
