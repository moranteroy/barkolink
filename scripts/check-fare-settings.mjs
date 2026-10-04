import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getDataConnect } from 'firebase-admin/data-connect'

initializeApp({ credential: applicationDefault(), projectId: 'barkolink-87e5e' })
const dc = getDataConnect({ serviceId: 'barkolink-87e5e-service', location: 'asia-southeast1', connector: 'staff' })
try {
  const result = await dc.executeQuery('AdminFareSettings', {}, { impersonate: { authClaims: { sub: 'fare-settings-check', role: 'ADMIN' } } })
  if (result.errors?.length) throw new Error('The fare settings query returned errors.')
  if (!Array.isArray(result.data?.vesselFareSettings)) throw new Error('Vessel-specific fare settings are missing from the deployed query.')
  console.log(`Admin fare settings query succeeded: ${result.data.vesselFareSettings.length} vessel(s) have saved rates.`)
  let denied = false
  try { await dc.executeQuery('AdminFareSettings', {}, { impersonate: { unauthenticated: true } }) }
  catch { denied = true }
  if (!denied) throw new Error('Unauthenticated fare settings access was not rejected.')
  console.log('Unauthenticated access was rejected.')
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Fare settings verification failed.')
  process.exitCode = 1
}
