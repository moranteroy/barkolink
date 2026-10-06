import { queryLive, usersExpression } from './test-data-database.mjs'

await queryLive(`begin;
do $$ declare before_users jsonb:=${usersExpression}; begin
  update public.booking_passenger p set full_name='Alex '||substring(p.full_name from position(' ' in p.full_name)+1)
    from public.booking b where b.id=p.booking_id and b.reference ~ '^BK-(6100[01][0-9]|620[01][0-9]|63[1-6]0[1-8])$'
    and p.sex='OTHER' and p.passenger_type not in ('SENIOR','CHILD','PREGNANT');
  update public.booking_passenger p set sex=case when split_part(p.full_name,' ',1)='Alex' then 'OTHER'
    when split_part(p.full_name,' ',1) in ('Elena','Sofia','Isabella','Angela','Mariana','Bianca','Lourdes') then 'FEMALE' else 'MALE' end
    from public.booking b where b.id=p.booking_id and b.reference ~ '^BK-(6100[01][0-9]|620[01][0-9]|63[1-6]0[1-8])$';
  update public.saved_traveler t set sex='MALE' from public.app_user u
    where u.uid=t.owner_uid and t.full_name=u.full_name and u.email not in ('ana.santos@example.com','camille.delacruz@example.com');
  if ${usersExpression} is distinct from before_users then raise exception 'Unexpected user change; rolled back'; end if;
end $$;
commit;`, false)
console.log('Demo passenger identity examples normalized; user accounts unchanged.')
