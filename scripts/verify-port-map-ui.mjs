import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const project=fs.readFileSync('.env.local','utf8').match(/^VITE_SUPABASE_URL\s*=\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
const id='11111111-1111-4111-8111-111111111111';
const user={id,email:'map@example.invalid',app_metadata:{role:'PASSENGER'},user_metadata:{fullName:'Map Passenger'},aud:'authenticated',created_at:'2026-01-01T00:00:00Z'};
const exp=Math.floor(Date.now()/1000)+3600,encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const session={access_token:`${encode({alg:'HS256'})}.${encode({sub:id,exp,role:'authenticated',app_metadata:user.app_metadata})}.fixture`,refresh_token:'fixture',token_type:'bearer',expires_at:exp,expires_in:3600,user};
const trip={id:'MAP-TRIP',selectionId:'map-fixture',from:'Batangas',to:'Calapan',originPortName:'Batangas Port',destinationPortName:'Calapan Port',vessel:'MV Map',available:100,regularFare:600,departure:'12:00 PM',arrival:'2:00 PM',date:'Oct 8, 2099',departureAt:'2099-10-08T04:00:00Z',accommodations:[]};
fs.mkdirSync('.audit/port-map',{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
  for(const width of [390,1440]) {
    const context=await browser.newContext({viewport:{width,height:1000}});
    await context.addInitScript(({project,session,trip})=>{
      localStorage.setItem(`sb-${new URL(project).hostname.split('.')[0]}-auth-token`,JSON.stringify(session));
      localStorage.setItem('barkolink-selected-trip',JSON.stringify(trip));
      localStorage.setItem('barkolink-theme','dark');
    },{project,session,trip});
    await context.route(`${project}/**`,route=>{
      if(route.request().url().includes('/auth/'))return route.fulfill({json:user});
      const {operation}=route.request().postDataJSON();
      return route.fulfill({json:operation==='MyProfile'?{user:{fullName:'Map Passenger',role:'PASSENGER'}}:{notifications:[],bookings:[],vouchers:[],advisories:[],sailings:[],configured:false}});
    });
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:8115/trip-details',{waitUntil:'networkidle'});
    const map=page.locator('.port-map');await map.scrollIntoViewIfNeeded();
    await map.locator('.port-pin').nth(1).waitFor();assert.equal(await map.locator('.port-pin').count(),2);
    await map.locator('.port-tabs button').nth(1).click();
    await map.locator('.leaflet-popup').getByText('Arrival · Calapan Port').waitFor();
    assert.match(await map.locator('.map-footer a').getAttribute('href'),/Calapan/);
    await map.getByRole('button',{name:'View both ports'}).click();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
    assert.match(await map.locator('.leaflet-control-attribution').textContent(),/OpenStreetMap/);
    await map.screenshot({path:`.audit/port-map/map-${width}.png`});
    if(width===390){
      await context.route('https://tile.openstreetmap.org/**',route=>route.abort());
      await page.reload({waitUntil:'networkidle'});
      await map.getByText('Map tiles could not load.',{exact:false}).waitFor();
      assert.equal(await map.locator('.port-pin').count(),2);
      await map.locator('.port-tabs button').nth(1).click();
      assert.match(await map.locator('.map-footer a').getAttribute('href'),/Calapan/);
      await context.unroute('https://tile.openstreetmap.org/**');
      await map.getByRole('button',{name:'Retry map'}).click();
      await map.getByText('Map tiles could not load.',{exact:false}).waitFor({state:'hidden'});
    }
    assert.deepEqual(errors,[]);await context.close();console.log(`Leaflet ${width}px: markers, popup, directions, attribution and layout passed.`);
  }
} finally { await browser.close(); }
