-- First register the account through BarkoLink and confirm its email.
-- Replace the email and role below. Run as the project owner in SQL Editor.
-- Never grant ADMIN through user_metadata or a browser request.
begin;
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'ADMIN')
where lower(email) = lower('replace-with-your-admin-email@example.com');
-- The auth trigger synchronizes public.app_user.role automatically.
select email, raw_app_meta_data->>'role' as role from auth.users
where lower(email) = lower('replace-with-your-admin-email@example.com');
commit;

-- Other supported roles: PASSENGER, TICKETING, BOARDING.
-- Sign out and back in after changing a role. SQL checks the current role even
-- when a browser still has an older token.
