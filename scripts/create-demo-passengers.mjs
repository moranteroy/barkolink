import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { projectRef, queryLive } from './test-data-database.mjs'

const password = process.env.BARKOLINK_DEMO_PASSWORD
if (!password || password.length < 8) throw new Error('Supply the authorized password through BARKOLINK_DEMO_PASSWORD.')
const token = fs.readFileSync('.env.supabase-management', 'utf8').match(/^SUPABASE_ACCESS_TOKEN\s*=\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '')
await queryLive('select 1 as connected') // Also verifies the configured project identity.
const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/api-keys`, {
  headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000),
})
if (!response.ok) throw new Error(`Could not access server-side account administration (${response.status}).`)
const keys = await response.json()
const key = keys.find(item => item.name === 'service_role')?.api_key || keys.find(item => item.type === 'secret')?.api_key
if (!key) throw new Error('A server-only administration key is required.')
const admin = createClient(`https://${projectRef}.supabase.co`, key, { auth: { persistSession: false, autoRefreshToken: false } })
const accounts = [
  { email: 'ana.santos@example.com', fullName: 'Ana Santos' },
  { email: 'miguel.reyes@example.com', fullName: 'Miguel Reyes' },
  { email: 'camille.delacruz@example.com', fullName: 'Camille Dela Cruz' },
]
for (const account of accounts) {
  const existing = await queryLive(`select exists(select 1 from auth.users where email='${account.email}') as present`)
  if (existing[0].present) { console.log(JSON.stringify({ email: account.email, status: 'already_exists', passwordChanged: false })); continue }
  const { data, error } = await admin.auth.admin.createUser({ email: account.email, password, email_confirm: true,
    user_metadata: { fullName: account.fullName }, app_metadata: { role: 'PASSENGER', demo_account: true } })
  if (error || !data.user) throw new Error(`Passenger account creation failed for ${account.email} (${error?.code || 'unknown'}).`)
  const profile = await queryLive(`select role,full_name from public.app_user where uid='${data.user.id}'`)
  if (profile[0]?.role !== 'PASSENGER' || profile[0]?.full_name !== account.fullName) throw new Error('Account profile synchronization failed.')
  console.log(JSON.stringify({ email: account.email, fullName: account.fullName, role: 'PASSENGER', status: 'created' }))
}
if (process.argv[2] === 'verify') {
  const env = fs.readFileSync('.env.local', 'utf8')
  const values = Object.fromEntries(env.split(/\r?\n/).filter(line => line.includes('=') && !line.startsWith('#')).map(line => {
    const index = line.indexOf('='); return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')]
  }))
  const publicKey = values.VITE_SUPABASE_PUBLISHABLE_KEY || values.VITE_SUPABASE_ANON_KEY
  for (const account of accounts) {
    const client = createClient(`https://${projectRef}.supabase.co`, publicKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data, error } = await client.auth.signInWithPassword({ email: account.email, password })
    if (error || data.user?.app_metadata.role !== 'PASSENGER') throw new Error(`Passenger sign-in failed for ${account.email} (${error?.code || error?.status || 'role mismatch'}).`)
    const bookings = await client.rpc('barkolink_execute', { operation: 'MyBookings', args: {} })
    const travelers = await client.rpc('barkolink_execute', { operation: 'MySavedTravelers', args: {} })
    if (bookings.error || travelers.error || !bookings.data.bookings.length || travelers.data.travelers.length !== 3) throw new Error('Passenger workflow data verification failed.')
    console.log(JSON.stringify({ email: account.email, signIn: 'passed', ownBookings: bookings.data.bookings.length, savedTravelers: travelers.data.travelers.length }))
    await client.auth.signOut({ scope: 'local' })
  }
}
