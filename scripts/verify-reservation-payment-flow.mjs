import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const project=fs.readFileSync('.env.local','utf8').match(/^VITE_SUPABASE_URL\s*=\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
const id='11111111-1111-4111-8111-111111111111';
const user={id,email:'ui@example.invalid',app_metadata:{role:'PASSENGER'},user_metadata:{fullName:'UI Passenger'},aud:'authenticated',created_at:'2026-01-01T00:00:00Z'};
const exp=Math.floor(Date.now()/1000)+3600,encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const session={access_token:`${encode({alg:'HS256'})}.${encode({sub:id,exp,role:'authenticated',app_metadata:user.app_metadata})}.fixture`,refresh_token:'fixture',token_type:'bearer',expires_at:exp,expires_in:3600,user};
const trip={id:'UI-TRIP',selectionId:'UI-SELECTION',from:'Batangas Port',to:'Calapan Port',vessel:'MV Isla Verde',available:20,passengerCount:1,regularFare:600,date:'Oct 8, 2099',departure:'12:16 PM',arrival:'2:16 PM'};
const sailing={code:trip.id,departureAt:'2099-10-08T04:16:00Z',arrivalAt:'2099-10-08T06:16:00Z',availableSeats:20,regularFare:600,accommodations:[],origin:{name:trip.from},destination:{name:trip.to},vessel:{name:trip.vessel}};
const person={id,name:'UI Passenger',type:'Regular',birthDate:'1990-01-01',sex:'Female',phone:'09171234567',nationality:'Filipino'};
const record=(reference,paymentStatus)=>({id:reference,reference,sailing,status:paymentStatus==='PAID'?'CONFIRMED':'PENDING',paymentStatus,paymentMethod:paymentStatus==='PAID'?'PAYMONGO_TEST':null,paymentProviderMethod:'gcash',total:600,passengerCount:1,paymentDeadline:new Date(Date.now()+3600000).toISOString(),createdAt:new Date().toISOString(),bookingPassengers_on_booking:[{id,fullName:person.name,passengerType:'REGULAR',fare:600,ticketStatus:paymentStatus==='PAID'?'ISSUED':'PENDING',ticketCode:id}]});
const browser=await chromium.launch({channel:'msedge',headless:true});
fs.mkdirSync('.audit/reservation-payment',{recursive:true});
try{
  const cases=['paid-duplicate','stale-paid-intent','unpaid-retry','new-passenger'].map(scenario=>({scenario,width:390,theme:'light'}));
  cases.push(...[390,560,1440].map(width=>({scenario:'paid-duplicate',width,theme:'dark'})));
  for(const {scenario,width,theme} of cases){
    const previous=record('BL-OLD',scenario==='unpaid-retry'?'UNPAID':'PAID');
    if(scenario==='new-passenger')previous.bookingPassengers_on_booking[0].fullName='Other Passenger';
    const bookings=[previous]; let reservations=0;
    const context=await browser.newContext({viewport:{width,height:1000}});
    await context.addInitScript(({project,session,trip,person,id,scenario,theme})=>{
      localStorage.setItem('barkolink-theme',theme);
      localStorage.setItem(`sb-${new URL(project).hostname.split('.')[0]}-auth-token`,JSON.stringify(session));
      localStorage.setItem('barkolink-selected-trip',JSON.stringify(trip));
      sessionStorage.setItem('barkolink-booking-draft',JSON.stringify({ownerUid:id,sailingCode:trip.id,selectionId:trip.selectionId,passengers:[person]}));
      if(['stale-paid-intent','unpaid-retry'].includes(scenario))sessionStorage.setItem('barkolink-booking-intent',JSON.stringify({ownerUid:id,sailingCode:trip.id,selectionId:trip.selectionId,reference:'BL-OLD'}));
    },{project,session,trip,person,id,scenario,theme});
    await context.route(`${project}/**`,route=>{
      if(route.request().url().includes('/auth/'))return route.fulfill({json:user});
      const body=route.request().postDataJSON();
      if(body.operation==='ReserveSailing1'){
        if(scenario!=='new-passenger')return route.fulfill({status:400,json:{code:'P0001',message:'Duplicate booking: BL-OLD. You already have an active reservation with these passenger details for this trip. Open the existing booking.'}});
        reservations++; bookings.push(record(body.args.reference,'UNPAID'));
        return route.fulfill({json:{}});
      }
      const response={BrowseSailings:{sailings:[sailing]},MyBookings:{bookings},MyProfile:{user:{fullName:person.name,phone:person.phone}},MySavedTravelers:{travelers:[]},SavedTravelers:{travelers:[]},MyNotifications:{notifications:[]},ActiveAdvisories:{advisories:[]}}[body.operation];
      assert.ok(response,`Unexpected operation ${body.operation}`);
      return route.fulfill({json:response});
    });
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://localhost:8100/booking-summary',{waitUntil:'networkidle'});
    await page.getByRole('button',{name:'Confirm reservation',exact:true}).click();
    if(['paid-duplicate','stale-paid-intent'].includes(scenario)){
      await page.getByRole('alert').filter({hasText:'Booking already exists'}).waitFor();
      await page.getByRole('link',{name:'View existing booking',exact:true}).waitFor();
      assert.equal(await page.getByRole('button',{name:'Confirm reservation',exact:true}).count(),0);
      assert.equal(await page.locator('main').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
      assert.equal(reservations,0);
      assert.equal(new URL(page.url()).pathname,'/booking-summary');
      assert.deepEqual(errors,[]);
      await page.locator('.duplicate-booking-notice').scrollIntoViewIfNeeded();
      await page.screenshot({path:`.audit/reservation-payment/${scenario}-${theme}-${width}.png`,fullPage:true});
      await page.locator('.duplicate-edit-action').click();
      await page.waitForURL('**/passenger-info');
      await page.goBack();
      await page.getByRole('button',{name:'Confirm reservation',exact:true}).last().waitFor();
      console.log(`${scenario} ${theme} ${width}px: duplicate notice, actions and edit recovery passed.`);
      await context.close();continue;
    }
    await page.waitForURL('**/booking-confirmed?reference=**');
    await page.locator('.online-payment').waitFor();
    assert.equal(reservations,scenario==='unpaid-retry'?0:1);
    assert.equal(new URL(page.url()).searchParams.get('reference')==='BL-OLD',scenario==='unpaid-retry');
    const confirmation=page.locator('.confirmed-page').last();
    assert.match(await confirmation.textContent(),/Awaiting payment/);
    assert.doesNotMatch(await confirmation.textContent(),/Payment recorded/);
    await confirmation.getByRole('button',{name:'Continue to payment',exact:true}).waitFor();
    assert.deepEqual(errors,[]);
    await page.screenshot({path:`.audit/reservation-payment/${scenario}.png`,fullPage:true});
    console.log(`${scenario}: correct reservation reference and payment choices displayed.`);
    await context.close();
  }
}finally{await browser.close();}
