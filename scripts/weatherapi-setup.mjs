import fs from 'node:fs';
const env=path=>Object.fromEntries(fs.readFileSync(path,'utf8').split(/\r?\n/).filter(line=>/^\w+\s*=/.test(line)).map(line=>{const at=line.indexOf('=');return [line.slice(0,at).trim(),line.slice(at+1).trim().replace(/^['"]|['"]$/g,'')]}));
const frontend=env('.env.local'),management=env('.env.supabase-management');
const config=fs.existsSync('.env.weather.local')?env('.env.weather.local'):{};
const project=new URL(frontend.VITE_SUPABASE_URL).hostname.split('.')[0];
if(!management.SUPABASE_ACCESS_TOKEN)throw new Error('Supabase management credentials are missing.');
async function request(path,options={}){
  const response=await fetch(`https://api.supabase.com/v1/projects/${project}${path}`,{...options,headers:{Authorization:`Bearer ${management.SUPABASE_ACCESS_TOKEN}`,...options.headers},signal:AbortSignal.timeout(60000)});
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(`Weather setup request failed (${response.status}).`);
  return data;
}
const sql=query=>request('/database/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,read_only:false})});
const state=(await sql("select to_regclass('public.port_weather_cache') is not null as installed"))[0];
if(!state.installed)await sql(`begin; select pg_advisory_xact_lock(hashtext('barkolink-weather-cache-024')); ${fs.readFileSync('supabase/migrations/024_port_weather_cache.sql','utf8')} commit;`);
if(config.WEATHERAPI_KEY)await request('/secrets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify([{name:'WEATHERAPI_KEY',value:config.WEATHERAPI_KEY}])});
const shared=fs.readFileSync('supabase/functions/weather/shared.ts','utf8').replace(/^export /gm,'');
const source=fs.readFileSync('supabase/functions/weather/index.ts','utf8').replace(/import \{ normalizeWeather, departureForecast, type WeatherPayload \} from '.\/shared.ts';/,shared);
const form=new FormData();form.append('metadata',JSON.stringify({name:'weather',entrypoint_path:'index.ts',verify_jwt:false}));form.append('file',new Blob([source],{type:'application/typescript'}),'index.ts');
const deployed=await request('/functions/deploy?slug=weather',{method:'POST',body:form});
console.log(JSON.stringify({function:deployed.status,keyUploaded:!!config.WEATHERAPI_KEY,message:config.WEATHERAPI_KEY?'Weather integration deployed.':'Integration deployed. Add WEATHERAPI_KEY locally and rerun setup to activate weather.'}));
