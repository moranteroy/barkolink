// Research preparation only. The reviewed JSON is committed; this script never writes to a database.
import fs from 'node:fs';
import { extendCatalog } from './extend-reference-catalog.mjs';
const marinaUrl = 'https://marina.gov.ph/wp-content/uploads/2026/04/Philippine-Nautical-Highway-Matrix-MAR-2026.pdf';
const starliteUrl = 'https://starliteferries.com/our-fleet/';
const montenegroUrl = 'https://montenegrolines.com.ph/contact.php';
const sources = {
  marina: { url: marinaUrl, published: '2026-03', title: 'MARINA Philippine Nautical Highway Matrix' },
  starlite: { url: starliteUrl, published: null, title: 'Starlite official fleet and vessel routes' },
  montenegro: { url: montenegroUrl, published: null, title: 'Montenegro official offices and routes' },
  ppa: { url: 'https://www.ppa.com.ph/content/mindoro%E2%80%99s-%E2%80%98food-highway%E2%80%99-gets-boost-completion-8-integrated-seaport-projects-prrd-leads?page=1', published:'2021-11', title:'PPA Mindoro port projects' },
  pcbsi: { url: 'https://linkrigroup.com/pcbsi-port-terminal-management-corp/', published:null, title:'PCBSI Port Terminal Management Corp.' },
};
const portData = [
  ['BTG','Batangas Port','Batangas City','Batangas'], ['CAL','Calapan Port','Calapan City','Oriental Mindoro'],
  ['PGA','Balatero Port','Puerto Galera','Oriental Mindoro'], ['ADI','Abra de Ilog Port','Abra de Ilog','Occidental Mindoro'],
  ['ROX','Dangay Port','Roxas','Oriental Mindoro'], ['CAT','Caticlan Jetty Port','Malay','Aklan'],
  ['ODI','Poctoy Port','Odiongan','Romblon'], ['ROM','Romblon Port','Romblon','Romblon'],
  ['MAG','Magdiwang Port','Magdiwang','Romblon'], ['SAG','San Agustin Port','San Agustin','Romblon'],
  ['RXS','Culasi Port','Roxas City','Capiz'], ['CEB','Cebu Port','Cebu City','Cebu'],
  ['SUR','Surigao Port','Surigao City','Surigao del Norte'], ['NAS','Nasipit Port','Nasipit','Agusan del Norte'],
  ['DAP','Dapitan (Pulauan) Port','Dapitan City','Zamboanga del Norte'], ['DUM','Dumaguete Port','Dumaguete City','Negros Oriental'],
  ['SIQ','Siquijor Port','Siquijor','Siquijor'], ['LAR','Larena Port','Larena','Siquijor'],
  ['ILO','Iloilo Port','Iloilo City','Iloilo'], ['BAC','BREDCO Port','Bacolod City','Negros Occidental'],
  ['DMG','Dumangas Port','Dumangas','Iloilo'], ['JRD','Jordan Port','Jordan','Guimaras'],
  ['CUY','Cuyo Port','Cuyo','Palawan'], ['PPS','Puerto Princesa Port','Puerto Princesa City','Palawan'],
  ['COR','Coron Port','Coron','Palawan'], ['CUL','Culion Port','Culion','Palawan'], ['ELN','El Nido Port','El Nido','Palawan'],
  ['LUC','Lucena (Talao-Talao) Port','Lucena City','Quezon'], ['BAL','Balanacan Port','Mogpog','Marinduque'],
  ['MAS','Masbate Port','Masbate City','Masbate'], ['PIL','Pilar Port','Pilar','Sorsogon'],
  ['LAG','Lagundi Port','Batuan','Masbate'], ['MTN','Matnog Port','Matnog','Sorsogon'],
  ['ALN','Balwharteco Port (Looc)','Allen','Northern Samar'], ['ADD','Dapdap Port','Allen','Northern Samar'],
  ['SIS','San Isidro Port','San Isidro','Northern Samar'], ['LAV','Lavezares Port','Lavezares','Northern Samar'],
  ['BIR','Biri Port','Biri','Northern Samar'], ['LIP','Lipata Ferry Terminal','Surigao City','Surigao del Norte'],
  ['BEN','Benit Port','San Ricardo','Southern Leyte'], ['LIL','Liloan Port','Liloan','Southern Leyte'],
  ['SJL','San Juan Port','San Juan','Southern Leyte'], ['DPA','Dapa Port','Dapa','Surigao del Norte'],
  ['DIN','San Jose Port','San Jose','Dinagat Islands'], ['ZAM','Zamboanga Port','Zamboanga City','Zamboanga del Sur'],
  ['ISA','Isabela Port','Isabela City','Basilan'], ['LAM','Lamitan Port','Lamitan City','Basilan'],
  ['JOL','Jolo Port','Jolo','Sulu'], ['MBN','Mabini Port','Mabini','Batangas'], ['TIN','Tingloy Port','Tingloy','Batangas'],
  ['STA','Santa Teresa Port','Magsaysay','Occidental Mindoro'], ['SJM','San Jose Port','San Jose','Occidental Mindoro'],
  ['BUL','Bulalacao Port','Bulalacao','Oriental Mindoro'], ['SEM','Semirara Port','Caluya','Antique'],
  ['BUR','Buruanga Port','Buruanga','Aklan'], ['UNI','Unidos Port','Nabas','Aklan'],
  ['ANT','Lipata Port','Culasi','Antique'], ['EST','Estancia Port','Estancia','Iloilo'],
  ['BOG','Polambato Port','Bogo City','Cebu'], ['PIO','Pio Duran Port','Pio Duran','Albay'],
  ['ARO','Aroroy Port','Aroroy','Masbate'], ['CTA','Cataingan Port','Cataingan','Masbate'],
  ['NAV','Naval Port','Naval','Biliran'], ['TAB','Tabaco Port','Tabaco City','Albay'],
  ['VIR','Virac Port','Virac','Catanduanes'], ['TAY','Taytay Port','Taytay','Palawan'],
  ['CLR','Calatrava Port','Calatrava','Romblon'], ['PIN','Pinamalayan Port','Pinamalayan','Oriental Mindoro'],
  ['CON','Concepcion Port (Sibale)','Concepcion','Romblon'], ['BAN','Banton Port','Banton','Romblon'],
  ['CGN','Cagban Port','Malay','Aklan'], ['TBL','Tabuelan Port','Tabuelan','Cebu'],
  ['ESC','Escalante Port','Escalante City','Negros Occidental'], ['OSL','Oslob Port','Oslob','Cebu'],
];
const ports = portData.map(([code,name,city,region]) => ({code,name,city,region,sourceIds:['marina'],terminalOperator:code==='CAL'?'PCBSI Port Terminal Management Corp.':null}));
const routeMap = new Map(), vesselMap = new Map();
function corridor(chain, operator, sourceId, page = null, vesselName = null, capacity = null, inactiveReason = null) {
  const codes = chain.split(' ');
  let vessel;
  if(vesselName) {
    const name = normalizeName(vesselName);
    const code = `${operator==='Starlite Ferries'?'SL':'MN'}-${name.replace(/^MV /,'').replace(/^Starlite /,'').toUpperCase().replace(/[^A-Z0-9]+/g,'-')}`;
    if (!vesselMap.has(code)) vesselMap.set(code,{code,name,operator,capacities:[],routes:[],observations:[]});
    vessel=vesselMap.get(code);
    if (Number.isInteger(capacity) && capacity>0) vessel.capacities.push(capacity);
    vessel.observations.push({sourceId,page,capacity});
  }
  for(let i=1;i<codes.length;i++) for(const [origin,destination] of [[codes[i-1],codes[i]],[codes[i],codes[i-1]]]) {
    if(origin===destination)continue;
    if(!ports.some(p=>p.code===origin)||!ports.some(p=>p.code===destination))throw new Error(`Unknown port ${chain}`);
    const code=`${origin}-${destination}`;
    if(!routeMap.has(code))routeMap.set(code,{code,origin,destination,durationMinutes:null,operators:[],sources:[],isActive:!inactiveReason,inactiveReason});
    const route=routeMap.get(code);
    route.operators.push(operator); route.sources.push({sourceId,page});
    if(vessel)vessel.routes.push(code);
  }
}
function normalizeName(name) {
  let n=name.replace(/"/g,'').replace(/\(Fastcraft\)/gi,'').replace(/^Mv /,'MV ').replace(/^MV MA /,'MV Maria ').replace(/^MV Ma\. /,'MV Maria ').replace('MV Marie Teresa','MV Maria Teresa').replace('MV Marie Kristina','MV Maria Kristina');
  if (/Trans.?Asia\s*20/i.test(n))return 'MV Starlite Phoenix';
  if(/Stellla Mariz/i.test(n))return 'MV SWM Stella Maris';
  if(/Stella del Mar/i.test(n))return 'MV SWM Stella del Mar';
  if(/STARLITE SATURN/.test(n))return 'MV Starlite Saturn';
  if(n==='Starlite Archer')return 'MV Starlite Archer';
  if(/REINA KLEOPATRA/.test(n))return 'MV Reina Kleopatra';
  if(/REINA JUSTISYA/.test(n))return 'MV Reina Justisya';
  if(/REINA BANDERADA/.test(n))return 'MV Reina Banderada';
  if(/MARIA ERLINDA/.test(n))return 'MV Maria Erlinda';
  n=n.replace('Reina Delos Flores','Reina delos Flores').replace('Reina Del Rosario','Reina del Rosario').replace('Reina De Luna','Reina de Luna').replace('Reina Centenciada','Reina Sentenciada');
  n=n.replace('Maria REBECCA','Maria Rebecca').replace('CITY OF MASBATE','City of Masbate').replace('CIty of Himamaylan','City of Himamaylan');
  return n.trim();
}
// All ferry corridors listed on Montenegro's official contact page; Rorobus land routes are excluded.
for(const chain of ['BTG ADI','BTG CAL','BTG PGA','BTG ODI','ODI ROM','MBN TIN','COR ELN','COR CUL',
  'LUC BAL','LUC ROM','LUC SAG','SAG ROM','ROM MAG','MAS PIL','MAS LAG','ALN MTN','LAV BIR',
  'LIP BEN','LIP LIL','SUR DPA','SUR DIN','ROX CAT','ROX ODI','CAT STA','ILO JRD','ILO CUY','ILO PPS','CUY PPS',
  'BAC DMG','BAC ILO','DUM DAP','DUM SIQ','ZAM ISA','ZAM JOL'])
  corridor(chain,'Montenegro Shipping Lines','montenegro');
// Vessel deployment pairs on the Starlite official fleet page, kept separate from schedules.
const starliteFleet = [
 ['MV Starlite Annapolis',['BTG CAL']],['MV Starlite Archer',['CEB SUR','CEB NAS']],
 ['MV Starlite Eagle',['ROX ODI']],['MV Starlite Jupiter',['BTG CAL']],['MV Starlite Pacific',['BTG CAL']],
 ['MV Starlite Phoenix',['BTG CAT']],['MV Starlite Pioneer',['CEB DAP','CEB NAS','SUR CEB']],
 ['MV Starlite Reliance',['ROX ODI']],['MV Starlite Saturn',['MAG BTG','MAG ROM','MAG RXS']],
 ['MV SWM Stella Maris',['MAG ROM','MAG RXS']],['MV SWM Stella del Mar',['BTG CAL','ROX CAT']],
 ['MV SWM Salve Regina',['ROM RXS','MAG BTG','MAG ROM','MAG RXS']],['MV Starlite Venus',['BTG CAT']],
 ['MV Starlite Sprint 1',['BTG CAL']],
];
for(const [name,chains] of starliteFleet)for(const chain of chains)corridor(chain,'Starlite Ferries','starlite',null,name);
// Reviewed MARINA route text -> actual consecutive port legs, never all combinations of a multi-stop itinerary.
const chainByRoute = {
 'Batangas - Calapan, Oriental Mindoro':'BTG CAL',
 'Batangas City -Balatero, Puerto,Galera, Oriental Mindoro':'BTG PGA',
 'Batangas City - Caticlan, Aklan':'BTG CAT',
 'Batangas- Lipata, Culasi, Antique - San Pedro, Iloilo - Bredco Bacolod- Estancia, Iloilo':'BTG ANT ILO BAC EST',
 'Batangas - Iloilo - Bacolod - Batangas':'BTG ILO BAC BTG',
 'Batangas City - Culasi , Roxas City, Capiz - Polambato, Bogo, Cebu':'BTG RXS BOG',
 'Batangas - Odiongan - Caticlan - Batangas - Caticlan - Odiongan - Batangas - Caticlan':'BTG ODI CAT BTG',
 'Batangas City - Romblon, Romblon':'BTG ROM',
 'Batangas City - Odiongan , Romblon - Romblon , Romblon':'BTG ODI ROM',
 'Roxas, Oriental Mindoro - Caticlan, Aklan':'ROX CAT',
 'Roxas, Oriental Mindoro - Buruanga, Aklan':'ROX BUR',
 'Roxas Oriental Mindoro - Odiongan, Romblon- Caticlan, Malay, Aklan':'ROX ODI CAT',
 'Roxas Oriental Mindoro - Caticlan Jetty Port Malay Aklan':'ROX CAT',
 'Dangay, Roxas Oriental Mindoro - Poctoy Odiongan Romblon':'ROX ODI',
 'Bulalacao, Oriental Mindoro - Semirara, Caluya Antique - Buruanga Aklan':'BUL SEM BUR',
 'San Jose, Occidental Mindoro - Sta. Teresa, Magsaysay, Occidental Mindoro - Semirara, Caluya Island - Buruanga, Aklan':'SJM STA SEM BUR',
 'Roxas, Oriental Mindoro - Unidos Port, Nabas, Aklan':'ROX UNI',
 'Dumangas, Iloilo - Bacolod, Negros Occidental':'DMG BAC',
 'Dumaguete City, Negros Oriental - Palauan, Dapitan City, Zamboanga Del Norte':'DUM DAP',
 'Matnog, Sorsogon - Looc, Balwharteco Allen, Northern Samar':'MTN ALN',
 'Matnog, Sorsogon - Dapdap, Allen, Northern Samar':'MTN ADD',
 'Matnog - San Isidro, Northern Samar':'MTN SIS',
 'Pio Duran, Albay -Masbate City - Surigao City':'PIO MAS SUR',
 'Benit, San Ricardo - Lipata, Surigao City':'BEN LIP',
 'Lipata, Surigao - San Juan,Southern Leyte':'LIP SJL',
 'Pilar, Sorsogon - Masbate City, Masbate':'PIL MAS',
 'Pioduran, Albay - Aroroy, Masbate':'PIO ARO',
 'Cataingan, Masbate - Bogo ,':'CTA BOG',
 'Bogo City - Cataingan, Masbate - Naval Biliran':'BOG CTA NAV',
 'Mabini, Batangas - Tingloy, Batangas (fastcraft)':'MBN TIN',
 'Batangas - Estancia, Iloilo - Polambato, Bogo Cebu':'BTG EST BOG',
 'Lucena, Quezon - Mogpog, Marinduque':'LUC BAL',
 'Tabaco City , Albay -Virac, Catanduanes':'TAB VIR',
 'Cuyo, Palawan - Iloilo':'CUY ILO',
 'Iloilo City - Cuyo, Palawan - Puerto Princesa, Palawan':'ILO CUY PPS',
 'Coron, Palawan - Culion, Palawan':'COR CUL',
 'San Jose Occidental Mindoro- Coron, Palawan -Taytay Palawan v.v.':'SJM COR TAY',
 'Bulalacao, Oriental Mindoro - Semirara Island, Caluya, Antique':'BUL SEM',
 'Roxas, Oriental Mindoro - Calatrava, Romblon - Romblon, Romblon - Magdiwang, Romblon':'ROX CLR ROM MAG',
 'Semirara, Island Caluya Antique - San Jose Oriental Mindoro':'SEM SJM',
 'Roxas, Oriental Mindoro - Odiongan, Romblon':'ROX ODI',
 'Roxas, Mindoro - Caticlan - Odiongan - Batangas - Romblon, Romblon - Magdiwang, Romblon - Culasi, Roxas and vice versa':'ROX CAT ODI BTG ROM MAG RXS',
 'San Agustin, Romblon - Romblon, Romblon - Magdiwang Romblon':'SAG ROM MAG',
 'Odiongan , Romblon - Romblon, Romblon':'ODI ROM',
 'Pinamalayan, Oriental Mindoro - Sibale, Concepcon, Romblon - Banton. Romblon -':'PIN CON BAN',
 'Masbate City - Lagundi, Batuan, Masbate':'MAS LAG',
 'Caticlan, Aklan - Cagban, Boracay':'CAT CGN',
 'Tabuelan, Cebu - Escalante, Negros Occidental':'TBL ESC',
 'Siquijor, Siquijor - Dumaguete, Negros Oriental':'SIQ DUM',
 'Oslob, Cebu - Larena, Siquijor':'OSL LAR',
 'San Jose , Dinagat Island - Surigao City':'DIN SUR',
 'Surigao City - Dapa, Siargao':'SUR DPA',
 'Zamboanga City - Isabela':'ZAM ISA', 'Lamitan':'ZAM LAM', 'Zamboanga City- Jolo, Sulu':'ZAM JOL',
 // The table text carries the previous route into these cells; page 29 visually confirms Dumaguete–Larena.
 'Pulupandan, Negros Oriental - Sibunag, Guimaras':'DUM LAR',
};
const observations = JSON.parse(fs.readFileSync('.audit/reference-catalog/marina-rows.json','utf8'));
for(const row of observations){
  const chain=chainByRoute[row.route];
  if(!chain || row.vessel.startsWith('LCT ') || row.vessel==='MV Lite Ferry 11' || row.vessel==='MV Reina Bandelaria')continue;
  const operator=row.operator.toLowerCase().includes('starlite')?'Starlite Ferries':'Montenegro Shipping Lines';
  const names=row.vessel==='Mv Reina Veronica & MV Reina Magdalena'?['MV Reina Veronica','MV Reina Magdalena']:[row.vessel];
  if(row.vessel==='MV Reina Neptuna MV City of Iloilo')names.splice(0,1,'MV Reina Neptuna','MV City of Iloilo');
  if(row.vessel==='MV City of Sorsogon MV Marie Kristina')names.splice(0,1,'MV City of Sorsogon','MV Maria Kristina');
  const cap=/^\d+$/.test(row.capacity)?Number(row.capacity):row.capacity==='265 / 265'?265:null;
  for(const name of names)corridor(chain,operator,'marina',row.page,name,names.length>1?null:cap);
}
// Page continuations omit the operator in some extracted cells. These assignments were checked against page images.
for(const [name,capacity] of [['MV Binibining Coron',410],['MV Santa Carmelita',419],['MV Santa Soledad',410],['MV Reina Genoveva',584]])
  corridor('BTG ADI','Montenegro Shipping Lines','marina',3,name,capacity);
for(const [name,capacity] of [['MV City of Roxas',198],['MV City of Dapitan',92],['MV City of Bacolod',92]])
  corridor('BTG PGA','Montenegro Shipping Lines','marina',2,name,capacity);
for(const [name,capacity] of [['MV Reina del Rosario',930],['MV Maria Matilde',638]])corridor('BTG ROM','Montenegro Shipping Lines','marina',4,name,capacity);
const uniq=(values)=>[...new Set(values)];
const vessels=[...vesselMap.values()].map(v=>{
  const capacities=uniq(v.capacities), passengerCapacity=capacities.length===1?capacities[0]:null;
  return {code:v.code,name:v.name,operator:v.operator,passengerCapacity,isActive:passengerCapacity!==null,
    capacityStatus:capacities.length>1?'conflicting published capacities':passengerCapacity===null?'capacity not published':'published reference capacity',
    publishedCapacities:capacities,routes:uniq(v.routes).sort(),observations:v.observations};
}).sort((a,b)=>a.name.localeCompare(b.name));
const routes=[...routeMap.values()].map(r=>({...r,operators:uniq(r.operators),sources:[...new Map(r.sources.map(s=>[JSON.stringify(s),s])).values()]})).sort((a,b)=>a.code.localeCompare(b.code));
// Remove unused ports; no unrelated nationwide ports are added just to inflate coverage.
const used=uniq(routes.flatMap(r=>[r.origin,r.destination]));
const catalog={checkedAt:'2026-10-11',scope:'Verified nationwide Starlite and Montenegro reference network; not a live sailing schedule',
  sources,ports:ports.filter(p=>used.includes(p.code)),routes,vessels};
extendCatalog(catalog);
fs.writeFileSync('src/data/ferryReferenceCatalog.json',JSON.stringify(catalog,null,2)+'\n');
console.log(JSON.stringify({ports:catalog.ports.length,routes:routes.length,vessels:vessels.length,capacityConfirmed:vessels.filter(v=>v.isActive).length}));
