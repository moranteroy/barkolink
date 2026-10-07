import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const project=fs.readFileSync('.env.local','utf8').match(/^VITE_SUPABASE_URL\s*=\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
const id='11111111-1111-4111-8111-111111111111';
const sailing={code:'UI-TRIP',departureAt:'2099-10-08T04:16:00Z',arrivalAt:'2099-10-08T06:16:00Z',status:'SCHEDULED',regularFare:600,availableSeats:20,origin:{name:'Batangas Port'},destination:{name:'Calapan Port'},vessel:{name:'MV Isla Verde',passengerCapacity:120},accommodations:[]};
const selected={id:sailing.code,from:'Batangas Port',to:'Calapan Port',vessel:sailing.vessel.name,date:'Oct 8, 2099',departure:'12:16 PM',arrival:'2:16 PM',duration:'2 hours',available:20,regularFare:600,passengerCount:1};
const reading={at:new Date().toISOString(),condition:'Light rain',temperatureC:29,windKph:18,visibilityKm:9,rainChance:75};
const browser=await chromium.launch({channel:'msedge',headless:true});fs.mkdirSync('.audit/weather-ui',{recursive:true});
try{
  const cases=[{role:'PASSENGER',state:'forecast',width:390,theme:'dark'},{role:'PASSENGER',state:'future',width:390,theme:'light'},{role:'PASSENGER',state:'unavailable',width:390,theme:'dark'},{role:'PASSENGER',state:'forecast',width:1440,theme:'light'},{role:'TICKETING',state:'forecast',width:1440,theme:'dark'},{role:'ADMIN',state:'forecast',width:1440,theme:'light'}];
  for(const test of cases){
    const user={id,email:'ui@example.invalid',app_metadata:{role:test.role},user_metadata:{fullName:'UI User'},aud:'authenticated',created_at:'2026-01-01T00:00:00Z'};
    const exp=Math.floor(Date.now()/1000)+3600,encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
    const session={access_token:`${encode({alg:'HS256'})}.${encode({sub:id,exp,role:'authenticated',app_metadata:user.app_metadata})}.fixture`,refresh_token:'fixture',token_type:'bearer',expires_at:exp,expires_in:3600,user};
    const context=await browser.newContext({viewport:{width:test.width,height:1000}});
    await context.addInitScript(({project,session,selected,theme})=>{localStorage.setItem(`sb-${new URL(project).hostname.split('.')[0]}-auth-token`,JSON.stringify(session));localStorage.setItem('barkolink-selected-trip',JSON.stringify(selected));localStorage.setItem('barkolink-theme',theme)},{project,session,selected,theme:test.theme});
    await context.route(`${project}/**`,route=>{
      if(route.request().url().includes('/auth/'))return route.fulfill({json:user});
      if(route.request().url().includes('/functions/v1/weather'))return route.fulfill({json:{configured:test.state!=='unavailable',departureAt:sailing.departureAt,ports:test.state==='unavailable'?[]:['Batangas Port','Calapan Port'].map((name,index)=>({id:String(index),name,role:index?'Arrival port':'Departure port',available:true,current:reading,forecast:test.state==='future'?null:reading}))}});
      const {operation}=route.request().postDataJSON();
      const generic={sailings:[],bookings:[],users:[],ports:[],vessels:[],routes:[],accommodations:[],bookingPassengers:[],fareSettings:null,vesselFareSettings:[],notifications:[],advisories:[],totalCount:0,nextTripCode:null,user:{fullName:'UI User',role:test.role},travelers:[]};
      return route.fulfill({json:['StaffSailings','AdminSailings'].includes(operation)?{sailings:[sailing],totalCount:1}:generic});
    });
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`http://localhost:8100${test.role==='PASSENGER'?'/trip-details':test.role==='ADMIN'?'/admin/trips':'/staff/ticketing/trips'}`,{waitUntil:'networkidle'});
    if(test.role!=='PASSENGER')await page.locator('.weather-trip-picker select').selectOption(sailing.code);
    if(test.state==='unavailable')await page.locator('.trip-weather').getByText(/Weather updates are currently unavailable/).waitFor();
    else{
      await page.locator('.weather-port').first().waitFor();
      assert.equal(await page.locator('.weather-port').count(),2);
      assert.match(await page.locator('.trip-weather').textContent(),test.state==='future'?/Current weather/:/Forecast at departure/);
      if(test.state==='future')assert.match(await page.locator('.trip-weather').textContent(),/Departure forecast is not available yet/);
    }
    assert.deepEqual(errors,[]);
    assert.equal(await page.locator('.trip-weather').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
    await page.locator('.trip-weather').scrollIntoViewIfNeeded();
    await page.screenshot({path:`.audit/weather-ui/${test.role.toLowerCase()}-${test.state}-${test.width}-${test.theme}.png`,fullPage:true});
    console.log(`${test.role} ${test.state} ${test.width}px: weather panel and fallback display passed.`);
    await context.close();
  }
}finally{await browser.close();}
