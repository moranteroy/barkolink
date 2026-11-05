import fs from 'node:fs';
// Reuse the full QR decoding fixture, adding narrow-screen and enlarged-text toolbar checks.
let source=fs.readFileSync('scripts/verify-ticket-qr-ui.mjs','utf8')
 .replace("from './boarding-timing-fixture.mjs'","from '../../scripts/boarding-timing-fixture.mjs'")
 .replace("from './browser-fixture-config.mjs'","from '../../scripts/browser-fixture-config.mjs'")
 .replace('for(const width of [390,1440])','for(const width of [320,360,390,430,560])')
 .replace("for(const role of ['PASSENGER','BOARDING'])","for(const role of ['PASSENGER'])")
 .replace("await context.addInitScript(({project,session})=>{", "await context.addInitScript(()=>{window.print=()=>{window.__ticketPrinted=true;};});await context.addInitScript(({project,session})=>{")
 .replace("await qr.scrollIntoViewIfNeeded();await page.locator('.ticket').screenshot",`const toolbar=page.locator('.ticket-actions');
        for(const scale of [1,1.5]){
          await toolbar.locator('button').evaluateAll((nodes,scale)=>nodes.forEach(el=>el.style.fontSize=(12*scale)+'px'),scale);
          const boxes=await toolbar.locator('button').evaluateAll(nodes=>nodes.map(el=>{const b=el.getBoundingClientRect();return {top:b.top,height:b.height,width:b.width,scroll:el.scrollWidth,client:el.clientWidth};}));
          assert.equal(boxes.length,3);assert.ok(Math.max(...boxes.map(b=>b.top))-Math.min(...boxes.map(b=>b.top))<1,'Action tops align');
          assert.ok(Math.max(...boxes.map(b=>b.height))-Math.min(...boxes.map(b=>b.height))<1,'Action heights match');
          assert.ok(boxes.every(b=>b.height>=44&&b.scroll<=b.client+1),'Labels fit accessible action buttons');
          await page.locator('ion-content').evaluate(async el=>{const scroll=await el.getScrollElement();scroll.scrollTop=0;});
          await page.screenshot({path:'.audit/mobile-ticket-actions/toolbar-'+width+'-'+scale+'.png'});
        }
        const [printed]=await Promise.all([page.waitForEvent('popup'),toolbar.getByRole('button',{name:'Print/PDF',exact:true}).click()]);
        await printed.waitForFunction(()=>window.__ticketPrinted===true);
        await printed.emulateMedia({media:'print'});
        assert.equal(await printed.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
        assert.match(await printed.locator('body').textContent(),/QR-BOOKING/);
        assert.equal(await printed.locator('ion-tab-bar').count(),0);
        const printQr=await printed.locator('img').first().evaluate(img=>{const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);return {width:canvas.width,height:canvas.height,data:Array.from(ctx.getImageData(0,0,canvas.width,canvas.height).data)};});
        assert.equal(jsQR(new Uint8ClampedArray(printQr.data),printQr.width,printQr.height)?.data,payload);
        await printed.screenshot({path:'.audit/mobile-ticket-actions/print-'+width+'.png',fullPage:true});
        await printed.close();
        await qr.scrollIntoViewIfNeeded();await page.locator('.ticket').screenshot`);
fs.mkdirSync('.audit/mobile-ticket-actions',{recursive:true});
fs.writeFileSync('.audit/mobile-ticket-actions/run.mjs',source);
await import('../.audit/mobile-ticket-actions/run.mjs');
