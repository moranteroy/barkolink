-- Realistic demonstration records. These are synthetic, not actual financial transactions.
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
  passenger_uids text[]; booking_owner text; case_number integer:=0;
  first_names text[]:=array['Marco','Elena','Paolo','Sofia','Daniel','Isabella','Luis','Angela','Rafael','Mariana','Carlo','Bianca'];
  family_names text[]:=array['Santos','Reyes','Dela Cruz','Garcia','Mendoza','Navarro','Castillo','Ramos','Aquino','Torres','Bautista','Flores'];
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
  select array_agg(uid order by (email in ('ana.santos@example.com','miguel.reyes@example.com','camille.delacruz@example.com')) desc,email)
    into passenger_uids from public.app_user where role='PASSENGER';
  perform set_config('request.jwt.claim.sub',admin_uid,true);

  insert into public.operation_settings(id,reservation_minutes) values(true,1440);
  insert into public.port(id,code,name,city,region,is_active) values
    (port_a,'BTG','Batangas Port','Batangas','Batangas',true),
    (port_b,'CAL','Calapan Port','Calapan','Oriental Mindoro',true),
    (port_c,'PGA','Puerto Galera Port','Puerto Galera','Oriental Mindoro',true),
    ('eeeeeeee-0000-4000-8000-000000000004','CAL-SOUTH','Calapan South Terminal','Calapan','Oriental Mindoro',false);
  insert into public.vessel(id,code,name,passenger_capacity,is_active) values
    (vessel_a,'VSL-001','MV Isla Verde',120,true),
    (vessel_b,'VSL-002','MV Mindoro Voyager',80,true),
    (vessel_c,'VSL-003','MV Galera Express',8,true),
    ('eeeeeeee-0000-4000-8000-000000000104','VSL-004','MV Bay Breeze',40,false);
  insert into public.fare_settings(code,regular_fare,student_discount,senior_discount,child_discount,pwd_discount,pregnant_discount,passenger_discounts)
    select id::text,600,20,20,50,20,10,
      barkolink_private.legacy_passenger_discounts('{"student_discount":20,"senior_discount":20,"child_discount":50,"pwd_discount":20,"pregnant_discount":10}'::jsonb)
      || '[{"id":"eeeeeeee-0000-4000-8000-000000000401","name":"Resident","percentage":15,"is_active":true}]'::jsonb
    from public.vessel;
  insert into public.accommodation(id,vessel_id,name,description,capacity,surcharge,is_active) values
    (economy_a,vessel_a,'Economy','Standard seating on the main passenger deck.',80,0,true),
    (premium_a,vessel_a,'Premium','Air-conditioned seating with a PHP 100 surcharge per passenger.',40,100,true),
    (economy_b,vessel_b,'Economy','Standard seating on the main passenger deck.',60,0,true),
    ('eeeeeeee-0000-4000-8000-000000000204',vessel_b,'Premium','Air-conditioned seating on the upper deck.',20,100,true),
    (economy_c,vessel_c,'Economy','Standard seating on the express ferry.',8,0,true),
    ('eeeeeeee-0000-4000-8000-000000000206',vessel_a,'Business','Temporarily unavailable while the cabin is being refurbished.',10,200,false);
  insert into public.ferry_route(code,origin_port_id,destination_port_id,duration_minutes,is_active) values
    ('BTG-CAL',port_a,port_b,90,true),('CAL-BTG',port_b,port_a,90,true),
    ('BTG-PGA',port_a,port_c,120,true),('PGA-BTG',port_c,port_a,120,true),
    ('CAL-PGA',port_b,port_c,60,false);

  for row in select * from (values
    ('TRP2026-1006001',vessel_a,interval '2 hours','BOARDING'),
    ('TRP2026-1006002',vessel_a,interval '6 hours','SCHEDULED'),
    ('TRP2026-1006003',vessel_b,interval '10 hours','DELAYED'),
    ('TRP2026-1006004',vessel_c,interval '1 day','SCHEDULED'),
    ('TRP2026-1006005',vessel_a,interval '1 day 6 hours','SCHEDULED'),
    ('TRP2026-1006006',vessel_a,interval '2 days','SCHEDULED'),
    ('TRP2026-1006007',vessel_a,interval '3 days','CANCELLED'),
    ('TRP2026-1006008',vessel_a,interval '-2 days','COMPLETED'),
    ('TRP2026-1006009',vessel_b,interval '-7 days','COMPLETED')
  ) t(code,vessel,offset_time,status) loop
    insert into public.sailing(code,origin_port_id,destination_port_id,vessel_id,departure_at,arrival_at,duration_minutes,
      regular_fare,student_fare,senior_fare,child_fare,pwd_fare,pregnant_fare,available_seats,status)
    select row.code,case when row.vessel=vessel_c then port_b else port_a end,case when row.vessel=vessel_b then port_c when row.vessel=vessel_c then port_a else port_b end,row.vessel,now()+row.offset_time,now()+row.offset_time+interval '90 minutes',90,
      600,480,480,300,480,540,passenger_capacity,row.status from public.vessel where id=row.vessel;
  end loop;
  -- Six separate calendar months for the revenue chart, using Philippine dates.
  for i in 1..6 loop
    insert into public.sailing(code,origin_port_id,destination_port_id,vessel_id,departure_at,arrival_at,duration_minutes,
      regular_fare,student_fare,senior_fare,child_fare,pwd_fare,pregnant_fare,available_seats,status)
    values('TRP2026-1006'||lpad((9+i)::text,3,'0'),case when i%2=0 then port_b else port_a end,case when i%2=0 then port_a else port_b end,vessel_a,
      (date_trunc('month',now() at time zone 'Asia/Manila')-make_interval(months=>i)+interval '10 days 9 hours') at time zone 'Asia/Manila',
      (date_trunc('month',now() at time zone 'Asia/Manila')-make_interval(months=>i)+interval '10 days 10 hours 30 minutes') at time zone 'Asia/Manila',
      90,600,480,480,300,480,540,120,'COMPLETED');
  end loop;

  create temporary table seed_cases(reference text,code text,kinds text[],stages text[],status text,payment text,premium boolean,walkin boolean) on commit drop;
  insert into seed_cases values
    ('BK-610001','TRP2026-1006002',array['REGULAR'],array['PENDING'],'PENDING','UNPAID',false,false),
    ('BK-610002','TRP2026-1006002',array['STUDENT','SENIOR','CHILD','PWD','PREGNANT','Resident'],array['PENDING'],'PENDING','UNPAID',true,false),
    ('BK-610003','TRP2026-1006002',array['REGULAR'],array['PENDING'],'PENDING','UNPAID',false,false),
    ('BK-610004','TRP2026-1006001',array['REGULAR','STUDENT'],array['ISSUED'],'CONFIRMED','PAID',false,false),
    ('BK-610005','TRP2026-1006001',array['REGULAR','PWD'],array['CHECKED_IN'],'CONFIRMED','PAID',false,false),
    ('BK-610006','TRP2026-1006001',array['REGULAR','SENIOR'],array['BOARDED'],'CONFIRMED','PAID',true,false),
    ('BK-610007','TRP2026-1006001',array['REGULAR'],array['ISSUED'],'CONFIRMED','PAID',false,true),
    ('BK-610008','TRP2026-1006003',array['REGULAR'],array['ISSUED'],'CONFIRMED','PAID',false,false),
    ('BK-610009','TRP2026-1006004',array['REGULAR','REGULAR','REGULAR','REGULAR','REGULAR','REGULAR','REGULAR','REGULAR'],array['ISSUED'],'CONFIRMED','PAID',false,false),
    ('BK-610010','TRP2026-1006007',array['REGULAR','STUDENT'],array['ISSUED'],'CANCELLED','REFUND_PENDING',false,false),
    ('BK-610011','TRP2026-1006007',array['REGULAR'],array['ISSUED'],'CANCELLED','REFUNDED',false,false),
    ('BK-610012','TRP2026-1006002',array['REGULAR'],array['PENDING'],'CANCELLED','UNPAID',false,false),
    ('BK-610013','TRP2026-1006002',array['REGULAR'],array['PENDING'],'EXPIRED','UNPAID',false,false),
    ('BK-610014','TRP2026-1006008',array['REGULAR','CHILD','Resident'],array['BOARDED'],'CONFIRMED','PAID',true,false),
    ('BK-610015','TRP2026-1006009',array['REGULAR','STUDENT'],array['ISSUED'],'CONFIRMED','PAID',false,false);
  for i in 1..12 loop
    insert into seed_cases values('BK-620'||lpad(i::text,2,'0'),'TRP2026-1006005',array['REGULAR','REGULAR',(array['STUDENT','SENIOR','CHILD','PWD','PREGNANT','Resident'])[1+(i-1)%6]],
      array['ISSUED'],'CONFIRMED','PAID',i%2=0,false);
  end loop;
  for i in 1..6 loop
    for j in 1..8 loop
      insert into seed_cases values('BK-63'||i||lpad(j::text,2,'0'),'TRP2026-1006'||lpad((9+i)::text,3,'0'),
        case when j%3=1 then array['REGULAR'] when j%3=2 then array['REGULAR','STUDENT'] else array['REGULAR','CHILD','SENIOR'] end,
        array['BOARDED'],'CONFIRMED','PAID',false,false);
    end loop;
  end loop;

  for row in select * from seed_cases order by reference loop
    case_number:=case_number+1;
    booking_owner:=passenger_uids[1+(case_number-1)%cardinality(passenger_uids)];
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
    values(row.reference,case when row.walkin then walkin_uid else booking_owner end,row.code,row.status,cardinality(kinds),
      amount+surcharge*cardinality(kinds),0,amount+surcharge*cardinality(kinds),case when row.walkin then 'WALK_IN' else 'ONLINE' end,
      row.payment,case when row.payment<>'UNPAID' then 'CASH' else null end,paid_time,case when row.payment<>'UNPAID' then ticketing_uid else null end,
      case when row.status='EXPIRED' then now()-interval '1 hour' else least(creation_time+interval '24 hours',trip.departure_at) end,
      case when row.status='CANCELLED' then 'Vessel maintenance required before departure.' else null end,
      case when row.payment='REFUNDED' then now()-interval '15 minutes' else null end,
      case when row.payment='REFUNDED' then ticketing_uid else null end,
      case when row.payment='REFUNDED' then 'Cash refund recorded at the ticketing counter.' else null end,
      class_id,class_name,surcharge,creation_time,creation_time)
    returning id into booking_id;
    for i in 1..cardinality(kinds) loop
      insert into public.booking_passenger(booking_id,full_name,passenger_type,birth_date,sex,phone,nationality,fare,ticket_status,
        issued_at,checked_in_at,boarded_at,discount_verified_at,discount_verified_by_uid,discount_verification_note,created_at)
      values(booking_id,(case when kinds[i]='SENIOR' then 'Lourdes' when kinds[i]='CHILD' then 'Sofia' when kinds[i]='PREGNANT' then 'Isabella' when i%3=0 then 'Alex' else first_names[1+(case_number+i-2)%cardinality(first_names)] end)||' '||family_names[1+(case_number-1)%cardinality(family_names)],kinds[i],
        case kinds[i] when 'SENIOR' then date '1949-01-01' when 'CHILD' then date '2020-01-01' when 'STUDENT' then date '2005-01-01' else date '1990-01-01' end,
        case when kinds[i] in ('SENIOR','CHILD','PREGNANT') then 'FEMALE' when i%3=0 then 'OTHER' when (1+(case_number+i-2)%cardinality(first_names))%2=0 then 'FEMALE' else 'MALE' end,'00000000000','Filipino',fares[i],stages[1],
        coalesce(paid_time,creation_time),case when stages[1] in ('CHECKED_IN','BOARDED') then coalesce(paid_time,creation_time)+interval '5 minutes' else null end,
        case when stages[1]='BOARDED' then coalesce(paid_time,creation_time)+interval '10 minutes' else null end,
        case when fares[i]<600 and row.payment<>'UNPAID' then paid_time else null end,
        case when fares[i]<600 and row.payment<>'UNPAID' then ticketing_uid else null end,
        case when fares[i]<600 and row.payment<>'UNPAID' then 'Eligibility reviewed at the ticketing counter.' else null end,creation_time)
      returning id into passenger_id;
      if stages[1] in ('CHECKED_IN','BOARDED') then
        insert into public.boarding_event(passenger_id,staff_uid,event_type,created_at) values(passenger_id,boarding_uid,'CHECKED_IN',coalesce(paid_time,creation_time)+interval '5 minutes');
      end if;
      if stages[1]='BOARDED' then
        insert into public.boarding_event(passenger_id,staff_uid,event_type,created_at) values(passenger_id,boarding_uid,'BOARDED',coalesce(paid_time,creation_time)+interval '10 minutes');
      end if;
      if row.reference='BK-610015' then
        insert into public.passenger_no_show(passenger_id,marked_by_uid) values(passenger_id,boarding_uid);
      end if;
    end loop;
  end loop;
  update public.sailing s set available_seats=v.passenger_capacity-coalesce((select sum(b.passenger_count) from public.booking b
    where b.sailing_code=s.code and b.status in ('PENDING','CONFIRMED')),0) from public.vessel v where v.id=s.vessel_id;

  insert into public.travel_advisory(title,message,category,priority,sailing_code,starts_at,ends_at,published) values
    ('Boarding at Gate 2','Please be at Gate 2 at least 30 minutes before departure. Keep your ticket and valid ID ready.','GENERAL','LOW','TRP2026-1006001',now()-interval '1 hour',now()+interval '2 days',true),
    ('Updated departure schedule','The departure time has been adjusted. Please check your booking for the latest schedule.','SCHEDULE','MEDIUM','TRP2026-1006003',now()-interval '1 hour',now()+interval '2 days',true),
    ('Weekend terminal guidance','Allow extra time at the terminal during the weekend. Follow the boarding lane indicated on your ticket.','GENERAL','LOW',null,now(),now()+interval '3 days',false),
    ('Terminal lane update','The temporary boarding lane arrangement has ended. Please use the regular boarding gate.','GENERAL','LOW',null,now()-interval '4 days',now()-interval '1 day',true);
  insert into public.saved_traveler(owner_uid,full_name,birth_date,sex,phone,nationality)
    select u.uid,case t.n when 1 then u.full_name when 2 then 'Lucas '||split_part(u.full_name,' ',array_length(string_to_array(u.full_name,' '),1)) else 'Alex '||split_part(u.full_name,' ',array_length(string_to_array(u.full_name,' '),1)) end,
      t.birth_date,case when t.n=1 and u.email not in ('ana.santos@example.com','camille.delacruz@example.com') then 'MALE' else t.sex end,'00000000000','Filipino' from public.app_user u cross join (values
      (1,date '1990-01-01','FEMALE'),(2,date '2020-01-01','MALE'),(3,date '1995-01-01','OTHER')) t(n,birth_date,sex) where u.role='PASSENGER';
  insert into public.notification_campaign(id,title,message,audience,sent_by_uid,recipient_count)
    select campaign,'Welcome aboard BarkoLink','View your reservations, check departure times and keep your ticket ready before you travel.',
      'ALL',admin_uid,count(*) from public.app_user where role<>'WALK_IN';
  insert into public.notification(owner_uid,title,message,category,campaign_id)
    select uid,'Welcome aboard BarkoLink','Check your booking for the latest departure time and boarding instructions.','GENERAL',campaign from public.app_user where role<>'WALK_IN';
  insert into public.notification(owner_uid,title,message,category,read_at) values
    (passenger_uid,'Reservation received','Your reservation is available in My Bookings.','BOOKING',now()),
    (passenger_uid,'Your boarding information','Please arrive at the terminal early and present your booking reference at the counter.','BOOKING',null);
  insert into public.activity_log(actor_uid,action,entity_type,entity_id,details)
    values(admin_uid,'DEMO_DATA_LOADED','dataset','BARKOLINK-DEMO',jsonb_build_object('fictional',true,'users_preserved',true));
