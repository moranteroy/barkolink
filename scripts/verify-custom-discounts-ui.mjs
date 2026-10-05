import assert from 'node:assert/strict'
import fs from 'node:fs'
import { chromium } from 'playwright-core'

// All backend calls use fixtures; no real accounts, bookings or payments are created.
const baseUrl = process.env.BARKOLINK_UI_URL || 'http://127.0.0.1:8110'
const projectUrl = fs.readFileSync('.env.local','utf8').match(/^VITE_SUPABASE_URL\s*=\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'')
const projectRef = new URL(projectUrl).hostname.split('.')[0]
const id = '11111111-1111-4111-8111-111111111111'
const discount = {id,name:'Scholar',percentage:35,isActive:true,fare:390}
const sailing = {code:'UI-CUSTOM',departureAt:'2099-01-01T08:00:00Z',arrivalAt:'2099-01-01T10:00:00Z',durationMinutes:120,status:'SCHEDULED',availableSeats:100,regularFare:600,studentFare:480,seniorFare:480,childFare:300,pwdFare:480,pregnantFare:600,passengerDiscounts:[discount],customDiscounts:[],accommodations:[],origin:{name:'Calapan'},destination:{name:'Batangas'},vessel:{name:'UI Ferry',passengerCapacity:100}}
const browser = await chromium.launch({channel:'msedge',headless:true})
const errors = []
try {
  for (const width of [1440,768,390]) for (const role of ['PASSENGER','TICKETING']) {
    const context = await browser.newContext({viewport:{width,height:950}})
    const user = {id,email:'ui@example.invalid',app_metadata:{role},user_metadata:{fullName:'UI Traveler'},aud:'authenticated',created_at:'2026-01-01T00:00:00Z'}
    const exp = Math.floor(Date.now()/1000)+3600, encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
    const session = {access_token:`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:id,exp,role:'authenticated',app_metadata:{role}})}.test`,refresh_token:'ui-test',token_type:'bearer',expires_at:exp,expires_in:3600,user}
    await context.addInitScript(({key,session,trip})=>{localStorage.setItem(key,JSON.stringify(session));localStorage.setItem('barkolink-theme','light');localStorage.setItem('barkolink-selected-trip',JSON.stringify(trip))},{key:`sb-${projectRef}-auth-token`,session,trip:{...sailing,id:sailing.code,selectionId:'custom-test',from:'Calapan',to:'Batangas',date:'Jan 1, 2099',departure:'16:00',arrival:'18:00',duration:'2 hours',vessel:'UI Ferry',available:100,passengerCount:1}})
    let lastArgs = null, writes = 0, catalogSailing=sailing
    await context.route(`${projectUrl}/**`,async route=>{
      if(route.request().url().includes('/auth/v1/')) return route.fulfill({json:user})
      assert.ok(route.request().url().includes('/rpc/barkolink_execute'))
      const {operation,args} = route.request().postDataJSON()
      let result
      if(operation === 'ReserveSailing1' || operation === 'TicketingCreateGuestWalkIn') {lastArgs=args;writes++;result={booking_insert:{id}}}
      else result = {
        MyProfile:{user:{fullName:'UI Traveler',role}},ActiveAdvisories:{advisories:[]},MySavedTravelers:{travelers:[]},
        BrowseSailings:{sailings:[sailing]},TicketingSailings:{sailings:[catalogSailing]},
        MyBookings:{bookings:lastArgs ? [{id,reference:lastArgs.reference,passengerCount:1,total:390,status:'PENDING',paymentStatus:'UNPAID',paymentDeadline:new Date(Date.now()+3600000).toISOString(),createdAt:new Date().toISOString(),sailing,bookingPassengers_on_booking:[{id,fullName:'UI Traveler',passengerType:discount.name,ticketStatus:'PENDING'}]}] : []},
      }[operation]
      assert.notEqual(result,undefined,`Unhandled ${operation}`)
      return route.fulfill({json:result})
    })
    const page = await context.newPage()
    page.on('pageerror',e=>errors.push(e.message))
    if(role === 'PASSENGER') {
      await page.goto(baseUrl+'/trip-details')
      await page.locator('main:visible').getByRole('button',{name:'Continue to passengers',exact:true}).click()
      await page.waitForURL('**/passenger-info')
      await page.waitForTimeout(600)
      const passengerType = page.locator('main:visible').getByLabel(/^Passenger type/)
      assert.equal(await passengerType.locator('option').filter({hasText:/^Student$|^Senior$|^PWD$/}).count(),0)
      await passengerType.selectOption(discount.name)
      await page.locator('main:visible').getByLabel('Full name',{exact:true}).fill('UI Traveler')
      await page.locator('main:visible').getByLabel('Date of birth',{exact:true}).fill('2000-01-01')
      await page.locator('main:visible').getByLabel(/^Sex/).selectOption('Male')
      await page.locator('main:visible').getByLabel('Mobile number',{exact:true}).fill('09123456789')
      await page.locator('main:visible').getByLabel('Nationality',{exact:true}).fill('Filipino')
      await page.locator('main:visible').getByRole('button',{name:'Review booking',exact:true}).click()
      await page.waitForURL('**/booking-summary')
      await page.waitForTimeout(600)
      await page.locator('main:visible').getByRole('heading',{name:'Ready to sail?',exact:true}).waitFor()
      assert.match(await page.locator('main:visible .flow-aside').innerText(),/PHP 390/)
      await page.locator('main:visible').getByRole('button',{name:'Confirm reservation',exact:true}).click()
      await page.waitForURL('**/booking-confirmed?reference=*')
      await page.waitForTimeout(600)
      assert.equal(lastArgs.passenger1Type,discount.name)
    } else {
      await page.goto(baseUrl+'/staff/ticketing/walk-in')
      await page.locator('main:visible').getByLabel(/^Sailing/).selectOption(sailing.code)
      const fareType = page.locator('main:visible').getByLabel(/^Fare type/)
      assert.equal(await fareType.locator('option').filter({hasText:/^Student$|^Senior$|^PWD$/}).count(),0)
      await fareType.selectOption(discount.name)
      await page.locator('main:visible').getByLabel('Full name',{exact:true}).fill('UI Traveler')
      await page.locator('main:visible').getByLabel('Date of birth',{exact:true}).fill('2000-01-01')
      await page.locator('main:visible').getByLabel(/^Sex/).selectOption('Male')
      assert.match(await page.locator('main:visible .summary-card').innerText(),/390/)
      await page.locator('main:visible').getByRole('checkbox',{name:"I checked this passenger's discount eligibility.",exact:true}).check()
      await page.locator('main:visible').getByLabel('Verification note',{exact:true}).fill('Operator eligibility checked')
      await page.locator('#walk-in-form').evaluate(form=>form.requestSubmit())
      await page.locator('main:visible').getByRole('dialog').waitFor()
      await page.locator('main:visible').getByRole('button',{name:/Cash received/}).click()
      await page.locator('main:visible').getByRole('heading',{name:'Ticket issued',exact:true}).waitFor()
      assert.equal(lastArgs.passengerType,discount.name)
      assert.equal(lastArgs.discountVerified,true)
      assert.match(await page.locator('main:visible .receipt').innerText(),/PHP 390/)
      catalogSailing={...sailing,passengerDiscounts:null,customDiscounts:[]}
      await page.locator('main:visible').getByRole('button',{name:'Issue another ticket',exact:true}).click()
      await page.locator('main:visible').getByLabel(/^Fare type/).selectOption('Student')
      await page.locator('main:visible').getByLabel('Full name',{exact:true}).fill('Legacy Student')
      await page.locator('main:visible').getByLabel('Date of birth',{exact:true}).fill('2000-01-01')
      await page.locator('main:visible').getByLabel(/^Sex/).selectOption('Male')
      await page.locator('main:visible').getByRole('checkbox').check()
      await page.locator('main:visible').getByLabel('Verification note',{exact:true}).fill('Student ID checked')
      await page.locator('#walk-in-form').evaluate(form=>form.requestSubmit())
      await page.locator('main:visible').getByRole('dialog').waitFor()
      await page.locator('main:visible').getByRole('button',{name:/Cash received/}).click()
      await page.locator('main:visible').getByRole('heading',{name:'Ticket issued',exact:true}).waitFor()
      assert.equal(lastArgs.passengerType,'STUDENT')
      assert.match(await page.locator('main:visible .receipt').innerText(),/PHP 480/)
    }
    assert.equal(writes,role === 'TICKETING' ? 2 : 1)
    assert.equal(await page.locator('main:visible').evaluate(el=>el.scrollWidth>el.clientWidth+2),false)
    assert.equal(await page.locator('[role=alert]:visible').count(),0)
    await context.close()
  }
  assert.deepEqual(errors,[])
  console.log('Custom discount booking and verified walk-in checks passed at desktop, tablet and mobile widths. No live writes.')
} finally {await browser.close()}
