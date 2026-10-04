import assert from 'node:assert/strict'
import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getDataConnect } from 'firebase-admin/data-connect'

async function checkBoarding() {
  initializeApp({ credential: applicationDefault(), projectId: 'barkolink-87e5e' })
  const dc = getDataConnect({ serviceId: 'barkolink-87e5e-service', location: 'asia-southeast1', connector: 'staff' })
  const result = await dc.executeQuery('AdminPassengerRecords', {}, { impersonate: { authClaims: { sub: 'boarding-query-check', role: 'ADMIN' } } })
  const checkedInBySailingStatus = {}
  for (const passenger of result.data.bookingPassengers) {
    assert.equal(typeof passenger.booking.sailing.status, 'string', 'The admin query must return sailing status.')
    if (passenger.ticketStatus === 'CHECKED_IN' && passenger.booking.status === 'CONFIRMED' && passenger.booking.paymentStatus === 'PAID') {
      const status = passenger.booking.sailing.status
      checkedInBySailingStatus[status] = (checkedInBySailingStatus[status] || 0) + 1
    }
  }
  console.log('Deployed admin boarding query verified. Checked-in paid passengers by sailing status:', checkedInBySailingStatus)
}

checkBoarding().catch(error => {
  console.error(error instanceof Error ? error.message : 'Admin boarding verification failed.')
  process.exitCode = 1
})
