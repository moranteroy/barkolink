import fs from 'node:fs';
import crypto from 'node:crypto';
export const catalog = JSON.parse(fs.readFileSync('src/data/ferryReferenceCatalog.json','utf8'));
const literal = value => value === null ? 'null' : `'${String(value).replaceAll("'","''")}'`;
const json = value => `${literal(JSON.stringify(value))}::jsonb`;
const id = (kind,code) => {
  const legacy={CAL:'76a29980-5c27-4c4b-9ead-cae943202001',BTG:'76a29980-5c27-4c4b-9ead-cae943202002',PGA:'76a29980-5c27-4c4b-9ead-cae943202003'};
  if(kind==='port' && legacy[code])return legacy[code];
  const h=crypto.createHash('sha256').update(`barkolink-reference:${kind}:${code}`).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
};
function metadata(record, extras={}) {
  const sourceIds=[...new Set([...(record.sourceIds || (record.sources || record.observations || []).map(s=>s.sourceId)),...(record.schedules || []).map(s=>s.sourceId),...(record.accommodationProfiles || []).map(p=>p.sourceId)])];
  return {kind:'verified-reference',checkedAt:catalog.checkedAt,sourceUrls:sourceIds.map(k=>catalog.sources[k].url),...extras};
}
export function referenceCatalogSql() {
  const statements=['-- Verified reference network. No invented fares, sailings, class allocations or seat inventory.'];
  for(const p of catalog.ports){
    const sourceIds=[...new Set(catalog.routes.filter(r=>r.origin===p.code||r.destination===p.code).flatMap(r=>r.sources.map(s=>s.sourceId)))];
    if(['BTG','CAL','PGA','ADI','ROX','BUL'].includes(p.code))sourceIds.push('ppa');
    if(p.code==='CAL')sourceIds.push('pcbsi');
    const meta=metadata({...p,sourceIds},{terminalOperator:p.terminalOperator});
    statements.push(`insert into public.port(id,code,name,city,region,reference_metadata) values(${literal(id('port',p.code))},${literal(p.code)},${literal(p.name)},${literal(p.city)},${literal(p.region)},${json(meta)})
      on conflict(code) do update set name=excluded.name,city=excluded.city,region=excluded.region,reference_metadata=excluded.reference_metadata;`);
  }
  for(const r of catalog.routes){
    const meta=metadata(r,{operators:r.operators,inactiveReason:r.inactiveReason,sourcePages:r.sources.filter(s=>s.page),schedules:r.schedules || [],accommodationProfiles:r.accommodationProfiles || []});
    statements.push(`insert into public.ferry_route(id,code,origin_port_id,destination_port_id,duration_minutes,is_active,reference_metadata)
      select ${literal(id('route',r.code))},${literal(r.code)},o.id,d.id,null,${r.isActive},${json(meta)} from public.port o,public.port d where o.code=${literal(r.origin)} and d.code=${literal(r.destination)}
      on conflict(origin_port_id,destination_port_id) do update set reference_metadata=excluded.reference_metadata${!r.isActive?',is_active=false':''};`);
  }
  for(const v of catalog.vessels){
    const meta=metadata(v,{operator:v.operator,capacityStatus:v.capacityStatus,publishedCapacities:v.publishedCapacities,observations:v.observations,serviceNote:v.serviceNote,accommodationProfiles:v.accommodationProfiles || []});
    statements.push(`insert into public.vessel(id,code,name,passenger_capacity,is_active,reference_metadata) values(${literal(id('vessel',v.code))},${literal(v.code)},${literal(v.name)},${v.passengerCapacity??'null'},${v.isActive},${json(meta)})
      on conflict(code) do update set reference_metadata=excluded.reference_metadata;`);
    for(const code of v.routes){
      const r=catalog.routes.find(r=>r.code===code);
      statements.push(`insert into public.vessel_route(vessel_id,route_id) select v.id,r.id from public.vessel v,public.ferry_route r,public.port o,public.port d
        where v.code=${literal(v.code)} and r.origin_port_id=o.id and r.destination_port_id=d.id and o.code=${literal(r.origin)} and d.code=${literal(r.destination)} on conflict do nothing;`);
    }
  }
  // Retain old demo identities for ticket history; exclude them from planning new sailings.
  statements.push(`update public.vessel set is_active=false,reference_metadata='{"kind":"demo-archive","operator":"Demo data"}'::jsonb
    where (code in ('VSL-001','VSL-002','VSL-003','VSL-004') and id::text like 'eeeeeeee-%') or (code='MIS-001' and name='Island Star');`);
  statements.push(`update public.port set is_active=false,reference_metadata='{"kind":"demo-archive"}'::jsonb where code='CAL-SOUTH' and name='Calapan South Terminal';`);
  statements.push(`update public.ferry_route set is_active=false,reference_metadata='{"kind":"demo-archive"}'::jsonb where code='CAL-PGA';`);
  // Enforce the requested service area for every existing port, including records not in this catalog.
  statements.push(`update public.port set is_active=(code in ('BTG','CAL') and coalesce(reference_metadata->>'kind','') <> 'demo-archive');`);
  statements.push(`update public.ferry_route r set is_active=false from public.port o,public.port d where r.origin_port_id=o.id and r.destination_port_id=d.id and (not o.is_active or not d.is_active);`);
  statements.push(`update public.vessel v set is_active=false where not exists(select 1 from public.vessel_route vr join public.ferry_route r on r.id=vr.route_id where vr.vessel_id=v.id and r.is_active);`);
  statements.push(`do $$ begin if to_regclass('barkolink_private.daily_schedule') is not null then update barkolink_private.daily_schedule s set is_active=false where not exists(select 1 from public.ferry_route r where r.id=s.route_id and r.is_active); end if; end $$;`);
  // Seed missing daily templates after fresh installs without overwriting admin edits.
  statements.push(`do $$ begin
    if to_regclass('barkolink_private.daily_schedule') is not null then
      if not exists(select 1 from barkolink_private.daily_schedule) then
insert into barkolink_private.daily_schedule(operator,route_id,departure_times,duration_minutes,is_active)
select item->>'operator',r.id,array(select jsonb_array_elements_text(item->'departureTimes') order by 1),
  (item->>'durationMinutes')::integer,r.is_active and o.is_active and d.is_active
from public.ferry_route r join public.port o on o.id=r.origin_port_id join public.port d on d.id=r.destination_port_id
cross join lateral jsonb_array_elements(coalesce(r.reference_metadata->'schedules','[]')) item
where item->>'operator' is not null and jsonb_typeof(item->'departureTimes')='array'
on conflict(operator,route_id) do nothing;
      end if;
    end if;
  end $$;`);
  return statements.join('\n')+'\n';
}
if(process.argv[2]==='generate') {
  fs.writeFileSync('supabase/reference-catalog.sql',referenceCatalogSql());
  fs.writeFileSync('supabase/seed.sql','-- Optional verified reference data. Apply after all migrations; no bookings, accounts, fares or departures are created.\n'+referenceCatalogSql());
  console.log(`Generated ${catalog.ports.length} ports, ${catalog.routes.length} directed routes, ${catalog.vessels.length} vessels.`);
}
