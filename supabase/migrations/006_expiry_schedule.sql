-- Supabase supports pg_cron. Local PostgreSQL test engines may not have it.
do $$ begin
  if exists(select 1 from pg_available_extensions where name='pg_cron') then
    execute 'create extension if not exists pg_cron';
    execute $schedule$select cron.schedule('barkolink-expire-reservations','* * * * *','select barkolink_private.expire_reservations();')$schedule$;
  end if;
end $$;
