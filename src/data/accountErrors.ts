export function accountRequestError(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') return fallback
  const detail = error as { code?: string; message?: string }
  const code = detail.code?.replace(/^functions\//, '')
  if (code === 'unauthenticated') return 'Your session has expired. Sign in again to manage accounts.'
  if (code === 'permission-denied') return 'Only administrators can manage accounts.'
  if (code === 'unavailable' || code === 'deadline-exceeded' || (code === 'internal' && (!detail.message || detail.message.toLowerCase() === 'internal'))) {
    return 'The account service is unavailable. Please try again shortly.'
  }
  return detail.message && detail.message.toLowerCase() !== 'internal' ? detail.message : fallback
}
