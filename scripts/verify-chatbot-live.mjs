import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
const config=Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).filter(line=>/^\w+\s*=/.test(line)).map(line=>{const at=line.indexOf('=');return [line.slice(0,at).trim(),line.slice(at+1).trim().replace(/^['"]|['"]$/g,'')]}));
const url=config.VITE_SUPABASE_URL,key=config.VITE_SUPABASE_PUBLISHABLE_KEY || config.VITE_SUPABASE_ANON_KEY;
const endpoint=`${url}/functions/v1/chatbot`;
for(const token of [null,'invalid-session',key]){
  const response=await fetch(endpoint,{method:'POST',headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({message:'May biyahe ba today?'}),signal:AbortSignal.timeout(30000)});
  assert.equal(response.status,401,'Live chatbot must reject missing or invalid passenger identity.');
  const body=await response.json();assert.ok(body.error);assert.equal(body.sources,undefined);
}
const options=await fetch(endpoint,{method:'OPTIONS',signal:AbortSignal.timeout(30000)});assert.equal(options.status,200);
const client=createClient(url,key,{auth:{persistSession:false}});
const {error}=await client.rpc('consume_chatbot_allowance');assert.equal(error?.code,'42501','Chat limits RPC must deny anonymous callers.');
console.log('Deployed chatbot authentication, CORS and anonymous database protection passed. No passenger data or accounts were accessed.');
