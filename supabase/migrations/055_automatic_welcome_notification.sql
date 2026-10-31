-- Only the designated welcome campaign follows future account registrations.
alter table public.notification_campaign add column is_welcome boolean not null default false;
alter table public.notification_campaign add constraint welcome_audience check (not is_welcome or (audience='ALL' and sailing_code is null));
create unique index notification_one_welcome on public.notification_campaign(is_welcome) where is_welcome;

create function barkolink_private.welcome_account() returns trigger
language plpgsql security definer set search_path='' as $$
declare campaign public.notification_campaign; delivered integer;
begin
  if new.role not in ('PASSENGER','TICKETING','BOARDING','ADMIN') then return new; end if;
  select * into campaign from public.notification_campaign where is_welcome;
  if not found then return new; end if;
  insert into public.notification(owner_uid,title,message,category,campaign_id)
    values(new.uid,campaign.title,campaign.message,'GENERAL',campaign.id)
    on conflict(campaign_id,owner_uid) where campaign_id is not null do nothing;
  get diagnostics delivered=row_count;
  if delivered>0 then
    update public.notification_campaign set recipient_count=recipient_count+delivered where id=campaign.id;
  end if;
  return new;
end $$;
revoke all on function barkolink_private.welcome_account() from public,anon,authenticated;
create trigger account_welcome after insert or update of role on public.app_user
  for each row execute function barkolink_private.welcome_account();

create function barkolink_private.welcome_existing_accounts() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not new.is_welcome then return new; end if;
  insert into public.notification(owner_uid,title,message,category,campaign_id)
    select uid,new.title,new.message,'GENERAL',new.id from public.app_user
    where role in ('PASSENGER','TICKETING','BOARDING','ADMIN')
    on conflict(campaign_id,owner_uid) where campaign_id is not null do nothing;
  update public.notification_campaign set recipient_count=(select count(*) from public.notification where campaign_id=new.id) where id=new.id;
  return new;
end $$;
revoke all on function barkolink_private.welcome_existing_accounts() from public,anon,authenticated;
create trigger campaign_welcome after insert or update of is_welcome on public.notification_campaign
  for each row when(new.is_welcome) execute function barkolink_private.welcome_existing_accounts();

-- Hold registrations until both the backfill and future-registration trigger are ready.
lock table public.app_user in share row exclusive mode;
update public.notification_campaign set is_welcome=true
where id=(select id from public.notification_campaign
  where title='Welcome aboard BarkoLink' and audience='ALL' and sailing_code is null
  order by created_at,id limit 1);
