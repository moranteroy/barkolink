import { before,beforeEach,after,describe,it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const moduleUrl=source=>`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64')}`;
const previousDeno=globalThis.Deno,previousFetch=globalThis.fetch;
let handler,key,cache,upstreamCalls,failed;
const epoch=Math.floor(Date.now()/1000);
const upstream={location:{country:'Philippines'},current:{last_updated_epoch:epoch,temp_c:28,wind_kph:10,vis_km:9,condition:{text:'Cloudy'}},forecast:{forecastday:[]}};
describe('weather Edge Function',()=>{
  before(async()=>{
    globalThis.Deno={env:{get:name=>name==='WEATHERAPI_KEY'?key:'test-only'},serve:callback=>{handler=callback}};
    globalThis.__weatherClient=()=>({auth:{getUser:async token=>({data:{user:token==='valid'?{id:'user'}:null},error:null})},from:table=>({
      select:()=>({eq:()=>({maybeSingle:async()=>({data:table==='sailing'?{origin_port_id:'port',destination_port_id:'port',departure_at:'2099-10-08T04:00:00Z'}:cache,error:null})}),in:async()=>({data:[{id:'port',name:'Batangas Port',city:'Batangas'}],error:null})}),upsert:async()=>({error:null})})});
    globalThis.fetch=async url=>{upstreamCalls++;assert.equal(new URL(url).searchParams.get('q'),'Batangas, Philippines');return new Response(JSON.stringify(upstream),{status:failed?503:200})};
    const shared=moduleUrl(fs.readFileSync('supabase/functions/weather/shared.ts','utf8'));
    const source=fs.readFileSync('supabase/functions/weather/index.ts','utf8').replace(/import \{ createClient \} from 'npm:[^']+';/,'const createClient=globalThis.__weatherClient;').replace("'./shared.ts'",JSON.stringify(shared));
    await import(moduleUrl(source));
  });
  beforeEach(()=>{key='test-key';cache=null;upstreamCalls=0;failed=false});
  after(()=>{globalThis.Deno=previousDeno;globalThis.fetch=previousFetch;delete globalThis.__weatherClient});
  const request=(token='valid',body={sailingCode:'TRIP-1'})=>new Request('https://example.com/weather',{method:'POST',headers:token?{Authorization:`Bearer ${token}`}:{},body:JSON.stringify(body)});
  it('requires a verified user before requesting provider data',async()=>{
    assert.equal((await handler(request(null))).status,401);
    assert.equal((await handler(request('wrong'))).status,401);
    assert.equal(upstreamCalls,0);
  });
  it('rejects invalid sailing codes and ignores client-supplied weather queries',async()=>{
    assert.equal((await handler(request('valid',{sailingCode:'https://attacker.invalid'}))).status,400);
    const response=await handler(request('valid',{sailingCode:'TRIP-1',q:'London',key:'attacker'}));
    assert.equal(response.status,200);
    assert.ok(upstreamCalls>0);
    assert.doesNotMatch(await response.text(),/test-key|attacker/);
  });
  it('uses shared cached weather without calling the provider',async()=>{
    cache={payload:{current:{at:new Date().toISOString(),condition:'Cloudy',temperatureC:28},hours:[]},fetched_at:new Date().toISOString(),expires_at:new Date(Date.now()+60000).toISOString()};
    const response=await handler(request());const data=await response.json();
    assert.equal(data.ports[0].available,true);assert.equal(data.ports[0].forecast,null);assert.equal(upstreamCalls,0);
  });
  it('reports missing configuration without exposing fake weather',async()=>{
    key=undefined;const data=await (await handler(request())).json();
    assert.equal(data.configured,false);assert.deepEqual(data.ports,[]);assert.equal(upstreamCalls,0);
  });
  it('marks fallback weather stale and rejects cached data older than six hours',async()=>{
    failed=true;
    cache={payload:{current:{at:new Date().toISOString(),condition:'Cloudy'},hours:[]},fetched_at:new Date(Date.now()-3600000).toISOString(),expires_at:new Date(Date.now()-1000).toISOString()};
    let data=await (await handler(request())).json();assert.equal(data.ports[0].stale,true);
    cache.fetched_at=new Date(Date.now()-25200000).toISOString();
    data=await (await handler(request())).json();assert.equal(data.ports[0].available,false);
  });
});
