import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

// Production assets and real CSP; only synthetic users and mocked inbox data.
const root=path.resolve('dist');
const headers=JSON.parse(fs.readFileSync('vercel.json','utf8')).headers[0].headers;
const project=fs.readFileSync('.env.local','utf8').match(/^VITE_SUPABASE_URL\s*=\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
const server=http.createServer((request,response)=>{
  const candidate=path.resolve(root,'.'+new URL(request.url,'http://localhost').pathname);
  if(!candidate.startsWith(root+path.sep))return response.writeHead(404).end();
  const file=fs.existsSync(candidate)&&fs.statSync(candidate).isFile()?candidate:path.join(root,'index.html');
  for(const header of headers)response.setHeader(header.key,header.value);
  response.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');
  response.end(fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const urlIndex=process.argv.indexOf('--url');
const base=urlIndex>=0?new URL(process.argv[urlIndex+1]).origin:`http://127.0.0.1:${server.address().port}`;
fs.mkdirSync('.audit/notifications',{recursive:true});
let browser;
try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  for(const [role,url] of [['PASSENGER','/notifications'],['ADMIN','/admin/inbox'],['TICKETING','/staff/ticketing/notifications'],['BOARDING','/staff/boarding/notifications']]){
    for(const [width,height,theme] of [[320,740,'light'],[390,640,'dark'],[1440,900,'dark']]){
      const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
      const user={id:'11111111-1111-4111-8111-111111111111',email:'inbox-test@example.invalid',aud:'authenticated',app_metadata:{role},user_metadata:{fullName:'Inbox Test'},factors:[]};
      const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url'),exp=Math.floor(Date.now()/1000)+3600;
      const session={access_token:`${encode({alg:'HS256'})}.${encode({sub:user.id,exp,aal:'aal2',role:'authenticated',app_metadata:user.app_metadata})}.fixture`,refresh_token:'fixture',token_type:'bearer',expires_at:exp,expires_in:3600,user};
      await context.addInitScript(({project,session,theme})=>{
        localStorage.setItem(`sb-${new URL(project).hostname.split('.')[0]}-auth-token`,JSON.stringify(session));
        localStorage.setItem('barkolink-theme',theme);
      },{project,session,theme});
      const items=Array.from({length:12},(_,i)=>({id:`notice-${i}`,category:['TRIPS','BOOKING','PROMO','GENERAL','SYSTEM'][i%5],title:i===0?'Sailing time updated':`Travel update ${i}`,message:i===0?'Booking BL-TEST-01: Batangas to Calapan now departs at 10:30 AM. Please check your updated ticket.':`An update for booking BL-TEST-${i}. Review your latest travel information before departure.`,createdAt:new Date(Date.UTC(2026,9,15,2,30-i)).toISOString(),readAt:i<7?null:'2026-10-15T03:00:00Z'}));
      const operations=[];
      await context.route(`${project}/**`,async route=>{
        if(route.request().url().includes('/auth/'))return route.fulfill({json:user});
        const body=route.request().postDataJSON()||{},operation=body.operation;operations.push(operation);
        if(operation==='MarkNotificationRead'){
          const item=items.find(item=>item.id===body.args?.id);if(item)item.readAt=new Date().toISOString();
          return route.fulfill({json:{updated:true}});
        }
        if(operation==='MyMarkAllNotificationsRead'){
          items.forEach(item=>item.readAt=new Date().toISOString());return route.fulfill({json:{updated:items.length}});
        }
        return route.fulfill({json:operation==='MyNotifications'?{notifications:items}:operation==='MyProfile'?{user:{fullName:'Inbox Test',role}}:{notifications:[],ports:[],settings:[],sailings:[],users:[],bookings:[]}});
      });
      const page=await context.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.addInitScript(()=>{
        window.inboxCspErrors=[];
        document.addEventListener('securitypolicyviolation',event=>window.inboxCspErrors.push(event.violatedDirective));
      });
      await page.goto(base+url,{waitUntil:'networkidle'});
      const inbox=page.locator(role==='PASSENGER'?'.notifications-page':'.notification-inbox');
      await inbox.locator('.notifications article').first().waitFor();
      assert.equal(await inbox.locator('.notifications article').count(),12,`${role} must show all updates`);
      const toolbar=await inbox.locator('.notification-toolbar').boundingBox();
      assert.ok(toolbar.height<=92,`${role} summary should be compact (${toolbar.height}px)`);
      const filters=inbox.locator('.notification-filters');
      assert.equal(await filters.evaluate(el=>getComputedStyle(el).flexWrap),'nowrap');
      assert.equal(await filters.evaluate(el=>new Set([...el.children].map(child=>Math.round(child.getBoundingClientRect().top))).size),1,'Categories must stay on one row');
      assert.equal(await inbox.locator('.notice-copy h2').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize)),16);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Page must not overflow horizontally');
      if(role==='PASSENGER'){
        const first=await inbox.locator('.notifications article').first().boundingBox(),nav=await page.locator('.bottom-nav').boundingBox();
        assert.ok(first.y<nav.y-30,'The first notification must appear before scrolling');
      }
      await page.screenshot({path:`.audit/notifications/${role}-${width}-${theme}.png`});
      await inbox.getByRole('button',{name:'Promos',exact:true}).click();
      assert.equal(await inbox.locator('.notifications article').count(),2);
      await inbox.getByRole('button',{name:'All categories',exact:true}).click();
      await inbox.getByRole('button',{name:'Unread 7',exact:true}).click();
      assert.equal(await inbox.locator('.notifications article').count(),7);
      await inbox.getByRole('button',{name:'Mark read: Sailing time updated',exact:true}).click();
      await page.waitForFunction(()=>document.querySelectorAll('.notifications article').length===6);
      if(role!=='PASSENGER'){
        await inbox.getByRole('searchbox').fill('nonexistent update');
        await inbox.getByRole('heading',{name:'No matching notifications'}).waitFor();
        await inbox.getByRole('searchbox').fill('');
      }
      await inbox.getByRole('button',{name:'Mark all read',exact:true}).click();
      await inbox.getByRole('heading',{name:'No unread updates',exact:true}).waitFor();
      await inbox.getByRole('button',{name:'View all updates',exact:true}).click();
      assert.equal(await inbox.locator('.notifications article').count(),12);
      const last=inbox.locator('.notifications article').last();await last.scrollIntoViewIfNeeded();
      if(role==='PASSENGER'){
        const card=await last.boundingBox(),nav=await page.locator('.bottom-nav').boundingBox();
        assert.ok(card.y+card.height<=nav.y-8,'Last notification must clear the bottom navigation');
      }
      if(width===1440){
        const heading=role==='PASSENGER'?'Your booking was updated':'New booking received';
        items.unshift({id:'arriving-notice',category:'BOOKING',title:heading,message:'Booking BKG-NEW: Calapan Port to Batangas Port.',createdAt:new Date().toISOString(),readAt:null,bookingReference:'BKG-NEW',sailingCode:'UI-TRIP'});
        await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
        await inbox.getByRole('heading',{name:heading,exact:true}).waitFor();
        assert.equal(await inbox.locator('.notifications article').count(),13,'The open inbox receives a newly polled notification');
        const bell=page.locator('[aria-label="Notifications, 1 unread"]').first();await bell.waitFor();
        await page.locator('.app-toast strong').filter({hasText:heading}).waitFor();
        if(role!=='PASSENGER'){
          const expected=role==='BOARDING'?'/staff/boarding/manifest?sailing=UI-TRIP':role==='ADMIN'?'/admin/bookings?search=BKG-NEW':'/staff/ticketing/bookings?search=BKG-NEW';
          assert.equal(await inbox.locator('.notifications article').first().locator('.notice-footer a').getAttribute('href'),expected);
        }
        await inbox.locator('.notifications article').first().scrollIntoViewIfNeeded();
        await page.screenshot({path:`.audit/notifications/${role}-live-update.png`});
      }
      assert.ok(operations.includes('MarkNotificationRead')&&operations.includes('MyMarkAllNotificationsRead'));
      assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.inboxCspErrors),[]);
      await context.close();
      console.log(`${role} ${width}px ${theme}: layout, category/unread filters, mark read/all, empty state, and CSP passed (mocked backend).`);
    }
  }
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
