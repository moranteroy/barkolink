-- Realistic demonstration records; amounts and boarding plans are simulated.
-- Additive only. Execute through apply-demonstration-data.mjs inside a transaction.
-- The private manifest identifies generated records without changing visible codes.
create table if not exists barkolink_private.demonstration_batch (
 id text primary key,created_at timestamptz not null default now(),manifest jsonb not null
);
revoke all on barkolink_private.demonstration_batch from public,anon,authenticated;
create temporary table demo_sailings(code text primary key,scenario text not null) on commit drop;
create temporary table demo_vouchers(id uuid,position integer) on commit drop;
do $$
declare
 v public.vessel; s public.sailing; cabin public.accommodation;
 vessels uuid[]; passengers text[]; walkins text[]:='{}';
 admin_uid text; boarding_uid text; owner text; origin_id uuid; destination_id uuid;
 trip_code text; booking_code text; booking_id uuid; passenger_id uuid; voucher_id uuid;
 trip_status text; booking_status text; payment text; ticket_status text; scenario text;
 depart timestamptz; arrival timestamptz; boarding timestamptz; created timestamptz; paid timestamptz;
 first_names text[]:=array['Marco','Elena','Paolo','Sofia','Daniel','Isabella','Luis','Angela','Rafael','Mariana','Carlo','Bianca','Gabriel','Andrea','Miguel','Camille'];
 surnames text[]:=array['Santos','Reyes','Dela Cruz','Garcia','Mendoza','Navarro','Castillo','Ramos','Aquino','Torres','Bautista','Flores','Villanueva','Cruz','Lopez'];
 kinds text[]; amounts integer[]; total_fares integer; surcharge integer; discount integer;
 i integer; j integer; k integer; seq integer; n integer; bookings integer; taken integer;
 voucher_ids uuid[]:='{}'; new_users text[]:='{}'; new_fares text[]:='{}'; new_classes uuid[]:='{}';
