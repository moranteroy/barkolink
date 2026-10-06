-- Disposable fictional acceptance data for an explicitly authorized reset.
-- Does not create, update or delete any app_user or auth.users record.
-- Run only through scripts/test-data-database.mjs after a verified backup.
do $$
declare
  admin_uid text; passenger_uid text; ticketing_uid text; boarding_uid text; walkin_uid text;
  port_a uuid := 'eeeeeeee-0000-4000-8000-000000000001';
  port_b uuid := 'eeeeeeee-0000-4000-8000-000000000002';
  port_c uuid := 'eeeeeeee-0000-4000-8000-000000000003';
  vessel_a uuid := 'eeeeeeee-0000-4000-8000-000000000101';
  vessel_b uuid := 'eeeeeeee-0000-4000-8000-000000000102';
  vessel_c uuid := 'eeeeeeee-0000-4000-8000-000000000103';
  economy_a uuid := 'eeeeeeee-0000-4000-8000-000000000201';
  premium_a uuid := 'eeeeeeee-0000-4000-8000-000000000202';
  economy_b uuid := 'eeeeeeee-0000-4000-8000-000000000203';
  economy_c uuid := 'eeeeeeee-0000-4000-8000-000000000205';
  campaign uuid := 'eeeeeeee-0000-4000-8000-000000000301';
  row record; trip public.sailing; booking_id uuid; passenger_id uuid;
  kinds text[]; stages text[]; fares integer[]; amount integer; surcharge integer;
  i integer; j integer; class_id uuid; class_name text; paid_time timestamptz; creation_time timestamptz;
