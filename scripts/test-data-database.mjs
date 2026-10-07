import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

export const projectRef = 'utobfkfmuepuoseszxks'
export const dataTables = ['port', 'vessel', 'fare_settings', 'sailing', 'booking', 'booking_passenger', 'online_payment', 'port_weather_cache', 'voucher',
  'notification', 'boarding_event', 'operation_settings', 'activity_log', 'travel_advisory',
  'saved_traveler', 'passenger_no_show', 'accommodation', 'ferry_route', 'notification_campaign']
const tableRows = table => `(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from public.${table} t)`
export const dataExpression = `jsonb_build_object(${dataTables.map(table => `'${table}',${tableRows(table)}`).join(',')})`
export const usersExpression = `jsonb_build_object('app',
  (select md5(coalesce(jsonb_agg(to_jsonb(u) order by uid),'[]'::jsonb)::text) from public.app_user u),
  'auth',(select md5(coalesce(jsonb_agg(to_jsonb(u) order by id),'[]'::jsonb)::text) from auth.users u))`
export const snapshotQuery = `select ${dataExpression} as data, ${usersExpression} as users,
  (select jsonb_object_agg(role,n) from (select role,count(*) as n from public.app_user group by role) r) as roles,
  (select count(*) from auth.users) as auth_count, now() as captured_at`

const literal = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`
export const fixtureChecks = `do $$ begin
  if exists(select 1 from public.booking b where b.passenger_count<>(select count(*) from public.booking_passenger p where p.booking_id=b.id)
    or b.passenger_fare_total<>(select sum(p.fare)+b.accommodation_surcharge*b.passenger_count from public.booking_passenger p where p.booking_id=b.id)
    or b.total<>b.passenger_fare_total+b.service_fee-b.voucher_discount) then raise exception 'Booking totals or passenger counts are inconsistent'; end if;
  if exists(select 1 from public.sailing s join public.vessel v on v.id=s.vessel_id
    where s.available_seats<>v.passenger_capacity-coalesce((select sum(b.passenger_count) from public.booking b where b.sailing_code=s.code and b.status in ('PENDING','CONFIRMED')),0)) then raise exception 'Seat counts are inconsistent'; end if;
  if exists(select 1 from public.accommodation a join public.vessel v on v.id=a.vessel_id where a.is_active
    and (select sum(c.capacity) from public.accommodation c where c.vessel_id=a.vessel_id and c.is_active)>v.passenger_capacity) then raise exception 'Class allocations exceed vessel capacity'; end if;
  if exists(select 1 from public.booking_passenger p join public.booking b on b.id=p.booking_id join public.sailing s on s.code=b.sailing_code
    where p.fare<>barkolink_private.fare(s,p.passenger_type) or (b.payment_status='PAID' and p.fare<s.regular_fare and p.discount_verified_at is null)) then raise exception 'Discount fare or verification is inconsistent'; end if;
  if (select available_seats from public.sailing where code='TEST-FULL')<>0 then raise exception 'Sold-out fixture is not full'; end if;
  if (select count(*) from public.booking_passenger p join public.booking b on b.id=p.booking_id where b.sailing_code='TEST-SCHEDULED')<>36 then raise exception 'Pagination fixture is incomplete'; end if;
