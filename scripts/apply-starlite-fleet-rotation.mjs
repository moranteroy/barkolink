import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { queryLive, projectRef, usersExpression } from './test-data-database.mjs';

const literal = value => `'${String(value).replaceAll("'", "''")}'`;
const migration = 'supabase/migrations/052_daily_fleet_rotation.sql';
const sagaCode = 'SL-SAGA';
const catalog = JSON.parse(fs.readFileSync('src/data/ferryReferenceCatalog.json','utf8'));
const saga = catalog.vessels.find(v => v.code === sagaCode);
assert.equal(saga.passengerCapacity,300);
const h = crypto.createHash('sha256').update(`barkolink-reference:vessel:${sagaCode}`).digest('hex');
const sagaId = `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
const metadata = {kind:'verified-reference',operator:saga.operator,checkedAt:'2026-10-24',
  sourceUrls:[catalog.sources.marinaSaga.url],capacityStatus:saga.capacityStatus,publishedCapacities:[300],
  observations:saga.observations,serviceNote:saga.serviceNote,accommodationProfiles:[]};

async function main(){
  const before=(await queryLive(`select jsonb_build_object(
    'vessels',(select jsonb_agg(to_jsonb(v) order by id) from public.vessel v),
    'sailings',(select coalesce(jsonb_agg(to_jsonb(s) order by code),'[]') from public.sailing s),
    'schedules',(select coalesce(jsonb_agg(to_jsonb(s) order by id),'[]') from barkolink_private.daily_schedule s),
    'generator',pg_get_functiondef('barkolink_private.generate_daily_trips()'::regprocedure),
    'dailyRpc',pg_get_functiondef('barkolink_private.execute_daily_automation(text,jsonb,text,text)'::regprocedure)) snapshot,
    exists(select 1 from information_schema.columns where table_schema='barkolink_private' and table_name='daily_schedule' and column_name='assignment_mode') installed`))[0];
  const sql=fs.readFileSync(migration,'utf8');
  const apply=process.argv.includes('--apply'),preview=process.argv.includes('--preview');
  console.log(JSON.stringify({projectRef,migration,installed:before.installed,newVessel:saga.name,capacity:300,mode:apply?'apply':preview?'preview':'inspect'}));
  if(!apply&&!preview)return;
  if(before.installed)throw new Error('Fleet rotation is already installed; inspect the existing rollout instead of rerunning setup.');
  assert.equal(before.snapshot.vessels.filter(v=>v.is_active).length,5,'Expected the existing five active vessels.');
  fs.mkdirSync('.backups',{recursive:true});
  const backupPath=`.backups/before-starlite-fleet-rotation-${Date.now()}.json`;
  fs.writeFileSync(backupPath,JSON.stringify({projectRef,snapshot:before.snapshot},null,2),{flag:'wx',mode:0o600});
  const fingerprint=`select md5(jsonb_build_object(
    'bookings',(select coalesce(jsonb_agg(to_jsonb(b) order by id),'[]') from public.booking b),
    'passengers',(select coalesce(jsonb_agg(to_jsonb(p) order by id),'[]') from public.booking_passenger p),
    'payments',(select coalesce(jsonb_agg(to_jsonb(p) order by id),'[]') from public.online_payment p),
    'users',${usersExpression},
    'vessels',(select coalesce(jsonb_agg(to_jsonb(v) order by id),'[]') from public.vessel v where code<>'SL-SAGA'),
    'fares',(select coalesce(jsonb_agg(to_jsonb(f) order by code),'[]') from public.fare_settings f where code<>${literal(sagaId)}),
    'classes',(select coalesce(jsonb_agg(to_jsonb(a) order by id),'[]') from public.accommodation a where vessel_id<>${literal(sagaId)}),
    'existingTrips',(select coalesce(jsonb_agg(to_jsonb(s)-'daily_schedule_id'-'daily_service_date'-'daily_departure_time' order by code),'[]') from public.sailing s where code in (select code from fleet_original_trips)))::text) fingerprint`;
  const response=await queryLive(`begin;set local lock_timeout='10s';set local statement_timeout='60s';
    select pg_advisory_xact_lock(hashtext('barkolink-generate-daily-trips'));
    lock table public.vessel,public.sailing,public.fare_settings,public.accommodation,public.ferry_route,public.vessel_route,
      public.booking,public.booking_passenger,public.online_payment,public.app_user,auth.users,barkolink_private.daily_schedule in share row exclusive mode;
    do $guard$ begin
      if pg_get_functiondef('barkolink_private.generate_daily_trips()'::regprocedure)<>${literal(before.snapshot.generator)} or
        pg_get_functiondef('barkolink_private.execute_daily_automation(text,jsonb,text,text)'::regprocedure)<>${literal(before.snapshot.dailyRpc)} then
        raise exception 'Automation changed; rollout aborted.';
      end if;
    end $guard$;
    create temporary table fleet_original_trips as select code from public.sailing;
    create temporary table fleet_record_guard as ${fingerprint};
    ${sql}
    insert into public.vessel(id,code,name,passenger_capacity,is_active,reference_metadata)
      values(${literal(sagaId)},'SL-SAGA',${literal(saga.name)},300,true,${literal(JSON.stringify(metadata))}::jsonb);
    insert into public.vessel_route(vessel_id,route_id) select ${literal(sagaId)},id from public.ferry_route where code in ('BTG-CAL','CAL-BTG') and is_active;
    -- Reuse the application's saved operator fare configuration; this is not a claim about published Saga fares.
    insert into public.fare_settings(code,regular_fare,student_discount,senior_discount,child_discount,pwd_discount,pregnant_discount,custom_discounts,passenger_discounts)
      select ${literal(sagaId)},f.regular_fare,f.student_discount,f.senior_discount,f.child_discount,f.pwd_discount,f.pregnant_discount,f.custom_discounts,f.passenger_discounts
      from public.fare_settings f join public.vessel v on f.code=v.id::text where v.code='SL-PACIFIC';
    insert into public.accommodation(vessel_id,name,description,capacity,surcharge,is_active)
      values(${literal(sagaId)},'Economy','Initial application seat allocation. Adjust classes before accepting reservations.',300,0,true);
    update barkolink_private.daily_schedule s set assignment_mode='FLEET',updated_at=now()
      from public.ferry_route r where s.route_id=r.id and s.operator='Starlite Ferries' and r.code in ('BTG-CAL','CAL-BTG');
    select barkolink_private.generate_daily_trips();
    do $guard$ declare original text;current_value text;begin
      select fingerprint into original from fleet_record_guard;
      ${fingerprint.replace(' fingerprint',' into current_value')};
      if original is distinct from current_value then raise exception 'Existing operational records changed; rollout rolled back.';end if;
      if (select count(*) from public.vessel where is_active)<>6 then raise exception 'Expected six active vessels.';end if;
      ${apply ? `if exists(select 1 from barkolink_private.daily_schedule where is_active and operator='Starlite Ferries' and generation_issues<>'[]') then raise exception 'Some departures remain blocked; rollout rolled back.';end if;` : ''}
    end $guard$;
    select jsonb_build_object('vessels',(select count(*) from public.vessel where is_active),
      'tripsCreated',(select count(*) from public.sailing where code not in (select code from fleet_original_trips)),
      'schedules',(select jsonb_agg(jsonb_build_object('route',r.code,'mode',s.assignment_mode,'issues',s.generation_issues,
        'futureTrips',(select count(*) from public.sailing t where t.daily_schedule_id=s.id and t.departure_at>now())))
        from barkolink_private.daily_schedule s join public.ferry_route r on r.id=s.route_id where s.is_active)) result;
    ${apply ? "notify pgrst,'reload schema';commit;" : 'rollback;'}`,false);
  fs.mkdirSync('.audit',{recursive:true});
  fs.writeFileSync(`.audit/starlite-fleet-rotation-${apply?'applied':'preview'}.json`,JSON.stringify({projectRef,backupPath,response},null,2));
  console.log(JSON.stringify(response));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
