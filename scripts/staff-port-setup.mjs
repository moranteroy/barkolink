import fs from 'node:fs';
const env = file => Object.fromEntries(fs.readFileSync(file,'utf8').split(/\r?\n/).filter(line=>/^\w+\s*=/.test(line)).map(line=>{
  const at=line.indexOf('='); return [line.slice(0,at).trim(),line.slice(at+1).trim().replace(/^['"]|['"]$/g,'')];
}));
const frontend=env('.env.local'), credentials=env('.env.supabase-management');
const hostname=new URL(frontend.VITE_SUPABASE_URL).hostname;
if(!/^[a-z0-9]+\.supabase\.co$/.test(hostname) || !credentials.SUPABASE_ACCESS_TOKEN) throw new Error('Configure hosted Supabase management access first.');
const project=hostname.split('.')[0];
async function request(path,options={}) {
  const response=await fetch(`https://api.supabase.com/v1/projects/${project}${path}`,{...options,headers:{Authorization:`Bearer ${credentials.SUPABASE_ACCESS_TOKEN}`,...options.headers},signal:AbortSignal.timeout(45000)});
  if(!response.ok) throw new Error(`Staff port setup request failed (${response.status}); private response omitted.`);
  return response.json();
}
const sql=(query,readOnly=true)=>request('/database/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,read_only:readOnly})});
const inspect=`select exists(select 1 from information_schema.columns where table_schema='public' and table_name='app_user' and column_name='assigned_port_id') as installed,
  to_regprocedure('barkolink_private.execute_flexible_discounts_v30(text,jsonb,text,text)') is not null as prerequisite,
  to_regprocedure('barkolink_private.execute_flexible_discounts_v31(text,jsonb,text,text)') is not null as guarded_dispatcher,
  to_regprocedure('barkolink_private.execute_flexible_discounts_v32(text,jsonb,text,text)') is not null as assignment_directory,
  (select count(*) from public.app_user where role in ('TICKETING','BOARDING')) as staff_accounts`;
let state=(await sql(inspect))[0];
if(process.argv.includes('--apply')) {
  if(!state.prerequisite || state.installed!==state.guarded_dispatcher) throw new Error('Unexpected migration state. Inspect before applying.');
  if(!state.installed) {
    const guard="do $$ begin perform pg_advisory_xact_lock(hashtext('barkolink-staff-port-032')); if exists(select 1 from information_schema.columns where table_schema='public' and table_name='app_user' and column_name='assigned_port_id') then raise exception 'Migration state changed'; end if; end $$;";
    await sql(`begin; set local lock_timeout='10s'; ${guard}\n${fs.readFileSync('supabase/migrations/032_staff_port_access.sql','utf8')}\ncommit;`,false);
  }
  if(!state.assignment_directory) {
    await sql(`begin; set local lock_timeout='10s'; do $$ begin perform pg_advisory_xact_lock(hashtext('barkolink-staff-directory-033')); if to_regprocedure('barkolink_private.execute_flexible_discounts_v32(text,jsonb,text,text)') is not null then raise exception 'Migration state changed'; end if; end $$;\n${fs.readFileSync('supabase/migrations/033_staff_port_directory.sql','utf8')}\ncommit;`,false);
  }
  const form=new FormData();
  form.append('metadata',JSON.stringify({name:'manage-account',entrypoint_path:'index.ts',verify_jwt:false}));
  form.append('file',new Blob([fs.readFileSync('supabase/functions/manage-account/index.ts','utf8')],{type:'application/typescript'}),'index.ts');
  const deployed=await request('/functions/deploy?slug=manage-account',{method:'POST',body:form});
  if(deployed.status!=='ACTIVE') throw new Error('Account function deployment did not become active.');
  state=(await sql(inspect))[0];
}
const permissions=state.installed ? (await sql(`select
  has_function_privilege('authenticated','public.verify_online_payment(uuid)','EXECUTE') as guarded_payment,
  has_function_privilege('authenticated','public.verify_online_payment_unscoped(uuid)','EXECUTE') as unscoped_payment,
  has_function_privilege('authenticated','barkolink_private.execute_flexible_discounts_v31(text,jsonb,text,text)','EXECUTE') as private_bypass,
  (select count(*) from public.app_user where role in ('TICKETING','BOARDING') and assigned_port_id is null) as unassigned_staff`))[0] : null;
if(permissions && (!permissions.guarded_payment || permissions.unscoped_payment || permissions.private_bypass)) throw new Error('Staff permission verification failed.');
if(process.argv.includes('--verify')) {
  if(!state.installed) throw new Error('Apply the port migration before verification.');
  const result=await sql(`begin;
    create temporary table port_verification_result(list_checks integer,denied_actions integer) on commit drop;
    do $$ declare actor record; chosen uuid; response jsonb; remote_booking uuid; remote_passenger uuid; listing integer:=0; blocked integer:=0;
    begin
      select id into chosen from public.port where is_active order by id limit 1;
      if chosen is null then raise exception 'An active port is required for verification'; end if;
      for actor in select uid,role from public.app_user where role in ('TICKETING','BOARDING') loop
        update public.app_user set assigned_port_id=chosen where uid=actor.uid;
        perform set_config('request.jwt.claim.sub',actor.uid,true);
        response:=public.barkolink_execute('StaffSailings','{}');
        if exists(select 1 from jsonb_array_elements(response->'sailings') item where item->'origin'->>'id'<>chosen::text) then raise exception 'Sailing scope failed'; end if;
        if (response->>'totalCount')::integer<>(select count(*) from public.sailing where origin_port_id=chosen) then raise exception 'Sailing count scope failed'; end if;
        response:=public.barkolink_execute('StaffDashboard','{}');
        if (response->>'bookings')::integer<>(select count(*) from public.booking b join public.sailing s on s.code=b.sailing_code where s.origin_port_id=chosen) then raise exception 'Dashboard scope failed'; end if;
        listing:=listing+2;
        select b.id,p.id into remote_booking,remote_passenger from public.booking b join public.sailing s on s.code=b.sailing_code join public.booking_passenger p on p.booking_id=b.id where s.origin_port_id<>chosen limit 1;
        if remote_booking is not null then
          begin
            perform public.barkolink_execute(case when actor.role='TICKETING' then 'CollectBookingPayment' else 'CheckInTicket' end,
              case when actor.role='TICKETING' then jsonb_build_object('bookingId',remote_booking,'method','CASH') else jsonb_build_object('passengerId',remote_passenger) end);
            raise exception 'Foreign port action was not blocked';
          exception when insufficient_privilege then blocked:=blocked+1; end;
        end if;
      end loop;
      insert into pg_temp.port_verification_result values(listing,blocked);
    end $$;
    select * from pg_temp.port_verification_result;
    rollback;`,false);
  console.log(JSON.stringify({liveVerification:result,rolledBack:true}));
}
console.log(JSON.stringify({project,applied:process.argv.includes('--apply'),...state,permissions}));
