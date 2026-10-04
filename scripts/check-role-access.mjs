import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getDataConnect } from 'firebase-admin/data-connect'

// Read-only audit of deployed queries. Never executes a mutation or prints user data.
const connectors = Object.fromEntries(['passenger', 'staff'].map(connector => [connector,
  getDataConnect({ serviceId: 'barkolink-87e5e-service', location: 'asia-southeast1', connector },
    initializeApp({ credential: applicationDefault(), projectId: 'barkolink-87e5e' }, `audit-${connector}`)),
]))
const roles = ['SIGNED_OUT', 'PASSENGER', 'TICKETING', 'BOARDING', 'ADMIN']
const variables = {
  sailingCode: '__access_audit_nonexistent__', code: '__access_audit_nonexistent__', offset: 0,
  dayStart: '2026-10-03T00:00:00Z', dayEnd: '2026-10-04T00:00:00Z',
  startAt: '2026-10-01T00:00:00Z', endAt: '2026-10-04T00:00:00Z',
}
let failures = 0
for (const [connector, dc] of Object.entries(connectors)) {
  const dir = new URL(`../dataconnect/${connector}/`, import.meta.url)
  for (const file of readdirSync(dir).filter(name => name.endsWith('.gql'))) {
    const source = readFileSync(new URL(file, dir), 'utf8')
    for (const match of source.matchAll(/^query\s+(\w+)(?:\(([^)]*)\))?\s+@auth\(([^\n]*)\)\s*\{/gm)) {
      const [, operation, args = '', policy] = match
      const input = Object.fromEntries([...args.matchAll(/\$(\w+):/g)].map(([, name]) => {
        assert.ok(name in variables, `Missing audit variable ${name}`)
        return [name, variables[name]]
      }))
      for (const role of roles) {
        const allowed = policy.includes('level: PUBLIC') || (policy.includes('level: USER')
          ? role !== 'SIGNED_OUT' : policy.includes(`'${role}'`))
        const impersonate = role === 'SIGNED_OUT' ? { unauthenticated: true } : {
          authClaims: { sub: 'barkolink-readonly-access-audit', ...(role === 'PASSENGER' ? {} : { role }), firebase: { sign_in_provider: 'password' } },
        }
        try {
          const result = await dc.executeQuery(operation, input, { impersonate })
          if (result.errors?.length) throw new Error(JSON.stringify(result.errors))
          assert.ok(allowed, 'Unexpectedly allowed access')
          console.log(`PASS ${role} ${operation}: allowed`)
        } catch (error) {
          const denied = /PERMISSION_DENIED|permission.denied|@auth rejected|unauthorized|unauthenticated/i.test(error.message || '')
          if (!allowed && denied) console.log(`PASS ${role} ${operation}: denied`)
          else { failures++; console.error(`FAIL ${role} ${operation}: ${String(error.message).slice(0, 350)}`) }
        }
      }
    }
  }
}
if (failures) process.exitCode = 1
console.log(`Role query audit finished: ${failures} failure(s). No live data modified.`)
