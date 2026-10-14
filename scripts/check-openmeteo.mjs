import { openMeteoUrl, normalizeOpenMeteo } from '../supabase/functions/weather/shared.ts';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
async function main() {
  for (const [port, point] of [['Batangas',[13.7580556,121.0458333]],['Calapan',[13.43,121.1966667]]]) {
    const {stdout} = await run(process.platform === 'win32' ? 'curl.exe' : 'curl', ['--fail','--silent','--show-error','--max-time','25',openMeteoUrl(point).toString()], {maxBuffer:2 * 1024 * 1024,windowsHide:true});
    const data = normalizeOpenMeteo(JSON.parse(stdout));
    console.log(JSON.stringify({port,provider:data.provider,days:data.days.length,hours:data.hours.length,firstDate:data.days[0]?.date,condition:data.current.condition}));
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
