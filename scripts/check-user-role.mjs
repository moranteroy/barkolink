import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const email = process.argv[2]?.trim().toLowerCase()
if (!email) {
  console.error('Usage: node scripts/check-user-role.mjs <account-email>')
  process.exit(1)
}

initializeApp({
  credential: applicationDefault(),
  projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'barkolink-87e5e',
})

try {
  const user = await getAuth().getUserByEmail(email)
  console.log(`${user.email}: ${String(user.customClaims?.role || 'PASSENGER').toUpperCase()}`)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
