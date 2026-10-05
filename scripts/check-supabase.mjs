import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const values = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(line => line.includes('=') && !line.startsWith('#')).map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]))
const key = values.VITE_SUPABASE_PUBLISHABLE_KEY || values.VITE_SUPABASE_ANON_KEY
const client = createClient(values.VITE_SUPABASE_URL, key, { auth: { persistSession: false } })
const { error } = await client.rpc('barkolink_execute', { operation: 'BrowseActivePorts', args: {} })
if (error) {
  console.log(JSON.stringify({ connected: false, code: error.code, message: error.message }))
  process.exitCode = 1
} else console.log('Supabase database API is configured and accessible. No data was modified.')
