import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
import {fixtureProject,fixtureBrowserOptions} from './browser-fixture-config.mjs';

// Fixture-only layout checks. Never sign into real accounts or call providers.
const base=process.env.BARKOLINK_UI_URL||'http://127.0.0.1:8127',project=fixtureProject();
const id='11111111-1111-4111-8111-111111111111';
const ports=[{id:'origin',name:'Batangas Port',city:'Batangas City',isActive:true},{id:'destination',name:'Calapan Port',city:'Calapan City',isActive:true}];
const date=new Date(Date.now()+86400000),isoDay=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(value);
const sailing={code:'MOBILE-TRIP',departureAt:date.toISOString(),arrivalAt:new Date(+date+7200000).toISOString(),status:'SCHEDULED',origin:ports[0],destination:ports[1],vessel:{id:'vessel',name:'MV Starlite Pacific',passengerCapacity:200},availableSeats:198,regularFare:600,studentFare:480,seniorFare:480,childFare:300,pwdFare:480,durationMinutes:120,accommodations:[]};
const passenger={id,fullName:'Mobile Traveler',passengerType:'REGULAR',fare:600,ticketCode:'MOBILE-TICKET',ticketStatus:'ISSUED',birthDate:'1990-01-01',sex:'FEMALE',phone:'09123456789',nationality:'Filipino'};
const booking={id,reference:'BKG-MOBILE-TEST',status:'CONFIRMED',paymentStatus:'PAID',paymentMethod:'PAYMONGO_TEST',paymentProviderMethod:'gcash',paymentVerificationRequired:true,createdAt:new Date().toISOString(),passengerCount:1,total:600,sailing,bookingPassengers_on_booking:[passenger]};
const user={id,email:'mobile@example.invalid',app_metadata:{role:'PASSENGER'},user_metadata:{fullName:'Mobile Traveler'},aud:'authenticated',created_at:'2026-01-01T00:00:00Z'};
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url'),exp=Math.floor(Date.now()/1000)+3600;
const session={access_token:`${encode({alg:'HS256'})}.${encode({sub:id,exp,aal:'aal2',role:'authenticated',app_metadata:user.app_metadata})}.fixture`,refresh_token:'fixture',token_type:'bearer',expires_at:exp,expires_in:3600,user};
const browser=await chromium.launch(fixtureBrowserOptions());
const output='.audit/mobile-density';fs.mkdirSync(output,{recursive:true});const results=[];
try {
 for(const width of (process.env.BARKOLINK_UI_WIDTHS?.split(',').map(Number)||[320,360,390,430,768,1440]))for(const theme of ['light','dark']) {
  const context=await browser.newContext({viewport:{width,height:820},deviceScaleFactor:width<=430?2:1,reducedMotion:'reduce',timezoneId:'America/Los_Angeles'});
  await context.addInitScript(({key,session,theme})=>{localStorage.setItem(key,JSON.stringify(session));localStorage.setItem('barkolink-theme',theme);},{key:`sb-${new URL(project).hostname.split('.')[0]}-auth-token`,session,theme});
  const errors=[];const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await context.route(`${project}/**`,route=>{
   const url=route.request().url();
   if(url.includes('/auth/'))return route.fulfill({json:user});
   if(url.includes('/functions/v1/weather'))return route.fulfill({json:{configured:true,ports:ports.map(port=>({...port,available:true,current:{at:new Date().toISOString(),condition:'Mainly clear',conditionCode:0,temperatureC:27,windKph:8,rainChance:5,cloudCover:37,visibilityKm:39},days:Array.from({length:7},(_,i)=>({date:isoDay(new Date(Date.now()+i*86400000)),condition:'Partly cloudy',conditionCode:2,highC:32,lowC:25,rainChance:35,windKph:18}))}))}});
   const {operation}=route.request().postDataJSON()||{};
   const data={
    MyProfile:{user:{uid:id,fullName:'Mobile Traveler',email:user.email,role:'PASSENGER'}},
    MyBookings:{bookings:[booking]},MyNotifications:{notifications:[],unreadCount:0,totalCount:0},
    BrowseActivePorts:{ports},BrowseSailings:{sailings:[sailing]},ActiveAdvisories:{advisories:[]},ActiveTravelAdvisories:{advisories:[]},
    PassengerSailingBoard:{date:isoDay(date),updatedAt:new Date().toISOString(),sailings:[sailing]},
    MyLoyalty:{completedTrips:10,rewardValue:300,tripsToNextReward:5,tripsPerReward:5,currentTier:'Gold',tiers:[{name:'Silver',trips:5,value:100},{name:'Gold',trips:10,value:200},{name:'Platinum',trips:15,value:300}],vouchers:[{code:'VCH-MOBILE-FIXTURE',value:200,expiresAt:'2099-01-01T00:00:00Z'}]},
    MySavedTravelers:{travelers:[passenger]},PassengerVouchers:{vouchers:[]},
   }[operation];
   assert.ok(data,`Missing mobile fixture: ${operation}`);return route.fulfill({json:data});
  });
  for(const path of ['/home','/bookings','/profile','/travelers','/help','/trips?all=1']) {
   await page.goto(base+path);await page.locator('h1:visible').first().waitFor();
   await page.waitForTimeout(350);
   const main=page.locator('main:visible').first();
   assert.ok(await main.evaluate(el=>el.scrollWidth<=el.clientWidth+2),`${width} ${path}: horizontal overflow`);
   assert.equal(await page.locator('[role=alert]:visible').count(),0,`${width} ${path}: error state`);
   if(path==='/home') {
    await page.locator('.smart-weather').waitFor();
    const search=page.locator('.home-search');const size=await search.boundingBox();
    if(width>=360&&width<=430)assert.ok(size.height<460,`Search form too tall: ${size.height}`);
    if(width<=430) {
     assert.ok((await page.locator('.bottom-nav').boundingBox()).height<=68);
     const weather=page.locator('.smart-weather'),weatherHeight=(await weather.boundingBox()).height;
     // At 320px, labels wrap more with Linux/Android font metrics. Allow that
     // natural growth while still catching a return to oversized card spacing.
     const weatherLimit=width<360?380:340;
     if(weatherHeight>=weatherLimit)await weather.screenshot({path:`${output}/weather-height-failure-${width}-${theme}.png`});
     assert.ok(weatherHeight<weatherLimit,`Weather card too tall at ${width}px: ${weatherHeight} (limit ${weatherLimit})`);
     const add=page.getByRole('button',{name:'Add passenger',exact:true});
     assert.ok((await add.boundingBox()).height>=44,'Passenger counter retains touch target');
     const counter=await page.locator('.counter').boundingBox(),plus=await add.boundingBox();
     assert.ok(plus.x+plus.width<=counter.x+counter.width+1,'Counter controls fit inside their field');
    }
    // The desktop geometry is identical when the mobile foundation is disabled.
    if(width===1440) {
     const before=await search.boundingBox();
     const original=await page.evaluate(()=>{const style=[...document.querySelectorAll('style[data-vite-dev-id]')].find(el=>el.dataset.viteDevId.endsWith('/theme/mobile.css'));if(!style)return null;const text=style.textContent;style.textContent='';return text;});
     const after=await search.boundingBox();assert.deepEqual(after,before,'Desktop search geometry changed');
     if(original!==null)await page.evaluate(text=>{[...document.querySelectorAll('style[data-vite-dev-id]')].find(el=>el.dataset.viteDevId.endsWith('/theme/mobile.css')).textContent=text;},original);
    }
    await page.screenshot({path:`${output}/home-${width}-${theme}.png`});
    await page.locator('.bottom-nav').evaluate(el=>{el.style.visibility='hidden';});
    for(const [name,selector] of [['search','.home-search'],['weather','.port-forecast'],['loyalty','.loyalty-card']])await page.locator(selector).screenshot({path:`${output}/${name}-${width}-${theme}.png`});
    await page.locator('.bottom-nav').evaluate(el=>{el.style.visibility='';});
    if(width===390) {
     await page.evaluate(()=>{document.documentElement.classList.add('native-android');document.documentElement.style.setProperty('--safe-area-inset-top','28px');document.documentElement.style.setProperty('--safe-area-inset-bottom','20px');});
     assert.equal(Math.round((await page.locator('ion-app').boundingBox()).y),28,'Cutout inset is reserved once');
     await page.evaluate(()=>document.documentElement.classList.add('keyboard-visible'));
     assert.equal(await page.locator('.bottom-nav').isVisible(),false,'Navigation clears Android keyboard');
     await page.evaluate(()=>{document.documentElement.classList.remove('native-android','keyboard-visible');document.documentElement.style.removeProperty('--safe-area-inset-top');document.documentElement.style.removeProperty('--safe-area-inset-bottom');});
    }
   }
   if(path==='/bookings'){
    await page.locator('.bottom-nav').evaluate(el=>{el.style.visibility='hidden';});
    await page.locator('.booking-card').first().screenshot({path:`${output}/booking-${width}-${theme}.png`});
    await page.locator('.bottom-nav').evaluate(el=>{el.style.visibility='';});
   }
   results.push({width,theme,path});
  }
  assert.deepEqual(errors,[]);await context.close();console.log(`PASS mobile density ${width}px ${theme}`);
 }
 fs.writeFileSync(`${output}/results.json`,JSON.stringify(results,null,2));console.log(`${results.length} passenger page/viewport/theme checks passed.`);
}finally{await browser.close();}
