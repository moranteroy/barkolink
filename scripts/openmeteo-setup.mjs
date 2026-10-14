import fs from 'node:fs';
const env = file => Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(line => /^\w+\s*=/.test(line)).map(line => {
  const at = line.indexOf('='); return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '')];
}));
async function main() {
  const frontend = env('.env.local'), management = env('.env.supabase-management');
  const project = new URL(frontend.VITE_SUPABASE_URL).hostname.split('.')[0];
  if (!management.SUPABASE_ACCESS_TOKEN) throw new Error('Supabase management credentials are missing.');
  async function request(path, options = {}) {
    const response = await fetch(`https://api.supabase.com/v1/projects/${project}${path}`, {
      ...options, headers: { Authorization: `Bearer ${management.SUPABASE_ACCESS_TOKEN}`, ...options.headers }, signal: AbortSignal.timeout(60000),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`Weather setup request failed (${response.status}).`);
    return data;
  }
  const state = await request('/database/query', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({query:"select to_regclass('public.port_weather_cache') is not null as installed",read_only:true}) });
  if (!state[0]?.installed) throw new Error('Apply migration 024_port_weather_cache.sql before deployment.');
  const shared = fs.readFileSync('supabase/functions/weather/shared.ts', 'utf8').replace(/^export /gm, '');
  const source = fs.readFileSync('supabase/functions/weather/index.ts', 'utf8').replace(/^import .* from '\.\/shared\.ts';\r?$/m, shared);
  const form = new FormData();
  form.append('metadata', JSON.stringify({name:'weather',entrypoint_path:'index.ts',verify_jwt:false}));
  form.append('file', new Blob([source], {type:'application/typescript'}), 'index.ts');
  const deployed = await request('/functions/deploy?slug=weather', {method:'POST',body:form});
  console.log(JSON.stringify({function:deployed.status,version:deployed.version,provider:'Open-Meteo',secretsUploaded:false}));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
