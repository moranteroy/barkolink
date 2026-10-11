import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { catalog } from './reference-catalog.mjs';
const projectUrl=fs.readFileSync('.env.local','utf8').match(/^VITE_SUPABASE_URL\s*=\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g,'');
const projectRef=new URL(projectUrl).hostname.split('.')[0],uid='33333333-3333-4333-8333-333333333333';
const sourceUrls=ids=>[...new Set(ids)].map(id=>catalog.sources[id].url);
const ports=catalog.ports.map(p=>({...p,id:p.code,isActive:p.isActive,referenceMetadata:{kind:'verified-reference',checkedAt:catalog.checkedAt,terminalOperator:p.terminalOperator,sourceUrls:sourceUrls(p.code==='CAL'?['ppa','pcbsi','marina']:['marina'])}}));
const vessels=catalog.vessels.map(v=>({...v,id:v.code,referenceMetadata:{kind:'verified-reference',operator:v.operator,checkedAt:catalog.checkedAt,sourceUrls:sourceUrls(v.observations.map(o=>o.sourceId)),capacityStatus:v.capacityStatus,publishedCapacities:v.publishedCapacities},routes:v.routes.map(code=>{const r=catalog.routes.find(r=>r.code===code);return{id:code,code,originPortId:r.origin,destinationPortId:r.destination,origin:ports.find(p=>p.code===r.origin).name,destination:ports.find(p=>p.code===r.destination).name,isActive:r.isActive}})}));
const routes=catalog.routes.map(r=>({...r,id:r.code,originPortId:r.origin,destinationPortId:r.destination,origin:{name:ports.find(p=>p.code===r.origin).name},destination:{name:ports.find(p=>p.code===r.destination).name},vessels:vessels.filter(v=>v.routes.some(x=>x.code===r.code)).map(v=>({id:v.id,name:v.name,operator:v.operator})),referenceMetadata:{kind:'verified-reference',checkedAt:catalog.checkedAt,operators:r.operators,sourceUrls:sourceUrls(r.sources.map(s=>s.sourceId))}}));
const scheduleRoutes=routes.map(r=>({id:r.id,code:r.code,origin:r.origin.name,destination:r.destination.name,isActive:r.isActive,operators:r.operators}));
const dailyTemplates=catalog.schedules.map((item,index)=>{const r=scheduleRoutes.find(r=>r.code===item.routeCode);return {...item,id:`schedule-${index}`,routeId:r.id,origin:r.origin,destination:r.destination,isActive:r.isActive,routeActive:r.isActive};});
const browser=await chromium.launch({channel:'msedge',headless:true});
const errors=[];
fs.mkdirSync('docs/screenshots/reference-catalog',{recursive:true});
try{
 for(const width of (process.argv.includes('--mobile-only') ? [390] : [1440,390])){
  const context=await browser.newContext({viewport:{width,height:950}});
  const user={id:uid,email:'catalog-ui@example.invalid',app_metadata:{role:'ADMIN'},user_metadata:{fullName:'Catalog Admin'},aud:'authenticated'};
  const encoded=value=>Buffer.from(JSON.stringify(value)).toString('base64url'),exp=Math.floor(Date.now()/1000)+3600;
  const session={access_token:`${encoded({alg:'HS256',typ:'JWT'})}.${encoded({sub:uid,exp,role:'authenticated',app_metadata:{role:'ADMIN'}})}.test`,refresh_token:'test',token_type:'bearer',expires_at:exp,expires_in:3600,user};
  await context.addInitScript(({key,session})=>{localStorage.setItem(key,JSON.stringify(session));localStorage.setItem('barkolink-theme','light')},{key:`sb-${projectRef}-auth-token`,session});
  await context.route(`${projectUrl}/**`,async route=>{
   if(route.request().url().includes('/auth/v1/'))return route.fulfill({json:user});
   const {operation,args}=route.request().postDataJSON();
   if(operation==='AdminDailySchedules') return route.fulfill({json:{schedules:dailyTemplates,routes:scheduleRoutes}});
   if(operation==='AdminSaveDailySchedule') {
     assert.equal(args.durationMinutes,135);assert.deepEqual(args.departureTimes,['09:00','23:00']);
     const item=dailyTemplates.find(s=>s.id===args.id);Object.assign(item,args);
     return route.fulfill({json:{schedules:dailyTemplates,routes:scheduleRoutes}});
   }
   if(operation==='AdminSetDailyScheduleActive') {
     dailyTemplates.find(s=>s.id===args.id).isActive=args.isActive;
     return route.fulfill({json:{schedules:dailyTemplates,routes:scheduleRoutes}});
   }
   if(operation==='AdminSaveRoute'){
     assert.equal(args.durationMinutes,90);assert.equal(args.code,'BTG-CAL');assert.equal('durationHours' in args,false);
     routes.find(r=>r.code===args.code).durationMinutes=args.durationMinutes;
     return route.fulfill({json:{}});
   }
   if(operation==='AdminSaveSailingStatusPolicy'){
     assert.equal(args.operator,'FastCat');assert.equal(args.boardingLeadMinutes,45);assert.equal(args.boardingTimeSource,'Confirmed terminal instruction (UI fixture)');
     return route.fulfill({json:{policies:[{...args}]}});
   }
   assert.ok(!/Create|Update|Save|Delete|Reserve|Pay|Assign/.test(operation),`Unexpected write ${operation}`);
   const result={
    MyProfile:{user:{uid,fullName:'Catalog Admin',email:user.email,role:'ADMIN'}},
    AdminPorts:{ports},AdminVessels:{vessels},AdminRoutes:{routes},AdminSailings:{sailings:[],totalCount:0},AdminSailingOptions:{sailings:[]},
    StaffBookings:{bookings:[],totalCount:0},AdminUsers:{users:[],totalCount:0},AdminPassengerRecords:{bookingPassengers:[],totalCount:0},
    AdminDashboardStats:{},AdminNextTripCode:{nextTripCode:{code:'TRP2026-1011001'}},
    AdminFareSettings:{fareSettings:null,vesselFareSettings:[{code:'SL-ANNAPOLIS',regularFare:600,studentDiscount:20,seniorDiscount:20,childDiscount:50,pwdDiscount:20,pregnantDiscount:0,customDiscounts:[]}]},
    MyNotifications:{notifications:[]},AdminSailingBookings:{bookings:[]},AdminAdvisories:{advisories:[]},AdminAccommodations:{accommodations:[]},
    AdminVesselPositions:{vessels:vessels.filter(v=>v.isActive).map(v=>({id:v.id,name:v.name,operator:v.operator,position:{state:'UNKNOWN',reason:'Confirm the vessel port before opening bookings.'}})),ports:ports.filter(p=>p.isActive).map(p=>({id:p.id,name:p.name}))},AdminVesselAvailability:{vessels:vessels.filter(v=>v.isActive).map(v=>({id:v.id,issue:'Confirm the vessel port before opening bookings.'}))},AdminOperationsSettings:{reservationMinutes:1440},AdminSailingStatusPolicies:{policies:[...new Set(catalog.vessels.map(v=>v.operator))].map(operator=>({operator,boardingLeadMinutes:null,boardingTimeSource:null,autoComplete:true}))},
   }[operation];
   return route.fulfill({json:result||{}});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  for(const theme of ['light','dark']){
   await page.addInitScript(theme=>localStorage.setItem('barkolink-theme',theme),theme);
   await page.goto('http://127.0.0.1:8110/admin/operations');
   await page.getByRole('heading',{name:'Sailing status configuration',exact:true}).waitFor();
   const config=page.locator('.status-settings');
   await config.getByLabel('Shipping operator',{exact:true}).selectOption('FastCat');
   assert.equal(await config.getByLabel('Automatically start Boarding',{exact:true}).isChecked(),false);
   await config.getByLabel('Automatically start Boarding',{exact:true}).check();
   assert.equal(await config.getByLabel('Boarding lead time (minutes)',{exact:true}).inputValue(),'');
   assert.equal(await config.getByRole('button',{name:'Save status configuration',exact:true}).isDisabled(),true);
   await config.getByLabel('Boarding lead time (minutes)',{exact:true}).fill('0');
   assert.equal(await config.getByRole('button',{name:'Save status configuration',exact:true}).isDisabled(),true);
   await config.getByLabel('Boarding lead time (minutes)',{exact:true}).fill('45');
   assert.equal(await config.getByRole('button',{name:'Save status configuration',exact:true}).isDisabled(),true);
   await config.getByLabel('Boarding time confirmation',{exact:true}).fill('Confirmed terminal instruction (UI fixture)');
   assert.equal(await config.getByRole('button',{name:'Save status configuration',exact:true}).isDisabled(),false);
   await config.getByText('Example: a 2:00 PM departure starts boarding at 1:15 PM.',{exact:true}).waitFor();
   await config.getByRole('button',{name:'Save status configuration',exact:true}).click();
   await config.getByText('Sailing status configuration saved.',{exact:true}).waitFor();
   assert.equal(await config.getByLabel('Boarding lead time (minutes)',{exact:true}).inputValue(),'45');
   await page.screenshot({path:`docs/screenshots/reference-catalog/status-settings-${width}-${theme}.png`,fullPage:true});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   await page.goto('http://127.0.0.1:8110/admin/vessels');
   await page.getByRole('heading',{name:'Vessels',exact:true}).waitFor();
   const search=page.locator('input[type="search"]').last();await search.fill('Annapolis');
   await page.getByRole('button',{name:'View details for vessel MV Starlite Annapolis'}).first().click();
   await page.getByRole('heading',{name:'Vessel routes'}).waitFor();
   await page.getByRole('heading',{name:'MV Starlite Annapolis',exact:true}).waitFor();
   assert.equal(await page.locator('ion-modal a').count(),0);
   assert.equal(await page.locator('ion-modal').getByText('Reference information',{exact:true}).count(),0);
   await page.waitForTimeout(400); // Ionic presentation animation must finish before screenshots.
   await page.screenshot({path:`docs/screenshots/reference-catalog/vessel-${width}-${theme}.png`,fullPage:true});
   await page.locator('ion-modal').getByRole('button',{name:'Close details'}).click();
   await page.waitForTimeout(400);
   await page.goto('http://127.0.0.1:8110/admin/ports');
   await page.getByRole('heading',{name:'Ports',exact:true}).waitFor();
   await page.locator('input[type="search"]').last().fill('Calapan');
   await page.getByRole('button',{name:/View details for port .*Calapan/}).first().click();
   await page.locator('ion-modal').getByRole('button',{name:'Close details'}).click();
   await page.waitForTimeout(400);
   await page.goto('http://127.0.0.1:8110/admin/routes');
   await page.getByRole('heading',{name:'Route directory'}).waitFor();
   const firstStatus = width < 700 ? page.locator('.mobile-record').first().locator('.mobile-field').filter({has: page.getByText('Status',{exact:true})}).locator('div') : page.locator('.ag-row .ag-cell[col-id="cell-4"]').first();
   await firstStatus.getByText('Active',{exact:true}).waitFor();
   if(width < 700) await page.locator('.mobile-records > label select').selectOption('0:desc');
   else await page.locator('.ag-header-cell[col-id="cell-0"]').click();
   await firstStatus.getByText('Active',{exact:true}).waitFor();
   await page.getByRole('button',{name:'Reset table',exact:true}).click();

   await page.locator('#route-search').fill('BTG-CAL');
   await page.getByRole('button',{name:'View details for route BTG-CAL'}).first().click();
   await page.getByRole('heading',{name:'Assigned vessels'}).waitFor();
   assert.ok(await page.locator('ion-modal').getByText('MV Maria Diana',{exact:true}).isVisible());
   await page.locator('ion-modal').getByRole('button',{name:'Close details'}).click();
   await page.waitForTimeout(400);
   await page.getByRole('button',{name:'Edit route BTG-CAL',exact:true}).click();
   await page.getByLabel(/^Estimated duration \(hours:minutes\)/).fill('1:30');
   await page.getByRole('button',{name:'Save route',exact:true}).click();
   await page.getByText('Route saved.',{exact:true}).waitFor();
   await page.getByText('1:30 hours',{exact:true}).waitFor();
   await page.waitForTimeout(400);
   await page.screenshot({path:`docs/screenshots/reference-catalog/routes-${width}-${theme}.png`,fullPage:true});
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false);
   await page.goto('http://127.0.0.1:8110/admin/accommodation');
   await page.getByText('Published accommodation classes',{exact:true}).click();
   const classes=page.locator('.published-references');
   await classes.getByLabel('Operator',{exact:true}).selectOption('FastCat');
   assert.equal(await classes.locator('article').count(),4);
   assert.ok(await classes.locator('article').first().getByText('Economy · Premium Economy · Business Class',{exact:true}).isVisible());
   await page.getByRole('button',{name:'Add accommodation',exact:true}).click();
   assert.ok(await page.locator('#accommodation-class-name option[value="Premium Economy"]').count());
   await page.locator('ion-modal').getByRole('button',{name:'Close dialog',exact:true}).click();
   await page.waitForTimeout(400);
   await page.screenshot({path:`docs/screenshots/reference-catalog/accommodation-${width}-${theme}.png`,fullPage:true});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   await page.goto('http://127.0.0.1:8110/admin/trips');
   await page.locator('button:has-text("Refresh"):not([disabled])').waitFor();
   const references=page.locator('.daily-schedules');
   await references.getByLabel('Operator',{exact:true}).selectOption('FastCat');
   await references.getByLabel('Trip date',{exact:true}).fill('2026-12-01');
   const cards=references.locator('article');
   assert.equal(await cards.count(),4);
   await cards.first().getByRole('button',{name:'Edit schedule FastCat BTG-CAL',exact:true}).click();
   const editor=page.locator('ion-modal.schedule-modal');
   await editor.getByRole('heading',{name:'Edit schedule',exact:true}).waitFor();
   await page.waitForTimeout(400);
   await page.screenshot({path:`docs/screenshots/reference-catalog/schedule-editor-${width}-${theme}.png`,fullPage:true});
   while(await editor.locator('.time-row').count()>2) await editor.getByRole('button',{name:/Remove departure time/}).last().click();
   await editor.getByLabel('Departure time 1',{exact:true}).fill('09:00');
   await editor.getByLabel('Departure time 2',{exact:true}).fill('23:00');
   await editor.getByLabel(/^Estimated duration/).fill('2:15');
   await editor.getByRole('button',{name:'Save schedule',exact:true}).click();
   await references.getByText('Daily schedule saved.',{exact:true}).waitFor();
   await page.waitForTimeout(400);
   await cards.first().getByRole('button',{name:'Pause schedule FastCat BTG-CAL',exact:true}).click();
   await references.getByText('Daily schedule paused.',{exact:true}).waitFor();
   const paused=cards.filter({has:page.getByRole('button',{name:'Resume schedule FastCat BTG-CAL',exact:true})});
   assert.ok(await paused.getByRole('button',{name:'Prepare trip',exact:true}).isDisabled());
   await paused.getByRole('button',{name:'Resume schedule FastCat BTG-CAL',exact:true}).click();
   await references.getByText('Daily schedule resumed.',{exact:true}).waitFor();
   await cards.first().getByLabel('Departure for FastCat BTG-CAL',{exact:true}).selectOption('09:00');
   await cards.first().getByRole('button',{name:'Prepare trip',exact:true}).click();
   let planning=page.locator('ion-modal:not(.schedule-modal)');
   assert.equal(await planning.getByLabel('Departure',{exact:true}).inputValue(),'2026-12-01T09:00');
   assert.equal(await planning.getByLabel('Arrival',{exact:true}).inputValue(),'2026-12-01T11:15');
   const preparedRoute=planning.getByLabel(/^Saved route \(optional\)/);
   assert.match(await preparedRoute.locator('option[value="BTG-CAL"]').textContent(),/2:15 hours/);
   await preparedRoute.selectOption('BTG-CAL');
   assert.equal(await planning.getByLabel('Arrival',{exact:true}).inputValue(),'2026-12-01T11:15');
   await planning.getByText('Travel time: 2:15 hours',{exact:true}).waitFor();
   assert.equal(await planning.getByLabel(/^Vessel/).locator('option[value="SL-ANNAPOLIS"]').count(),0);
   assert.ok(await planning.getByLabel(/^Vessel/).locator('option[value="FC-M5"]').count());
   await planning.getByRole('button',{name:/Close/}).first().click();
   await page.waitForTimeout(400);
   if(await page.locator('ion-alert').isVisible())await page.locator('ion-alert').getByRole('button',{name:'Discard changes',exact:true}).click();
   assert.ok(await cards.nth(2).getByRole('button',{name:'Prepare trip',exact:true,includeHidden:true}).isDisabled());
   await page.screenshot({path:`docs/screenshots/reference-catalog/schedules-${width}-${theme}.png`,fullPage:true});
   await page.getByRole('button',{name:'Create trip',exact:true}).first().click();
   const modal=page.locator('ion-modal');
   await page.waitForTimeout(400);
   await page.screenshot({path:`docs/screenshots/reference-catalog/trip-${width}-${theme}.png`,fullPage:true});
   await modal.getByLabel(/^Origin/).selectOption('BTG');
   await modal.getByLabel(/^Destination/).selectOption('CAL');
   const vesselSelect=modal.getByLabel(/^Vessel/);
   assert.ok(await vesselSelect.locator('option[value="SL-ANNAPOLIS"]').count());
   assert.equal(await vesselSelect.locator('option[value="SL-POLARIS"]').count(),0);
   await vesselSelect.selectOption('SL-ANNAPOLIS');
   const saved=modal.getByLabel(/^Saved route \(optional\)/);
   assert.equal(await saved.locator('option').count(),3); // placeholder plus two verified directions
   await saved.selectOption('BTG-CAL');
   assert.equal(await modal.getByLabel('Arrival',{exact:true}).inputValue(),'');
   console.log(`Reference directories and vessel-route planning passed at ${width}px in ${theme} theme.`);
  }
  await context.close();
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close()}
