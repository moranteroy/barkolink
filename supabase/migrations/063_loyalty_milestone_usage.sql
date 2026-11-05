-- Read-only usage summaries for the three milestone cards. Platinum includes
-- recurring rewards after the third milestone; voucher amounts are not identities.
create function barkolink_private.loyalty_milestone_usage(actor text) returns jsonb
language sql stable set search_path='' as $$
  with rewards as (
    select least(v.loyalty_reward_number,3) reward_number,
      case
        when exists(select 1 from public.booking b where b.voucher_id=v.id) then 'USED'
        when v.expires_at<=now() then 'EXPIRED'
        when not v.is_active then 'UNAVAILABLE'
        when v.starts_at>now() then 'PENDING'
        else 'READY'
      end state
    from public.voucher v where v.owner_uid=actor and v.loyalty_reward_number is not null
  ), summaries as (
    select n.reward_number,
      count(*) filter(where r.state='READY') ready_count,
      count(*) filter(where r.state='USED') used_count,
      count(*) filter(where r.state='EXPIRED') expired_count,
      count(*) filter(where r.state='UNAVAILABLE') unavailable_count,
      count(*) filter(where r.state='PENDING') pending_count
    from generate_series(1,3) n(reward_number)
    left join rewards r using(reward_number) group by n.reward_number
  )
  select jsonb_agg(to_jsonb(s) order by s.reward_number) from summaries s;
$$;
revoke all on function barkolink_private.loyalty_milestone_usage(text) from public,anon,authenticated;

-- Extend the existing MyLoyalty response without another dispatcher wrapper.
-- That branch has already verified PASSENGER and derives actor_uid from Auth.
do $$declare definition text; previous text;begin
  definition:=pg_get_functiondef('barkolink_private.execute_flexible_discounts_v31(text,jsonb,text,text)'::regprocedure);
  previous:=definition;
  definition:=replace(definition,
    'return result||jsonb_build_object(''trips_per_reward'',cycle',
    'return result||jsonb_build_object(''milestones'',barkolink_private.loyalty_milestone_usage(actor_uid),''trips_per_reward'',cycle');
  if definition=previous then raise exception 'MyLoyalty milestone insertion point was not found.';end if;
  execute definition;
end $$;