end $$;


with people as (
  select p.id,p.passenger_type,least((s.departure_at at time zone 'Asia/Manila')::date,(now() at time zone 'Asia/Manila')::date) as at_date,
    ('x'||substr(md5(p.id::text),1,8))::bit(32)::bigint as salt,
    row_number() over(order by md5(p.id::text)) as n
  from public.booking_passenger p join public.booking b on b.id=p.booking_id join public.sailing s on s.code=b.sailing_code
  where b.reference ~ '^BK-(6100[01][0-9]|620[01][0-9]|63[1-6]0[1-8])$'
), varied as (
  select *,case passenger_type when 'CHILD' then 3+salt%9 when 'SENIOR' then 61+salt%18
    when 'STUDENT' then 18+salt%7 when 'PREGNANT' then 22+salt%17 else 25+salt%31 end as years
  from people
)
update public.booking_passenger p set
  phone=case when p.phone is null or p.phone='00000000000' then
    (array['0917','0918','0919','0920','0927','0930','0945','0956','0961','0975','0995'])[1+(v.salt%11)::integer]
      ||lpad(((v.n*7919+2468101)%10000000)::text,7,'0') else p.phone end,
  birth_date=case when p.birth_date is null or p.birth_date in (date '1949-01-01',date '2020-01-01',date '2005-01-01',date '1990-01-01') then
    (v.at_date-make_interval(years=>v.years::integer,days=>((v.salt/31)%365)::integer))::date else p.birth_date end
from varied v where v.id=p.id;

with people as (
  select t.id,('x'||substr(md5(t.id::text),1,8))::bit(32)::bigint as salt,
    row_number() over(order by md5(t.id::text)) as n,
    case when t.full_name like 'Lucas %' then 4 else 30 end as min_age,
    case when t.full_name like 'Lucas %' then 7 else 20 end as age_span
  from public.saved_traveler t join public.app_user u on u.uid=t.owner_uid
  where t.full_name=u.full_name or t.full_name like 'Lucas %' or t.full_name like 'Alex %'
)
update public.saved_traveler t set
  phone=case when t.phone='00000000000' then
    (array['0917','0918','0919','0920','0927','0930','0945','0956','0961','0975','0995'])[1+(p.salt%11)::integer]
      ||lpad(((p.n*7919+7654321)%10000000)::text,7,'0') else t.phone end,
  birth_date=case when t.birth_date in (date '1990-01-01',date '2020-01-01',date '1995-01-01') then
    ((now() at time zone 'Asia/Manila')::date-make_interval(years=>(p.min_age+p.salt%p.age_span)::integer,days=>((p.salt/31)%365)::integer))::date else t.birth_date end
from people p where p.id=t.id;
