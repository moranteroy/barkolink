import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {edgeFunctionSource} from './edge-function-source.mjs';
import {spawnSync} from 'node:child_process';
const env=file=>Object.fromEntries(fs.readFileSync(file,'utf8').split(/\r?\n/).flatMap(line=>{
  const match=line.match(/^([A-Z_0-9]+)\s*=\s*(.*)$/);return match?[[match[1],match[2].trim().replace(/^['"]|['"]$/g,'')]]:[];
}));
const frontend=env('.env.local'),credentials=env('.env.supabase-management');
const project=new URL(frontend.VITE_SUPABASE_URL).hostname.split('.')[0];
if(project!=='utobfkfmuepuoseszxks' || !credentials.SUPABASE_ACCESS_TOKEN)throw new Error('Configured deployment target or credentials are invalid.');
const mode=process.argv[2] || 'inspect';
async function management(endpoint,options={}){
  const response=await fetch(`https://api.supabase.com/v1/projects/${project}${endpoint}`,{...options,headers:{Authorization:`Bearer ${credentials.SUPABASE_ACCESS_TOKEN}`,...options.headers},signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw new Error(`Management request ${endpoint.split('?')[0]} failed (${response.status}); response omitted.`);
  const raw=await response.text();return raw.trim()?JSON.parse(raw):null;
}
const sql=(query,read_only=true)=>management('/database/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,read_only})});
const stateQuery=`select to_regprocedure('public.port_display(uuid)') is not null as migration_042,
  to_regprocedure('public.verify_online_payment(uuid)') is not null as payment_rpc,
  to_regprocedure('public.consume_api_allowance(uuid,text)') is not null as quotas,
  to_regprocedure('public.verify_online_payment_v42(uuid)') is not null as mfa_wrapper,
  (select count(*) from public.booking) as bookings,(select count(*) from public.booking_passenger) as passengers,
  (select count(*) from auth.users) as accounts,(select reservation_minutes from public.operation_settings where id) as hold_minutes`;
const folder=mode==='deploy-account-mfa' ? '.backups/account-mfa-2026-10-19' : '.backups/security-2026-10-15';
if(mode==='inspect'){
  const [state,auth,functions,mfa]=await Promise.all([
    sql(stateQuery),management('/config/auth'),management('/functions'),
    sql(`select count(*) as staff_accounts,count(*) filter(where exists(select 1 from auth.mfa_factors f where f.user_id=u.id and f.status='verified')) as enrolled_staff from auth.users u where u.raw_app_meta_data->>'role' in ('ADMIN','TICKETING','BOARDING')`),
  ]);
  const safeAuth=Object.fromEntries(['site_url','uri_allow_list','mailer_autoconfirm','password_min_length','mfa_totp_enroll_enabled','mfa_totp_verify_enabled','security_captcha_enabled'].map(k=>[k,auth[k]]));
  console.log(JSON.stringify({project,state:state[0],auth:safeAuth,mfa:mfa[0],functions:functions.map(f=>({slug:f.slug,status:f.status,version:f.version}))},null,2));
}else if(mode==='harden-auth'){
  const auth=await management('/config/auth');
  fs.mkdirSync(folder,{recursive:true});
  const changes={password_min_length:Math.max(8,auth.password_min_length || 0),mailer_autoconfirm:false,mfa_totp_enroll_enabled:true,mfa_totp_verify_enabled:true};
  const previous=Object.fromEntries(Object.keys(changes).map(k=>[k,auth[k]]));
  if(!fs.existsSync(`${folder}/auth-before.json`))fs.writeFileSync(`${folder}/auth-before.json`,JSON.stringify({project,previous},null,2),{flag:'wx'});
  await management('/config/auth',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(changes)});
  const checked=await management('/config/auth');
  if(Object.entries(changes).some(([k,v])=>checked[k]!==v))throw new Error('Hosted auth configuration verification failed.');
  console.log(JSON.stringify({project,authChanges:changes,verified:true}));
}else if(mode==='apply-database'){
  const before=(await sql(stateQuery))[0];
  if(before.quotas && before.mfa_wrapper){console.log('Migration 043 already installed; no schema changes applied.');process.exit(0);}
  if(!before.migration_042 || !before.payment_rpc || before.quotas || before.mfa_wrapper)throw new Error('Unexpected migration state; deployment stopped.');
  const definitions=await sql(`select n.nspname as schema,p.proname,pg_get_function_identity_arguments(p.oid) as args,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.oid in (to_regprocedure('public.barkolink_execute(text,jsonb)'),to_regprocedure('public.verify_online_payment(uuid)'),to_regprocedure('barkolink_private.expire_reservations()'))`);
  fs.mkdirSync(folder,{recursive:true});
  fs.writeFileSync(`${folder}/before.json`,JSON.stringify({project,state:before,definitions},null,2),{flag:'wx'});
  const migration=fs.readFileSync('supabase/migrations/043_security_hardening.sql','utf8');
  await sql(`begin; set local lock_timeout='10s'; set local statement_timeout='45s';
    select pg_advisory_xact_lock(hashtext('barkolink-security-043'));
    ${migration}\ncommit;`,false);
  const after=(await sql(stateQuery))[0];
  if(!after.quotas || !after.mfa_wrapper)throw new Error('Migration verification failed.');
  console.log(JSON.stringify({project,applied:true,migrationSha256:createHash('sha256').update(migration).digest('hex'),before,after}));
}else if(mode==='deploy-functions' || mode==='deploy-chatbot' || mode==='deploy-account-mfa'){
  if(!(await sql(stateQuery))[0].quotas)throw new Error('Apply the quota migration before deploying handlers.');
  for(const slug of mode==='deploy-chatbot'?['chatbot']:mode==='deploy-account-mfa'?['manage-account']:['manage-account','paymongo','weather']){
    console.log(JSON.stringify({function:slug,stage:'backing up existing handler'}));
    fs.mkdirSync(folder,{recursive:true});
    if(!fs.existsSync(`${folder}/${slug}-before-body.bin`) && !fs.existsSync(`${folder}/${slug}-before-source-head.tar`)){
      const metadata=await management(`/functions/${slug}`);
      if(mode==='deploy-chatbot' && process.argv.includes('--use-head-backup')){
        const archive=spawnSync('git',['archive','--format=tar',`--output=${folder}/${slug}-before-source-head.tar`,'HEAD',`supabase/functions/${slug}`],{windowsHide:true});
        if(archive.status!==0)throw new Error('Could not save the pre-change chatbot source snapshot.');
        fs.writeFileSync(`${folder}/${slug}-before-metadata.json`,JSON.stringify({...metadata,backupKind:'pre-change Git HEAD source; remote body download timed out'},null,2),{flag:'wx'});
        console.log(JSON.stringify({function:slug,previousVersion:metadata.version,backup:'pre-change Git HEAD source snapshot'}));
      }else{
      console.log(JSON.stringify({function:slug,previousVersion:metadata.version,stage:'downloading previous body'}));
      const response=await fetch(`https://api.supabase.com/v1/projects/${project}/functions/${slug}/body`,{
        headers:{Authorization:`Bearer ${credentials.SUPABASE_ACCESS_TOKEN}`},signal:AbortSignal.timeout(60000)});
      if(!response.ok)throw new Error(`Could not back up ${slug} (${response.status}).`);
      fs.writeFileSync(`${folder}/${slug}-before-body.bin`,Buffer.from(await response.arrayBuffer()),{flag:'wx'});
      fs.writeFileSync(`${folder}/${slug}-before-metadata.json`,JSON.stringify(metadata,null,2),{flag:'wx'});
      }
    }
    const source=edgeFunctionSource(slug);
    const form=new FormData();form.append('metadata',JSON.stringify({name:slug,entrypoint_path:'index.ts',verify_jwt:false}));
    form.append('file',new Blob([source],{type:'application/typescript'}),'index.ts');
    console.log(JSON.stringify({function:slug,stage:'deploying updated handler'}));
    const deployed=await management(`/functions/deploy?slug=${slug}`,{method:'POST',body:form});
    console.log(JSON.stringify({function:slug,status:deployed.status,version:deployed.version,sourceSha256:createHash('sha256').update(source).digest('hex')}));
  }
}else if(mode==='verify'){
  const state=(await sql(stateQuery))[0];
  const grants=(await sql(`select has_function_privilege('authenticated','public.consume_api_allowance(uuid,text)','EXECUTE') as browser_quota_access,
    has_function_privilege('anon','public.verify_online_payment_v42(uuid)','EXECUTE') as anon_old_payment,
    has_function_privilege('authenticated','public.verify_online_payment_v42(uuid)','EXECUTE') as browser_old_payment,
    has_function_privilege('authenticated','barkolink_private.require_staff_mfa(text)','EXECUTE') as browser_mfa_helper,
    exists(select 1 from cron.job where jobname='barkolink-expire-reservations' and active) as expiry_job`))[0];
  if(!state.quotas || !state.mfa_wrapper || Object.entries(grants).some(([k,v])=>k!=='expiry_job' && v) || !grants.expiry_job)throw new Error('Live security verification failed.');
  // A privileged rollback-only transaction models claims without touching real sessions.
  await sql(`begin;
    do $$ declare actor text; blocked boolean:=false; begin
      select id::text into actor from auth.users where raw_app_meta_data->>'role'='ADMIN' limit 1;
      if actor is null then raise exception 'No admin account available for role verification.'; end if;
      perform set_config('request.jwt.claim.sub',actor,true);
      perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'aal','aal1')::text,true);
      begin perform public.barkolink_execute('AdminUsers','{}'); exception when insufficient_privilege then blocked:=true; end;
      if not blocked then raise exception 'AAL1 admin request was not denied.'; end if;
      perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'aal','aal2')::text,true);
      perform public.barkolink_execute('AdminUsers','{"pageSize":1}');
    end $$;
    rollback;`,false);
  const key=frontend.VITE_SUPABASE_PUBLISHABLE_KEY || frontend.VITE_SUPABASE_ANON_KEY;
  for(const slug of ['manage-account','paymongo','weather']){
    const response=await fetch(`${frontend.VITE_SUPABASE_URL}/functions/v1/${slug}`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(20000)});
    if(response.status!==401)throw new Error(`${slug} did not reject an unsigned request (${response.status}).`);
    console.log(JSON.stringify({function:slug,unsignedRequest:response.status}));
  }
  const functions=(await management('/functions')).filter(f=>['manage-account','paymongo','weather'].includes(f.slug))
    .map(f=>({slug:f.slug,status:f.status,version:f.version}));
  if(functions.length!==3 || functions.some(f=>{
    const previous=JSON.parse(fs.readFileSync(`${folder}/${f.slug}-before-metadata.json`,'utf8'));
    return f.status!=='ACTIVE' || f.version<=previous.version;
  }))throw new Error('Updated handler versions are not all active.');
  const report={project,state,grants,functions,mfaClaimChecks:'passed; transaction rolled back'};
  fs.mkdirSync('.audit',{recursive:true});fs.writeFileSync('.audit/security-live-verification.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}else throw new Error('Unknown deployment mode.');
