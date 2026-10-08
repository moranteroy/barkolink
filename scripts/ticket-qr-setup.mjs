import fs from 'node:fs';
import { queryLive } from './test-data-database.mjs';
const [state]=await queryLive("select to_regprocedure('barkolink_private.execute_flexible_discounts_v28(text,jsonb,text,text)') is not null as installed");
if(!state.installed)await queryLive(`begin; select pg_advisory_xact_lock(hashtext('barkolink-ticket-qr-029')); ${fs.readFileSync('supabase/migrations/029_verified_ticket_qr.sql','utf8')} commit;`,false);
const [result]=await queryLive("select count(*) as tickets from public.booking_passenger where qr_verification_token is not null");
console.log(JSON.stringify({installed:true,ticketsWithVerification:Number(result.tickets)}));
