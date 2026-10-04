export function dataConnectRequestError(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') return fallback
  const { code, message } = error as { code?: string; message?: string }
  const detail = `${code || ''} ${message || ''}`
  if (/unauthenticated|requires a signed-in user/i.test(detail)) {
    return 'Your session has expired. Sign in again, then retry.'
  }
  if (/PERMISSION_DENIED|permission-denied|@auth rejected|unauthorized/i.test(detail)) {
    return 'Access was denied. Sign in again to refresh your session. If this continues, contact the administrator to check your account permissions.'
  }
  return message || fallback
}
