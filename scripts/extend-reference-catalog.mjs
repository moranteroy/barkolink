// Reviewed official operator publications; independent of live inventory and bookings.
import fs from 'node:fs';
export function extendCatalog(catalog) {
  Object.assign(catalog.sources, {
    fastcatSchedules:{url:'https://www.fastcat.ph/routes-schedules/',published:'2026-08',title:'FastCat official schedules'},
    fastcatClasses:{url:'https://www.fastcat.ph/rates/',published:null,title:'FastCat official accommodation classes'},
    starliteSchedules:{url:'https://starliteferries.com/schedule-and-rates-2025-2/',published:'2025',title:'Starlite published schedules and classes (2025)'},
    supercatSchedules:{url:'https://supercat.ph/schedules-and-rates/',published:null,title:'SuperCat official schedules and classes'},
    oceanjetClasses:{url:'https://www.oceanjet.net/travel-advisories/updated-baggage-policy',published:'2026-02-02',title:'OceanJet official accommodation classes'},
    montenegroBooking:{url:'https://montenegrolines.com.ph/booking.php',published:null,title:'Montenegro date-specific schedule lookup'},
  });
  const regions=['Batangas','Oriental Mindoro','Occidental Mindoro'];
  const addPort=(code,name,city,region)=>{
    if(!catalog.ports.some(p=>p.code===code))catalog.ports.push({code,name,city,region,sourceIds:['fastcatSchedules'],terminalOperator:null});
  };
  addPort('BNG','Banago Port','Bacolod City','Negros Occidental');
  addPort('SCA','San Carlos Port','San Carlos City','Negros Occidental');
  addPort('TOL','Toledo Port','Toledo','Cebu');
  addPort('TUB','Tubigon Port','Tubigon','Bohol');
  addPort('MSN','Maasin Port','Maasin','Southern Leyte');
  const pair=(a,b,operator,sourceId,page)=>{
    for(const [origin,destination] of [[a,b],[b,a]]){
      const code=`${origin}-${destination}`;
      let r=catalog.routes.find(r=>r.code===code);
      if(!r){r={code,origin,destination,isActive:true,inactiveReason:null,operators:[],sources:[]};catalog.routes.push(r);}
      if(!r.operators.includes(operator))r.operators.push(operator);
      if(!r.sources.some(s=>s.sourceId===sourceId&&s.page===page))r.sources.push({sourceId,...(page?{page}:{})});
    }
    return [`${a}-${b}`,`${b}-${a}`];
  };
  const vessel=(code,name,operator,cap,a,b,page,extra={})=>{
    const routes=pair(a,b,operator,'marina',page);
    let v=catalog.vessels.find(v=>v.code===code);
    if(!v){v={code,name,operator,passengerCapacity:cap,isActive:cap!=null,capacityStatus:cap==null?'capacity not published':'published reference capacity',publishedCapacities:cap==null?[]:[cap],routes:[],observations:[]};catalog.vessels.push(v);}
    for(const route of routes)if(!v.routes.includes(route))v.routes.push(route);
    const observation={sourceId:'marina',page,capacity:cap,route:`${a}-${b}`};
    if(!v.observations.some(o=>JSON.stringify(o)===JSON.stringify(observation)))v.observations.push(observation);
    Object.assign(v,extra);
  };
  for(const [number,cap] of [[5,289],[15,330],[12,350]])vessel(`FC-M${number}`,`MV Fast Cat M${number}`,'FastCat',cap,'BTG','CAL',1);
  vessel('FC-M8','MV Fast Cat M8','FastCat',275,'BUL','CAT',5);
  vessel('OJ-3','MV Ocean Jet 3','OceanJet',323,'BTG','CAL',2,{isActive:false,serviceNote:'Under preventive maintenance in the March 2026 MARINA matrix; confirm return to service.'});
  vessel('OJ-5','MV Ocean Jet 5','OceanJet',319,'BTG','CAL',2);
  vessel('SC-ST-URIEL','MV St. Uriel','SuperCat',292,'BTG','CAL',2);
  vessel('SC-ST-BRAQUIEL','MV St. Braquiel','SuperCat',247,'BTG','CAL',2);
  vessel('BESTA-BALENO','MV Baleno','Besta Shipping Lines',null,'BTG','CAL',1,{capacityStatus:'conflicting published capacities',publishedCapacities:[820,498]});
  vessel('BESTA-BALENO','MV Baleno','Besta Shipping Lines',null,'BTG','ADI',3,{capacityStatus:'conflicting published capacities',publishedCapacities:[820,498]});
  for(const [code,name] of [['FIVE','MV Baleno Five'],['OTSO','MV Baleno Otso']]){
    vessel(`BESTA-${code}`,name,'Besta Shipping Lines',288,'BTG','CAL',1);
    vessel(`BESTA-${code}`,name,'Besta Shipping Lines',288,'BTG','ADI',3);
  }
  for(const n of [2,3])vessel(`ORANGE-RORO-MASTER-${n}`,`MV RORO Master ${n}`,'Orange Navigation',800,'BTG','ADI',3);
  vessel('ATZ-STAR-SAN-CARLOS','MV Star San Carlos','Atienza Inter-Island Ferries',182,'BTG','PGA',2);
  vessel('ATZ-MAY-LILIES','MV May Lilies','Atienza Inter-Island Ferries',278,'BTG','PGA',2);
  const fastcatPairs=[['BTG','CAL'],['BUL','CAT'],['DMG','BNG'],['DUM','DAP'],['SCA','TOL'],['CEB','TUB'],['MTN','ADD'],['MSN','SUR'],['ZAM','ISA']];
  for(const [a,b] of fastcatPairs)pair(a,b,'FastCat','fastcatSchedules');
  for(const p of catalog.ports)p.isActive=regions.includes(p.region);
  for(const r of catalog.routes){
    const inScope=[r.origin,r.destination].every(c=>catalog.ports.find(p=>p.code===c)?.isActive);
    r.isActive=inScope && !r.sources.some(s=>s.status==='NOT SERVED');
    r.inactiveReason=inScope?null:'Outside the active Batangas–Mindoro service area.';
  }
  const daily=(operator,routeCode,times,sourceId,durationMinutes=null)=>({operator,routeCode,days:[0,1,2,3,4,5,6],departureTimes:times.split(' '),durationMinutes,timezone:'Asia/Manila',sourceId,published:catalog.sources[sourceId].published,status:'published-reference'});
  const odd=Array.from({length:12},(_,i)=>`${String(2*i+1).padStart(2,'0')}:00`).join(' ');
  catalog.schedules=[
    daily('FastCat','BTG-CAL','01:00 06:00 09:00 13:00 15:00 21:00','fastcatSchedules',120),
    daily('FastCat','CAL-BTG','00:00 04:00 10:00 12:00 16:00 21:00','fastcatSchedules',120),
    daily('FastCat','BUL-CAT','10:00 22:00','fastcatSchedules',210),
    daily('FastCat','CAT-BUL','03:00 15:00','fastcatSchedules',210),
    daily('Starlite Ferries','BTG-CAL',odd,'starliteSchedules'),
    daily('Starlite Ferries','CAL-BTG',odd,'starliteSchedules'),
    daily('SuperCat','BTG-CAL','09:30 13:30 17:30','supercatSchedules'),
    daily('SuperCat','CAL-BTG','07:30 11:30 17:30','supercatSchedules'),
    daily('Starlite Ferries','ROX-CAT','02:00 06:00 11:00 14:00 18:00 23:00','starliteSchedules'),
    daily('Starlite Ferries','CAT-ROX','01:00 05:00 09:00 12:00 16:00 20:00','starliteSchedules'),
  ];
  catalog.scheduleNotes={
    FastCat:'Arrival estimates use the published 2-hour duration. The source’s 09:00 AM → 11:00 PM entry is inconsistent and is not copied as an arrival time.',
    'Starlite Ferries':'The official page is labelled 2025. Reconfirm these published departures before operating a trip.',
    SuperCat:'Published operator departures are subject to change; confirm vessel assignment and travel time.',
    'Montenegro Shipping Lines':'Schedules are date-specific in the official booking lookup. No fixed daily times were verified.',
    OceanJet:'No current fixed daily Batangas–Calapan timetable was verified. Ocean Jet 3 is marked under maintenance in the MARINA matrix.',
  };
  catalog.accommodationProfiles=[
    {operator:'FastCat',routeCodes:['BTG-CAL','CAL-BTG','BUL-CAT','CAT-BUL'],classes:['Economy','Premium Economy','Business Class'],sourceId:'fastcatClasses'},
    {operator:'Starlite Ferries',routeCodes:['BTG-CAL','CAL-BTG','ROX-CAT','CAT-ROX'],classes:['Economy','Tourist Class','Business Class'],sourceId:'starliteSchedules'},
    {operator:'SuperCat',routeCodes:['BTG-CAL','CAL-BTG'],classes:['Economy (Open Air)','Tourist Class','Business Class'],sourceId:'supercatSchedules'},
    {operator:'OceanJet',routeCodes:['BTG-CAL','CAL-BTG'],classes:['Open Air','Tourist Class','Business Class'],sourceId:'oceanjetClasses'},
  ].map(p=>({...p,capacity:null,surcharge:null,status:'allocation-required',scope:'operator-route; availability depends on the assigned vessel'}));
  for(const r of catalog.routes){
    r.schedules=catalog.schedules.filter(s=>s.routeCode===r.code);
    r.accommodationProfiles=catalog.accommodationProfiles.filter(p=>p.routeCodes.includes(r.code));
  }
  for(const v of catalog.vessels){
    v.accommodationProfiles=catalog.accommodationProfiles.filter(p=>p.operator===v.operator&&p.routeCodes.some(c=>v.routes.includes(c)));
  }
  catalog.scope='Nationwide ferry reference network; active ports limited to Batangas and Oriental/Occidental Mindoro. Published operator timetables and class profiles require operational confirmation.';
  return catalog;
}
if(process.argv[1]?.endsWith('extend-reference-catalog.mjs')){
  const file='src/data/ferryReferenceCatalog.json',catalog=extendCatalog(JSON.parse(fs.readFileSync(file,'utf8')));
  fs.writeFileSync(file,JSON.stringify(catalog,null,2)+'\n');
  console.log(JSON.stringify({ports:catalog.ports.length,activePorts:catalog.ports.filter(p=>p.isActive).length,vessels:catalog.vessels.length,operators:[...new Set(catalog.vessels.map(v=>v.operator))],schedules:catalog.schedules.length}));
}
