import assert from 'node:assert/strict'
import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getDataConnect } from 'firebase-admin/data-connect'
initializeApp({ credential: applicationDefault(), projectId: 'barkolink-87e5e' })
const dc = getDataConnect({ serviceId: 'barkolink-87e5e-service', location: 'asia-southeast1', connector: 'staff' })
const impersonate = { authClaims: { sub: 'manifest-verification', role: 'ADMIN' } }
const reports = await dc.executeQuery('AdminReports', { startAt: '2026-09-30T16:00:00Z', endAt: '2026-10-31T16:00:00Z' }, { impersonate })
let total = 0
for (const sailing of reports.data.sailings) {
  let count = 0
  for (let offset = 0; ; offset += 500) {
    const result = await dc.executeQuery('AdminExportManifest', { sailingCode: sailing.code, offset }, { impersonate })
    count += result.data.bookingPassengers.length
    assert.ok(result.data.bookingPassengers.every(p => p.booking.sailing.code === sailing.code))
    if (result.data.bookingPassengers.length < 500) break
  }
  assert.equal(count, Number(sailing.paidPassengers))
  total += count
}
await assert.rejects(() => dc.executeQuery('AdminExportManifest', { sailingCode: 'MISSING', offset: 0 }, { impersonate: { unauthenticated: true } }))
console.log('Deployed manifest export verified:', { sailings: reports.data.sailings.length, paidConfirmedPassengers: total, adminOnly: true })
