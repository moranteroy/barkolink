create table barkolink_private.mfa_policy (
  singleton boolean primary key default true check(singleton),
  staff_required boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into barkolink_private.mfa_policy(singleton) values(true);
revoke all on barkolink_private.mfa_policy from public,anon,authenticated;

create function barkolink_private.account_mfa_required(p_actor uuid,p_role text) returns boolean
language plpgsql stable set search_path='' as $$
begin
  if p_role not in ('ADMIN','TICKETING','BOARDING') then return false;end if;
  if p_role in ('TICKETING','BOARDING') and (select staff_required from barkolink_private.mfa_policy where singleton) then return true;end if;
  -- A missing Auth relation must never make an opted-in account less protected.
  if to_regclass('auth.mfa_factors') is null then return true;end if;
  return exists(select 1 from auth.mfa_factors where user_id=p_actor and status='verified');
end $$;

create or replace function barkolink_private.require_staff_mfa(actor_role text) returns void
language plpgsql set search_path='' as $$
begin
  if actor_role in ('ADMIN','TICKETING','BOARDING') and
    coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'aal','')<>'aal2' and
    barkolink_private.account_mfa_required(auth.uid(),actor_role) then
    raise exception 'Verify your authenticator code before accessing the staff workspace.' using errcode='42501';
  end if;
end $$;

-- Available before step-up so the router can decide whether setup is required.
create function public.my_mfa_settings() returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); actor_role text; enabled boolean; required boolean;
begin
  if actor is null then raise exception 'Sign in first.' using errcode='42501';end if;
  select coalesce(raw_app_meta_data->>'role','PASSENGER') into actor_role from auth.users where id=actor;
  if not found then raise exception 'Account was not found.' using errcode='42501';end if;
  select exists(select 1 from auth.mfa_factors where user_id=actor and status='verified' and factor_type='totp') into enabled;
  select staff_required into required from barkolink_private.mfa_policy where singleton;
  return jsonb_build_object('role',actor_role,'enabled',enabled,'staffRequired',required,
    'policyRequired',actor_role in ('TICKETING','BOARDING') and required,
    'mfaRequired',barkolink_private.account_mfa_required(actor,actor_role));
end $$;
revoke all on function public.my_mfa_settings() from public,anon;
grant execute on function public.my_mfa_settings() to authenticated;

create function public.set_staff_mfa_required(p_required boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); actor_role text;
begin
  select raw_app_meta_data->>'role' into actor_role from auth.users where id=actor;
  if actor is null or actor_role is distinct from 'ADMIN' then raise exception 'Administrator access required.' using errcode='42501';end if;
  perform barkolink_private.require_staff_mfa(actor_role);
  if p_required is null then raise exception 'Choose whether staff 2FA is required.';end if;
  update barkolink_private.mfa_policy set staff_required=p_required,updated_at=now() where singleton;
  insert into public.activity_log(actor_uid,action,entity_type,entity_id,details)
    values(actor::text,'MFA_POLICY_UPDATED','mfa_policy','staff',jsonb_build_object('staff_required',p_required));
  return public.my_mfa_settings();
end $$;
revoke all on function public.set_staff_mfa_required(boolean) from public,anon;
grant execute on function public.set_staff_mfa_required(boolean) to authenticated;

-- The account-management Edge Function validates the caller, then consults the
-- same rule using its service role. No caller can query another account directly.
create function public.admin_mfa_requirement(p_actor uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from auth.users where id=p_actor and raw_app_meta_data->>'role'='ADMIN') then
    raise exception 'Administrator access required.' using errcode='42501';end if;
  return barkolink_private.account_mfa_required(p_actor,'ADMIN');
end $$;
revoke all on function public.admin_mfa_requirement(uuid) from public,anon,authenticated;
grant execute on function public.admin_mfa_requirement(uuid) to service_role;
revoke all on all functions in schema barkolink_private from public,anon,authenticated;
