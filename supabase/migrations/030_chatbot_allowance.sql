create table barkolink_private.chatbot_usage (
  actor_id uuid primary key references auth.users(id) on delete cascade,
  window_at timestamptz not null,
  window_count integer not null,
  usage_day date not null,
  day_count integer not null
);
revoke all on barkolink_private.chatbot_usage from public, anon, authenticated;

create function public.consume_chatbot_allowance() returns boolean
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); usage barkolink_private.chatbot_usage;
begin
  if actor is null or not exists(select 1 from auth.users where id=actor and coalesce(raw_app_meta_data->>'role','PASSENGER')='PASSENGER') then
    raise exception 'Passenger sign-in required.' using errcode='42501';
  end if;
  insert into barkolink_private.chatbot_usage values(actor,now(),1,(now() at time zone 'UTC')::date,1)
  on conflict(actor_id) do update set
    window_at=case when chatbot_usage.window_at<=now()-interval '10 minutes' then now() else chatbot_usage.window_at end,
    window_count=case when chatbot_usage.window_at<=now()-interval '10 minutes' then 1 else chatbot_usage.window_count+1 end,
    usage_day=(now() at time zone 'UTC')::date,
    day_count=case when chatbot_usage.usage_day<>(now() at time zone 'UTC')::date then 1 else chatbot_usage.day_count+1 end
  returning * into usage;
  return usage.window_count<=12 and usage.day_count<=100;
end $$;
revoke all on function public.consume_chatbot_allowance() from public,anon;
grant execute on function public.consume_chatbot_allowance() to authenticated;
