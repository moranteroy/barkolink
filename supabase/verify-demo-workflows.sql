-- Execute with management access in a transaction that is ALWAYS rolled back.
do $$
#variable_conflict use_variable
declare actor text; role_name text; operation_name text; result jsonb; row record;
  booking_id uuid; passenger_id uuid; notification_id uuid; checked integer:=0;
  args jsonb:=jsonb_build_object('sailingCode','TRP2026-1006001','code','TRP2026-1006001','offset',0,'pageSize',30,
    'audience','ALL','startAt',now()-interval '8 months','endAt',now()+interval '5 days');
begin
  for row in select * from (values
    ('ADMIN','AdminOverview'),('ADMIN','AdminSailings'),('ADMIN','AdminSailingOptions'),('ADMIN','AdminUsers'),
    ('ADMIN','AdminPassengerRecords'),('ADMIN','AdminExportManifest'),('ADMIN','AdminReports'),
    ('ADMIN','AdminPorts'),('ADMIN','AdminVessels'),('ADMIN','AdminFareSettings'),('ADMIN','AdminAccommodations'),
    ('ADMIN','AdminRoutes'),('ADMIN','AdminAdvisories'),('ADMIN','AdminNotificationCampaigns'),('ADMIN','AdminNotificationRecipients'),
    ('ADMIN','AdminOperationsSettings'),('ADMIN','AdminAuditLog'),('ADMIN','AdminTripOperations'),
    ('TICKETING','StaffDashboard'),('TICKETING','StaffBookings'),('TICKETING','StaffSailings'),('TICKETING','StaffPassengers'),
    ('TICKETING','StaffFares'),('BOARDING','StaffNoShows'),('TICKETING','TicketingPassengerAccounts'),
    ('BOARDING','BoardingSailings'),('BOARDING','BoardingManifest'),('BOARDING','BoardingActivity'),
    ('PASSENGER','MyProfile'),('PASSENGER','MyBookings'),('PASSENGER','MyTickets'),('PASSENGER','MyNotifications'),
    ('PASSENGER','MySavedTravelers'),('PASSENGER','ActiveAdvisories')
  ) operations(role_name,operation_name) loop
    select uid into strict actor from public.app_user where role=row.role_name order by created_at,uid limit 1;
    perform set_config('request.jwt.claim.sub',actor,true);
    result:=public.barkolink_execute(row.operation_name,case when row.operation_name='AdminNotificationRecipients' then args-'sailingCode'-'code' else args end);
    if jsonb_typeof(result)<>'object' then raise exception 'Invalid module response'; end if;
    checked:=checked+1;
  end loop;
  select uid into strict actor from public.app_user where role='TICKETING' order by created_at,uid limit 1;
  perform set_config('request.jwt.claim.sub',actor,true);
  select id into strict booking_id from public.booking where reference='BK-610002';
  for row in select id from public.booking_passenger where public.booking_passenger.booking_id=booking_id loop
    perform public.barkolink_execute('VerifyPassengerDiscount',jsonb_build_object('passengerId',row.id,'note','TEST fictional verification, rollback only'));
  end loop;
  perform public.barkolink_execute('CollectBookingPayment',jsonb_build_object('bookingId',booking_id,'method','CASH'));
  if not exists(select 1 from public.booking where id=booking_id and payment_status='PAID') then raise exception 'Test payment failed'; end if;
  select id into strict booking_id from public.booking where reference='BK-610010';
  perform public.barkolink_execute('RefundBooking',jsonb_build_object('bookingId',booking_id,'note','TEST refund, rollback only'));
  if not exists(select 1 from public.booking where id=booking_id and payment_status='REFUNDED') then raise exception 'Test refund failed'; end if;

  select uid into strict actor from public.app_user where role='BOARDING' order by created_at,uid limit 1;
  perform set_config('request.jwt.claim.sub',actor,true);
  select p.id into strict passenger_id from public.booking_passenger p join public.booking b on b.id=p.booking_id where b.reference='BK-610004' order by p.id limit 1;
  perform public.barkolink_execute('CheckInTicket',jsonb_build_object('passengerId',passenger_id));
  perform public.barkolink_execute('BoardTicket',jsonb_build_object('passengerId',passenger_id));
  if not exists(select 1 from public.booking_passenger where id=passenger_id and ticket_status='BOARDED') then raise exception 'Test boarding failed'; end if;

  select uid into strict actor from public.app_user where role='PASSENGER' order by created_at,uid limit 1;
  perform set_config('request.jwt.claim.sub',actor,true);
  perform public.barkolink_execute('ReserveSailing2',jsonb_build_object('sailingCode','TRP2026-1006006','reference','BK-VERIFY-ROLLBACK',
    'accommodationId','eeeeeeee-0000-4000-8000-000000000201','passenger1Name','TEST New Adult','passenger1Type','REGULAR',
    'passenger2Name','TEST New Student','passenger2Type','STUDENT'));
  select id into strict booking_id from public.booking where reference='BK-610003';
  select owner_uid into actor from public.booking where id=booking_id;
  perform set_config('request.jwt.claim.sub',actor,true);
  perform public.barkolink_execute('CancelMyBooking',jsonb_build_object('bookingId',booking_id));
  if not exists(select 1 from public.booking where id=booking_id and status='CANCELLED') then raise exception 'Test cancellation failed'; end if;
  select id into notification_id from public.notification where owner_uid=actor and read_at is null limit 1;
  perform public.barkolink_execute('MarkNotificationRead',jsonb_build_object('id',notification_id));
  perform public.barkolink_execute('MyMarkAllNotificationsRead','{}');
  if exists(select 1 from public.notification where owner_uid=actor and read_at is null) then raise exception 'Test inbox failed'; end if;
  insert into pg_temp.test_verification_result(module_reads,transaction_flows) values(checked,7);
end $$;