begin
  select uid into admin_uid from public.app_user where role='ADMIN' order by created_at,uid limit 1;
  select uid into passenger_uid from public.app_user where role='PASSENGER' order by created_at,uid limit 1;
  select uid into ticketing_uid from public.app_user where role='TICKETING' order by created_at,uid limit 1;
  select uid into boarding_uid from public.app_user where role='BOARDING' order by created_at,uid limit 1;
  select uid into walkin_uid from public.app_user where role='WALK_IN' order by created_at,uid limit 1;
  if admin_uid is null or passenger_uid is null or ticketing_uid is null or boarding_uid is null or walkin_uid is null then
    raise exception 'Existing accounts for all five roles are required; no accounts will be created automatically.';
  end if;
  perform set_config('request.jwt.claim.sub',admin_uid,true);

  insert into public.operation_settings(id,reservation_minutes) values(true,1440);
  insert into public.port(id,code,name,city,region,is_active) values
    (port_a,'TEST-BTG','[TEST] Batangas terminal','Batangas','Batangas',true),
    (port_b,'TEST-CAL','[TEST] Calapan terminal','Calapan','Oriental Mindoro',true),
    (port_c,'TEST-PGA','[TEST] Puerto Galera terminal','Puerto Galera','Oriental Mindoro',true),
    ('eeeeeeee-0000-4000-8000-000000000004','TEST-OFF','[TEST] Inactive terminal','Demo City','Test Region',false);
  insert into public.vessel(id,code,name,passenger_capacity,is_active) values
    (vessel_a,'TEST-V01','[TEST] Island Explorer',120,true),
    (vessel_b,'TEST-V02','[TEST] Channel Voyager',80,true),
    (vessel_c,'TEST-V03','[TEST] Small Ferry',8,true),
    ('eeeeeeee-0000-4000-8000-000000000104','TEST-V04','[TEST] Maintenance Vessel',40,false);
  insert into public.fare_settings(code,regular_fare,student_discount,senior_discount,child_discount,pwd_discount,pregnant_discount,passenger_discounts)
    select id::text,600,20,20,50,20,10,
      barkolink_private.legacy_passenger_discounts('{"student_discount":20,"senior_discount":20,"child_discount":50,"pwd_discount":20,"pregnant_discount":10}'::jsonb)
      || '[{"id":"eeeeeeee-0000-4000-8000-000000000401","name":"Test Promo","percentage":15,"is_active":true}]'::jsonb
    from public.vessel;
  insert into public.accommodation(id,vessel_id,name,description,capacity,surcharge,is_active) values
    (economy_a,vessel_a,'[TEST] Economy','Fictional seating class for testing.',80,0,true),
    (premium_a,vessel_a,'[TEST] Premium','Fictional class with a PHP 100 surcharge per passenger.',40,100,true),
    (economy_b,vessel_b,'[TEST] Economy','Fictional seating class for testing.',60,0,true),
    ('eeeeeeee-0000-4000-8000-000000000204',vessel_b,'[TEST] Premium','Fictional premium class.',20,100,true),
    (economy_c,vessel_c,'[TEST] Economy','Eight-seat class for sold-out testing.',8,0,true),
    ('eeeeeeee-0000-4000-8000-000000000206',vessel_a,'[TEST] Inactive Class','Should be excluded from passenger choices.',10,200,false);
  insert into public.ferry_route(code,origin_port_id,destination_port_id,duration_minutes,is_active) values
    ('TEST-BTG-CAL',port_a,port_b,90,true),('TEST-CAL-BTG',port_b,port_a,90,true),
    ('TEST-BTG-PGA',port_a,port_c,120,true),('TEST-PGA-BTG',port_c,port_a,120,true),
    ('TEST-CAL-PGA',port_b,port_c,60,false);

  for row in select * from (values
    ('TEST-BOARDING',vessel_a,interval '2 hours','BOARDING'),
    ('TEST-PAYMENT',vessel_a,interval '6 hours','SCHEDULED'),
    ('TEST-DELAYED',vessel_b,interval '10 hours','DELAYED'),
    ('TEST-FULL',vessel_c,interval '1 day','SCHEDULED'),
    ('TEST-SCHEDULED',vessel_a,interval '1 day 6 hours','SCHEDULED'),
    ('TEST-EMPTY',vessel_a,interval '2 days','SCHEDULED'),
    ('TEST-CANCELLED',vessel_a,interval '3 days','CANCELLED'),
    ('TEST-HISTORY',vessel_a,interval '-2 days','COMPLETED'),
    ('TEST-NOSHOW',vessel_b,interval '-7 days','COMPLETED')
  ) t(code,vessel,offset_time,status) loop
    insert into public.sailing(code,origin_port_id,destination_port_id,vessel_id,departure_at,arrival_at,duration_minutes,
      regular_fare,student_fare,senior_fare,child_fare,pwd_fare,pregnant_fare,available_seats,status)
    select row.code,port_a,port_b,row.vessel,now()+row.offset_time,now()+row.offset_time+interval '90 minutes',90,
      600,480,480,300,480,540,passenger_capacity,row.status from public.vessel where id=row.vessel;
  end loop;
  -- Six separate calendar months for the revenue chart, using Philippine dates.
  for i in 1..6 loop
    insert into public.sailing(code,origin_port_id,destination_port_id,vessel_id,departure_at,arrival_at,duration_minutes,
      regular_fare,student_fare,senior_fare,child_fare,pwd_fare,pregnant_fare,available_seats,status)
    values('TEST-MONTH-'||i,port_a,port_b,vessel_a,
      (date_trunc('month',now() at time zone 'Asia/Manila')-make_interval(months=>i)+interval '10 days 9 hours') at time zone 'Asia/Manila',
      (date_trunc('month',now() at time zone 'Asia/Manila')-make_interval(months=>i)+interval '10 days 10 hours 30 minutes') at time zone 'Asia/Manila',
      90,600,480,480,300,480,540,120,'COMPLETED');
  end loop;

  create temporary table seed_cases(reference text,code text,kinds text[],stages text[],status text,payment text,premium boolean,walkin boolean) on commit drop;
  insert into seed_cases values
    ('TEST-PAY-REGULAR','TEST-PAYMENT',array['REGULAR'],array['PENDING'],'PENDING','UNPAID',false,false),
    ('TEST-DISCOUNT-PENDING','TEST-PAYMENT',array['STUDENT','SENIOR','CHILD','PWD','PREGNANT','Test Promo'],array['PENDING'],'PENDING','UNPAID',true,false),
    ('TEST-CANCEL-READY','TEST-PAYMENT',array['REGULAR'],array['PENDING'],'PENDING','UNPAID',false,false),
    ('TEST-ISSUED','TEST-BOARDING',array['REGULAR','STUDENT'],array['ISSUED'],'CONFIRMED','PAID',false,false),
    ('TEST-CHECKED-IN','TEST-BOARDING',array['REGULAR','PWD'],array['CHECKED_IN'],'CONFIRMED','PAID',false,false),
    ('TEST-BOARDED','TEST-BOARDING',array['REGULAR','SENIOR'],array['BOARDED'],'CONFIRMED','PAID',true,false),
    ('TEST-WALK-IN','TEST-BOARDING',array['REGULAR'],array['ISSUED'],'CONFIRMED','PAID',false,true),
    ('TEST-DELAYED-PAID','TEST-DELAYED',array['REGULAR'],array['ISSUED'],'CONFIRMED','PAID',false,false),
    ('TEST-SOLD-OUT','TEST-FULL',array['REGULAR','REGULAR','REGULAR','REGULAR','REGULAR','REGULAR','REGULAR','REGULAR'],array['ISSUED'],'CONFIRMED','PAID',false,false),
    ('TEST-REFUND-PENDING','TEST-CANCELLED',array['REGULAR','STUDENT'],array['ISSUED'],'CANCELLED','REFUND_PENDING',false,false),
    ('TEST-REFUNDED','TEST-CANCELLED',array['REGULAR'],array['ISSUED'],'CANCELLED','REFUNDED',false,false),
    ('TEST-CANCELLED-UNPAID','TEST-PAYMENT',array['REGULAR'],array['PENDING'],'CANCELLED','UNPAID',false,false),
    ('TEST-EXPIRED','TEST-PAYMENT',array['REGULAR'],array['PENDING'],'EXPIRED','UNPAID',false,false),
    ('TEST-COMPLETED','TEST-HISTORY',array['REGULAR','CHILD','Test Promo'],array['BOARDED'],'CONFIRMED','PAID',true,false),
    ('TEST-NO-SHOW','TEST-NOSHOW',array['REGULAR','STUDENT'],array['ISSUED'],'CONFIRMED','PAID',false,false);
  for i in 1..12 loop
    insert into seed_cases values('TEST-LIST-'||lpad(i::text,2,'0'),'TEST-SCHEDULED',array['REGULAR','STUDENT','Test Promo'],
      array['ISSUED'],'CONFIRMED','PAID',i%2=0,false);
  end loop;
  for i in 1..6 loop
    insert into seed_cases values('TEST-REVENUE-'||i,'TEST-MONTH-'||i,array['REGULAR','STUDENT'],array['BOARDED'],'CONFIRMED','PAID',false,false);
  end loop;

  for row in select * from seed_cases order by reference loop
    select * into strict trip from public.sailing where code=row.code;
    class_id := case when row.premium then premium_a when trip.vessel_id=vessel_a then economy_a when trip.vessel_id=vessel_b then economy_b else economy_c end;
    select a.name,a.surcharge into class_name,surcharge from public.accommodation a where a.id=class_id;
    kinds:=row.kinds; stages:=row.stages; fares:='{}';
    for i in 1..cardinality(kinds) loop fares:=array_append(fares,barkolink_private.fare(trip,kinds[i])); end loop;
    select sum(f) into amount from unnest(fares) f;
    creation_time:=case when trip.departure_at<now() then trip.departure_at-interval '1 day' else now()-interval '1 hour' end;
    paid_time:=case when row.payment<>'UNPAID' then creation_time+interval '30 minutes' else null end;
    insert into public.booking(reference,owner_uid,sailing_code,status,passenger_count,passenger_fare_total,service_fee,total,
      booking_channel,payment_status,payment_method,paid_at,collected_by_uid,payment_deadline,cancellation_reason,
      refunded_at,refunded_by_uid,refund_note,accommodation_id,accommodation_name,accommodation_surcharge,created_at,updated_at)
    values(row.reference,case when row.walkin then walkin_uid else passenger_uid end,row.code,row.status,cardinality(kinds),
      amount+surcharge*cardinality(kinds),0,amount+surcharge*cardinality(kinds),case when row.walkin then 'WALK_IN' else 'ONLINE' end,
      row.payment,case when row.payment<>'UNPAID' then 'CASH' else null end,paid_time,case when row.payment<>'UNPAID' then ticketing_uid else null end,
      case when row.status='EXPIRED' then now()-interval '1 hour' else least(creation_time+interval '24 hours',trip.departure_at) end,
      case when row.status='CANCELLED' then '[TEST] Simulated cancellation; no actual journey cancelled.' else null end,
      case when row.payment='REFUNDED' then now()-interval '15 minutes' else null end,
      case when row.payment='REFUNDED' then ticketing_uid else null end,
      case when row.payment='REFUNDED' then '[TEST] Simulated cash refund; no money exchanged.' else null end,
      class_id,class_name,surcharge,creation_time,creation_time)
    returning id into booking_id;
    for i in 1..cardinality(kinds) loop
      insert into public.booking_passenger(booking_id,full_name,passenger_type,birth_date,sex,phone,nationality,fare,ticket_status,
        issued_at,checked_in_at,boarded_at,discount_verified_at,discount_verified_by_uid,discount_verification_note,created_at)
      values(booking_id,'TEST Passenger '||row.reference||' '||i,kinds[i],
        case kinds[i] when 'SENIOR' then date '1949-01-01' when 'CHILD' then date '2020-01-01' when 'STUDENT' then date '2005-01-01' else date '1990-01-01' end,
        case when i%3=0 then 'OTHER' when i%2=0 or kinds[i]='PREGNANT' then 'FEMALE' else 'MALE' end,'00000000000','Filipino',fares[i],stages[1],
        coalesce(paid_time,creation_time),case when stages[1] in ('CHECKED_IN','BOARDED') then coalesce(paid_time,creation_time)+interval '5 minutes' else null end,
        case when stages[1]='BOARDED' then coalesce(paid_time,creation_time)+interval '10 minutes' else null end,
        case when fares[i]<600 and row.payment<>'UNPAID' then paid_time else null end,
        case when fares[i]<600 and row.payment<>'UNPAID' then ticketing_uid else null end,
        case when fares[i]<600 and row.payment<>'UNPAID' then '[TEST] Fictional verification; no real ID collected.' else null end,creation_time)
      returning id into passenger_id;
      if stages[1] in ('CHECKED_IN','BOARDED') then
        insert into public.boarding_event(passenger_id,staff_uid,event_type,created_at) values(passenger_id,boarding_uid,'CHECKED_IN',coalesce(paid_time,creation_time)+interval '5 minutes');
      end if;
      if stages[1]='BOARDED' then
        insert into public.boarding_event(passenger_id,staff_uid,event_type,created_at) values(passenger_id,boarding_uid,'BOARDED',coalesce(paid_time,creation_time)+interval '10 minutes');
      end if;
      if row.reference='TEST-NO-SHOW' then
        insert into public.passenger_no_show(passenger_id,marked_by_uid) values(passenger_id,boarding_uid);
      end if;
    end loop;
  end loop;
  update public.sailing s set available_seats=v.passenger_capacity-coalesce((select sum(b.passenger_count) from public.booking b
    where b.sailing_code=s.code and b.status in ('PENDING','CONFIRMED')),0) from public.vessel v where v.id=s.vessel_id;

  insert into public.travel_advisory(title,message,category,priority,sailing_code,starts_at,ends_at,published) values
    ('[TEST] Boarding reminder','Fictional notice: use the TEST-BOARDING trip to exercise ticket review and boarding.','GENERAL','LOW','TEST-BOARDING',now()-interval '1 hour',now()+interval '2 days',true),
    ('[TEST] Simulated delay','Fictional delay notice for testing; this is not a real weather or port warning.','SCHEDULE','MEDIUM','TEST-DELAYED',now()-interval '1 hour',now()+interval '2 days',true),
    ('[TEST] Draft advisory','Unpublished fictional notice for testing the admin advisory editor.','GENERAL','LOW',null,now(),now()+interval '3 days',false),
    ('[TEST] Expired advisory','Expired fictional notice; it should not appear among active passenger notices.','GENERAL','LOW',null,now()-interval '4 days',now()-interval '1 day',true);
  insert into public.saved_traveler(owner_uid,full_name,birth_date,sex,phone,nationality) values
    (passenger_uid,'TEST Saved Adult',date '1990-01-01','MALE','00000000000','Filipino'),
    (passenger_uid,'TEST Saved Child',date '2020-01-01','FEMALE','00000000000','Filipino'),
    (passenger_uid,'TEST Saved Other',date '1995-01-01','OTHER','00000000000','Filipino');
  insert into public.notification_campaign(id,title,message,audience,sent_by_uid,recipient_count)
    select campaign,'[TEST] Acceptance test dataset','Fictional operational records are loaded. No actual payment, refund or journey is represented.',
      'ALL',admin_uid,count(*) from public.app_user where role<>'WALK_IN';
  insert into public.notification(owner_uid,title,message,category,campaign_id)
    select uid,'[TEST] Acceptance test dataset','Use records beginning TEST for system testing only.','GENERAL',campaign from public.app_user where role<>'WALK_IN';
  insert into public.notification(owner_uid,title,message,category,read_at) values
    (passenger_uid,'[TEST] Read notification','Fictional example of a previously read notice.','BOOKING',now()),
    (passenger_uid,'[TEST] Unread notification','Fictional example for mark-as-read and inbox testing.','BOOKING',null);
  insert into public.activity_log(actor_uid,action,entity_type,entity_id,details)
    values(admin_uid,'TEST_DATA_SEEDED','dataset','TEST',jsonb_build_object('fictional',true,'users_preserved',true));
end $$;
