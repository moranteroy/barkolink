import { randomBytes } from 'node:crypto'
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getDataConnect } from 'firebase-admin/data-connect'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

initializeApp()

const auth = getAuth()
const sqlConnect = getDataConnect({
  serviceId: 'barkolink-87e5e-service',
  location: 'asia-southeast1',
})

const insertUserProfile = `
  mutation CreateManagedUserProfile(
    $uid: String!, $email: String!, $fullName: String!, $role: String!, $phone: String
  ) {
    user_insert(data: {
      uid_expr: "vars.uid"
      email: $email
      fullName: $fullName
      phone: $phone
      role: $role
    }) { uid }
  }
`

const roleOptions = new Set(['PASSENGER', 'TICKETING', 'BOARDING'])

function requireText(value, label, maxLength) {
  if (typeof value !== 'string') throw new HttpsError('invalid-argument', `${label} is required.`)
  const text = value.trim()
  if (!text || text.length > maxLength) throw new HttpsError('invalid-argument', `${label} must be between 1 and ${maxLength} characters.`)
  return text
}

export const createManagedUser = onCall({ region: 'asia-southeast1', maxInstances: 5 }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in with an administrator account first.')
  if (String(request.auth.token.role || '').toUpperCase() !== 'ADMIN') {
    throw new HttpsError('permission-denied', 'Only administrators can create accounts.')
  }

  const fullName = requireText(request.data?.fullName, 'Full name', 120)
  const email = requireText(request.data?.email, 'Email', 254).toLowerCase()
  const password = requireText(request.data?.password, 'Temporary password', 128)
  const role = requireText(request.data?.role, 'Role', 20).toUpperCase()
  const phone = typeof request.data?.phone === 'string' && request.data.phone.trim()
    ? request.data.phone.trim().slice(0, 40)
    : null

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpsError('invalid-argument', 'Enter a valid email address.')
  if (password.length < 8) throw new HttpsError('invalid-argument', 'Temporary password must be at least 8 characters.')
  if (!roleOptions.has(role)) throw new HttpsError('invalid-argument', 'Choose Passenger, Ticketing Staff, or Boarding Staff.')

  let newUser
  try {
    newUser = await auth.createUser({ email, password, displayName: fullName, phoneNumber: phone || undefined })
    await auth.setCustomUserClaims(newUser.uid, { role })
    await sqlConnect.executeGraphql(insertUserProfile, {
      operationName: 'CreateManagedUserProfile',
      variables: { uid: newUser.uid, email, fullName, role, phone },
    })
  } catch (error) {
    if (newUser) {
      try { await auth.deleteUser(newUser.uid) } catch { /* best-effort rollback for a partially created account */ }
    }
    if (error instanceof HttpsError) throw error
    if (error?.code === 'auth/email-already-exists') throw new HttpsError('already-exists', 'An account already uses this email address.')
    console.error('createManagedUser failed', error)
    throw new HttpsError('internal', 'Could not create the account. Please try again.')
  }

  return { uid: newUser.uid, email, fullName, role }
})

export const generateTemporaryPassword = onCall({ region: 'asia-southeast1', maxInstances: 5 }, async request => {
  if (!request.auth || String(request.auth.token.role || '').toUpperCase() !== 'ADMIN') {
    throw new HttpsError('permission-denied', 'Only administrators can generate account passwords.')
  }
  return { password: randomBytes(18).toString('base64url') }
})
