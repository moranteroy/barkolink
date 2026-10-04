import { describe, expect, it } from 'vitest'
import { resolveAccountRole, roleDestination } from '../../src/data/sessionRole'
import { dataConnectRequestError } from '../../src/data/dataConnectErrors'

describe('session permissions', () => {
  it('requires a matching token role for staff access', () => {
    for (const role of ['ADMIN', 'TICKETING', 'BOARDING'] as const) {
      expect(resolveAccountRole(role)).toBe(role)
      expect(() => resolveAccountRole(undefined, role)).toThrow('not configured in Firebase Authentication')
    }
    expect(() => resolveAccountRole('admin')).toThrow('invalid access role')
    expect(resolveAccountRole('PASSENGER', 'ADMIN')).toBe('PASSENGER')
  })
  it('supports passengers registered without custom claims and rejects missing profiles', () => {
    expect(resolveAccountRole(undefined, 'PASSENGER')).toBe('PASSENGER')
    expect(() => resolveAccountRole(undefined, null)).toThrow('profile was not found')
    expect(roleDestination('ADMIN')).toBe('/admin')
    expect(roleDestination('BOARDING')).toBe('/staff/boarding')
    expect(roleDestination('TICKETING')).toBe('/staff/ticketing')
    expect(roleDestination('PASSENGER')).toBe('/home')
  })
  it('explains the reported Firebase 403 without displaying backend JSON', () => {
    const error = new Error(JSON.stringify({ error: { code: 403, message: 'unauthorized: you are not authorized to perform this operation', status: 'PERMISSION_DENIED', details: [{ message: '@auth rejected the request' }] } }))
    expect(dataConnectRequestError(error, 'Fallback')).toContain('Sign in again')
    expect(dataConnectRequestError(error, 'Fallback')).not.toContain('@auth')
    expect(dataConnectRequestError({ code: 'unauthenticated' }, 'Fallback')).toContain('session has expired')
    expect(dataConnectRequestError(new Error('No seats available.'), 'Fallback')).toBe('No seats available.')
    expect(dataConnectRequestError(null, 'Fallback')).toBe('Fallback')
  })
})
