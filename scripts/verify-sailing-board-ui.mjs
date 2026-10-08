import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const project = fs.readFileSync('.env.local','utf8').match(/^VITE_SUPABASE_URL\s*=\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
const id = '11111111-1111-4111-8111-111111111111';
const user = { id, email:'ui@example.invalid', app_metadata:{role:'PASSENGER'}, user_metadata:{fullName:'Carlo'}, aud:'authenticated', created_at:'2026-01-01T00:00:00Z' };
const exp = Math.floor(Date.now()/1000)+3600, encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const session = { access_token:`${encode({alg:'HS256'})}.${encode({sub:id,exp,role:'authenticated',app_metadata:user.app_metadata})}.fixture`, refresh_token:'fixture', token_type:'bearer', expires_at:exp, expires_in:3600, user };
const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const ports = [{id, name:'Batangas Port',city:'Batangas'}, {id:'22222222-2222-4222-8222-222222222222',name:'Calapan Port',city:'Calapan'}];
const trip = {code:'OUTBOUND',departureAt:`${today}T10:00:00+08:00`,arrivalAt:`${today}T12:00:00+08:00`,status:'BOARDING',origin:ports[0],destination:ports[1],vessel:{name:'MV Isla Verde'}};
const browser = await chromium.launch({channel:'msedge',headless:true});
fs.mkdirSync('.audit/sailing-board',{recursive:true});
try {
  for (const width of [320,390,1440]) for (const theme of ['dark','light']) {
    const context = await browser.newContext({viewport:{width,height:1000}});
    await context.addInitScript(({project,session,theme}) => {localStorage.setItem(`sb-${new URL(project).hostname.split('.')[0]}-auth-token`,JSON.stringify(session));localStorage.setItem('barkolink-theme',theme);}, {project,session,theme});
    await context.route(`${project}/**`,route => {
      if(route.request().url().includes('/auth/')) return route.fulfill({json:user});
      if(route.request().url().includes('/functions/v1/weather')) return route.fulfill({json:{configured:false,ports:[]}});
      const {operation} = route.request().postDataJSON();
      const fixtures = { MyProfile:{user:{fullName:'Carlo',role:'PASSENGER'}}, MyBookings:{bookings:[]}, MyNotifications:{notifications:[]}, BrowseActivePorts:{ports}, PassengerSailingBoard:{date:today,updatedAt:new Date().toISOString(),sailings:[trip,{...trip,code:'INBOUND',origin:ports[1],destination:ports[0],status:'DELAYED'}]},ActiveTravelAdvisories:{advisories:[]} };
      return route.fulfill({json:fixtures[operation] || {advisories:[],notifications:[]}});
    });
    const page = await context.newPage(), errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:8115/home',{waitUntil:'networkidle'});
    const board=page.locator('.sailing-board');
    await board.getByText('OUTBOUND',{exact:false}).waitFor({timeout:10000}).catch(async error => { console.log(JSON.stringify({url:page.url(),board:await board.textContent().catch(()=>null),errors})); await page.screenshot({path:'.audit/sailing-board/debug.png'}); throw error; });
    assert.match(await board.textContent(),/Boarding/);
    await board.getByRole('button',{name:/Arrivals/}).click();
    assert.match(await board.textContent(),/INBOUND/);
    assert.match(await board.textContent(),/Delayed/);
    await board.locator('select').selectOption(ports[1].id);
    assert.match(await board.textContent(),/OUTBOUND/);
    assert.equal(await board.evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
    assert.deepEqual(errors,[]);
    await board.scrollIntoViewIfNeeded();
    await board.screenshot({path:`.audit/sailing-board/${width}-${theme}.png`});
    await context.close();
    console.log(`${width}px ${theme}: departures, arrivals, port switching and layout passed.`);
  }
} finally { await browser.close(); }
