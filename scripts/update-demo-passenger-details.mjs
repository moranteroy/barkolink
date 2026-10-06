import fs from 'node:fs'
import crypto from 'node:crypto'
import { queryLive, usersExpression } from './test-data-database.mjs'
import { demoPassengerDetailsSql } from './demo-passenger-details.mjs'

const snapshot = (await queryLive(`select
  (select coalesce(jsonb_agg(to_jsonb(p) order by id),'[]') from public.booking_passenger p) as passengers,
  (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.saved_traveler t) as travelers`))[0]
fs.mkdirSync('.backups', { recursive: true })
const file = `.backups/passenger-details-before-${Date.now()}.json`
const contents = JSON.stringify(snapshot, null, 2)
fs.writeFileSync(file, contents, { flag: 'wx', mode: 0o600 })
fs.writeFileSync(`${file}.sha256`, crypto.createHash('sha256').update(contents).digest('hex'), { flag: 'wx' })
await queryLive(`begin;
  lock table public.booking_passenger,public.saved_traveler in share row exclusive mode;
  create temporary table preserved_users as select ${usersExpression} as value;
  ${demoPassengerDetailsSql}
  do $$ begin
    if ${usersExpression} is distinct from (select value from preserved_users) then raise exception 'User records changed; rollback required'; end if;
  end $$;
  drop table preserved_users;
  commit;`, false)
const result = await queryLive(`select count(*) as passengers,count(distinct phone) as distinct_phones,
  count(distinct birth_date) as distinct_birthdates,count(*) filter(where phone='00000000000' or phone is null) as placeholder_phones
  from public.booking_passenger`)
const travelers = await queryLive(`select count(*) as saved_travelers,count(distinct phone) as distinct_phones,
  count(distinct birth_date) as distinct_birthdates,count(*) filter(where phone='00000000000') as placeholder_phones from public.saved_traveler`)
const validation = await queryLive(`select count(*) filter(where p.phone !~ '^09[0-9]{9}$') as invalid_phone_format,
  count(*) filter(where p.birth_date>(now() at time zone 'Asia/Manila')::date
    or (p.passenger_type='CHILD' and extract(year from age(least(s.departure_at,now()),p.birth_date)) not between 3 and 11)
    or (p.passenger_type='SENIOR' and extract(year from age(least(s.departure_at,now()),p.birth_date))<60)) as invalid_age
  from public.booking_passenger p join public.booking b on b.id=p.booking_id join public.sailing s on s.code=b.sailing_code`)
if (validation.some(row => Number(row.invalid_phone_format) || Number(row.invalid_age))) throw new Error('Passenger detail validation failed.')
console.log(JSON.stringify({ updated: true, result, travelers, validation, backup: file }))
