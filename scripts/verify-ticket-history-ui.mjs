import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
import {fixtureProject,fixtureBrowserOptions} from './browser-fixture-config.mjs';

// Fixture-only: no real accounts, payments, bookings or gate events.
const base=process.env.BARKOLINK_UI_URL||'http://127.0.0.1:8127',project=fixtureProject();
const id='11111111-1111-4111-8111-111111111111';
const user={id,email:'history@example.invalid',app_metadata:{role:'PASSENGER'},user_metadata:{fullName:'History Traveler'},aud:'authenticated',created_at:'2026-01-01T00:00:00Z'};
const exp=Math.floor(Date.now()/1000)+3600,encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const session={access_token:`${encode({alg:'HS256'})}.${encode({sub:id,exp,role:'authenticated',app_metadata:user.app_metadata})}.fixture`,refresh_token:'fixture',token_type:'bearer',expires_at:exp,expires_in:3600,user};
function record(reference,states,{past=false,unverified=false,completed=false}={}) {
 const departureAt=new Date(Date.now()+(past?-86400000:86400000)).toISOString();
 const arrivalAt=new Date(Date.parse(departureAt)+7200000).toISOString();
 return {id:reference,reference,status:'CONFIRMED',paymentStatus:'PAID',paymentMethod:unverified?'PAYMONGO_TEST':'CASH',paymentVerificationRequired:unverified,total:600*states.length,passengerCount:states.length,createdAt:new Date().toISOString(),
  sailing:{code:'HISTORY-'+reference,status:completed?'COMPLETED':'BOARDING',departureAt,arrivalAt,origin:{name:'Batangas Port'},destination:{name:'Calapan Port'},vessel:{name:'History Ferry'}},
  bookingPassengers_on_booking:states.map((ticketStatus,index)=>({id:reference+index,fullName:`History Traveler ${index+1}`,passengerType:'REGULAR',fare:600,ticketStatus,ticketCode:`TICKET-${reference}-${index}`,ticketQrPayload:unverified?null:JSON.stringify({BarkoLink:'Ticket v2',Ticket:`TICKET-${reference}-${index}`})}))};
}
const bookings=[record('PAST-UNVERIFIED',['PENDING'],{past:true,unverified:true}),record('PAST-PAID',['ISSUED'],{past:true,completed:true}),record('USED',['BOARDED']),record('CHECKED-IN',['CHECKED_IN']),record('READY',['ISSUED']),record('GROUP',['BOARDED','CHECKED_IN','ISSUED'])];
const output='.audit/ticket-history';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch(fixtureBrowserOptions());let checks=0;
try {
 for(const width of [320,390,1440])for(const theme of ['light','dark']) {
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',timezoneId:'America/Los_Angeles'});
  await context.addInitScript(({key,session,theme})=>{localStorage.setItem(key,JSON.stringify(session));localStorage.setItem('barkolink-theme',theme);},{key:`sb-${new URL(project).hostname.split('.')[0]}-auth-token`,session,theme});
  await context.route(`${project}/**`,route=>{
   if(route.request().url().includes('/auth/'))return route.fulfill({json:user});
   const {operation}=route.request().postDataJSON()||{};
   const response={MyBookings:{bookings},MyProfile:{user:{uid:id,fullName:'History Traveler',role:'PASSENGER'}},MyNotifications:{notifications:[],unreadCount:0}}[operation];
   assert.ok(response,`Missing ticket-history fixture: ${operation}`);return route.fulfill({json:response});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/bookings?tab=Past%20departures');
  const pending=page.locator('.booking-card').filter({hasText:'PAST-UNVERIFIED'});await pending.waitFor();
  assert.match(await pending.locator('.booking-status').innerText(),/Travel period ended/);
  assert.match(await pending.locator('.payment-hint').innerText(),/verification was not completed/);
  assert.equal(await pending.getByText('Awaiting staff verification',{exact:true}).count(),0);
  assert.equal(await pending.locator('.booking-ticket-link').count(),0,'Unverified payment must not acquire an e-ticket');
  const paid=page.locator('.booking-card').filter({hasText:'PAST-PAID'});
  assert.match(await paid.locator('.booking-status').innerText(),/Trip completed/);
  assert.equal(await paid.locator('.booking-ticket-link').count(),1,'Historical issued tickets remain viewable');
  await pending.screenshot({path:`${output}/past-booking-${width}-${theme}.png`});
  await page.goto(base+'/booking-details?reference=PAST-UNVERIFIED');
  await page.locator('.booking-detail-card .payment-hint').waitFor();
  assert.match(await page.locator('.detail-status').innerText(),/Travel period ended/);
  assert.match(await page.locator('.booking-detail-card .payment-hint').innerText(),/verification was not completed/);
  await page.goto(base+'/ticket?reference=PAST-UNVERIFIED');
  await page.getByRole('heading',{name:'Travel period ended',exact:true}).waitFor();
  assert.equal(await page.locator('.qr-block').count(),0);
  assert.equal(await page.getByText('Pay PHP',{exact:false}).count(),0);
  for(const [reference,label,qrCount] of [['PAST-PAID','Trip completed',0],['USED','Boarded',0],['CHECKED-IN','Checked in',1],['READY','Paid',1],['GROUP','Partially boarded',2]]) {
   await page.goto(base+'/ticket?reference='+reference);
   await page.locator('.ticket-record-banner').waitFor();
   assert.ok((await page.locator('.ticket-record-banner').innerText()).includes(label));
   assert.equal(await page.locator('.qr-block').count(),qrCount,`${reference} QR eligibility`);
   if(qrCount)await page.locator('.qr-block img').first().waitFor();
   if(reference==='USED')assert.match(await page.locator('.ticket-person b').innerText(),/Used.*Boarded/);
   if(reference==='PAST-PAID')assert.match(await page.locator('.ticket-record-state').innerText(),/transaction records/);
   const main=page.locator('main:visible').first();
   assert.ok(await main.evaluate(el=>el.scrollWidth<=el.clientWidth+2),`${reference} overflow ${width}`);
   if(['USED','CHECKED-IN','GROUP'].includes(reference))await page.locator('.ticket').screenshot({path:`${output}/${reference.toLowerCase()}-${width}-${theme}.png`});
   checks++;
  }
  assert.deepEqual(errors,[]);await context.close();
  console.log(`PASS historical/used/checked-in/group tickets ${width}px ${theme}`);
 }
 console.log(`${checks} ticket renders plus historical booking/detail checks passed.`);
}finally{await browser.close();}
