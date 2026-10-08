import fs from 'node:fs'

const projectRef = 'utobfkfmuepuoseszxks'
const source = fs.readFileSync('.env.supabase-management', 'utf8')
const token = source.match(/^SUPABASE_ACCESS_TOKEN\s*=\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '')
if (!token) throw new Error('Set SUPABASE_ACCESS_TOKEN in .env.supabase-management first.')

async function management(path, options = {}) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}${path}`, {
    ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers },
    signal: AbortSignal.timeout(90000),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    // Never log credentials, request headers, or private account data.
    throw new Error(`Management API ${response.status}: ${String(result.message || result.error || 'Request failed').replaceAll(token, '[redacted]')}`)
  }
  return result
}
async function sql(query, readOnly = true, parameters = []) {
  return management('/database/query', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, read_only: readOnly, parameters }),
  })
}
const tables = ['app_user','port','vessel','fare_settings','sailing','booking','booking_passenger','notification','boarding_event']
const inspectQuery = `select table_name from information_schema.tables where table_schema='public' and table_name in (${tables.map(t => `'${t}'`).join(',')}) order by table_name`
const mode = process.argv[2] || 'inspect'
if (['inspect-admin-filters', 'upgrade-admin-filters', 'verify-admin-filters'].includes(mode)) {
  const env = fs.readFileSync('.env.local', 'utf8')
  const url = env.match(/^VITE_SUPABASE_URL\s*=\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '')
  if (!url || new URL(url).hostname !== `${projectRef}.supabase.co`) throw new Error('Frontend and management project must match before checking or upgrading.')
  const inspect = `select
    to_regprocedure('barkolink_private.execute_flexible_discounts(text,jsonb,text,text)') is not null as ready,
    to_regprocedure('barkolink_private.execute_flexible_discounts_v17(text,jsonb,text,text)') is not null as backup,
    coalesce((select position('AdminSailingOptions' in pg_get_functiondef(p.oid))>0 from pg_proc p where p.oid=to_regprocedure('barkolink_private.execute_flexible_discounts(text,jsonb,text,text)')),false) as installed,
    (select count(*) from information_schema.columns where table_schema='public' and table_name in ('fare_settings','sailing') and column_name='passenger_discounts') as columns`
  let state = (await sql(inspect))[0]
  if (mode === 'upgrade-admin-filters') {
    if (!state.ready || Number(state.columns) !== 2 || state.backup !== state.installed) throw new Error('Unexpected migration state; inspect before upgrading.')
    if (state.installed) console.log('Migration 018 already installed; no changes applied.')
    else {
      const guard = `do $$ begin
        perform pg_advisory_xact_lock(hashtext('barkolink-migration-018'));
        if to_regprocedure('barkolink_private.execute_flexible_discounts_v17(text,jsonb,text,text)') is not null then
          raise exception 'Migration state changed; inspect before retrying';
        end if;
      end $$;`
      await sql('begin;\n' + guard + '\n' + fs.readFileSync('supabase/migrations/018_admin_directory_filters.sql', 'utf8') + '\ncommit;', false)
      console.log('Applied migration 018 transactionally; no booking, payment or account records edited.')
      state = (await sql(inspect))[0]
    }
  }
  console.log(JSON.stringify({ projectRef, adminFilters: state }))
  if (mode === 'inspect-admin-filters') console.log(JSON.stringify({ ownership: await sql(`select n.nspname,p.proname,r.rolname as owner,p.prosecdef as security_definer,has_function_privilege(current_user,p.oid,'EXECUTE') as management_execute,has_function_privilege('postgres',p.oid,'EXECUTE') as postgres_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner where p.proname in ('barkolink_execute','execute_flexible_discounts','execute_flexible_discounts_v17')`) }))
  if (mode !== 'inspect-admin-filters') {
    if (!state.ready || !state.backup || !state.installed) throw new Error('Migration 018 is not installed.')
    const security = (await sql(`select
      has_function_privilege('authenticated','barkolink_private.execute_flexible_discounts(text,jsonb,text,text)','EXECUTE') as browser_private_execute,
      has_function_privilege('anon','barkolink_private.execute_flexible_discounts(text,jsonb,text,text)','EXECUTE') as anonymous_private_execute,
      has_function_privilege('authenticated','barkolink_private.execute_flexible_discounts_v17(text,jsonb,text,text)','EXECUTE') as browser_backup_execute,
      has_table_privilege('authenticated','public.booking_passenger','SELECT') as browser_passenger_select`))[0]
    if (Object.values(security).some(Boolean)) throw new Error('Unexpected browser access to private functions or tables.')
    const result = await sql(`with actor as (select uid from public.app_user where role='ADMIN' limit 1),
      results as materialized (select operation, barkolink_private.execute_flexible_discounts(operation,'{"pageSize":1}'::jsonb,uid,'ADMIN') as data
        from actor cross join (values ('AdminSailings'),('AdminUsers'),('AdminPassengerRecords'),('AdminSailingOptions')) ops(operation))
      select operation, jsonb_typeof(data)='object' as valid_response,
        case when operation='AdminSailingOptions' then data ? 'sailings' else data ? 'totalCount' end as expected_shape from results`, false)
    if (result.length !== 4 || result.some(row => !row.valid_response || !row.expected_shape)) throw new Error('Authorized admin directory verification failed.')
    console.log(JSON.stringify({ adminDirectoryVerification: 'passed', result, security }))
  }
} else if (['inspect-loyalty-settings', 'upgrade-loyalty-settings', 'verify-loyalty-settings'].includes(mode)) {
  const env = fs.readFileSync('.env.local', 'utf8')
  const url = env.match(/^VITE_SUPABASE_URL\s*=\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '')
  if (!url || new URL(url).hostname !== `${projectRef}.supabase.co`) throw new Error('Frontend and management project must match before applying loyalty settings.')
  const inspect = `select
    to_regclass('barkolink_private.loyalty_settings') is not null as settings_table,
    to_regprocedure('barkolink_private.execute_flexible_discounts_v30(text,jsonb,text,text)') is not null as backup,
    to_regprocedure('barkolink_private.loyalty_reward_value(integer)') is not null as reward_ready,
    to_regprocedure('barkolink_private.issue_loyalty_vouchers(text)') is not null as issuance_ready,
    coalesce((select position('AdminLoyaltySettings' in pg_get_functiondef(p.oid))>0 from pg_proc p where p.oid=to_regprocedure('barkolink_private.execute_flexible_discounts(text,jsonb,text,text)')),false) as installed`
  let state = (await sql(inspect))[0]
  if (mode === 'upgrade-loyalty-settings') {
    if (!state.reward_ready || !state.issuance_ready || state.settings_table !== state.backup || state.backup !== state.installed) throw new Error('Unexpected loyalty migration state; inspect before applying.')
    if (state.installed) console.log('Migration 031 already installed; saved settings preserved.')
    else {
      const guard = `do $$ begin
        perform pg_advisory_xact_lock(hashtext('barkolink-migration-031'));
        if to_regclass('barkolink_private.loyalty_settings') is not null or to_regprocedure('barkolink_private.execute_flexible_discounts_v30(text,jsonb,text,text)') is not null then
          raise exception 'Loyalty migration state changed; inspect before retrying';
        end if;
      end $$;`
      await sql('begin;\n' + guard + '\n' + fs.readFileSync('supabase/migrations/031_loyalty_settings.sql', 'utf8') + '\ncommit;', false)
      console.log('Applied migration 031 transactionally. Existing vouchers, bookings and reward expiry dates preserved.')
      state = (await sql(inspect))[0]
    }
  }
  console.log(JSON.stringify({ projectRef, loyaltySettings: state }))
  if (mode !== 'inspect-loyalty-settings') {
    if (!state.settings_table || !state.backup || !state.installed) throw new Error('Migration 031 is not installed.')
    const security = (await sql(`select
      has_table_privilege('authenticated','barkolink_private.loyalty_settings','SELECT') as browser_settings_read,
      has_table_privilege('authenticated','barkolink_private.loyalty_settings','UPDATE') as browser_settings_write,
      has_table_privilege('anon','barkolink_private.loyalty_settings','SELECT') as anonymous_settings_read,
      has_function_privilege('authenticated','barkolink_private.execute_flexible_discounts(text,jsonb,text,text)','EXECUTE') as browser_private_execute,
      has_function_privilege('authenticated','barkolink_private.execute_flexible_discounts_v30(text,jsonb,text,text)','EXECUTE') as browser_backup_execute`))[0]
    if (Object.values(security).some(Boolean)) throw new Error('Unexpected direct access to private loyalty settings.')
    const results = await sql(`select barkolink_private.execute_flexible_discounts('AdminLoyaltySettings','{}'::jsonb,uid,'ADMIN') as data
      from public.app_user where role='ADMIN' limit 1`, false)
    if (results.length !== 1 || !results[0].data?.settings?.trips_per_reward) throw new Error('Admin loyalty settings response verification failed.')
    console.log(JSON.stringify({ verification: 'passed', settings: results[0].data.settings, security }))
  }
} else if (mode === 'inspect') {
  const existing = await sql(inspectQuery)
  const functions = await sql("select routine_name from information_schema.routines where routine_schema='public' and routine_name='barkolink_execute'")
  console.log(JSON.stringify({ projectRef, tables: existing, functions }))
} else if (mode === 'upgrade-custom-discounts' || mode === 'verify-custom-discounts') {
  const inspect = "select to_regprocedure('barkolink_private.execute_discounts(text,jsonb,text,text)') is not null as installed, (select count(*) from information_schema.columns where table_schema='public' and table_name in ('fare_settings','sailing') and column_name='custom_discounts') as columns"
  const state = (await sql(inspect))[0]
  if (mode === 'upgrade-custom-discounts' && !state.installed && Number(state.columns) === 0) {
    await sql('begin;\n' + fs.readFileSync('supabase/migrations/016_custom_discounts.sql','utf8') + '\ncommit;', false)
    console.log('Installed custom discounts. Existing trip and reservation fares are preserved.')
  } else if (!state.installed || Number(state.columns) !== 2) throw new Error('Unexpected custom discount migration state; inspect before continuing.')
  console.log(JSON.stringify(await sql(inspect)))
  console.log(JSON.stringify(await sql("select count(*) as saved_vessels, count(*) filter(where jsonb_array_length(custom_discounts)>0) as vessels_with_custom_discounts from public.fare_settings")))
} else if (mode === 'upgrade-editable-discounts' || mode === 'verify-editable-discounts') {
  const inspect = "select to_regprocedure('barkolink_private.execute_flexible_discounts(text,jsonb,text,text)') is not null as installed, (select count(*) from information_schema.columns where table_schema='public' and table_name in ('fare_settings','sailing') and column_name='passenger_discounts') as columns"
  const state = (await sql(inspect))[0]
  if (mode === 'upgrade-editable-discounts' && !state.installed && Number(state.columns) === 0) {
    await sql('begin;\n' + fs.readFileSync('supabase/migrations/017_editable_passenger_discounts.sql','utf8') + '\ncommit;', false)
    console.log('Existing passenger discounts are editable. Existing sailing and booking fares are preserved.')
  } else if (!state.installed || Number(state.columns) !== 2) throw new Error('Unexpected editable discount migration state; inspect before continuing.')
  console.log(JSON.stringify(await sql(inspect)))
  console.log(JSON.stringify(await sql("select count(*) as configured_vessels, count(*) filter(where passenger_discounts is not null) as editable_vessels from public.fare_settings")))
} else if (mode === 'install') {
  const existing = await sql(inspectQuery)
  if (!Array.isArray(existing) || existing.length) throw new Error('Existing BarkoLink tables detected. Inspect and compare the schema before applying migrations.')
  await sql(fs.readFileSync('supabase/setup.sql', 'utf8'), false)
  console.log('Installed BarkoLink PostgreSQL schema, application functions and Auth profile trigger.')
  console.log(JSON.stringify({ tables: await sql(inspectQuery) }))
} else if (mode === 'inspect-experience' || mode === 'upgrade-experience') {
  const state = (await sql("select to_regclass('public.travel_advisory') is not null as advisory, to_regclass('public.saved_traveler') is not null as traveler, to_regclass('public.passenger_no_show') is not null as no_show, to_regprocedure('barkolink_private.execute_experience(text,jsonb,text,text)') is not null as dispatcher, exists(select 1 from information_schema.columns where table_schema='public' and table_name='booking' and column_name='payment_deadline') as operations_ready"))[0]
  if (mode === 'upgrade-experience') {
    if (!state.operations_ready) throw new Error('Install and verify migrations 005?008 before this upgrade.')
    const flags = [state.advisory,state.traveler,state.no_show,state.dispatcher]
    if (flags.every(Boolean)) console.log('Experience upgrade already installed; no changes applied.')
    else {
      if (flags.some(Boolean)) throw new Error('Partial experience schema detected. Inspect it before applying changes.')
      await sql('begin;\n' + fs.readFileSync('supabase/migrations/009_experience_upgrade.sql','utf8') + '\ncommit;', false)
      console.log('Applied migration 009 in one transaction. Existing account, booking and boarding records were preserved.')
    }
    console.log(JSON.stringify({ security: await sql("select relname,relrowsecurity,has_table_privilege('authenticated',oid,'SELECT') as browser_select from pg_class where oid in ('public.travel_advisory'::regclass,'public.saved_traveler'::regclass,'public.passenger_no_show'::regclass)") }))
  } else console.log(JSON.stringify({ experience: state }))
} else if (mode === 'inspect-parity' || mode === 'upgrade-parity') {
  const inspect = "select to_regclass('public.accommodation') is not null as accommodation, to_regclass('public.ferry_route') is not null as routes, to_regclass('public.notification_campaign') is not null as campaigns, to_regprocedure('barkolink_private.execute_workspaces(text,jsonb,text,text)') is not null as dispatcher, to_regprocedure('barkolink_private.execute_workspace(text,jsonb,text,text)') is not null as ready";
  const state = (await sql(inspect))[0]
  if (mode === 'upgrade-parity') {
    if (!state.ready) throw new Error('Install migration 011 before this upgrade.')
    const flags = [state.accommodation,state.routes,state.campaigns,state.dispatcher]
    if (flags.every(Boolean)) console.log('Base44 workspace upgrade already installed; no changes applied.')
    else {
      if (flags.some(Boolean)) throw new Error('Partial workspace upgrade detected. Inspect it before applying changes.')
      await sql('begin;\n' + ['012_accommodation_inventory.sql','013_base44_workspaces.sql'].map(file => fs.readFileSync(`supabase/migrations/${file}`,'utf8')).join('\n') + '\ncommit;',false)
      console.log('Applied migrations 012 and 013 together. Existing bookings and accounts preserved; no seating classes or notification campaigns were created.')
    }
    console.log(JSON.stringify({installed:await sql(inspect),security:await sql("select relname,relrowsecurity,has_table_privilege('authenticated',oid,'SELECT') as browser_select from pg_class where oid in ('public.accommodation'::regclass,'public.ferry_route'::regclass,'public.notification_campaign'::regclass)")}))
  } else console.log(JSON.stringify({workspaces:state}))
} else if (mode === 'upgrade-audit-roles' || mode === 'verify-audit-roles') {
  if (mode === 'upgrade-audit-roles') {
    const state=(await sql("select exists(select 1 from information_schema.columns where table_schema='public' and table_name='activity_log' and column_name='actor_role') as installed"))[0]
    if (!state.installed) {
      await sql('begin;\n'+fs.readFileSync('supabase/migrations/015_audit_actor_roles.sql','utf8')+'\ncommit;',false)
      console.log('Applied migration 015: trusted role snapshots and settings-history filtering. Existing history preserved.')
    } else console.log('Audit role upgrade already installed; no changes applied.')
  }
  const check=await sql(`with actor as materialized (
    select set_config('request.jwt.claim.sub',uid,true) from public.app_user where role='ADMIN' limit 1
  ), result as materialized (
    select public.barkolink_execute('AdminAuditLog','{"entityType":"operation_settings"}'::jsonb) as data from actor
  ) select (data->>'totalCount')::integer as settings_history_count,
    not exists(select 1 from jsonb_array_elements(data->'records') r where r->>'entityType'<>'operation_settings') as filtered,
    not exists(select 1 from jsonb_array_elements(data->'records') r where not (r ? 'actorRole' and r ? 'actorRoleRecorded')) as roles_present from result`,false)
  if (check.length!==1 || !check[0].filtered || !check[0].roles_present) throw new Error('Hosted settings history and role verification failed.')
  const trigger=await sql("select exists(select 1 from pg_trigger where tgrelid='public.activity_log'::regclass and tgname='activity_log_actor_role' and tgenabled='O' and not tgisinternal) as role_capture_enabled")
  if (!trigger[0]?.role_capture_enabled) throw new Error('The audit role capture trigger is not enabled.')
  console.log(JSON.stringify({auditRoles:'passed',result:check,trigger,security:await sql("select has_function_privilege('authenticated','barkolink_private.execute_workspace(text,jsonb,text,text)','EXECUTE') as browser_private_execute,has_table_privilege('authenticated','public.activity_log','SELECT') as browser_table_select")}))
} else if (mode === 'fix-accommodation-alias' || mode === 'verify-accommodation') {
  if (mode === 'fix-accommodation-alias') {
    await sql('begin;\n' + fs.readFileSync('supabase/migrations/014_accommodation_alias_fix.sql','utf8') + '\ncommit;',false)
    console.log('Applied migration 014: accommodation dispatcher variable renamed; existing records preserved.')
  }
  // Exercise the public RPC with a trusted existing administrator identity.
  // Return only aggregate verification results, never account or inventory details.
  const check = await sql(`with actor as materialized (
    select set_config('request.jwt.claim.sub',uid,true) from public.app_user where role='ADMIN' limit 1
  ), result as materialized (
    select public.barkolink_execute('AdminAccommodations','{}'::jsonb) as data from actor
  ) select jsonb_array_length(data->'accommodations') as accommodation_count from result`,false)
  if (check.length !== 1) throw new Error('An existing administrator is required to verify the Accommodation RPC.')
  console.log(JSON.stringify({ accommodationRpc: 'passed', result: check, security: await sql("select has_function_privilege('authenticated','barkolink_private.execute_accommodation(text,jsonb,text,text)','EXECUTE') as browser_private_execute, has_table_privilege('authenticated','public.accommodation','SELECT') as browser_table_select") }))
} else if (mode === 'inspect-workspace' || mode === 'upgrade-workspace') {
  const state = (await sql("select to_regprocedure('barkolink_private.execute_workspace(text,jsonb,text,text)') is not null as installed, to_regprocedure('barkolink_private.execute_experience(text,jsonb,text,text)') is not null as ready, to_regprocedure('barkolink_private.save_profile(jsonb,text,text)') is not null as profile_ready, to_regclass('public.activity_log_action_created_idx') is not null as indexed"))[0]
  if (mode === 'upgrade-workspace') {
    if (!state.ready || !state.profile_ready) throw new Error('Install migrations 009 and 010 before migration 011.')
    if (state.installed && state.indexed) console.log('Workspace upgrade already installed; no changes applied.')
    else {
      if (state.installed || state.indexed) throw new Error('Partial workspace upgrade detected. Inspect it before applying changes.')
      await sql('begin;\n' + fs.readFileSync('supabase/migrations/011_workspace_audit.sql','utf8') + '\ncommit;', false)
      console.log('Applied migration 011 in one transaction; existing records preserved.')
    }
    console.log(JSON.stringify({ security: await sql("select has_function_privilege('authenticated','barkolink_private.execute_workspace(text,jsonb,text,text)','EXECUTE') as browser_private_execute, has_table_privilege('authenticated','public.activity_log','SELECT') as browser_table_select") }))
  } else console.log(JSON.stringify({ workspace:state }))
} else if (mode === 'upgrade-profile') {
  const state = (await sql("select to_regprocedure('barkolink_private.save_profile(jsonb,text,text)') is not null as installed, to_regprocedure('barkolink_private.execute_experience(text,jsonb,text,text)') is not null as experience_ready"))[0]
  if (!state.experience_ready) throw new Error('Install migration 009 before the profile upgrade.')
  if (state.installed) console.log('Profile upgrade already installed; no changes applied.')
  else { await sql('begin;\n' + fs.readFileSync('supabase/migrations/010_atomic_profile.sql','utf8') + '\ncommit;', false); console.log('Applied migration 010. Profile saves now synchronize account names in one transaction; no existing profiles were edited.') }
} else if (mode === 'upgrade-operations') {
  const installed = await sql("select column_name from information_schema.columns where table_schema='public' and table_name='booking' and column_name='payment_deadline'")
  if (installed.length) throw new Error('Operations upgrade already exists. Inspect the installed migrations; do not re-run the upgrade.')
  const upgrade = fs.readFileSync('supabase/migrations/005_operations_upgrade.sql', 'utf8')
  const schedule = fs.readFileSync('supabase/migrations/006_expiry_schedule.sql', 'utf8')
  await sql(`begin;\n${upgrade}\n${schedule}\ncommit;`, false)
  console.log('Installed operations upgrade and expiry schedule without deleting existing records.')
  console.log(JSON.stringify({ settings: await sql('select reservation_minutes from public.operation_settings'), cron: await sql("select extname from pg_extension where extname='pg_cron'") }))
} else if (mode === 'upgrade-lock-order') {
  await sql(`begin;\n${fs.readFileSync('supabase/migrations/007_reschedule_lock_order.sql','utf8')}\ncommit;`, false)
  console.log('Updated the rescheduling function lock order; no booking records were changed.')
} else if (mode === 'upgrade-terminal-counts') {
  await sql(`begin;\n${fs.readFileSync('supabase/migrations/008_active_terminal_counts.sql','utf8')}\ncommit;`, false)
  console.log('Updated terminal counts to exclude cancelled bookings.')
} else if (mode === 'inspect-operations') {
  console.log(JSON.stringify({
    columns: await sql("select table_name,column_name from information_schema.columns where table_schema='public' and column_name in ('payment_deadline','pregnant_discount','pregnant_fare','discount_verified_at') order by table_name,column_name"),
    extensions: await sql("select name,installed_version from pg_available_extensions where name='pg_cron'"),
  }))
} else if (mode === 'verify-operations') {
  console.log(JSON.stringify({
    settings: await sql('select reservation_minutes from public.operation_settings'),
    cron: await sql("select jobname,schedule,active from cron.job where jobname='barkolink-expire-reservations'"),
    cronRuns: await sql("select status,return_message from cron.job_run_details where jobid in (select jobid from cron.job where jobname='barkolink-expire-reservations') order by start_time desc limit 3"),
    security: await sql("select relname,relrowsecurity from pg_class where oid in ('public.activity_log'::regclass,'public.operation_settings'::regclass)"),
    constraints: await sql("select tgname from pg_trigger where tgname in ('barkolink_vessel_schedule','barkolink_audit') and not tgisinternal"),
  }))
} else if (mode === 'deploy-function') {
  const form = new FormData()
  form.append('metadata', JSON.stringify({ name: 'manage-account', entrypoint_path: 'index.ts', verify_jwt: false }))
  form.append('file', new Blob([fs.readFileSync('supabase/functions/manage-account/index.ts', 'utf8')], { type: 'application/typescript' }), 'index.ts')
  const result = await management('/functions/deploy?slug=manage-account', { method: 'POST', body: form })
  console.log(JSON.stringify({ deployed: true, slug: result.slug, status: result.status, verifyJwt: result.verify_jwt }))
} else if (mode === 'verify') {
  const security = await sql("select c.relname as table_name, c.relrowsecurity as rls_enabled from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('app_user','port','vessel','fare_settings','sailing','booking','booking_passenger','notification','boarding_event') order by c.relname")
  const triggers = await sql("select t.tgname as trigger_name from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='auth' and c.relname='users' and t.tgname='barkolink_auth_profile' and not t.tgisinternal")
  const functions = await management('/functions')
  console.log(JSON.stringify({ security, authTriggerInstalled: Array.isArray(triggers) && triggers.length > 0, accountFunction: functions.filter(f => f.slug === 'manage-account').map(f => ({ slug: f.slug, status: f.status, verifyJwt: f.verify_jwt })) }))
} else if (mode === 'auth-config') {
  const config = await management('/config/auth')
  console.log(JSON.stringify({ siteUrl: config.site_url, redirectAllowList: config.uri_allow_list, signupDisabled: config.disable_signup, emailConfirmationRequired: !config.mailer_autoconfirm }))
} else if (mode === 'configure-local-redirects') {
  const config = await management('/config/auth')
  const urls = new Set(String(config.uri_allow_list || '').split(',').map(url => url.trim()).filter(Boolean))
  for (const origin of ['http://localhost:8100','http://127.0.0.1:8100','http://localhost:5173','http://127.0.0.1:5173']) {
    urls.add(`${origin}/login`); urls.add(`${origin}/reset-password`)
  }
  await management('/config/auth', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uri_allow_list: [...urls].join(',') }) })
  console.log('Added BarkoLink local login and password-reset URLs; preserved existing redirect URLs and Site URL.')
} else if (mode === 'account-summary') {
  console.log(JSON.stringify({ accountCounts: await sql('select role, count(*) as account_count from public.app_user group by role order by role') }))
} else if (mode === 'account-emails') {
  console.log(JSON.stringify({ accounts: await sql('select email, email_confirmed_at is not null as confirmed from auth.users order by created_at desc limit 10') }))
} else if (mode === 'set-admin' || mode === 'confirm-admin') {
  const email = process.argv[3]?.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Provide the exact registered admin email.')
  const accounts = await sql('select email, email_confirmed_at is not null as confirmed from auth.users where lower(email) = $1', true, [email])
  if (!Array.isArray(accounts) || accounts.length !== 1) {
    console.log(JSON.stringify({ email, status: 'not_registered', changed: false }))
    process.exitCode = 2
  } else if (!accounts[0].confirmed && mode !== 'confirm-admin') {
    console.log(JSON.stringify({ email, status: 'email_confirmation_required', changed: false }))
    process.exitCode = 2
  } else {
    if (mode === 'confirm-admin') {
      // Explicit project-owner bootstrap of the designated dummy admin account.
      // This updates only this account, not the project's confirmation settings.
      await sql("update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()), raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'ADMIN') where lower(email) = $1", false, [email])
    } else {
      await sql("update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'ADMIN') where lower(email) = $1 and email_confirmed_at is not null", false, [email])
    }
    const roles = await sql("select u.email, u.email_confirmed_at is not null as confirmed, u.raw_app_meta_data->>'role' as auth_role, p.role as profile_role from auth.users u join public.app_user p on p.uid = u.id::text where lower(u.email) = $1", true, [email])
    if (roles.length !== 1 || !roles[0].confirmed || roles[0].auth_role !== 'ADMIN' || roles[0].profile_role !== 'ADMIN') throw new Error('Admin confirmation and role synchronization could not be verified.')
    console.log(JSON.stringify({ email, status: 'admin_assigned', roles }))
  }
} else throw new Error('Use inspect, install, deploy-function or verify.')
