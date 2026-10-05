import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  client: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(), getUser: vi.fn(), signUp: vi.fn(), signInWithPassword: vi.fn(), signOut: vi.fn(), resetPasswordForEmail: vi.fn(), updateUser: vi.fn() } },
}))
vi.mock('../../src/services/supabase', () => ({ supabase: mocks.client, requireSupabase: () => mocks.client }))
const user = { id: 'account-id', email: 'user@example.com', user_metadata: { fullName: 'Passenger', role: 'ADMIN' }, app_metadata: {} }

describe('Supabase authentication', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.client.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    mocks.client.auth.signOut.mockResolvedValue({ error: null })
  })
  it('restores an existing session before guarded navigation', async () => {
    mocks.client.auth.getSession.mockResolvedValue({ data: { session: { user } }, error: null })
    const { auth } = await import('../../src/services/auth')
    await auth!.ready()
    expect(auth!.currentUser?.uid).toBe('account-id')
  })
  it('handles email confirmation without creating a signed-in session', async () => {
    mocks.client.auth.signUp.mockResolvedValue({ data: { user, session: null }, error: null })
    const { registerAccount, requireAuth } = await import('../../src/services/auth')
    const result = await registerAccount(requireAuth(), user.email, 'Test-password123', 'Passenger')
    expect(result.session).toBeNull()
    expect(requireAuth().currentUser).toBeNull()
    expect(mocks.client.auth.signUp).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ data: { fullName: 'Passenger' } }) }))
  })
  it('ignores editable user metadata when resolving account permissions', async () => {
    mocks.client.auth.signInWithPassword.mockResolvedValue({ data: { user }, error: null })
    mocks.client.auth.getUser.mockResolvedValue({ data: { user }, error: null })
    const { signInWithPassword, requireAuth } = await import('../../src/services/auth')
    const result = await signInWithPassword(requireAuth(), user.email, 'Test-password123')
    expect((await result.user.getRoleSession()).claims.role).toBe('PASSENGER')
    mocks.client.auth.getUser.mockResolvedValue({ data: { user: { ...user, app_metadata: { role: 'TICKETING' } } }, error: null })
    expect((await result.user.getRoleSession()).claims.role).toBe('TICKETING')
  })
  it('rejects expired sessions and propagates sign-in failures', async () => {
    mocks.client.auth.signInWithPassword.mockResolvedValueOnce({ data: { user }, error: null })
    mocks.client.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('Expired') })
    const { signInWithPassword, requireAuth } = await import('../../src/services/auth')
    const result = await signInWithPassword(requireAuth(), user.email, 'Test-password123')
    await expect(result.user.getRoleSession()).rejects.toThrow('Expired')
    mocks.client.auth.signInWithPassword.mockResolvedValue({ data: {}, error: new Error('Invalid credentials') })
    await expect(signInWithPassword(requireAuth(), user.email, 'wrong')).rejects.toThrow('Invalid credentials')
  })
  it('sends recovery links to the dedicated password reset page and clears sessions on logout', async () => {
    mocks.client.auth.resetPasswordForEmail.mockResolvedValue({ error: null })
    mocks.client.auth.signInWithPassword.mockResolvedValue({ data: { user }, error: null })
    const { sendPasswordResetEmail, signInWithPassword, signOut, requireAuth } = await import('../../src/services/auth')
    await signInWithPassword(requireAuth(), user.email, 'Test-password123')
    await sendPasswordResetEmail(requireAuth(), user.email)
    expect(mocks.client.auth.resetPasswordForEmail).toHaveBeenCalledWith(user.email, { redirectTo: `${location.origin}/reset-password` })
    await signOut(requireAuth())
    expect(requireAuth().currentUser).toBeNull()
  })
})
