import fs from 'node:fs';
import {createHash} from 'node:crypto';
// Fail a release build if HTML changes invalidate the checked-in CSP hashes.
const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));
const policy=config.headers.flatMap(rule=>rule.headers).find(h=>h.key==='Content-Security-Policy')?.value;
if(!policy || !policy.includes("frame-ancestors 'none'"))throw new Error('Application framing policy is missing.');
const html=fs.readFileSync('dist/index.html','utf8');
let checked=0;
for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
  if(/\bsrc\s*=/.test(match[1]) || !match[2].trim())continue;
  const hash=createHash('sha256').update(match[2]).digest('base64');
  if(!policy.includes(`'sha256-${hash}'`))throw new Error('Built inline script is not authorized by CSP. Review and update vercel.json hashes.');
  checked++;
}
console.log(`Security headers verified; ${checked} built inline scripts authorized by CSP.`);
