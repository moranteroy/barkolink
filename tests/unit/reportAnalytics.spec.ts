import { describe, expect, it } from 'vitest'
import { decodeReports, groupedReports, manilaDay, reportCsv, reportNumberFields, reportPercentage, reportRange, reportTotals, revenueTrend, type ReportSailing } from '../../src/data/reportAnalytics'

export function sailing(overrides: Partial<ReportSailing> = {}): ReportSailing {
  return { ...Object.fromEntries(reportNumberFields.map(k => [k, 0])), code: 'TRP1', departureAt: '2026-10-02T16:00:00Z', status: 'SCHEDULED', originId: 'a', origin: 'A', destinationId: 'b', destination: 'B', vesselId: 'v1', vessel: 'Ferry', ...overrides } as ReportSailing
}
describe('report analytics', () => {
  it('uses inclusive Philippine dates with an exclusive next-day end', () => {
    expect(reportRange('2026-10-02', '2026-10-02')).toEqual({ startAt: '2026-10-01T16:00:00.000Z', endAt: '2026-10-02T16:00:00.000Z' })
    expect(manilaDay(new Date('2026-10-02T16:00:00Z'))).toBe('2026-10-03')
  })
  it('rejects reversed, impossible, blank, and excessive dates', () => {
    for (const [a,b] of [['2026-10-03','2026-10-02'],['2026-02-30','2026-03-01'],['','2026-10-02'],['2025-01-01','2026-01-02']]) expect(() => reportRange(a,b)).toThrow()
    expect(() => reportRange('2024-01-01','2024-12-31')).not.toThrow()
  })
  it('decodes numeric SQL strings without treating missing data as zero', () => {
    expect(decodeReports([{ ...sailing(), bookingCount: '123' }])[0].bookingCount).toBe(123)
    expect(() => decodeReports(null)).toThrow()
    expect(() => decodeReports([{ ...sailing(), capacity: null }])).toThrow()
    expect(() => decodeReports([{ ...sailing(), capacity: -1 }])).toThrow()
  })
  it('sums every record and calculates occupancy from combined capacity', () => {
    const rows = [sailing({ capacity: 10, reservedSeats: 10, collectedRevenue: 100 }), sailing({ capacity: 90, reservedSeats: 0, collectedRevenue: 200 })]
    const t = reportTotals(rows)
    expect(t.collectedRevenue).toBe(300)
    expect(reportPercentage(t.reservedSeats,t.capacity)).toBe(10)
    expect(reportTotals(Array.from({ length: 1200 }, () => sailing({ bookingCount: 1 }))).bookingCount).toBe(1200)
    expect(reportPercentage(0,0)).toBe(0)
  })
  it('keeps directional routes and different vessels separate', () => {
    const rows = [sailing({ collectedRevenue: 100 }),sailing({ originId: 'b', destinationId: 'a', vesselId: 'v2', collectedRevenue: 200 })]
    expect(groupedReports(rows,'route')).toHaveLength(2)
    expect(groupedReports(rows,'vessel')[0].totals.collectedRevenue).toBe(200)
  })
  it('fills missing daily periods and assigns midnight to the Philippine day', () => {
    expect(revenueTrend([sailing({ collectedRevenue: 500 })], '2026-10-02','2026-10-04').points).toEqual([{ date: '2026-10-02', revenue: 0 },{ date: '2026-10-03', revenue: 500 },{ date: '2026-10-04', revenue: 0 }])
  })
  it('preserves revenue in weekly and monthly buckets', () => {
    for (const end of ['2026-11-30','2026-12-31']) {
      const trend = revenueTrend([sailing({ collectedRevenue: 500 })], '2026-01-01',end)
      expect(trend.mode).toBe('Monthly')
      expect(trend.points.reduce((sum,p) => sum+p.revenue,0)).toBe(500)
    }
    expect(revenueTrend([], '2026-10-01','2026-11-02').mode).toBe('Weekly')
  })
  it('escapes CSV quotes and spreadsheet formulas', () => {
    expect(reportCsv(['Name','PHP'],[['=CMD()',123],['Ferry "A"',0]])).toBe('\ufeff"Name","PHP"\r\n"\'=CMD()","123"\r\n"Ferry ""A""","0"')
  })
})
