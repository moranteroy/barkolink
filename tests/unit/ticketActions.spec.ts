import { describe, expect, it } from 'vitest'
import { ticketActionBlockReason, ticketRequestError } from '../../src/data/ticketActions'

const ticket = () => ({ ticketStatus: 'CHECKED_IN', booking: { status: 'CONFIRMED', paymentStatus: 'PAID', sailing: { code: 'TRP2026-1002001', status: 'BOARDING', departureAt: '2026-10-02T08:00:00Z' } } })
describe('gate eligibility', () => {
  it('allows a checked-in paid confirmed passenger when the trip is boarding', () => {
    expect(ticketActionBlockReason(ticket(), 'boarding')).toBe('')
  })
  it.each(['SCHEDULED', 'DELAYED', 'COMPLETED'])('blocks boarding on a %s trip', status => {
    const record = ticket(); record.booking.sailing.status = status
    expect(ticketActionBlockReason(record, 'boarding')).toContain('Set trip TRP2026-1002001 to BOARDING')
  })
  it('blocks unpaid, cancelled, unchecked, and already-boarded tickets', () => {
    const unpaid = ticket(); unpaid.booking.paymentStatus = 'UNPAID'
    const cancelled = ticket(); cancelled.booking.status = 'CANCELLED'
    const issued = ticket(); issued.ticketStatus = 'ISSUED'
    const boarded = ticket(); boarded.ticketStatus = 'BOARDED'
    for (const record of [unpaid, cancelled, issued, boarded]) expect(ticketActionBlockReason(record, 'boarding')).not.toBe('')
  })
  it('matches the backend check-in cutoff and active sailing rules', () => {
    const record = ticket(); record.ticketStatus = 'ISSUED'; record.booking.sailing.status = 'SCHEDULED'
    expect(ticketActionBlockReason(record, 'check-in', new Date('2026-10-02T07:00:00Z'))).toBe('')
    expect(ticketActionBlockReason(record, 'check-in', new Date('2026-10-02T08:00:00Z'))).toContain('departed')
    record.booking.sailing.status = 'BOARDING'
    expect(ticketActionBlockReason(record, 'check-in', new Date('2026-10-02T08:00:00Z'))).toBe('')
    record.booking.sailing.status = 'COMPLETED'
    expect(ticketActionBlockReason(record, 'check-in')).not.toBe('')
  })
  it('extracts useful server messages without rollback noise', () => {
    const error = new Error('DataConnect error while performing request: [{"message":"(aborted)"},{"message":"Open boarding first. (aborted)\\n(rolled back)"}]')
    expect(ticketRequestError(error, 'Try again.')).toBe('Open boarding first.')
    expect(ticketRequestError(new Error('DataConnect error: invalid'), 'Try again.')).toBe('Try again.')
    expect(ticketRequestError(new Error('Network unavailable.'), 'Try again.')).toBe('Network unavailable.')
  })
})
