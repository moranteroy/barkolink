import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import jsQR from 'jsqr';
const project=fs.readFileSync('.env.local','utf8').match(/^VITE_SUPABASE_URL\s*=\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
const id='11111111-1111-4111-8111-111111111111',code='22222222-2222-4222-8222-222222222222';
const sailing={code:'QR-TRIP',departureAt:'2099-10-08T04:00:00Z',arrivalAt:'2099-10-08T06:00:00Z',status:'BOARDING',origin:{name:'Batangas Port',city:'Batangas'},destination:{name:'Calapan Port',city:'Calapan'},vessel:{name:'MV Isla Verde'}};
const payload=JSON.stringify({BarkoLink:'Ticket v2',Name:'Carlo Reyes',Date:'2099-10-08 12:00 Philippine time',Vessel:sailing.vessel.name,Route:'Batangas Port to Calapan Port',Booking:'QR-BOOKING',Ticket:code,Verification:'a'.repeat(64)});
const person={id,fullName:'Carlo Reyes',passengerType:'REGULAR',fare:600,ticketCode:code,ticketQrPayload:payload,ticketStatus:'ISSUED'};
const booking={id,reference:'QR-BOOKING',status:'CONFIRMED',paymentStatus:'PAID',paymentMethod:'CASH',paymentVerificationRequired:false,total:600,passengerCount:1,sailing,bookingPassengers_on_booking:[person],createdAt:'2026-10-08T00:00:00Z'};
fs.mkdirSync('.audit/ticket-qr',{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  for(const width of [390,1440]){
    let decoded;
    for(const role of ['PASSENGER','BOARDING']){
      const user={id,email:'qr@example.invalid',app_metadata:{role},user_metadata:{fullName:'Carlo Reyes'},aud:'authenticated',created_at:'2026-01-01T00:00:00Z'};
      const exp=Math.floor(Date.now()/1000)+3600,encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
      const session={access_token:`${encode({alg:'HS256'})}.${encode({sub:id,exp,role:'authenticated',app_metadata:user.app_metadata})}.fixture`,refresh_token:'fixture',token_type:'bearer',expires_at:exp,expires_in:3600,user};
      const context=await browser.newContext({viewport:{width,height:1000}});
      await context.addInitScript(({project,session})=>{localStorage.setItem(`sb-${new URL(project).hostname.split('.')[0]}-auth-token`,JSON.stringify(session));localStorage.setItem('barkolink-theme','dark');},{project,session});
      let actions=0,alreadyBoarded=false;
      await context.route(`${project}/**`,route=>{
        if(route.request().url().includes('/auth/'))return route.fulfill({json:user});
        const {operation,args}=route.request().postDataJSON();
        if(['CheckInTicket','BoardTicket'].includes(operation)){actions++;return route.fulfill({json:{}});}
        if(operation==='VerifyTicketQr'){
          if(args.payload!==payload && args.payload!==code)return route.fulfill({status:400,json:{message:'QR verification failed: ticket details were changed.',code:'P0001'}});
          return route.fulfill({json:{passenger:{...person,ticketStatus:alreadyBoarded?'BOARDED':'ISSUED',booking},alreadyBoarded,legacyCode:args.payload===code}});
        }
        const fixtures={MyProfile:{user:{fullName:'Carlo Reyes',role}},MyBookings:{bookings:[booking]},MyNotifications:{notifications:[]},BoardingSailings:{sailings:[sailing]},BoardingManifest:{bookings:[booking]},BoardingActivity:{boardingEvents:[]}};
        return route.fulfill({json:fixtures[operation]||{advisories:[],notifications:[]}});
      });
      const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
      if(role==='PASSENGER'){
        await page.goto('http://127.0.0.1:8115/ticket?reference=QR-BOOKING',{waitUntil:'networkidle'});
        const qr=page.locator('.qr-block img');await qr.waitFor();
        const frame=await qr.evaluate(img=>{const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);return {width:canvas.width,height:canvas.height,data:Array.from(ctx.getImageData(0,0,canvas.width,canvas.height).data)};});
        decoded=jsQR(new Uint8ClampedArray(frame.data),frame.width,frame.height)?.data;assert.equal(decoded,payload);
        assert.equal(JSON.parse(decoded).Name,'Carlo Reyes');
        await qr.scrollIntoViewIfNeeded();await page.locator('.ticket').screenshot({path:`.audit/ticket-qr/passenger-${width}.png`});
      }else{
        await page.goto('http://127.0.0.1:8115/staff/boarding/check-in',{waitUntil:'networkidle'});
        await page.locator('.heading-actions').getByRole('button',{name:'Find ticket'}).click();
        const modal=page.locator('.scanner-modal');await modal.locator('input').fill(JSON.stringify({...JSON.parse(payload),Name:'Fake Passenger'}));
        await modal.getByRole('button',{name:'Verify ticket'}).click();await modal.getByText(/QR verification failed/).waitFor();
        assert.equal(actions,0);
        await modal.locator('input').fill(decoded);await modal.getByRole('button',{name:'Verify ticket'}).click();
        const review=page.locator('.review-panel');await review.getByText('Carlo Reyes',{exact:true}).waitFor();
        assert.match(await review.textContent(),/MV Isla Verde/);assert.match(await review.textContent(),/2099/);assert.match(await review.textContent(),/Paid/);assert.equal(actions,0);
        await review.screenshot({path:`.audit/ticket-qr/staff-${width}.png`});
        alreadyBoarded=true;
        await page.locator('.heading-actions').getByRole('button',{name:'Find ticket'}).click();await modal.locator('input').fill(decoded);await modal.getByRole('button',{name:'Verify ticket'}).click();
        await review.getByText('Boarded',{exact:true}).waitFor();assert.equal(await review.locator('.review-action').count(),0);assert.equal(actions,0);
      }
      assert.deepEqual(errors,[]);await context.close();
      console.log(`${role} ${width}px: QR details, verification and review checks passed.`);
    }
  }
}finally{await browser.close();}
