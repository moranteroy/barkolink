-- Profiles are created even when email confirmation is enabled. Application
-- roles come from server-managed app_metadata, never editable user_metadata.
create function barkolink_private.sync_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare assigned_role text;
begin
  assigned_role := coalesce(new.raw_app_meta_data->>'role', 'PASSENGER');
  if assigned_role not in ('PASSENGER','TICKETING','BOARDING','ADMIN') then raise exception 'Invalid account role.'; end if;
  insert into public.app_user(uid, email, full_name, role)
  values (new.id::text, lower(new.email), left(coalesce(nullif(trim(new.raw_user_meta_data->>'fullName'), ''), split_part(new.email, '@', 1)), 120), assigned_role)
  on conflict (uid) do update set email = excluded.email, full_name = excluded.full_name, role = excluded.role, updated_at = now();
  return new;
end $$;
create trigger barkolink_auth_profile after insert or update of email, raw_user_meta_data, raw_app_meta_data
on auth.users for each row execute function barkolink_private.sync_auth_user();
revoke all on function barkolink_private.sync_auth_user() from public, anon, authenticated;

-- Backfill any accounts already registered in this Supabase project.
insert into public.app_user(uid, email, full_name, role)
select id::text, lower(email), left(coalesce(nullif(trim(raw_user_meta_data->>'fullName'), ''), split_part(email, '@', 1)), 120),
  coalesce(raw_app_meta_data->>'role', 'PASSENGER') from auth.users where email is not null
on conflict (uid) do nothing;
