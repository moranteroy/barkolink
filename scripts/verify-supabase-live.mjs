import fs from 'node:fs'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const values = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(line => line.includes('=') && !line.startsWith('#')).map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]))
const url = values.VITE_SUPABASE_URL
const key = values.VITE_SUPABASE_PUBLISHABLE_KEY || values.VITE_SUPABASE_ANON_KEY
const client = createClient(url, key, { auth: { persistSession: false } })
for (const operation of ['BrowseActivePorts', 'BrowseSailings']) {
  const { data, error } = await client.rpc('barkolink_execute', { operation, args: {} })
  assert.equal(error, null, `${operation} should be publicly readable`)
  assert.ok(data && typeof data === 'object')
  console.log(`${operation}: passed`)
}
for (const operation of ['MyBookings', 'AdminUsers', 'StaffBookings', 'ActiveAdvisories', 'AdminAdvisories', 'MySavedTravelers', 'MyMarkAllNotificationsRead', 'AdminTripOperations', 'AdminReconcileNoShows', 'AdminAuditLog','AdminOverview','AdminAccommodations','AdminSaveAccommodation','AdminRoutes','AdminSaveRoute','AdminNotificationCampaigns','AdminSendNotification','StaffSailings','StaffPassengers','StaffFares','StaffNoShows','StaffMarkNoShow']) {
  const { error } = await client.rpc('barkolink_execute', { operation, args: {} })
  assert.equal(error?.code, '42501', `${operation} must reject unsigned callers`)
  console.log(`${operation} access protection: passed`)
}
const { error: tableError } = await client.from('booking').select('id').limit(1)
assert.equal(tableError?.code, '42501', 'Direct table access must be denied')
console.log('Direct booking table protection: passed')
for (const table of ['travel_advisory', 'saved_traveler', 'passenger_no_show', 'activity_log','accommodation','ferry_route','notification_campaign']) {
  const { error } = await client.from(table).select('*').limit(1)
  assert.equal(error?.code, '42501', `Direct ${table} access must be denied`)
  console.log(`Direct ${table} protection: passed`)
}
const endpoint = `${url}/functions/v1/manage-account`
for (const authorization of [null, `Bearer ${key}`]) {
  const response = await fetch(endpoint, {
    method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) },
    body: JSON.stringify({ action: 'generateTemporaryPassword' }), signal: AbortSignal.timeout(30000),
  })
  assert.equal(response.status, 401, 'Account management must require an authenticated admin session')
}
console.log('Account function authentication protection: passed')
console.log('All live smoke checks passed. No test accounts or bookings were created. API calls may process overdue reservation expiry.')