begin
 if exists(select 1 from barkolink_private.demonstration_batch where id='batangas-calapan-2026-v1') then raise exception 'Demonstration batch already exists'; end if;
 select uid into admin_uid from public.app_user where role='ADMIN' order by created_at limit 1;
 if admin_uid is null then raise exception 'An existing administrator is required'; end if;
 select array_agg(uid order by uid) into passengers from public.app_user
 where role='PASSENGER' and (email like '%@example.com' or email like '%.invalid');
 select array_agg(ship.id order by ship.code) into vessels from public.vessel ship where ship.is_active and ship.passenger_capacity>=100
 and exists(select 1 from public.vessel_route vr join public.ferry_route r on r.id=vr.route_id where vr.vessel_id=ship.id and r.is_active);
 if coalesce(cardinality(vessels),0)=0 then raise exception 'No eligible corridor vessels'; end if;
 for i in 1..30 loop
   owner:='guest-'||gen_random_uuid()::text;
   insert into public.app_user(uid,email,full_name,role)
   values(owner,owner||'@example.invalid',first_names[1+(i-1)%16]||' '||surnames[1+(i-1)%15],'WALK_IN');
   walkins:=array_append(walkins,owner);new_users:=array_append(new_users,owner);
 end loop;
 -- Preserve existing rates and cabin allocations. Supply demo rates only where absent.
 foreach origin_id in array vessels loop
   select * into v from public.vessel where id=origin_id;
   if not exists(select 1 from public.fare_settings where code=v.id::text) then
     insert into public.fare_settings(code,regular_fare,student_discount,senior_discount,child_discount,pwd_discount,pregnant_discount)
     values(v.id::text,600,20,20,50,20,0);
     new_fares:=array_append(new_fares,v.id::text);
   end if;
   if not exists(select 1 from public.accommodation where vessel_id=v.id) then
     insert into public.accommodation(vessel_id,name,description,capacity,surcharge,is_active)
     values(v.id,'Economy','Standard passenger seating.',v.passenger_capacity-v.passenger_capacity/4,0,true)
     returning id into voucher_id;new_classes:=array_append(new_classes,voucher_id);
     insert into public.accommodation(vessel_id,name,description,capacity,surcharge,is_active)
     values(v.id,'Premium Economy','Passenger seating with an additional accommodation charge.',v.passenger_capacity/4,100,true)
     returning id into voucher_id;new_classes:=array_append(new_classes,voucher_id);
   end if;
 end loop;
 for i in 1..6 loop
   insert into public.voucher(code,discount_type,value,minimum_spend,usage_limit,starts_at,expires_at,is_active)
   values(barkolink_private.new_voucher_code(),case when i%2=0 then 'PERCENT' else 'FIXED' end,
     case when i%2=0 then 10 else 75 end,300,case when i=6 then 1 else 500 end,
     case when i=4 then now()+interval '2 days' else now()-interval '10 days' end,
     case when i=3 then now()-interval '1 day' else now()+interval '30 days' end,i<>5)
   returning id into voucher_id;
   insert into demo_vouchers values(voucher_id,i);voucher_ids:=array_append(voucher_ids,voucher_id);
 end loop;
 for i in 1..60 loop
   select * into v from public.vessel where id=vessels[1+(i-1)%cardinality(vessels)];
   select id into origin_id from public.port where code=case when i%2=1 then 'BTG' else 'CAL' end;
   select id into destination_id from public.port where code=case when i%2=1 then 'CAL' else 'BTG' end;
   scenario:=case i when 1 then 'automatic-boarding' when 2 then 'automatic-completion' when 3 then 'delayed' when 4 then 'cancelled' when 5 then 'boarding-workspace' when 6 then 'sold-out' else case when i<=18 then 'history' else 'upcoming' end end;
   trip_status:=case when i in (2,5) then 'BOARDING' when i=3 then 'DELAYED' when i=4 then 'CANCELLED' when i between 7 and 18 then 'COMPLETED' else 'SCHEDULED' end;
   depart:=case when i=1 then now()+interval '30 minutes' when i=2 then now()-interval '89 minutes'
     when i=3 then now()+interval '5 hours' when i=4 then now()+interval '1 day' when i=5 then now()+interval '45 minutes'
     when i=6 then now()+interval '2 days'
     when i<=18 then (date_trunc('month',now() at time zone 'Asia/Manila')-make_interval(months=>1+(i-7)/2)+make_interval(days=>10+(i%2),hours=>9)) at time zone 'Asia/Manila'
     else (date_trunc('day',now() at time zone 'Asia/Manila')+make_interval(days=>1+(i-19)/4,hours=>6+((i-19)%4)*4)) at time zone 'Asia/Manila' end;
   arrival:=depart+interval '90 minutes';
   boarding:=case when i=1 then now()+interval '15 seconds' when i=5 then now()-interval '1 minute' else depart-interval '30 minutes' end;
   trip_code:='TRP'||to_char(depart at time zone 'Asia/Manila','YYYY-MMDD');
   select coalesce(max(substring(code from 13)::integer),0)+1 into seq from public.sailing
     where code ~ ('^'||trip_code||'[0-9]{3,}$');
   trip_code:=trip_code||lpad(seq::text,greatest(3,length(seq::text)),'0');
   insert into public.sailing(code,origin_port_id,destination_port_id,vessel_id,departure_at,arrival_at,duration_minutes,
     regular_fare,student_fare,senior_fare,child_fare,pwd_fare,pregnant_fare,available_seats,status,boarding_at,boarding_time_source)
   values(trip_code,origin_id,destination_id,v.id,depart,arrival,90,600,480,480,300,480,600,v.passenger_capacity,trip_status,boarding,'Boarding plan approved for system demonstration.');
   insert into demo_sailings values(trip_code,scenario);
   select * into s from public.sailing where code=trip_code;
   bookings:=case when i=6 then (v.passenger_capacity+7)/8 else 12 end;taken:=0;
   for j in 1..bookings loop
     n:=case when i=6 then least(8,v.passenger_capacity-taken) else 1+(j-1)%4 end;
     booking_status:=case when i=4 then 'CANCELLED' when i>=19 and j=12 then 'EXPIRED' when i>=19 and j%4=0 then 'PENDING' else 'CONFIRMED' end;
     payment:=case when i=4 then case when j%3=0 then 'UNPAID' when j%2=0 then 'REFUNDED' else 'REFUND_PENDING' end when booking_status in ('PENDING','EXPIRED') then 'UNPAID' else 'PAID' end;
     ticket_status:=case when payment='UNPAID' then 'PENDING' when i between 7 and 18 then case when j=12 then 'ISSUED' else 'BOARDED' end when i in (2,5) then (array['ISSUED','CHECKED_IN','BOARDED'])[1+(j-1)%3] else 'ISSUED' end;
     if i between 7 and 18 and j=12 then ticket_status:='ISSUED'; end if;
     select * into cabin from public.accommodation a where a.vessel_id=v.id and a.is_active order by a.surcharge,a.id limit 1;
     surcharge:=coalesce(cabin.surcharge,0);
     -- Keep sold-out seats in the base cabin snapshot, without overallocating cabins.
     if i=6 then cabin:=null;surcharge:=0; end if;
     kinds:='{}';amounts:='{}';
     for k in 1..n loop
       kinds:=array_append(kinds,(array['REGULAR','STUDENT','SENIOR','CHILD','PWD','PREGNANT'])[1+(i+j+k-3)%6]);
       amounts:=array_append(amounts,barkolink_private.fare(s,kinds[k]));
     end loop;
     select sum(f) into total_fares from unnest(amounts) f;
     owner:=case when j%2=0 and coalesce(cardinality(passengers),0)>0 then passengers[1+(i+j-2)%cardinality(passengers)] else walkins[1+(i+j-2)%30] end;
     created:=case when depart<now() then depart-interval '1 day' else now()-interval '1 hour' end;
     paid:=case when payment<>'UNPAID' then created+interval '10 minutes' else null end;
     voucher_id:=case when i=6 and j=1 then voucher_ids[6] when i>=19 and j%5=0
       and not exists(select 1 from public.booking b where b.owner_uid=owner and b.voucher_id=voucher_ids[1] and b.status in ('PENDING','CONFIRMED')) then voucher_ids[1] else null end;
     discount:=case when voucher_id= voucher_ids[6] then greatest(1,floor((total_fares+surcharge*n)*.1))::integer when voucher_id is not null then 75 else 0 end;
     booking_code:='BKG'||to_char(created at time zone 'Asia/Manila','YYYY-MMDD')||lpad((('x'||substr(replace(gen_random_uuid()::text,'-',''),1,10))::bit(40)::bigint)::text,12,'0');
     insert into public.booking(reference,owner_uid,sailing_code,status,passenger_count,passenger_fare_total,service_fee,total,booking_channel,
       payment_status,payment_method,paid_at,collected_by_uid,payment_deadline,cancellation_reason,refunded_at,refunded_by_uid,refund_note,
       accommodation_id,accommodation_name,accommodation_surcharge,voucher_id,voucher_code,voucher_discount,created_at,updated_at)
     values(booking_code,owner,trip_code,booking_status,n,total_fares+surcharge*n,0,total_fares+surcharge*n-discount,
       case when owner=any(walkins) then 'WALK_IN' else 'ONLINE' end,payment,case when payment='UNPAID' then null else 'CASH' end,paid,
       case when paid is null then null else admin_uid end,case when booking_status='EXPIRED' then now()-interval '10 minutes' else least(now()+interval '24 hours',depart) end,
       case when i=4 then 'Departure cancelled due to vessel maintenance.' else null end,
       case when payment='REFUNDED' then created+interval '20 minutes' else null end,case when payment='REFUNDED' then admin_uid else null end,
       case when payment='REFUNDED' then 'Refund recorded at the ticketing counter.' else null end,cabin.id,cabin.name,surcharge,
       voucher_id,(select code from public.voucher where id=voucher_id),discount,created,created)
     returning id into booking_id;
     select uid into boarding_uid from public.app_user where role='BOARDING' and assigned_port_id=origin_id order by created_at limit 1;
     boarding_uid:=coalesce(boarding_uid,admin_uid);
     for k in 1..n loop
       insert into public.booking_passenger(booking_id,full_name,passenger_type,birth_date,sex,nationality,fare,ticket_status,issued_at,checked_in_at,boarded_at,
         discount_verified_at,discount_verified_by_uid,discount_verification_note,created_at)
       values(booking_id,first_names[1+(i+j+k-3)%16]||' '||surnames[1+(i+j-2)%15],kinds[k],
         case kinds[k] when 'SENIOR' then date '1955-05-12' when 'CHILD' then date '2018-08-21' when 'STUDENT' then date '2005-02-14' else date '1990-06-18' end,
         case when kinds[k]='PREGNANT' or k%2=0 then 'FEMALE' else 'MALE' end,'Filipino',amounts[k],ticket_status,coalesce(paid,created),
         case when ticket_status in ('CHECKED_IN','BOARDED') then least(coalesce(paid,created)+interval '5 minutes',boarding) else null end,
         case when ticket_status='BOARDED' then boarding else null end,
         case when payment<>'UNPAID' and amounts[k]<600 then paid else null end,case when payment<>'UNPAID' and amounts[k]<600 then admin_uid else null end,
         case when payment<>'UNPAID' and amounts[k]<600 then 'Eligibility reviewed at the ticketing counter.' else null end,created)
       returning id into passenger_id;
       if ticket_status in ('CHECKED_IN','BOARDED') then insert into public.boarding_event(passenger_id,staff_uid,event_type,created_at) values(passenger_id,boarding_uid,'CHECKED_IN',least(coalesce(paid,created)+interval '5 minutes',boarding)); end if;
       if ticket_status='BOARDED' then insert into public.boarding_event(passenger_id,staff_uid,event_type,created_at) values(passenger_id,boarding_uid,'BOARDED',boarding); end if;
       if i between 7 and 18 and j=12 then insert into public.passenger_no_show(passenger_id,marked_by_uid) values(passenger_id,boarding_uid); end if;
     end loop;
     if booking_status in ('PENDING','CONFIRMED') then taken:=taken+n; end if;
   end loop;
   update public.sailing set available_seats=v.passenger_capacity-taken where code=trip_code;
 end loop;
 insert into barkolink_private.demonstration_batch(id,manifest) values('batangas-calapan-2026-v1',jsonb_build_object(
   'synthetic',true,'sailings',(select jsonb_agg(to_jsonb(t) order by code) from demo_sailings t),'newUsers',new_users,'newFareSettings',new_fares,'newAccommodations',new_classes,'vouchers',voucher_ids));
end $$;
