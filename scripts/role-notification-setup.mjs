import fs from 'node:fs';
import { queryLive } from './test-data-database.mjs';
async function main() {
  const installed = async () =>
    (
      await queryLive(
        "select to_regprocedure('barkolink_private.booking_operational_notifications()') is not null installed",
      )
    )[0].installed;
  if (process.argv.includes('--apply') && !(await installed())) {
    await queryLive(
      `begin;set local lock_timeout='10s';set local statement_timeout='45s';
    select pg_advisory_xact_lock(hashtext('barkolink-notifications-060'));
    ${fs.readFileSync('supabase/migrations/060_role_scoped_notifications.sql', 'utf8')}
    commit;`,
      false,
    );
  }
  if (!(await installed())) {
    console.log(JSON.stringify({ installed: false }));
    return;
  }
  if (process.argv.includes('--verify')) {
    await queryLive(
      `begin;set local lock_timeout='10s';set local statement_timeout='30s';
   do $$declare actor text;trip public.sailing;b public.booking;expected integer;delivered integer;staff_note uuid;blocked boolean:=false;payload jsonb;
   begin
    select uid into strict actor from public.app_user where role='PASSENGER' order by uid limit 1;
    select * into strict trip from public.sailing s where s.status='SCHEDULED' and s.departure_at>now()+interval '2 hours'
     and barkolink_private.vessel_departure_issue(s.vessel_id,s.origin_port_id,s.departure_at,s.code) is null
     and exists(select 1 from public.app_user u where u.role='TICKETING' and u.assigned_port_id=s.origin_port_id)
     order by s.departure_at,s.code limit 1;
    insert into public.booking(reference,owner_uid,sailing_code,status,passenger_count,passenger_fare_total,total,booking_channel,payment_deadline)
     values('NOTIFICATION-PROBE-'||gen_random_uuid()::text,actor,trip.code,'PENDING',1,trip.regular_fare,trip.regular_fare,'ONLINE',now()+interval '1 hour') returning * into b;
    select count(*) into expected from public.app_user u where u.role='ADMIN' or (u.role in('TICKETING','BOARDING') and barkolink_private.staff_port_matches(trip.origin_port_id,u.uid,u.role));
    select count(*) into delivered from public.notification where event_key=b.id::text||':created';
    if expected<>delivered or exists(select 1 from public.notification n join public.app_user u on u.uid=n.owner_uid where event_key=b.id::text||':created'
      and (u.role='PASSENGER' or (u.role<>'ADMIN' and u.assigned_port_id<>trip.origin_port_id))) then raise exception 'Native notification recipient verification failed.';end if;
    select id into strict staff_note from public.notification where event_key=b.id::text||':created' limit 1;
    perform set_config('request.jwt.claim.sub',actor,true);perform set_config('request.jwt.claims','{"aal":"aal2"}',true);
    payload:=public.barkolink_execute('MyNotifications','{}');
    if exists(select 1 from jsonb_array_elements(payload->'notifications') n where n->>'id'=staff_note::text) then raise exception 'A passenger received a staff notice.';end if;
    begin perform public.barkolink_execute('MarkNotificationRead',jsonb_build_object('id',staff_note));
    exception when insufficient_privilege then blocked:=true;end;
    if not blocked then raise exception 'A passenger could mark a staff notice as read.';end if;
   end $$;rollback;`,
      false,
    );
    console.log(
      'Native booking alerts and passenger/staff isolation passed; probe records rolled back.',
    );
  }
  console.log(
    JSON.stringify({
      installed: true,
      ...(
        await queryLive(`select
   (select count(*) from pg_trigger where not tgisinternal and tgname in('booking_operational_notifications','sailing_operational_notifications','passenger_attendance_notification','advisory_notification_revision','advisory_notification_delivery')) active_triggers,
   has_function_privilege('authenticated','barkolink_private.notify_booking_staff(public.booking,text,text,text,text[])','EXECUTE') browser_can_send,
   has_table_privilege('authenticated','public.notification','SELECT') browser_direct_read`)
      )[0],
    }),
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
