-- Optional reference data; no accounts, bookings or payments are created.
insert into public.port(id, code, name, city, region) values
  ('76a29980-5c27-4c4b-9ead-cae943202001', 'CAL', 'Calapan Port', 'Calapan', 'Oriental Mindoro'),
  ('76a29980-5c27-4c4b-9ead-cae943202002', 'BTG', 'Batangas Port', 'Batangas', 'Batangas'),
  ('76a29980-5c27-4c4b-9ead-cae943202003', 'PGA', 'Puerto Galera Port', 'Puerto Galera', 'Oriental Mindoro')
on conflict (code) do nothing;
insert into public.vessel(id, code, name, passenger_capacity) values
  ('76a29980-5c27-4c4b-9ead-cae943203001', 'MIS-001', 'Island Star', 200)
on conflict (code) do nothing;
insert into public.fare_settings(code, regular_fare, student_discount, senior_discount, child_discount, pwd_discount)
select id::text, 600, 20, 20, 50, 20 from public.vessel where code = 'MIS-001'
on conflict (code) do nothing;
