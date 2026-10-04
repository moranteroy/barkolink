import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getDataConnect } from 'firebase-admin/data-connect'

initializeApp({ credential: applicationDefault(), projectId: 'barkolink-87e5e' })
const dc = getDataConnect({ serviceId: 'barkolink-87e5e-service', location: 'asia-southeast1', connector: 'staff' })
const variables = { startAt: '2026-09-30T16:00:00Z', endAt: '2026-10-31T16:00:00Z' }
const impersonate = { authClaims: { sub: 'reports-verification', role: 'ADMIN' } }
const source = readFileSync('dataconnect/staff/reports.gql','utf8')
const result = process.argv.includes('--deployed')
  ? await dc.executeQuery('AdminReports', variables, { impersonate })
  : await dc.executeGraphqlRead(source, { variables, impersonate })
assert.ok(Array.isArray(result.data.sailings))
const expected = await dc.executeGraphqlRead(`query Verify($startAt: Timestamp!, $endAt: Timestamp!) @auth(expr: "auth.token.role == 'ADMIN'") {
  totals: _selectFirst(sql: """
    SELECT count(*) AS bookings,
      COALESCE(sum(b.total) FILTER (WHERE b.payment_status = 'PAID'),0) AS collected,
      COALESCE(sum(b.total) FILTER (WHERE b.payment_status = 'UNPAID' AND b.status IN ('PENDING','CONFIRMED')),0) AS pending
    FROM booking b JOIN sailing s ON s.code = b.sailing_code
    WHERE s.departure_at >= $1::timestamptz AND s.departure_at < $2::timestamptz
  """, params: [$startAt,$endAt])
}`, { variables, impersonate })
const sum = key => result.data.sailings.reduce((n,s) => n + Number(s[key]),0)
assert.equal(sum('bookingCount'),Number(expected.data.totals.bookings))
assert.equal(sum('collectedRevenue'),Number(expected.data.totals.collected))
assert.equal(sum('pendingRevenue'),Number(expected.data.totals.pending))
for (const s of result.data.sailings) {
  assert.equal(Number(s.regular)+Number(s.student)+Number(s.senior)+Number(s.child)+Number(s.pwd),Number(s.paidPassengers))
  assert.ok(Number(s.boarded) <= Number(s.checkedIn) && Number(s.checkedIn) <= Number(s.paidPassengers))
}
await assert.rejects(() => dc.executeGraphqlRead(source, { variables, impersonate: { unauthenticated: true } }))
console.log('Reports verified against independent database totals:', { sailings: result.data.sailings.length, bookings: sum('bookingCount'), collected: sum('collectedRevenue'), pending: sum('pendingRevenue'), adminOnly: true })