end $$;`

export function resetTransaction(snapshot, seed, checks = fixtureChecks) {
  if (snapshot.projectRef !== projectRef) throw new Error('Backup belongs to a different project.')
  if (JSON.stringify(Object.keys(snapshot.data).sort()) !== JSON.stringify([...dataTables].sort())) throw new Error('Backup table inventory is incomplete.')
  return `begin;
    set local lock_timeout='10s';
    set local statement_timeout='45s';
    select pg_advisory_xact_lock(hashtext('barkolink-test-data-reset'));
    lock table public.app_user,auth.users in share mode;
    lock table ${dataTables.map(t => `public.${t}`).join(',')} in access exclusive mode;
    do $$ begin
      if ${usersExpression} is distinct from ${literal(snapshot.users)} then raise exception 'Users changed since the backup; reset aborted'; end if;
      if ${dataExpression} is distinct from ${literal(snapshot.data)} then raise exception 'Operational data changed since the backup; reset aborted'; end if;
    end $$;
    truncate table ${dataTables.map(t => `public.${t}`).join(',')};
    ${seed}
    ${checks}
    do $$ begin
      if ${usersExpression} is distinct from ${literal(snapshot.users)} then raise exception 'Users were changed; entire reset rolled back'; end if;
    end $$;
    commit;`
}

function readValue(file, key) {
  return fs.readFileSync(file, 'utf8').match(new RegExp(`^${key}\\s*=\\s*(.+)$`, 'm'))?.[1]?.trim().replace(/^['"]|['"]$/g, '')
}
export async function queryLive(query, readOnly = true) {
  const url = readValue('.env.local', 'VITE_SUPABASE_URL')
  if (!url || new URL(url).hostname !== `${projectRef}.supabase.co`) throw new Error('Frontend and management projects do not match.')
  const token = readValue('.env.supabase-management', 'SUPABASE_ACCESS_TOKEN')
  if (!token) throw new Error('Management access is not configured.')
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, read_only: readOnly }), signal: AbortSignal.timeout(60000),
  })
  const result = await response.json()
  // Database errors can contain row/contact data. Do not print their payloads.
  if (!response.ok) throw new Error(`Database request failed (${response.status}). No private response data was logged.`)
  return result
}
export async function inspectLive() {
  const tables = await queryLive("select tablename from pg_tables where schemaname='public' order by tablename")
  const expected = [...dataTables, 'app_user'].sort()
  if (JSON.stringify(tables.map(row => row.tablename)) !== JSON.stringify(expected)) throw new Error('Unexpected public tables; reset requires a complete reviewed inventory.')
  const constraints = await queryLive(`select conrelid::regclass::text as child,confrelid::regclass::text as parent
    from pg_constraint where contype='f' and confrelid in (${dataTables.map(t => `'public.${t}'::regclass`).join(',')})`)
  if (constraints.some(row => !dataTables.includes(row.child.replace(/^public\./, '')))) throw new Error('An unreviewed table references reset data.')
  const counts = await queryLive(`select ${dataTables.map(t => `(select count(*) from public.${t}) as ${t}`).join(',')}`)
  const roles = await queryLive('select role,count(*) as count from public.app_user group by role order by role')
  const auth = await queryLive('select count(*) as count from auth.users')
  console.log(JSON.stringify({ projectRef, tables: counts[0], roles, authUsers: auth[0].count }))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2] || 'inspect'
  if (mode === 'inspect') await inspectLive()
  else if (mode === 'backup') {
    await inspectLive()
    const snapshot = (await queryLive(snapshotQuery))[0]
    const file = path.resolve('.backups', `before-test-reset-${Date.now()}.json`)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const contents = JSON.stringify({ projectRef, ...snapshot }, null, 2)
    fs.writeFileSync(file, contents, { flag: 'wx', mode: 0o600 })
    const digest = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
    fs.writeFileSync(`${file}.sha256`, digest, { flag: 'wx' })
    console.log(JSON.stringify({ backup: path.relative(process.cwd(), file), verified: true }))
  } else if (mode === 'apply' || mode === 'apply-demo') {
    const file = process.argv[3]
    if (!file || process.argv[4] !== `--confirm-project=${projectRef}`) throw new Error('Provide the verified backup path and exact project confirmation.')
    await inspectLive()
    const root = path.resolve('.backups') + path.sep
    const resolved = path.resolve(file)
    if (!resolved.startsWith(root)) throw new Error('Use a backup inside the ignored .backups directory.')
    const contents = fs.readFileSync(resolved)
    const digest = crypto.createHash('sha256').update(contents).digest('hex')
    if (digest !== fs.readFileSync(`${resolved}.sha256`, 'utf8').trim()) throw new Error('Backup checksum does not match.')
    const snapshot = JSON.parse(contents)
    const demo = mode === 'apply-demo'
    const seed = fs.readFileSync(demo ? 'supabase/demo-data.sql' : 'supabase/test-data.sql', 'utf8')
    const checks = demo ? fs.readFileSync('supabase/verify-demo-integrity.sql', 'utf8') : fixtureChecks
    await queryLive(resetTransaction(snapshot, seed, checks), false)
    const preserved = (await queryLive(`select ${usersExpression} as users`))[0].users
    if (JSON.stringify(preserved) !== JSON.stringify(snapshot.users)) throw new Error('Post-reset user preservation check failed.')
    const receipt = { projectRef, completedAt: new Date().toISOString(), usersPreserved: true, backupSha256: digest }
    fs.writeFileSync(`${resolved}.reset-receipt.json`, JSON.stringify(receipt, null, 2), { flag: 'wx' })
    console.log(JSON.stringify({ reset: 'passed', usersPreserved: true, backup: path.relative(process.cwd(), resolved) }))
    await inspectLive()
  } else if (mode === 'verify' || mode === 'verify-demo') {
    const demo = mode === 'verify-demo'
    const before = (await queryLive(`select md5(${dataExpression}::text) as data, ${usersExpression} as users`))[0]
    const result = await queryLive(`begin;
      set local statement_timeout='45s';
      create temporary table test_verification_result(module_reads integer,transaction_flows integer) on commit drop;
      ${demo ? fs.readFileSync('supabase/verify-demo-integrity.sql', 'utf8') : fixtureChecks}
      ${fs.readFileSync(demo ? 'supabase/verify-demo-workflows.sql' : 'supabase/verify-test-data.sql', 'utf8')}
      select module_reads,transaction_flows from pg_temp.test_verification_result;
      rollback;`, false)
    const after = (await queryLive(`select md5(${dataExpression}::text) as data, ${usersExpression} as users`))[0]
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Data changed during rollback verification; inspect before continuing.')
    console.log(JSON.stringify({ fixtureVerification: 'passed', rolledBack: true, dataUnchanged: true, result }))
  } else throw new Error('Use inspect, backup, apply, apply-demo, verify or verify-demo.')
}
