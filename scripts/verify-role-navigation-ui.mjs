import assert from 'node:assert/strict';
import { fixtureProject, fixtureBrowserOptions } from './browser-fixture-config.mjs';
import { chromium } from 'playwright-core';
import { boardingTimingFixture } from './boarding-timing-fixture.mjs';

// Synthetic sessions and intercepted backend requests only; no hosted writes or email delivery.
const base = process.env.BARKOLINK_UI_URL || 'http://127.0.0.1:8127';
const project = fixtureProject();
const id = '11111111-1111-4111-8111-111111111111';
const port = { id:'batangas',name:'Batangas Port',city:'Batangas',isActive:true };
const sailing = { code:'ACCESS-TRIP',origin:port,destination:{...port,id:'calapan',name:'Calapan Port'},vessel:{id:'vessel',name:'Test vessel',passengerCapacity:100},status:'SCHEDULED',departureAt:'2099-01-01T08:00:00Z',arrivalAt:'2099-01-01T10:00:00Z',availableSeats:100,regularFare:600 };
const destinations = { ADMIN:'/admin',PASSENGER:'/home',TICKETING:'/staff/ticketing',BOARDING:'/staff/boarding' };
const browser = await chromium.launch(fixtureBrowserOptions());
const errors = [];
let verified = 0;
try {
  for (const role of ['ANONYMOUS',...Object.keys(destinations)]) {
    const context = await browser.newContext({viewport:{width:1240,height:900}});
    const user = {id,email:'access@example.invalid',app_metadata:{role},user_metadata:{fullName:'Access test'},aud:'authenticated',created_at:'2026-01-01T00:00:00Z'};
    if (role !== 'ANONYMOUS') {
      const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
      const exp = Math.floor(Date.now()/1000)+3600;
      const session = {access_token:`${encode({alg:'HS256'})}.${encode({sub:id,exp,aal:'aal2',role:'authenticated',app_metadata:{role}})}.fixture`,refresh_token:'fixture',token_type:'bearer',expires_at:exp,expires_in:3600,user};
      await context.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:`sb-${new URL(project).hostname.split('.')[0]}-auth-token`,session});
    }
    const calls = [];
    await context.route(`${project}/**`,route=>{
      const url = route.request().url();
      if (url.includes('/auth/')) return route.fulfill(role === 'ANONYMOUS' ? {status:401,json:{message:'Not signed in'}} : {json:user});
      if (url.endsWith('/rpc/my_mfa_settings')) return route.fulfill({json:{role,enabled:true,staffRequired:true,policyRequired:['BOARDING','TICKETING'].includes(role),mfaRequired:role!=='PASSENGER'}});
      if (url.includes('/functions/v1/weather')) return route.fulfill({json:{configured:false,ports:[]}});
      const {operation} = route.request().postDataJSON() || {};
      calls.push(operation);
      assert.ok(role === 'ADMIN' || !operation?.startsWith('Admin'), `${role} must not request admin records`);
      const result = {
        MyProfile:{user:{uid:id,fullName:'Access test',email:user.email,role,assignedPortId:port.id,assignedPort:port}},
        MyNotifications:{notifications:[]},MyBookings:{bookings:[]},ActiveAdvisories:{advisories:[]},
        MyLoyalty:{currentTier:'Bronze',rewardValue:100,completedTrips:0,tripsPerReward:5,tripsToNextReward:5,vouchers:[],tiers:[]},
        BrowseActivePorts:{ports:[port,sailing.destination]},BrowseSailings:{sailings:[sailing]},
        PassengerSailingBoard:{date:'2099-01-01',updatedAt:new Date().toISOString(),sailings:[]},
        StaffDashboard:{bookings:0,paid:0,unpaid:0,trips:0},StaffBookings:{bookings:[],totalCount:0},
        BoardingSailings:{sailings:[sailing]},BoardingSailingTiming:boardingTimingFixture(sailing),BoardingManifest:{bookings:[]},BoardingActivity:{boardingEvents:[]},
        AdminOverview:{stats:{},trips:[],monthly:[],bookingStatus:[],categories:[],routes:[]},
      }[operation];
      assert.ok(result,`Unhandled access fixture: ${operation}`);
      return route.fulfill({json:result});
    });
    const page = await context.newPage();
    page.on('pageerror',error=>errors.push(error.stack || error.message));
    for (const route of ['/home','/admin','/staff/ticketing','/staff/boarding']) {
      if (role === 'ADMIN' && route.startsWith('/staff/')) continue; // Admin access to staff pages is intentionally permitted.
      const expected = role === 'ANONYMOUS' ? '/login' : route === destinations[role] ? route : destinations[role];
      await page.goto(base+route);
      await page.waitForURL(url=>url.pathname===expected);
      await page.locator('h1:visible').first().waitFor();
      verified++;
    }
    if (role === 'ANONYMOUS') {
      for (const [route,heading] of [['/login','Welcome to BarkoLink'],['/register','Create your account'],['/reset-password','Set a new password']]) {
        await page.goto(base+route);
        await page.getByRole('heading',{name:heading,exact:true}).waitFor();
        verified++;
      }
      await page.locator('input[autocomplete="new-password"]').first().waitFor();
    }
    assert.ok(!calls.some(operation=>/^(Reserve|Collect|BoardTicket|CheckInTicket|AdminSave)/.test(operation||'')));
    await context.close();
    console.log(`${role}: own workspace and unauthorized-route redirects passed`);
  }
  assert.deepEqual(errors,[]);
  console.log(`${verified} route/auth checks passed with no browser runtime errors.`);
} finally {await browser.close();}
