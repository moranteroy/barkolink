const textFields = ['code', 'departureAt', 'status', 'originId', 'origin', 'destinationId', 'destination', 'vesselId', 'vessel'] as const
export const reportNumberFields = ['capacity', 'reservedSeats', 'bookingCount', 'paidBookings', 'pendingBookings', 'cancelledBookings', 'collectedRevenue', 'pendingRevenue', 'onlineBookings', 'walkInBookings', 'activePassengers', 'paidPassengers', 'checkedIn', 'boarded', 'regular', 'student', 'senior', 'child', 'pwd'] as const
export type ReportSailing = Record<typeof textFields[number], string> & Record<typeof reportNumberFields[number], number>
export type ReportTotals = Record<typeof reportNumberFields[number], number>
export function decodeReports(value: unknown): ReportSailing[] {
  if (!Array.isArray(value)) throw new Error('The report data is unavailable. Try Refresh.')
  return value.map(item => {
    if (!item || typeof item !== 'object') throw new Error('Invalid report data received.')
    const row = {} as ReportSailing
    for (const key of textFields) {
      if (typeof item[key] !== 'string') throw new Error(`Missing report field: ${key}.`)
      row[key] = item[key]
    }
    if (!Number.isFinite(new Date(row.departureAt).getTime())) throw new Error('Invalid report departure date.')
    for (const key of reportNumberFields) {
      const number = Number(item[key])
      if (item[key] == null || !Number.isFinite(number) || number < 0) throw new Error(`Invalid report total: ${key}.`)
      row[key] = number
    }
    return row
  })
}
export function reportTotals(rows: ReportSailing[]): ReportTotals {
  const totals = Object.fromEntries(reportNumberFields.map(key => [key, 0])) as ReportTotals
  for (const row of rows) for (const key of reportNumberFields) totals[key] += row[key]
  return totals
}
export function reportPercentage(numerator: number, denominator: number) {
  return denominator ? Math.round(numerator / denominator * 100) : 0
}
export function manilaDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const part = (type: string) => parts.find(item => item.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
export function shiftDay(day: string, offset: number) {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}
export function reportRange(start: string, end: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) throw new Error('Choose a start and end date.')
  const days = (new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / 86400000 + 1
  if (!Number.isFinite(days) || shiftDay(start, 0) !== start || shiftDay(end, 0) !== end) throw new Error('Choose valid calendar dates.')
  if (!Number.isFinite(days) || days < 1 || days > 366) throw new Error('Choose an ordered date range of up to 366 days.')
  return { startAt: new Date(`${start}T00:00:00+08:00`).toISOString(), endAt: new Date(`${shiftDay(end, 1)}T00:00:00+08:00`).toISOString() }
}
export function groupedReports(rows: ReportSailing[], by: 'route' | 'vessel') {
  const groups = new Map<string, { key: string; label: string; rows: ReportSailing[] }>()
  for (const row of rows) {
    const key = by === 'route' ? `${row.originId}:${row.destinationId}` : row.vesselId
    const label = by === 'route' ? `${row.origin} → ${row.destination}` : row.vessel
    if (!groups.has(key)) groups.set(key, { key, label, rows: [] })
    groups.get(key)!.rows.push(row)
  }
  return [...groups.values()].map(group => ({ ...group, totals: reportTotals(group.rows) })).sort((a, b) => b.totals.collectedRevenue - a.totals.collectedRevenue || a.label.localeCompare(b.label))
}
export function revenueTrend(rows: ReportSailing[], start: string, end: string) {
  const days = (Date.parse(end) - Date.parse(start)) / 86400000 + 1
  const mode = days > 120 ? 'Monthly' : days > 31 ? 'Weekly' : 'Daily'
  const bucket = (day: string) => {
    if (mode === 'Monthly') return day.slice(0, 7)
    if (mode === 'Daily') return day
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay()
    return shiftDay(day, -(weekday === 0 ? 6 : weekday - 1))
  }
  const totals = new Map<string, number>()
  for (let day = start; day <= end; day = shiftDay(day, 1)) totals.set(bucket(day), 0)
  for (const row of rows) {
    const key = bucket(manilaDay(new Date(row.departureAt)))
    if (totals.has(key)) totals.set(key, totals.get(key)! + row.collectedRevenue)
  }
  return { mode, points: [...totals].map(([date, revenue]) => ({ date, revenue })) }
}
export function reportCsv(headers: string[], rows: (string | number)[][]) {
  const cell = (value: string | number) => {
    const text = typeof value === 'string' && /^[=+\-@\t\r]/.test(value) ? `'${value}` : String(value)
    return `"${text.replaceAll('"', '""')}"`
  }
  return '\ufeff' + [headers, ...rows].map(row => row.map(cell).join(',')).join('\r\n')
}
