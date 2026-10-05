import assert from 'node:assert/strict'
import fs from 'node:fs'
import { chromium } from 'playwright-core'

const baseUrl=process.env.BARKOLINK_UI_URL || 'http://127.0.0.1:8110'
const projectUrl=fs.readFileSync('.env.local','utf8').match(/^VITE_SUPABASE_URL\s*=\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g,'')
const projectRef=new URL(projectUrl).hostname.split('.')[0]
const id='11111111-1111-4111-8111-111111111111'
const browser=await chromium.launch({channel:'msedge',headless:true})
const errors=[]
try {
  for(const width of [1440,768,390]) {
    const context=await browser.newContext({viewport:{width,height:950}})
    await context.route(`${projectUrl}/**`,route=>route.fulfill({status:403,json:{message:'Live requests are blocked in this UI check.'}}))
    await context.addInitScript(()=>localStorage.setItem('barkolink-theme','light'))
    const page=await context.newPage()
    page.on('pageerror',error=>errors.push(error.message))
    for(const path of ['/login','/register']) {
      await page.goto(baseUrl+path)
      await page.locator('.form-heading h1').waitFor()
      await page.waitForTimeout(350)
      assert.equal(await page.locator('main').evaluate(el=>el.scrollWidth>el.clientWidth+2),false,`${path} ${width}px overflow`)
      assert.equal(await page.getByLabel('Email address',{exact:true}).isVisible(),true)
      await page.getByRole('button',{name:'Show password',exact:true}).click()
      assert.equal(await page.locator('#password').getAttribute('type'),'text')
      await page.getByRole('button',{name:'Hide password',exact:true}).click()
      if(path==='/register') {
        await page.getByLabel('Full name',{exact:true}).fill('UI Traveler')
        await page.getByLabel('Email address',{exact:true}).fill('ui@example.invalid')
        await page.getByLabel('Password',{exact:true}).fill('Strong-password123')
        await page.getByLabel('Confirm password',{exact:true}).fill('Different-password123')
        await page.locator('#terms').check()
        await page.getByRole('button',{name:'Create account',exact:true}).click()
        await page.getByRole('alert').waitFor()
        assert.match(await page.getByRole('alert').innerText(),/match/i)
      }
      fs.mkdirSync('docs/screenshots/auth',{recursive:true})
      await page.screenshot({path:`docs/screenshots/auth/${path.slice(1)}-${width}.png`})
    }
    await context.close()
    const passengerContext=await browser.newContext({viewport:{width,height:950}})
    const user={id,email:'ui@example.invalid',app_metadata:{role:'PASSENGER'},user_metadata:{fullName:'UI Traveler'},aud:'authenticated',created_at:'2026-01-01T00:00:00Z'}
    const exp=Math.floor(Date.now()/1000)+3600,encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url')
    const session={access_token:`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:id,exp,role:'authenticated',app_metadata:{role:'PASSENGER'}})}.test`,refresh_token:'ui-test',token_type:'bearer',expires_at:exp,expires_in:3600,user}
    await passengerContext.addInitScript(({key,session})=>{localStorage.setItem(key,JSON.stringify(session));localStorage.setItem('barkolink-theme','light')},{key:`sb-${projectRef}-auth-token`,session})
    let cancelled=false,cancelCalls=0,nativeDialogs=0
    const sailing={code:'UI-TRIP',departureAt:'2099-01-01T08:00:00Z',arrivalAt:'2099-01-01T10:00:00Z',origin:{name:'Calapan'},destination:{name:'Batangas'},vessel:{name:'UI Ferry'}}
    await passengerContext.route(`${projectUrl}/**`,async route=>{
      if(route.request().url().includes('/auth/v1/'))return route.fulfill({json:user})
      const {operation}=route.request().postDataJSON()
      let result
      if(operation==='CancelMyBooking'){cancelCalls++;cancelled=true;result={booking_update:{id}}}
      else result={ActiveAdvisories:{advisories:[]},MySavedTravelers:{travelers:[]},MyProfile:{user:{fullName:'UI Traveler',role:'PASSENGER'}},MyBookings:{bookings:[{id,reference:'UI-UNPAID',passengerCount:1,total:600,status:cancelled?'CANCELLED':'PENDING',paymentStatus:'UNPAID',paymentDeadline:new Date(Date.now()+3600000).toISOString(),createdAt:new Date().toISOString(),sailing,bookingPassengers_on_booking:[{id,fullName:'UI Traveler',passengerType:'REGULAR',ticketStatus:'PENDING'}]}]}}[operation]
      assert.notEqual(result,undefined,`Unhandled operation ${operation}`)
      return route.fulfill({json:result})
    })
    const passengerPage=await passengerContext.newPage()
    passengerPage.on('pageerror',error=>errors.push(error.message))
    passengerPage.on('dialog',async dialog=>{nativeDialogs++;await dialog.dismiss()})
    await passengerPage.goto(baseUrl+'/bookings')
    await passengerPage.getByRole('button',{name:'Cancel reservation',exact:true}).click()
    const dialog=passengerPage.locator('ion-alert.barkolink-confirmation')
    await dialog.waitFor()
    await passengerPage.waitForTimeout(350)
    assert.match(await dialog.innerText(),/release 1 reserved seat/)
    await passengerPage.screenshot({path:`docs/screenshots/auth/cancel-dialog-${width}.png`})
    await dialog.getByRole('button',{name:'Go back',exact:true}).click()
    await dialog.waitFor({state:'detached'})
    assert.equal(cancelCalls,0)
    await passengerPage.getByRole('button',{name:'Cancel reservation',exact:true}).click()
    await passengerPage.locator('ion-alert').getByRole('button',{name:'Cancel reservation',exact:true}).click()
    await passengerPage.getByRole('tab',{name:'Cancelled',exact:true}).waitFor()
    await passengerPage.waitForTimeout(350)
    assert.equal(cancelCalls,1)
    assert.equal(nativeDialogs,0)
    const selectedTrip={id:'UI-TRIP',selectionId:'ui-selection',from:'Calapan',to:'Batangas',date:'Jan 1, 2099',departure:'16:00',arrival:'18:00',duration:'2 hours',vessel:'UI Ferry',available:2,passengerCount:2,regularFare:600,studentFare:480,seniorFare:480,childFare:300,pwdFare:480,accommodations:[{id,name:'Tourist',description:'Comfort seats',capacity:2,availableSeats:2,surcharge:120,isActive:true},{id:'sold-out',name:'Business',description:'Reserved seating',capacity:1,availableSeats:0,surcharge:200,isActive:true}]}
    await passengerPage.evaluate(trip=>localStorage.setItem('barkolink-selected-trip',JSON.stringify(trip)),selectedTrip)
    await passengerPage.goto(baseUrl+'/trip-details')
    await passengerPage.locator('.accommodation-picker').waitFor()
    const continueButton=passengerPage.getByRole('button',{name:'Continue to passengers',exact:true})
    assert.equal(await continueButton.isDisabled(),true)
    assert.equal(await passengerPage.getByRole('radio').nth(1).isDisabled(),true)
    await passengerPage.getByRole('radio').first().check()
    await continueButton.click({trial:true})
    assert.equal(await continueButton.isDisabled(),false)
    assert.match(await passengerPage.locator('.flow-aside .total').innerText(),/1,440/)
    assert.equal(await passengerPage.evaluate(()=>JSON.parse(localStorage.getItem('barkolink-selected-trip')).accommodationId),id)
    await passengerPage.screenshot({path:`docs/screenshots/auth/accommodation-selection-${width}.png`})
    await continueButton.click()
    await passengerPage.waitForURL('**/passenger-info')
    await passengerPage.waitForTimeout(600)
    assert.equal(await passengerPage.locator('main:visible').evaluate(el=>el.scrollWidth>el.clientWidth+2),false)
    assert.equal(await passengerPage.locator('[role=alert]:visible').count(),0)
    await passengerContext.close()
  }
  assert.deepEqual(errors,[])
  console.log('Login, registration validation, custom confirmations, and accommodation selection checks passed at desktop, tablet, and mobile widths. No live writes.')
} finally {await browser.close()}
