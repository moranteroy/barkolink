import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const project=fs.readFileSync('.env.local','utf8').match(/^VITE_SUPABASE_URL\s*=\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
const previewUrl=process.env.ASSISTANT_PREVIEW_URL || 'http://127.0.0.1:8100';
const id='11111111-1111-4111-8111-111111111111',user={id,email:'assistant@example.invalid',app_metadata:{role:'PASSENGER'},user_metadata:{fullName:'Chat Passenger'},aud:'authenticated',created_at:'2026-01-01T00:00:00Z'};
const exp=Math.floor(Date.now()/1000)+3600,encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const session={access_token:`${encode({alg:'HS256'})}.${encode({sub:id,exp,role:'authenticated',app_metadata:user.app_metadata})}.fixture`,refresh_token:'fixture',token_type:'bearer',expires_at:exp,expires_in:3600,user};
fs.mkdirSync('.audit/assistant',{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  for(const [width,theme] of [[320,'dark'],[390,'dark'],[1440,'dark'],[390,'light']]){
    const context=await browser.newContext({viewport:{width,height:850},reducedMotion:theme==='light'?'reduce':'no-preference'});
    await context.addInitScript(({project,session,theme})=>{localStorage.setItem(`sb-${new URL(project).hostname.split('.')[0]}-auth-token`,JSON.stringify(session));localStorage.setItem('barkolink-theme',theme);},{project,session,theme});
    let mode='ready';const questions=[];
    await context.route(`${project}/**`,async route=>{
      if(route.request().url().includes('/auth/'))return route.fulfill({json:user});
      const body=route.request().postDataJSON();
      if(route.request().url().includes('/functions/v1/chatbot')){
        await new Promise(resolve=>setTimeout(resolve,350));
        questions.push(body);if(mode==='failed')return route.fulfill({status:503,json:{error:'AI is temporarily unavailable. Subukan ulit.'}});
        if(mode==='pending')return route.fulfill({json:{configured:false,answer:'Hindi pa available ang AI assistant. Setup is pending.',sources:[],links:[{label:'Travel guide',path:'/help'}]}});
        const answer=body.message.startsWith('Is')?'Your booking is paid.':body.message.startsWith('Bayad')?'Bayad na ang booking mo.':'Paid na ang booking mo; MV Verified ang vessel.';
        return route.fulfill({json:{configured:true,answer:`${answer}\nOpen [My booking](/booking-details?reference=MY-BOOKING).`,sources:[{topic:'get_my_bookings',checkedAt:'2026-10-08T04:00:00Z',totalMatches:1,records:[{reference:'MY-BOOKING',paymentStatus:'PAID',vessel:'MV Verified',departureAt:'2099-10-08T04:00:00Z',total:600}]}],links:[{label:'Booking MY-BOOKING',path:'/booking-details?reference=MY-BOOKING'}]}});
      }
      return route.fulfill({json:body.operation==='MyProfile'?{user:{fullName:'Chat Passenger',role:'PASSENGER'}}:{notifications:[],advisories:[],bookings:[]}});
    });
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`${previewUrl}/assistant`,{waitUntil:'networkidle'});
    await page.getByRole('heading',{name:'Ahoy! How can I help?'}).waitFor();
    assert.equal(await page.locator('.assistant-intro .barko-mascot img').evaluate(img=>img.complete && img.naturalWidth===1024),true,'Welcome mascot must load.');
    assert.equal(await page.locator('.assistant-link .barko-mascot--portrait').count(),1,'Header shortcut must show the mascot.');
    assert.equal(await page.locator('.assistant-intro').evaluate(el=>el.scrollWidth>el.clientWidth+1),false,'Mascot introduction must fit the passenger canvas.');
    if(theme==='light')assert.equal(await page.locator('.intro-mascot').evaluate(el=>getComputedStyle(el).animationName),'none','Reduced motion must disable the greeting.');
    const shell=await page.locator('.assistant-page').boundingBox();
    assert.ok(Math.abs(shell.x-(width-shell.width)/2)<2,'Assistant must be centered in the passenger canvas.');
    assert.ok(shell.width<=560,'Assistant must use the shared compact passenger canvas.');
    await page.screenshot({path:`.audit/assistant/empty-${width}-${theme}.png`});
    await page.locator('.composer').scrollIntoViewIfNeeded();
    const compose=await page.locator('.composer').boundingBox(),nav=await page.locator('.bottom-nav').boundingBox();
    assert.ok(compose.y+compose.height<=nav.y-4,'Composer must clear the bottom navigation.');
    assert.equal(await page.locator('.composer button').evaluate(button=>{const rect=button.getBoundingClientRect();return document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)?.closest('button')===button;}),true,'Send button must not be covered.');
    let replyCount=0;
    for(const question of ['Is my booking paid?','Bayad na ba ang booking ko?','Paid na ba booking ko, tapos anong vessel?']){
      await page.locator('#chat-question').fill(question);await page.getByRole('button',{name:'Send question',exact:true}).click();
      await page.locator('.typing-dots').waitFor();
      assert.equal(await page.locator('.composer button').isDisabled(),true);
      await page.waitForFunction(count=>document.querySelectorAll('.chat-turn.assistant').length===count,++replyCount);
    }
    assert.equal(questions[2].history.length,4);assert.equal(questions[2].message,'Paid na ba booking ko, tapos anong vessel?');
    assert.match(await page.locator('.source-details').last().textContent(),/PAID/);
    assert.match(await page.locator('.source-details').last().textContent(),/MV Verified/);
    assert.equal(await page.locator('.message-body a').last().getAttribute('href'),'/booking-details?reference=MY-BOOKING');
    assert.equal(await page.locator('.composer').evaluate(el=>getComputedStyle(el).position),'relative','Composer must stay in flow so it cannot cover replies.');
    assert.ok(await page.locator('.composer').evaluate(el=>el.getBoundingClientRect().top>=document.querySelector('.conversation').getBoundingClientRect().bottom),'Composer must follow the conversation.');
    const turn=page.locator('.chat-turn.assistant').last();await turn.scrollIntoViewIfNeeded();await turn.screenshot({path:`.audit/assistant/answer-${width}.png`});
    assert.equal(await turn.locator('.barko-mascot--portrait img').evaluate(img=>img.complete && img.naturalWidth===1024),true,'Assistant reply mascot must load.');
    mode='failed';await page.locator('#chat-question').fill('Retry this question');await page.getByRole('button',{name:'Send question',exact:true}).click();
    await page.locator('.chat-error').waitFor();assert.equal(await page.locator('#chat-question').inputValue(),'Retry this question');
    mode='pending';await page.getByRole('button',{name:'Send question',exact:true}).click();await page.locator('.setup-note').waitFor();
    await page.locator('.composer').screenshot({path:`.audit/assistant/composer-${width}.png`});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.locator('.answer-links').last().getByRole('link',{name:'Travel guide'}).click();await page.waitForURL('**/help');
    const guide=page.locator('.mascot-guide').filter({visible:true});await guide.waitFor();
    assert.equal(await guide.locator('img').evaluate(img=>img.complete && img.naturalWidth===1024),true,'Help guide mascot must load.');
    assert.equal(await guide.evaluate(el=>el.scrollWidth>el.clientWidth+1),false,'Help guide must fit the passenger canvas.');
    await guide.screenshot({path:`.audit/assistant/mascot-help-${width}-${theme}.png`});
    await guide.click();await page.waitForURL('**/assistant');
    assert.equal(await page.locator('.chat-turn').count(),0);assert.deepEqual(errors,[]);
    await context.close();console.log(`Assistant ${width}px: multilingual input, context, source cards, failure recovery, setup state and conversation cleanup passed (mocked AI).`);
  }
}finally{await browser.close();}
