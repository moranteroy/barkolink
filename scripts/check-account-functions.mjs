import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

process.env.GCLOUD_PROJECT ||= 'barkolink-87e5e'
const require = createRequire(new URL('../functions/index.js', import.meta.url))
const { createManagedUser, generateTemporaryPassword } = await import('../functions/index.js')
const auth = require('firebase-admin/auth').getAuth()
const sql = require('firebase-admin/data-connect').getDataConnect({ serviceId: 'barkolink-87e5e-service', location: 'asia-southeast1' })
const original = { create: auth.createUser, claims: auth.setCustomUserClaims, remove: auth.deleteUser, query: sql.executeGraphql, error: console.error }
const calls = []
const admin = { uid: 'mock-admin', token: { role: 'ADMIN' } }
const input = { fullName: 'Mock Staff', email: 'MOCK@example.invalid', password: 'Mock-password123', role: 'TICKETING' }
try {
  // Mock all writes: this exercises the actual handlers without creating live accounts.
  auth.createUser = async data => { calls.push(['create',data]); return { uid: 'mock-user' } }
  auth.setCustomUserClaims = async (...args) => { calls.push(['claims',...args]) }
  auth.deleteUser = async uid => { calls.push(['delete',uid]) }
  sql.executeGraphql = async (_source, options) => { calls.push(['profile', options.variables]); return { data: {} } }
  await assert.rejects(() => createManagedUser.run({ data: input }), error => error.code === 'unauthenticated')
  await assert.rejects(() => createManagedUser.run({ auth: { token: { role: 'PASSENGER' } }, data: input }), error => error.code === 'permission-denied')
  await assert.rejects(() => createManagedUser.run({ auth: admin, data: { ...input, role: 'ADMIN' } }), error => error.code === 'invalid-argument')
  assert.equal(calls.length,0)
  const passwords = new Set()
  for (let i = 0; i < 10; i++) {
    const result = await generateTemporaryPassword.run({ auth: admin, data: null })
    assert.match(result.password,/^[A-Za-z0-9_-]{24}$/)
    passwords.add(result.password)
  }
  assert.equal(passwords.size,10)
  await assert.rejects(() => generateTemporaryPassword.run({ data: null }), error => error.code === 'permission-denied')
  const result = await createManagedUser.run({ auth: admin, data: input })
  assert.equal(result.email,'mock@example.invalid')
  assert.deepEqual(calls.map(c => c[0]),['create','claims','profile'])
  assert.deepEqual(calls[1],['claims','mock-user',{ role: 'TICKETING' }])
  assert.equal(calls[2][1].role,'TICKETING')
  calls.length = 0
  auth.createUser = async () => { throw { code: 'auth/email-already-exists' } }
  await assert.rejects(() => createManagedUser.run({ auth: admin, data: input }), error => error.code === 'already-exists')
  assert.equal(calls.length,0)
  auth.createUser = async () => ({ uid: 'mock-user' })
  sql.executeGraphql = async () => { throw new Error('Mock profile failure') }
  console.error = () => {}
  await assert.rejects(() => createManagedUser.run({ auth: admin, data: input }), error => error.code === 'internal')
  assert.ok(calls.some(c => c[0] === 'delete' && c[1] === 'mock-user'))
} finally {
  auth.createUser = original.create; auth.setCustomUserClaims = original.claims; auth.deleteUser = original.remove; sql.executeGraphql = original.query; console.error = original.error
}
for (const name of ['generateTemporaryPassword','createManagedUser']) {
  const url = `http://127.0.0.1:5001/barkolink-87e5e/asia-southeast1/${name}`
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8100' }, body: JSON.stringify({ data: null }), signal: AbortSignal.timeout(10000) })
  assert.equal(response.status, name === 'createManagedUser' ? 401 : 403)
  assert.equal(response.headers.get('access-control-allow-origin'),'http://localhost:8100')
}
console.log('Account handlers verified: admin permissions, secure passwords, Auth + SQL creation, duplicate email, rollback. Both local endpoints reachable with CORS. No live accounts created.')
