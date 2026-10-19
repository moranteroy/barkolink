import { before,beforeEach,after,describe,it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const moduleUrl=source=>`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64')}`;
const previousDeno=globalThis.Deno,previousFetch=globalThis.fetch;
let handler,key,cache,upstreamCalls,failed,limited,allowed,quotaError;
const epoch=Math.floor(Date.now()/1000);
const upstream={current:{time:epoch,temperature_2m:28,weather_code:3,wind_speed_10m:10},hourly:{time:[]},daily:{time:Array.from({length:7},(_,i)=>epoch+i*86400),temperature_2m_max:Array(7).fill(30),temperature_2m_min:Array(7).fill(24),weather_code:Array(7).fill(61)}};
describe('weather Edge Function',()=>{
  before(async()=>{
    globalThis.Deno={env:{get:name=>name==='WEATHERAPI_KEY'?key:'test-only'},serve:callback=>{handler=callback}};
    globalThis.__weatherClient=()=>({rpc:async()=>({data:allowed,error:quotaError}),auth:{getUser:async token=>({data:{user:token==='valid'?{id:'user'}:null},error:null})},from:table=>({
      select:()=>({eq:()=>({maybeSingle:async()=>({data:table==='sailing'?{origin_port_id:'port',destination_port_id:'port',departure_at:'2099-10-08T04:00:00Z'}:table==='port'?{id:'11111111-1111-4111-8111-111111111111',name:'Batangas Port',city:'Batangas'}:cache,error:null})}),in:async()=>({data:[{id:'port',name:'Batangas Port',city:'Batangas'}],error:null})}),upsert:async()=>({error:null})})});
    globalThis.fetch=async url=>{upstreamCalls++;const parsed=new URL(url);assert.equal(parsed.origin,'https://api.open-meteo.com');assert.equal(parsed.searchParams.get('latitude'),'13.7580556');assert.equal(parsed.searchParams.get('forecast_days'),'7');
      return new Response(JSON.stringify(upstream),{status:failed?503:200})};
    const shared=moduleUrl(fs.readFileSync('supabase/functions/weather/shared.ts','utf8'));

    const security = 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(fs.readFileSync('supabase/functions/_shared/security.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64');
    const source=fs.readFileSync('supabase/functions/weather/index.ts','utf8').replace("'../_shared/security.ts'", JSON.stringify(security)).replace(/import \{ createClient \} from 'npm:[^']+';/,'const createClient=globalThis.__weatherClient;').replace("'./shared.ts'",JSON.stringify(shared));
    await import(moduleUrl(source));
  });
  beforeEach(()=>{key='test-key';cache=null;upstreamCalls=0;failed=false;limited=false;allowed=true;quotaError=null});
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
    cache={payload:{provider:'open-meteo',current:{at:new Date().toISOString(),condition:'Cloudy',temperatureC:28},hours:[],days:[]},fetched_at:new Date().toISOString(),expires_at:new Date(Date.now()+60000).toISOString()};
    const response=await handler(request());const data=await response.json();
    assert.equal(data.ports[0].available,true);assert.equal(data.ports[0].forecast,null);assert.equal(upstreamCalls,0);
  });
  it('works without a WeatherAPI secret',async()=>{
    key=undefined;const data=await (await handler(request())).json();
    assert.equal(data.configured,true);assert.equal(data.ports[0].available,true);assert.ok(upstreamCalls>0);
  });
  it('loads seven daily forecasts for a canonical port without requiring a sailing',async()=>{
    const data=await (await handler(request('valid',{portId:'11111111-1111-4111-8111-111111111111',q:'London'}))).json();
    assert.equal(data.ports.length,1);assert.equal(data.ports[0].days.length,7);assert.equal(data.ports[0].days[0].highC,30);assert.equal(data.ports[0].forecast,null);
    assert.equal((await handler(request('valid',{portId:'London'}))).status,400);
  });
  it('reports unavailable weather when the provider fails without cache',async()=>{
    failed=true;
    const data=await (await handler(request('valid',{portId:'11111111-1111-4111-8111-111111111111'}))).json();
    assert.equal(data.ports[0].available,false);assert.equal(upstreamCalls,1);
  });
  it('marks fallback weather stale and rejects cached data older than six hours',async()=>{
    failed=true;
    cache={payload:{provider:'open-meteo',current:{at:new Date().toISOString(),condition:'Cloudy'},hours:[],days:[]},fetched_at:new Date(Date.now()-3600000).toISOString(),expires_at:new Date(Date.now()-1000).toISOString()};
    let data=await (await handler(request())).json();assert.equal(data.ports[0].stale,true);
    cache.fetched_at=new Date(Date.now()-25200000).toISOString();
    data=await (await handler(request())).json();assert.equal(data.ports[0].available,false);
  });
  it('rejects exhausted quotas and fails closed when quota storage is unavailable',async()=>{
    allowed=false;assert.equal((await handler(request())).status,429);
    allowed=true;quotaError={message:'offline'};assert.equal((await handler(request())).status,503);assert.equal(upstreamCalls,0);
  });
  it('rejects oversized and non-object input before provider calls',async()=>{
    assert.equal((await handler(request('valid',{padding:'x'.repeat(17000)}))).status,413);
    assert.equal((await handler(request('valid',[]))).status,400);assert.equal(upstreamCalls,0);
  });
});
