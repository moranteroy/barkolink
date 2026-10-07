import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const project=fs.readFileSync('.env.local','utf8').match(/^VITE_SUPABASE_URL\s*=\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
const id='11111111-1111-4111-8111-111111111111';
const trip={id:'UI-TRIP',selectionId:'UI-SELECTION',from:'Batangas Port',to:'Calapan Port',vessel:'MV Isla Verde',available:20,passengerCount:1,regularFare:600,date:'Oct 8, 2099',departure:'12:16 PM',arrival:'2:16 PM'};
const sailing={code:trip.id,departureAt:'2099-10-08T04:16:00Z',arrivalAt:'2099-10-08T06:16:00Z',availableSeats:20,regularFare:600,accommodations:[],origin:{name:trip.from},destination:{name:trip.to},vessel:{name:trip.vessel}};
const person={id,name:'UI Passenger',type:'Regular',birthDate:'1990-01-01',sex:'Female',phone:'09171234567',nationality:'Filipino'};
const browser=await chromium.launch({channel:'msedge',headless:true});
fs.mkdirSync('.audit/vouchers',{recursive:true});
try{
  for(const role of ['PASSENGER','ADMIN'])for(const width of [390,1440]){
    const user={id,email:'ui@example.invalid',app_metadata:{role},user_metadata:{fullName:person.name},aud:'authenticated',created_at:new Date().toISOString()};
    const exp=Math.floor(Date.now()/1000)+3600,encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
    const session={access_token:`${encode({alg:'HS256'})}.${encode({sub:id,exp,role:'authenticated',app_metadata:user.app_metadata})}.fixture`,refresh_token:'fixture',token_type:'bearer',expires_at:exp,expires_in:3600,user};
    const context=await browser.newContext({viewport:{width,height:1000}});
    await context.addInitScript(({project,session,trip,person,id})=>{
      localStorage.setItem(`sb-${new URL(project).hostname.split('.')[0]}-auth-token`,JSON.stringify(session));localStorage.setItem('barkolink-theme','dark');localStorage.setItem('barkolink-selected-trip',JSON.stringify(trip));
      sessionStorage.setItem('barkolink-booking-draft',JSON.stringify({ownerUid:id,sailingCode:trip.id,selectionId:trip.selectionId,passengers:[person]}));
    },{project,session,trip,person,id});
    const bookings=[],vouchers=[];let reservations=0;
    await context.route(`${project}/**`,route=>{
      if(route.request().url().includes('/auth/'))return route.fulfill({json:user});
      const {operation,args}=route.request().postDataJSON();
      if(operation==='QuoteVoucher')return route.fulfill(args.voucherCode==='BAD'?{status:400,json:{message:'Voucher is invalid, inactive, or expired.'}}:{json:{code:'SAIL50',discount:50,subtotal:600,total:550}});
      if(operation==='ReserveSailing1'){
        assert.equal(args.voucherCode,'SAIL50');assert.equal(args.expectedVoucherDiscount,50);reservations++;
        bookings.push({id:args.reference,reference:args.reference,sailing,total:550,voucherCode:'SAIL50',voucherDiscount:50,passengerCount:1,status:'PENDING',paymentStatus:'UNPAID',paymentDeadline:new Date(Date.now()+3600000).toISOString(),createdAt:new Date().toISOString(),bookingPassengers_on_booking:[{id,fullName:person.name,passengerType:'REGULAR',fare:600,ticketStatus:'PENDING'}]});
        return route.fulfill({json:{}});
      }
      if(operation==='AdminSaveVoucher'){
        if(args.id)vouchers[0].isActive=args.isActive;
        else{assert.match(args.startsAt,/Z$/);vouchers.push({...args,id,used:0});}
        return route.fulfill({json:{id}});
      }
      const response={BrowseSailings:{sailings:[sailing]},MyBookings:{bookings},MyProfile:{user:{fullName:person.name,phone:person.phone}},MySavedTravelers:{travelers:[]},SavedTravelers:{travelers:[]},MyNotifications:{notifications:[]},ActiveAdvisories:{advisories:[]},AdminVouchers:{vouchers}}[operation];
      assert.ok(response,`Unexpected operation ${operation}`);return route.fulfill({json:response});
    });
    const page=await context.newPage(),errors=[],consoleErrors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
    await page.goto(`http://localhost:8100${role==='ADMIN'?'/admin/vouchers':'/booking-summary'}`,{waitUntil:'networkidle'});
    if(role==='PASSENGER'){
      await page.getByLabel('Have a voucher?').fill('BAD');await page.getByRole('button',{name:'Apply',exact:true}).click();await page.getByRole('alert').filter({hasText:'invalid'}).waitFor();
      await page.getByLabel('Have a voucher?').fill('SAIL50');await page.getByRole('button',{name:'Apply',exact:true}).click();await page.locator('.voucher-discount').waitFor();
      assert.match(await page.locator('.review-fares .total').textContent(),/550/);
      await page.locator('.voucher-entry').scrollIntoViewIfNeeded();await page.screenshot({path:`.audit/vouchers/passenger-${width}.png`,fullPage:true});
      await page.getByRole('button',{name:'Confirm reservation',exact:true}).click();await page.waitForURL('**/booking-confirmed?reference=**');await page.locator('.online-payment').last().waitFor();assert.equal(reservations,1);assert.match(await page.locator('.confirmed-page').last().textContent(),/550/);
    }else{
      const code=page.getByLabel('Code',{exact:true});
      await code.fill('SAIL-50');assert.equal(await code.evaluate(el=>el.checkValidity()),true);
      await code.fill('SAIL_50');assert.equal(await code.evaluate(el=>el.checkValidity()),true);
      await code.fill('BAD!');assert.equal(await code.evaluate(el=>el.checkValidity()),false);
      await page.getByLabel('Code',{exact:true}).fill('SAIL50');await page.getByLabel('Expires (Philippine time)').fill('2099-01-01T12:00');await page.getByRole('button',{name:'Create voucher',exact:true}).click();await page.locator('.voucher-list').getByText('SAIL50',{exact:true}).waitFor();
      await page.getByRole('button',{name:'Pause',exact:true}).click();await page.getByText('Paused',{exact:true}).waitFor();await page.screenshot({path:`.audit/vouchers/admin-${width}.png`,fullPage:true});
      assert.deepEqual(consoleErrors,[]);
    }
    assert.deepEqual(errors,[]);console.log(`${role} ${width}px: voucher flow passed.`);await context.close();
  }
}finally{await browser.close();}
