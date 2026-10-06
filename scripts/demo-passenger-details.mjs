// Stable shuffled sample values; no messages/calls are sent to generated numbers.
export const demoPassengerDetailsSql = `
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
`
