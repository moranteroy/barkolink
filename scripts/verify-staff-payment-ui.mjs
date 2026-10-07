import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const project = fs.readFileSync('.env.local','utf8').match(/^VITE_SUPABASE_URL\s*=\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
const id = '11111111-1111-4111-8111-111111111111';
const sailing = {code:'UI-TRIP',departureAt:'2099-10-08T04:16:00Z',arrivalAt:'2099-10-08T06:16:00Z',regularFare:600,status:'SCHEDULED',origin:{name:'Batangas Port'},destination:{name:'Calapan Port'},vessel:{name:'MV Isla Verde'}};
const bookings = ['gcash','paymaya','card','cash'].map((method,index)=>({id:`11111111-1111-4111-8111-11111111111${index}`,reference:`UI-PAYMENT-${index}`,owner:{fullName:'UI Passenger',email:'ui@example.invalid'},sailing,passengerCount:1,total:600,status:'CONFIRMED',paymentStatus:'PAID',paymentMethod:method==='cash'?'CASH':'PAYMONGO_TEST',paymentProviderMethod:method==='cash'?null:method,paidAt:'2026-10-07T11:00:00Z',createdAt:'2026-10-07T11:00:00Z',bookingChannel:'ONLINE',bookingPassengers_on_booking:[{id,fullName:'UI Passenger',passengerType:'REGULAR',fare:600,ticketStatus:'ISSUED',ticketCode:id}]}));
const browser = await chromium.launch({channel:'msedge',headless:true});
bookings[0].paymentVerificationRequired=true;
bookings[0].paymentTransactionId='pay_ui_gcash';
bookings[0].bookingPassengers_on_booking[0].ticketStatus='PENDING';
fs.mkdirSync('.audit/staff-payment-ui',{recursive:true});
try {
  for(const role of ['ADMIN','TICKETING','TICKETING_DASHBOARD']) {
    const dashboard=role==='TICKETING_DASHBOARD';
    const accountRole=dashboard?'TICKETING':role;
    const user = {id,email:'ui@example.invalid',app_metadata:{role:accountRole},user_metadata:{fullName:'UI Staff'},aud:'authenticated',created_at:'2026-01-01T00:00:00Z'};
    const exp=Math.floor(Date.now()/1000)+3600,encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
    const session={access_token:`${encode({alg:'HS256'})}.${encode({sub:id,exp,role:'authenticated',app_metadata:user.app_metadata})}.fixture`,refresh_token:'ui-fixture',token_type:'bearer',expires_at:exp,expires_in:3600,user};
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    await context.addInitScript(({key,session})=>{localStorage.setItem(key,JSON.stringify(session));localStorage.setItem('barkolink-theme','dark')},{key:`sb-${new URL(project).hostname.split('.')[0]}-auth-token`,session});
    await context.route(`${project}/**`,route=>{
      if(route.request().url().includes('/auth/'))return route.fulfill({json:user});
      const {operation,args}=route.request().postDataJSON();
      if(dashboard && operation==='StaffBookings')assert.equal(args.status,'ACTION_REQUIRED');
      if(operation==='StaffDashboard')return route.fulfill({json:{bookings:4,paid:4,unpaid:0,awaitingVerification:1,trips:1}});
      const empty={sailings:[],users:[],ports:[],vessels:[],fares:[],fareSettings:null,vesselFareSettings:[],bookingPassengers:[],notifications:[],advisories:[],routes:[],accommodations:[],totalCount:0,user:{fullName:'UI Staff',role}};
      return route.fulfill({json:operation==='StaffBookings'?{bookings:dashboard?[bookings[0]]:bookings,totalCount:dashboard?1:4}:empty});
    });
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`http://localhost:8100${role==='ADMIN'?'/admin/bookings':dashboard?'/staff/ticketing':'/staff/ticketing/bookings'}`,{waitUntil:'networkidle'});
    if(role==='ADMIN'){
      await page.getByText('Payment method',{exact:true}).waitFor();
      for(const label of ['GCash','Maya','Credit / debit card','Cash'])await page.getByText(label,{exact:true}).waitFor();
    }else{
      await page.locator('.queue-payment').first().waitFor();
      for(const label of dashboard?['GCash']:['GCash','Maya','Credit / debit card','Cash'])assert.match(await page.locator('.queue-list').textContent(),new RegExp(label));
      await page.locator('.queue-update').first().click();
      await page.locator('.booking-payment-details').waitFor();
      assert.match(await page.locator('.booking-payment-details').textContent(),/GCash/);
      await page.getByRole('button',{name:'Verify online payment and issue tickets',exact:true}).waitFor();
      assert.equal(await page.locator('.ticket-record code').count(),0);
      assert.match(await page.locator('.transaction-reference').textContent(),/pay_ui_gcash/);
    }
    assert.deepEqual(errors,[]);
    await page.screenshot({path:`.audit/staff-payment-ui/${role.toLowerCase()}.png`,fullPage:true});
    console.log(`${role}: actual recorded payment methods rendered correctly.`);
    await context.close();
  }
}finally{await browser.close();}
