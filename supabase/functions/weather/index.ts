import { createClient } from 'npm:@supabase/supabase-js@2';
import { normalizeWeather, departureForecast, type WeatherPayload } from './shared.ts';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply=(status:number,body:object)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
const inflight=new Map<string,Promise<WeatherPayload>>();
Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(request.method!=='POST')return reply(405,{error:'Use POST.'});
  try{
    const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
    const token=request.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');
    if(!token)return reply(401,{error:'Sign in to see trip weather.'});
    const {data:{user},error:authError}=await admin.auth.getUser(token);
    if(authError || !user)return reply(401,{error:'Your session expired. Sign in again.'});
    const {sailingCode}=await request.json();
    if(typeof sailingCode!=='string' || !/^[A-Za-z0-9_-]{1,80}$/.test(sailingCode))return reply(400,{error:'Choose a valid trip.'});
    const {data:trip,error:tripError}=await admin.from('sailing').select('origin_port_id,destination_port_id,departure_at').eq('code',sailingCode).maybeSingle();
    if(tripError || !trip)return reply(404,{error:'Trip was not found.'});
    const key=Deno.env.get('WEATHERAPI_KEY');
    if(!key)return reply(200,{configured:false,ports:[],departureAt:trip.departure_at});
    const {data:ports,error:portError}=await admin.from('port').select('id,name,city').in('id',[trip.origin_port_id,trip.destination_port_id]);
    if(portError || !ports)throw new Error('Ports unavailable.');
    const load=async(port:any)=>{
      const base={id:port.id,name:port.name,city:port.city,role:port.id===trip.origin_port_id?'Departure port':'Arrival port'};
      const {data:cache}=await admin.from('port_weather_cache').select('payload,fetched_at,expires_at').eq('port_id',port.id).maybeSingle();
      let payload=cache?.payload as WeatherPayload | undefined, fetchedAt=cache?.fetched_at, stale=false;
      if(!payload || new Date(cache!.expires_at).getTime()<=Date.now()){
        try{
          let pending=inflight.get(port.id);
          if(!pending){
            pending=(async()=>{
              const url=new URL('https://api.weatherapi.com/v1/forecast.json');
              url.searchParams.set('key',key);url.searchParams.set('q',`${port.city}, Philippines`);
              url.searchParams.set('days','3');url.searchParams.set('aqi','no');url.searchParams.set('alerts','no');
              const response=await fetch(url,{signal:AbortSignal.timeout(10000)});
              if(!response.ok)throw new Error('Weather provider unavailable.');
              const result=normalizeWeather(await response.json());
              await admin.from('port_weather_cache').upsert({port_id:port.id,payload:result,fetched_at:new Date().toISOString(),expires_at:new Date(Date.now()+1800000).toISOString()});
              return result;
            })();
            inflight.set(port.id,pending);
          }
          try{payload=await pending;fetchedAt=new Date().toISOString();}finally{if(inflight.get(port.id)===pending)inflight.delete(port.id);}
        }catch{
          if(!payload || !fetchedAt || Date.now()-new Date(fetchedAt).getTime()>21600000)return {...base,available:false};
          stale=true;
        }
      }
      return {...base,available:true,current:payload.current,forecast:departureForecast(payload,trip.departure_at),fetchedAt,stale};
    };
    const ordered=[trip.origin_port_id,trip.destination_port_id].map(id=>ports.find(port=>port.id===id)).filter(Boolean);
    return reply(200,{configured:true,departureAt:trip.departure_at,ports:await Promise.all(ordered.map(load))});
  }catch{return reply(503,{error:'Weather updates are temporarily unavailable. Please try again later.'});}
});
