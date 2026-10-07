create table public.port_weather_cache (
  port_id uuid primary key references public.port(id) on delete cascade,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);
alter table public.port_weather_cache enable row level security;
revoke all on public.port_weather_cache from public,anon,authenticated;
grant all on public.port_weather_cache to service_role;
