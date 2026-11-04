import fs from 'node:fs';

export function fixtureProject() {
  const local=fs.existsSync('.env.local') ? fs.readFileSync('.env.local','utf8') : '';
  const url=process.env.VITE_SUPABASE_URL || local.match(/^VITE_SUPABASE_URL\s*=\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g,'');
  if(!url)throw new Error('Provide the same public VITE_SUPABASE_URL used for the fixture app build.');
  return url;
}
export function fixtureBrowserOptions() {
  return {headless:true,...(process.env.BARKOLINK_BROWSER==='chromium' ? {} : {channel:'msedge'})};
}
