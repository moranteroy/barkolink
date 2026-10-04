import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getDataConnect } from 'firebase-admin/data-connect'

async function checkTripCodes() {
initializeApp({ credential: applicationDefault(), projectId: 'barkolink-87e5e' })
const dc = getDataConnect({ serviceId: 'barkolink-87e5e-service', location: 'asia-southeast1', connector: 'staff' })
const source = readFileSync(new URL('../dataconnect/staff/trip-codes.gql', import.meta.url), 'utf8')
const sql = source.match(/sql:\s*"""([\s\S]*?)"""/)[1]
const fixtureSql = sql.replace("to_char(current_timestamp AT TIME ZONE 'Asia/Manila', '\"TRP\"YYYY-MMDD')", '$2::text').replace('LEFT JOIN sailing s', 'LEFT JOIN jsonb_array_elements_text($1::jsonb) s(code)')
const query = `query CheckTripNumbers($codes: String!, $day: String!) { result: _selectFirst(sql: """${fixtureSql}""", params: [$codes, $day]) }`
const cases = [
  [[], 'TRP2026-1002', 'TRP2026-1002001'],
  [['TRP2026-1002001', 'TRP2026-1002002'], 'TRP2026-1002', 'TRP2026-1002003'],
  [['TRP2026-1002008', 'TRP2026-1002001'], 'TRP2026-1002', 'TRP2026-1002009'],
  [['TRP2026-1002008'], 'TRP2026-1003', 'TRP2026-1003001'],
  [['TRP2026-1231999'], 'TRP2027-0101', 'TRP2027-0101001'],
  [['TRP2026-1002999'], 'TRP2026-1002', 'TRP2026-10021000'],
  [['TRP-EXISTING', 'TRP2026-100X001'], 'TRP2026-1002', 'TRP2026-1002001'],
]
for (const [codes, day, expected] of cases) {
  const response = await dc.executeGraphqlRead(query, { variables: { codes: JSON.stringify(codes), day } })
  assert.equal(response.data.result.code, expected)
}
// Prove the transaction lock runs, then deliberately fail the check to roll back.
let lockChecked = false
try {
  await dc.executeGraphql(`mutation CheckTripLock @transaction {
    codeLock: _execute(sql: "SELECT pg_advisory_xact_lock(4281001)")
    query @check(expr: "false", message: "TRIP_LOCK_CHECK_ROLLBACK") { ports(limit: 1) { id } }
  }`)
} catch (error) { lockChecked = String(error.message).includes('TRIP_LOCK_CHECK_ROLLBACK') }
assert.ok(lockChecked, 'The daily trip-code transaction lock must run successfully.')
console.log('Trip code SQL passed 7 cases; transaction lock verified with rollback.')
const preview = await dc.executeQuery('AdminNextTripCode', {}, { impersonate: { authClaims: { sub: 'trip-code-check', role: 'ADMIN' } } })
const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
const part = type => parts.find(value => value.type === type).value
assert.ok(preview.data.nextTripCode.code.startsWith(`TRP${part('year')}-${part('month')}${part('day')}`))
assert.match(preview.data.nextTripCode.code, /^TRP\d{4}-\d{4}\d{3,}$/)
console.log(`Deployed next-code preview: ${preview.data.nextTripCode.code}`)
}

checkTripCodes().catch(error => {
  console.error(error instanceof Error ? error.message : 'Trip code verification failed.')
  process.exitCode = 1
})
