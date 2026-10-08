import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const project=fs.readFileSync('.env.local','utf8').match(/^VITE_SUPABASE_URL\s*=\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
const id='11111111-1111-4111-8111-111111111111';
const user={id,email:'ui@example.invalid',app_metadata:{role:'PASSENGER'},user_metadata:{fullName:'Carlo'},aud:'authenticated',created_at:'2026-01-01T00:00:00Z'};
const exp=Math.floor(Date.now()/1000)+3600,encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const session={access_token:`${encode({alg:'HS256'})}.${encode({sub:id,exp,role:'authenticated',app_metadata:user.app_metadata})}.fixture`,refresh_token:'fixture',token_type:'bearer',expires_at:exp,expires_in:3600,user};
const selected={id:'UI-TRIP',selectionId:'loyalty-test',from:'Batangas',to:'Calapan',vessel:'MV Isla Verde',date:'Oct 8, 2099',departure:'12:00 PM',arrival:'2:00 PM',duration:'2 hours',available:20,regularFare:600,passengerCount:1};
const quote={code:'LOYAL-TEST',discount:100,subtotal:600,total:500};
const browser=await chromium.launch({channel:'msedge',headless:true});fs.mkdirSync('.audit/loyalty',{recursive:true});
try{
  for(const width of [390,1440]){
    const context=await browser.newContext({viewport:{width,height:1000}});
    await context.addInitScript(({project,session,selected})=>{localStorage.setItem(`sb-${new URL(project).hostname.split('.')[0]}-auth-token`,JSON.stringify(session));localStorage.setItem('barkolink-selected-trip',JSON.stringify(selected));localStorage.setItem('barkolink-theme','dark');},{project,session,selected});
    await context.route(`${project}/**`,route=>{
      if(route.request().url().includes('/auth/'))return route.fulfill({json:user});
      if(route.request().url().includes('/functions/v1/weather'))return route.fulfill({json:{configured:false,ports:[]}});
      const {operation}=route.request().postDataJSON();
      const fixtures={MyProfile:{user:{fullName:'Carlo',role:'PASSENGER'}},MyTravelers:{travelers:[]},MyBookings:{bookings:[]},MyNotifications:{notifications:[]},BrowseActivePorts:{ports:[]},PassengerSailingBoard:{sailings:[]},MyLoyalty:{completedTrips:10,tripsPerReward:5,rewardValue:300,tripsToNextReward:5,currentTier:'Gold',tiers:[{name:'Silver',trips:5,value:100},{name:'Gold',trips:10,value:200},{name:'Platinum',trips:15,value:300}],vouchers:[{code:quote.code,value:100,expiresAt:'2027-01-01T00:00:00Z'},{code:'LOYAL-GOLD',value:200,expiresAt:'2027-01-02T00:00:00Z'}]},QuoteLoyaltyVoucher:{quote},QuoteVoucher:{...quote,code:'MANUAL'}};
      return route.fulfill({json:fixtures[operation]||{advisories:[],travelers:[],notifications:[]}});
    });
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:8115/home',{waitUntil:'networkidle'});
    const card=page.locator('.loyalty-card');await card.getByText('₱100 off your next eligible booking').waitFor();
    assert.equal(await card.locator('.reward-ready').count(),2);assert.equal(await card.locator('.reward-tiers > div').count(),3);assert.equal(await card.locator('.reward-tiers .reached').count(),2);
    assert.equal(await card.evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
    await card.scrollIntoViewIfNeeded();await card.screenshot({path:`.audit/loyalty/home-${width}.png`});
    await page.goto('http://127.0.0.1:8115/booking-summary',{waitUntil:'networkidle'});
    const voucher=page.locator('.voucher-entry');await voucher.getByText(/Loyalty voucher automatically applied/).waitFor();
    assert.match(await page.locator('.review-fares .total').textContent(),/500/);
    await voucher.scrollIntoViewIfNeeded();await page.locator('.review-fares').screenshot({path:`.audit/loyalty/review-${width}.png`});
    await voucher.getByRole('button',{name:'Remove',exact:true}).click();
    assert.match(await page.locator('.review-fares .total').textContent(),/600/);
    await voucher.locator('input').fill('MANUAL');await voucher.getByRole('button',{name:'Apply',exact:true}).click();
    await voucher.getByText(/MANUAL applied/).waitFor();assert.deepEqual(errors,[]);
    await context.close();console.log(`${width}px: loyalty wallet, automatic discount, removal and manual voucher passed.`);
  }
}finally{await browser.close();}
