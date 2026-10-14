import fs from 'node:fs';
import crypto from 'node:crypto';
import { queryLive, projectRef } from './test-data-database.mjs';

// Diagnostics only: do not print credentials, upload secrets or deploy functions.
function env(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(fs.readFileSync(file,'utf8').split(/\r?\n/).filter(line => /^\w+\s*=/.test(line)).map(line => {
    const index=line.indexOf('=');
    return [line.slice(0,index).trim(),line.slice(index+1).trim().replace(/^['"]|['"]$/g,'')];
  }));
}
const weather=env('.env.weather.local'), management=env('.env.supabase-management'), frontend=env('.env.local');
if (!frontend.VITE_SUPABASE_URL || new URL(frontend.VITE_SUPABASE_URL).hostname !== `${projectRef}.supabase.co`) throw new Error('Frontend project does not match the reviewed backend.');
async function inspect(path) {
  if (!management.SUPABASE_ACCESS_TOKEN) return {available:false,reason:'management_access_missing'};
  try {
    const response=await fetch(`https://api.supabase.com/v1/projects/${projectRef}${path}`,{headers:{Authorization:`Bearer ${management.SUPABASE_ACCESS_TOKEN}`},signal:AbortSignal.timeout(30000)});
    const data=await response.json().catch(()=>null);
    return {status:response.status,data:response.ok ? data : null};
  } catch { return {available:false,reason:'management_request_failed'}; }
}
async function provider(days) {
  if (!weather.WEATHERAPI_KEY) return {tested:false,reason:'local_weather_key_missing'};
  const url=new URL('https://api.weatherapi.com/v1/forecast.json');
  url.searchParams.set('key',weather.WEATHERAPI_KEY);url.searchParams.set('q','Batangas, Philippines');
  url.searchParams.set('days',String(days));url.searchParams.set('aqi','no');url.searchParams.set('alerts','no');
  try {
    const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
    const data=await response.json().catch(()=>null);
    return {tested:true,requestedDays:days,status:response.status,ok:response.ok,
      ...(response.ok ? {returnedDays:data?.forecast?.forecastday?.length ?? 0,country:data?.location?.country} : {errorCode:data?.error?.code ?? null,message:String(data?.error?.message || 'Provider request failed').replaceAll(weather.WEATHERAPI_KEY,'[redacted]')})};
  } catch {return {tested:true,requestedDays:days,ok:false,reason:'provider_network_or_timeout'};}
}
async function main() {
const [secrets,deployed,upstream]=await Promise.all([inspect('/secrets'),inspect('/functions/weather'),provider(7)]);
const secret=Array.isArray(secrets.data) ? secrets.data.find(entry=>entry.name==='WEATHERAPI_KEY') : undefined;
const digest=weather.WEATHERAPI_KEY ? crypto.createHash('sha256').update(weather.WEATHERAPI_KEY).digest('hex') : null;
// Management metadata may expose the SHA-256 digest as `value`, never log it.
const metadataDigest = [secret?.digest, secret?.value].find(value => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value));
const result={projectRef,localKeyPresent:!!weather.WEATHERAPI_KEY,
  deployedKey:{metadataStatus:secrets.status,present:!!secret,matchesLocal:metadataDigest && digest ? metadataDigest.toLowerCase()===digest : null},
  function:{metadataStatus:deployed.status,status:deployed.data?.status,version:deployed.data?.version,updatedAt:deployed.data?.updated_at},
  provider:upstream};
if (upstream.errorCode===2009) result.fallback=await provider(3);
try {
  result.cache=await queryLive(`select p.code,p.city,w.fetched_at,w.expires_at,w.expires_at>now() as fresh from public.port p left join public.port_weather_cache w on w.port_id=p.id where p.code in ('BTG','CAL') order by p.code`);
} catch {result.cache={available:false,reason:'cache_inspection_failed'};}
console.log(JSON.stringify(result,null,2));
}
main().catch(() => {
  console.error('Weather diagnostics could not complete. No credentials were logged.');
  process.exitCode=1;
});
