-- Switching the application requirement off must preserve the Auth factor.
create table barkolink_private.account_mfa_preference (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null,
  last_verification bigint not null,
  updated_at timestamptz not null default now()
);
revoke all on barkolink_private.account_mfa_preference from public,anon,authenticated;

create or replace function barkolink_private.account_mfa_required(p_actor uuid,p_role text) returns boolean
language plpgsql stable set search_path='' as $$
begin
  if p_role not in ('ADMIN','TICKETING','BOARDING') then return false;end if;
  if p_role in ('TICKETING','BOARDING') and (select staff_required from barkolink_private.mfa_policy where singleton) then return true;end if;
  if to_regclass('auth.mfa_factors') is null then return true;end if;
  return coalesce((select enabled from barkolink_private.account_mfa_preference where user_id=p_actor),true)
    and exists(select 1 from auth.mfa_factors where user_id=p_actor and status='verified');
end $$;

create or replace function public.my_mfa_settings() returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); actor_role text; linked boolean; required boolean; preference boolean;
begin
  if actor is null then raise exception 'Sign in first.' using errcode='42501';end if;
  select coalesce(raw_app_meta_data->>'role','PASSENGER') into actor_role from auth.users where id=actor;
  if not found then raise exception 'Account was not found.' using errcode='42501';end if;
  select exists(select 1 from auth.mfa_factors where user_id=actor and status='verified' and factor_type='totp') into linked;
  select staff_required into required from barkolink_private.mfa_policy where singleton;
  select enabled into preference from barkolink_private.account_mfa_preference where user_id=actor;
  return jsonb_build_object('role',actor_role,'authenticatorLinked',linked,
    'enabled',linked and (coalesce(preference,true) or (actor_role in ('TICKETING','BOARDING') and required)),
    'staffRequired',required,'policyRequired',actor_role in ('TICKETING','BOARDING') and required,
    'mfaRequired',barkolink_private.account_mfa_required(actor,actor_role));
end $$;

create function public.set_account_mfa_enabled(p_enabled boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); actor_role text; required boolean; claims jsonb;
  verified_at bigint; last_used bigint;
begin
  select raw_app_meta_data->>'role' into actor_role from auth.users where id=actor;
  if actor is null or actor_role not in ('ADMIN','TICKETING','BOARDING') or actor_role is null then
    raise exception 'Staff or administrator access required.' using errcode='42501';end if;
  if p_enabled is null then raise exception 'Choose On or Off.';end if;
  -- Serialize policy changes and concurrent toggles; one proof cannot be replayed.
  select staff_required into required from barkolink_private.mfa_policy where singleton for share;
  if not p_enabled and actor_role in ('TICKETING','BOARDING') and required then
    raise exception 'Your administrator requires staff two-factor authentication.' using errcode='42501';end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,47621));
  claims:=coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb);
  select max((item->>'timestamp')::bigint) into verified_at from jsonb_array_elements(
    case when jsonb_typeof(claims->'amr')='array' then claims->'amr' else '[]'::jsonb end) item
    where item->>'method'='totp' and item->>'timestamp' ~ '^[0-9]{1,12}$';
  if claims->>'aal' is distinct from 'aal2' or verified_at is null
    or verified_at<extract(epoch from now())-300 or verified_at>extract(epoch from now())+30 then
    raise exception 'Verify a fresh authenticator code before changing 2FA.' using errcode='42501';end if;
  if not exists(select 1 from auth.mfa_factors where user_id=actor and factor_type='totp' and status='verified') then
    raise exception 'Link an authenticator before changing 2FA.' using errcode='42501';end if;
  select last_verification into last_used from barkolink_private.account_mfa_preference where user_id=actor;
  if last_used is not null and verified_at<=last_used then
    raise exception 'Use a new authenticator code before changing 2FA again.' using errcode='42501';end if;
  insert into barkolink_private.account_mfa_preference(user_id,enabled,last_verification)
    values(actor,p_enabled,verified_at) on conflict(user_id) do update
    set enabled=excluded.enabled,last_verification=excluded.last_verification,updated_at=now();
  insert into public.activity_log(actor_uid,action,entity_type,entity_id,details)
    values(actor::text,'ACCOUNT_MFA_UPDATED','account_mfa',actor::text,jsonb_build_object('enabled',p_enabled));
  return public.my_mfa_settings();
end $$;
revoke all on function public.set_account_mfa_enabled(boolean) from public,anon;
grant execute on function public.set_account_mfa_enabled(boolean) to authenticated;
revoke all on all functions in schema barkolink_private from public,anon,authenticated;
