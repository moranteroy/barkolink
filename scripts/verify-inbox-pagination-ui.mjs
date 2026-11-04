import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
import {fixtureProject,fixtureBrowserOptions} from './browser-fixture-config.mjs';

// Synthetic sessions and intercepted requests only. No hosted writes/providers.
const base=process.env.BARKOLINK_UI_URL || 'http://127.0.0.1:8127';
const project=fixtureProject();
const uid='11111111-1111-4111-8111-111111111111';
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const browser=await chromium.launch(fixtureBrowserOptions());
const errors=[];
fs.mkdirSync('.audit/inbox-pagination',{recursive:true});
let checked=0;
try {
 for(const role of ['ADMIN','PASSENGER','TICKETING','BOARDING'])for(const width of [1440,768,390])for(const theme of ['light','dark']) {
  const context=await browser.newContext({viewport:{width,height:1000}});
  const user={id:uid,email:'inbox@example.invalid',app_metadata:{role},user_metadata:{fullName:'Inbox Tester'},aud:'authenticated',created_at:'2026-01-01T00:00:00Z'};
  const exp=Math.floor(Date.now()/1000)+3600;
  const session={access_token:`${encode({alg:'HS256'})}.${encode({sub:uid,exp,aal:'aal2',role:'authenticated',app_metadata:{role}})}.fixture`,refresh_token:'fixture',token_type:'bearer',expires_at:exp,expires_in:3600,user};
  await context.addInitScript(({key,session,theme})=>{localStorage.setItem(key,JSON.stringify(session));localStorage.setItem('barkolink-theme',theme);},{key:`sb-${new URL(project).hostname.split('.')[0]}-auth-token`,session,theme});
  const notes=Array.from({length:151},(_,i)=>({id:`notice-${i+1}`,title:`History ${i+1}`,message:`Booking and sailing update for a passenger with a long name ${'Traveler '.repeat(8)}`,category:i%2?'TRIPS':'BOOKING',createdAt:new Date(Date.UTC(2026,9,30,12)-i*60000).toISOString(),readAt:i<120?null:'2026-10-31T00:00:00Z'}));
  const calls=[];
  await context.route(`${project}/**`,route=>{
   const url=route.request().url();
   if(url.includes('/auth/'))return route.fulfill({json:user});
   if(url.endsWith('/rpc/my_mfa_settings'))return route.fulfill({json:{role,enabled:true,staffRequired:true,mfaRequired:role!=='PASSENGER'}});
   const {operation,args={}}=route.request().postDataJSON()||{};calls.push({operation,args});
   if(operation==='MyProfile')return route.fulfill({json:{user:{uid,fullName:'Inbox Tester',role,assignedPortId:'origin',assignedPort:{id:'origin',name:'Batangas Port',isActive:true}}}});
   if(operation==='MyNotifications') {
    const filtered=args.summary?notes:notes.filter(n=>(!args.unreadOnly||!n.readAt)&&(!args.category||args.category==='ALL'||n.category===args.category)&&(!args.search||(n.title+' '+n.message).toLowerCase().includes(args.search.toLowerCase())));
    const size=args.summary?50:args.pageSize||100;
    const categoryCounts=Object.fromEntries(['BOOKING','TRIPS'].map(c=>[c,notes.filter(n=>n.category===c&&(!args.unreadOnly||!n.readAt)).length]));
    return route.fulfill({json:{notifications:filtered.slice((args.page||0)*size,((args.page||0)+1)*size),totalCount:filtered.length,inboxCount:notes.length,categoryCounts,unreadCount:notes.filter(n=>!n.readAt).length,categories:['BOOKING','TRIPS']}});
   }
   if(operation==='MyMarkAllNotificationsRead'){notes.forEach(n=>{n.readAt=new Date().toISOString();});return route.fulfill({json:{marked:120}});}
   if(operation==='MarkNotificationRead'){notes.find(n=>n.id===args.id).readAt=new Date().toISOString();return route.fulfill({json:{}});}
   if(operation==='StaffDashboard')return route.fulfill({json:{bookings:0,paid:0,unpaid:0,trips:0}});
   if(operation==='StaffBookings')return route.fulfill({json:{bookings:[],totalCount:0}});
   throw new Error(`Unhandled inbox fixture: ${operation}`);
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const path=role==='ADMIN'?'/admin/inbox':role==='PASSENGER'?'/notifications':`/staff/${role.toLowerCase()}/notifications`;
  await page.goto(base+path);
  await page.getByText('Page 1 of 6',{exact:true}).waitFor();
  const inbox=role==='PASSENGER'?page.locator('.notifications-page'):page.locator('.notification-inbox');
  await inbox.getByText('120 unread updates',{exact:true}).waitFor();
  await inbox.getByRole('button',{name:'All updates 151',exact:true}).waitFor();
  await inbox.getByRole('button',{name:'Next',exact:true}).click();
  await page.getByText('Page 2 of 6',{exact:true}).waitFor();
  await inbox.getByRole('heading',{name:'History 31',exact:true}).waitFor();
  assert.equal(await inbox.locator('article').count(),30);
  if(role!=='PASSENGER') {
   await inbox.getByRole('searchbox').fill('History 151');
   await page.getByText('Page 1 of 1',{exact:true}).waitFor();
   await inbox.getByRole('heading',{name:'History 151',exact:true}).waitFor();
   assert.equal(await inbox.locator('article').count(),1);
   await inbox.getByRole('searchbox').fill('');
   await page.getByText('Page 1 of 6',{exact:true}).waitFor();
  }
  await page.screenshot({path:`.audit/inbox-pagination/${role.toLowerCase()}-${width}-${theme}.png`,fullPage:true});
  await inbox.getByRole('button',{name:'Mark all read',exact:true}).click();
  await inbox.getByText('You are all caught up',{exact:true}).waitFor();
  assert.ok(calls.some(c=>c.operation==='MyNotifications'&&c.args.summary===true));
  assert.ok(calls.some(c=>c.operation==='MyNotifications'&&c.args.page===1&&c.args.pageSize===30));
  assert.ok(!calls.some(c=>/^(Reserve|Collect|BoardTicket|CheckInTicket|AdminSave)/.test(c.operation||'')));
  await context.close();checked++;
  console.log(`PASS ${role} ${width}px ${theme}: bounded pages, global unread count, search/read updates`);
 }
 assert.deepEqual(errors,[]);console.log(`${checked} inbox role/viewport/theme checks passed.`);
}finally{await browser.close();}
