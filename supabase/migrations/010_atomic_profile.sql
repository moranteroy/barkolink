-- Update the application profile and Auth display name together, preserving roles and other metadata.
create function barkolink_private.save_profile(args jsonb, actor_uid text, actor_role text)
returns jsonb language plpgsql set search_path = '' as $$
declare name_value text := regexp_replace(trim(args->>'fullName'),'\s+',' ','g');
  phone_value text := nullif(regexp_replace(trim(coalesce(args->>'phone','')),'[-()[:space:]]','','g'),'');
begin
  if actor_uid is null or actor_uid='' then raise exception 'Sign in to continue.' using errcode='42501'; end if;
  if actor_role is null or actor_role not in ('PASSENGER','TICKETING','BOARDING','ADMIN') then raise exception 'Invalid access role.' using errcode='42501'; end if;
  if name_value is null or length(name_value) not between 1 and 120 then raise exception 'Enter your full name using 1 to 120 characters.'; end if;
  if phone_value is not null and phone_value !~ '^\+?[0-9]{7,15}$' then raise exception 'Enter a valid contact number with 7 to 15 digits, optionally starting with +.'; end if;
  update auth.users set raw_user_meta_data=coalesce(raw_user_meta_data,'{}'::jsonb)||jsonb_build_object('fullName',name_value)
    where id::text=actor_uid;
  if not found then raise exception 'Account was not found.' using errcode='42501'; end if;
  update public.app_user set full_name=name_value,phone=phone_value,updated_at=now() where uid=actor_uid;
  if not found then raise exception 'Profile was not found.'; end if;
  return jsonb_build_object('user_update',jsonb_build_object('uid',actor_uid));
end $$;
create or replace function public.barkolink_execute(operation text, args jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_uid text; actor_role text := 'PASSENGER';
begin
  actor_uid := auth.uid()::text;
  if operation is null or length(operation)>80 or args is null or jsonb_typeof(args)<>'object' then raise exception 'Invalid database request.'; end if;
  if actor_uid is not null then
    select coalesce(raw_app_meta_data->>'role','PASSENGER') into actor_role from auth.users where id::text=actor_uid;
    if not found then raise exception 'Account was not found.' using errcode='42501'; end if;
  end if;
  if operation='CreateManagedUserProfile' then raise exception 'Use the account management function.' using errcode='42501'; end if;
  perform barkolink_private.expire_reservations();
  if operation='UpdateMyProfile' then return barkolink_private.camel(barkolink_private.save_profile(args,actor_uid,actor_role)); end if;
  return barkolink_private.camel(barkolink_private.execute_experience(operation,args,actor_uid,actor_role));
end $$;
revoke all on function public.barkolink_execute(text,jsonb) from public;
grant execute on function public.barkolink_execute(text,jsonb) to anon, authenticated, service_role;
revoke all on all functions in schema barkolink_private from public, anon, authenticated;
