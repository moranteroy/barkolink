import { describe, expect, it } from 'vitest'
import { accountRequestError } from '../../src/data/accountErrors'
describe('account errors', () => {
  it('explains unreachable backend and session failures', () => {
    expect(accountRequestError({ code: 'functions/internal', message: 'internal' }, 'Fallback')).toContain('service is unavailable')
    expect(accountRequestError({ code: 'functions/unavailable' }, 'Fallback')).toContain('service is unavailable')
    expect(accountRequestError({ code: 'functions/unauthenticated' }, 'Fallback')).toContain('Sign in again')
  })
  it('preserves actionable backend messages', () => {
    expect(accountRequestError({ code: 'functions/already-exists', message: 'An account already uses this email address.' }, 'Fallback')).toBe('An account already uses this email address.')
    expect(accountRequestError(null, 'Fallback')).toBe('Fallback')
  })
})
