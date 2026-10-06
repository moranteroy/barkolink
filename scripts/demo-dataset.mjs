import fs from 'node:fs'
import { fixtureChecks } from './test-data-database.mjs'
import { demoPassengerDetailsSql } from './demo-passenger-details.mjs'

export const codes = {
  'TEST-BOARDING': 'TRP2026-1006001', 'TEST-PAYMENT': 'TRP2026-1006002', 'TEST-DELAYED': 'TRP2026-1006003',
  'TEST-FULL': 'TRP2026-1006004', 'TEST-SCHEDULED': 'TRP2026-1006005', 'TEST-EMPTY': 'TRP2026-1006006',
  'TEST-CANCELLED': 'TRP2026-1006007', 'TEST-HISTORY': 'TRP2026-1006008', 'TEST-NOSHOW': 'TRP2026-1006009',
  'TEST-PAY-REGULAR': 'BK-610001', 'TEST-DISCOUNT-PENDING': 'BK-610002', 'TEST-CANCEL-READY': 'BK-610003',
  'TEST-ISSUED': 'BK-610004', 'TEST-CHECKED-IN': 'BK-610005', 'TEST-BOARDED': 'BK-610006',
  'TEST-WALK-IN': 'BK-610007', 'TEST-DELAYED-PAID': 'BK-610008', 'TEST-SOLD-OUT': 'BK-610009',
  'TEST-REFUND-PENDING': 'BK-610010', 'TEST-REFUNDED': 'BK-610011', 'TEST-CANCELLED-UNPAID': 'BK-610012',
  'TEST-EXPIRED': 'BK-610013', 'TEST-COMPLETED': 'BK-610014', 'TEST-NO-SHOW': 'BK-610015',
}
export function remapCodes(sql) {
  for (const [from, to] of Object.entries(codes)) sql = sql.replaceAll(`'${from}'`, `'${to}'`)
  return sql
}
export const demoChecks = remapCodes(fixtureChecks)
export function demoWorkflowChecks() {
  let sql = remapCodes(fs.readFileSync('supabase/verify-test-data.sql', 'utf8'))
  sql = sql.replace("'TEST-VERIFY-ROLLBACK'", "'BK-VERIFY-ROLLBACK'")
  sql = sql.replace("  perform public.barkolink_execute('CancelMyBooking',jsonb_build_object('bookingId',booking_id));", `  select owner_uid into actor from public.booking where id=booking_id;
  perform set_config('request.jwt.claim.sub',actor,true);
  perform public.barkolink_execute('CancelMyBooking',jsonb_build_object('bookingId',booking_id));`)
  return sql
}
export function buildDemoSeed() {
  let sql = fs.readFileSync('supabase/test-data.sql', 'utf8')
  const replace = (from, to) => {
    if (!sql.includes(from)) throw new Error('Fixture source changed; review demo generation before applying.')
    sql = sql.replaceAll(from, to)
  }
  replace('  kinds text[];', `  passenger_uids text[]; booking_owner text; case_number integer:=0;
  first_names text[]:=array['Marco','Elena','Paolo','Sofia','Daniel','Isabella','Luis','Angela','Rafael','Mariana','Carlo','Bianca'];
  family_names text[]:=array['Santos','Reyes','Dela Cruz','Garcia','Mendoza','Navarro','Castillo','Ramos','Aquino','Torres','Bautista','Flores'];
  kinds text[];`)
  replace("  perform set_config('request.jwt.claim.sub',admin_uid,true);", `  select array_agg(uid order by (email in ('ana.santos@example.com','miguel.reyes@example.com','camille.delacruz@example.com')) desc,email)
    into passenger_uids from public.app_user where role='PASSENGER';
  perform set_config('request.jwt.claim.sub',admin_uid,true);`)
  const labels = {
    'TEST-BTG': 'BTG', 'TEST-CAL': 'CAL', 'TEST-PGA': 'PGA', 'TEST-OFF': 'CAL-SOUTH',
    '[TEST] Batangas terminal': 'Batangas Port', '[TEST] Calapan terminal': 'Calapan Port', '[TEST] Puerto Galera terminal': 'Puerto Galera Port',
    '[TEST] Inactive terminal': 'Calapan South Terminal', 'Demo City': 'Calapan', 'Test Region': 'Oriental Mindoro',
    'TEST-V01': 'VSL-001', 'TEST-V02': 'VSL-002', 'TEST-V03': 'VSL-003', 'TEST-V04': 'VSL-004',
    '[TEST] Island Explorer': 'MV Isla Verde', '[TEST] Channel Voyager': 'MV Mindoro Voyager', '[TEST] Small Ferry': 'MV Galera Express',
    '[TEST] Maintenance Vessel': 'MV Bay Breeze', '[TEST] Economy': 'Economy', '[TEST] Premium': 'Premium', '[TEST] Inactive Class': 'Business',
    'Fictional seating class for testing.': 'Standard seating on the main passenger deck.',
    'Fictional class with a PHP 100 surcharge per passenger.': 'Air-conditioned seating with a PHP 100 surcharge per passenger.',
    'Fictional premium class.': 'Air-conditioned seating on the upper deck.',
    'Eight-seat class for sold-out testing.': 'Standard seating on the express ferry.',
    'Should be excluded from passenger choices.': 'Temporarily unavailable while the cabin is being refurbished.',
    'TEST-BTG-CAL': 'BTG-CAL', 'TEST-CAL-BTG': 'CAL-BTG', 'TEST-BTG-PGA': 'BTG-PGA', 'TEST-PGA-BTG': 'PGA-BTG', 'TEST-CAL-PGA': 'CAL-PGA',
    'Test Promo': 'Resident', '[TEST] Simulated cancellation; no actual journey cancelled.': 'Vessel maintenance required before departure.',
    '[TEST] Simulated cash refund; no money exchanged.': 'Cash refund recorded at the ticketing counter.',
    '[TEST] Fictional verification; no real ID collected.': 'Eligibility reviewed at the ticketing counter.',
    '[TEST] Boarding reminder': 'Boarding at Gate 2', 'Fictional notice: use the TEST-BOARDING trip to exercise ticket review and boarding.': 'Please be at Gate 2 at least 30 minutes before departure. Keep your ticket and valid ID ready.',
    '[TEST] Simulated delay': 'Updated departure schedule', 'Fictional delay notice for testing; this is not a real weather or port warning.': 'The departure time has been adjusted. Please check your booking for the latest schedule.',
    '[TEST] Draft advisory': 'Weekend terminal guidance', 'Unpublished fictional notice for testing the admin advisory editor.': 'Allow extra time at the terminal during the weekend. Follow the boarding lane indicated on your ticket.',
    '[TEST] Expired advisory': 'Terminal lane update', 'Expired fictional notice; it should not appear among active passenger notices.': 'The temporary boarding lane arrangement has ended. Please use the regular boarding gate.',
    '[TEST] Acceptance test dataset': 'Welcome aboard BarkoLink', 'Fictional operational records are loaded. No actual payment, refund or journey is represented.': 'View your reservations, check departure times and keep your ticket ready before you travel.',
    'Use records beginning TEST for system testing only.': 'Check your booking for the latest departure time and boarding instructions.',
    '[TEST] Read notification': 'Reservation received', 'Fictional example of a previously read notice.': 'Your reservation is available in My Bookings.',
    '[TEST] Unread notification': 'Your boarding information', 'Fictional example for mark-as-read and inbox testing.': 'Please arrive at the terminal early and present your booking reference at the counter.',
    'TEST_DATA_SEEDED': 'DEMO_DATA_LOADED',
  }
  for (const [from, to] of Object.entries(labels)) replace(`'${from}'`, `'${to}'`)
  replace('"name":"Test Promo"', '"name":"Resident"')
  replace("select row.code,port_a,port_b,row.vessel", "select row.code,case when row.vessel=vessel_c then port_b else port_a end,case when row.vessel=vessel_b then port_c when row.vessel=vessel_c then port_a else port_b end,row.vessel")
  replace("'TEST-MONTH-'||i,port_a,port_b", "'TRP2026-1006'||lpad((9+i)::text,3,'0'),case when i%2=0 then port_b else port_a end,case when i%2=0 then port_a else port_b end")
  replace("'TEST-LIST-'||lpad(i::text,2,'0')", "'BK-620'||lpad(i::text,2,'0')")
  replace("array['REGULAR','STUDENT','Resident']", "array['REGULAR','REGULAR',(array['STUDENT','SENIOR','CHILD','PWD','PREGNANT','Resident'])[1+(i-1)%6]]")
  replace(`    insert into seed_cases values('TEST-REVENUE-'||i,'TEST-MONTH-'||i,array['REGULAR','STUDENT'],array['BOARDED'],'CONFIRMED','PAID',false,false);`,
    `    for j in 1..8 loop
      insert into seed_cases values('BK-63'||i||lpad(j::text,2,'0'),'TRP2026-1006'||lpad((9+i)::text,3,'0'),
        case when j%3=1 then array['REGULAR'] when j%3=2 then array['REGULAR','STUDENT'] else array['REGULAR','CHILD','SENIOR'] end,
        array['BOARDED'],'CONFIRMED','PAID',false,false);
    end loop;`)
  replace('  for row in select * from seed_cases order by reference loop', `  for row in select * from seed_cases order by reference loop
    case_number:=case_number+1;
    booking_owner:=passenger_uids[1+(case_number-1)%cardinality(passenger_uids)];`)
  replace('case when row.walkin then walkin_uid else passenger_uid end', 'case when row.walkin then walkin_uid else booking_owner end')
  replace("'TEST Passenger '||row.reference||' '||i", "(case when kinds[i]='SENIOR' then 'Lourdes' when kinds[i]='CHILD' then 'Sofia' when kinds[i]='PREGNANT' then 'Isabella' when i%3=0 then 'Alex' else first_names[1+(case_number+i-2)%cardinality(first_names)] end)||' '||family_names[1+(case_number-1)%cardinality(family_names)]")
  replace("case when i%3=0 then 'OTHER' when i%2=0 or kinds[i]='PREGNANT' then 'FEMALE' else 'MALE' end", "case when kinds[i] in ('SENIOR','CHILD','PREGNANT') then 'FEMALE' when i%3=0 then 'OTHER' when (1+(case_number+i-2)%cardinality(first_names))%2=0 then 'FEMALE' else 'MALE' end")
  const savedStart = sql.indexOf('  insert into public.saved_traveler(')
  const savedEnd = sql.indexOf('  insert into public.notification_campaign(', savedStart)
  sql = sql.slice(0, savedStart) + `  insert into public.saved_traveler(owner_uid,full_name,birth_date,sex,phone,nationality)
    select u.uid,case t.n when 1 then u.full_name when 2 then 'Lucas '||split_part(u.full_name,' ',array_length(string_to_array(u.full_name,' '),1)) else 'Alex '||split_part(u.full_name,' ',array_length(string_to_array(u.full_name,' '),1)) end,
      t.birth_date,case when t.n=1 and u.email not in ('ana.santos@example.com','camille.delacruz@example.com') then 'MALE' else t.sex end,'00000000000','Filipino' from public.app_user u cross join (values
      (1,date '1990-01-01','FEMALE'),(2,date '2020-01-01','MALE'),(3,date '1995-01-01','OTHER')) t(n,birth_date,sex) where u.role='PASSENGER';
` + sql.slice(savedEnd)
  sql = remapCodes(sql)
  sql = sql.replace("'dataset','TEST'", "'dataset','BARKOLINK-DEMO'")
  return sql + '\n' + demoPassengerDetailsSql
}

if (process.argv[2] === 'generate') {
  fs.writeFileSync('supabase/demo-data.sql', '-- Realistic demonstration records. These are synthetic, not actual financial transactions.\n' + buildDemoSeed())
  fs.writeFileSync('supabase/verify-demo-integrity.sql', demoChecks)
  fs.writeFileSync('supabase/verify-demo-workflows.sql', demoWorkflowChecks())
  console.log('Generated supabase/demo-data.sql without TEST labels in displayed records.')
}
