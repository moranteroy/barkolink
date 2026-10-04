export type AccountRole = 'PASSENGER' | 'TICKETING' | 'BOARDING' | 'ADMIN'

export function resolveAccountRole(claim: unknown, profileRole?: string | null): AccountRole {
  // Staff access is granted by the backend's token claims, not the SQL profile.
  if (claim) {
    if (['PASSENGER', 'TICKETING', 'BOARDING', 'ADMIN'].includes(String(claim))) return claim as AccountRole
    throw new Error('Your account has an invalid access role. Contact the administrator.')
  }
  if (profileRole === 'PASSENGER') return 'PASSENGER'
  if (profileRole) throw new Error('Your staff access is not configured in Firebase Authentication. Contact the administrator to synchronize your account role, then sign in again.')
  throw new Error('Your account profile was not found. Sign in again to finish account setup.')
}

export function roleDestination(role: AccountRole): string {
  return { PASSENGER: '/home', TICKETING: '/staff/ticketing', BOARDING: '/staff/boarding', ADMIN: '/admin' }[role]
}
