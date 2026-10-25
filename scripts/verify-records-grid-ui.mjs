import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright-core';

// Run against a local Vite dev server. This standalone grid makes no backend requests.
const baseUrl = process.env.BARKOLINK_UI_URL || 'http://127.0.0.1:8110';
const output = '.audit/records-grid-ui';
async function main() {
await fs.mkdir(output, { recursive: true });
await fs.writeFile(`${output}/fixture.html`, `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main id="app"></main><script type="module">
import {createApp,h,ref} from 'vue';
import RecordsGrid from '/src/components/shared/RecordsGrid.vue';
import '/src/theme/variables.css';
import '/src/theme/ui.css';
const rows=ref([
  {key:'a',cells:['Ana — Batangas to Calapan','PHP 1,200','Oct 25, 2026','Paid'],sortValues:['Ana',1200,Date.parse('2026-10-24T16:30:00Z')],source:{},statusIndex:3},
  {key:'b',cells:['Bea — Calapan to Batangas','PHP 300','Oct 24, 2026','Pending'],sortValues:['Bea',300,Date.parse('2026-10-24T15:30:00Z')],source:{},statusIndex:3},
  {key:'c',cells:['Carlos — a long passenger and route name for mobile wrapping','PHP 2,500','Oct 26, 2026','Archived'],sortValues:['Carlos',2500,Date.parse('2026-10-25T16:30:00Z')],source:{isActive:false},statusIndex:3}
]);
window.gridRows=rows;
createApp({render:()=>h(RecordsGrid,{title:'Fixture records',columns:['Passenger','Amount','Departure (PH)','Status'],columnTypes:['text','number','date','text'],rows:rows.value,density:'compact'}, {actions:({row})=>h('button',{'aria-label':'Review '+row.key,onClick:()=>{window.reviewed=row.key}},'Review')})}).mount('#app');
</script><style>body{margin:0;padding:16px;background:var(--cloud)}#app{max-width:1200px;margin:auto;background:var(--surface);border:1px solid var(--line);border-radius:12px}button{font:inherit}</style></body></html>`);

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
try {
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'America/Los_Angeles' });
    // Only the local fixture and Vite modules are reachable.
    await context.route('**/*', route => route.request().url().startsWith(baseUrl) ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (['warning', 'error'].includes(message.type()) && message.text().includes('AG Grid')) errors.push(message.text()); });
    await page.goto(`${baseUrl}/${output}/fixture.html`);
    await page.locator('.ag-row').first().waitFor();
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
    const grid = page.locator('.records-grid');
    const withApi = async (action, value) => grid.evaluate((el, {action,value}) => {
      let owner = el.__vueParentComponent;
      while (owner && !owner.exposed?.getApi) owner = owner.parent;
      const api = owner.exposed.getApi();
      if (action === 'filter') api.setFilterModel(value);
      if (action === 'prepare') { api.setColumnsVisible(['cell-3'], false); api.applyColumnState({state:[{colId:'cell-0',sort:'desc'}]}); }
      return { filters:api.getFilterModel(), columns:api.getColumnState().map(c=>({id:c.colId,hide:c.hide,sort:c.sort})), rows:api.getDisplayedRowCount() };
    }, {action,value});

    assert.equal(await page.getByText('Table help', {exact:true}).count(), 0);
    await withApi('filter', {'cell-1':{filterType:'number',type:'greaterThan',filter:1000}});
    await page.waitForFunction(() => document.querySelector('.grid-count')?.textContent.includes('2 of 3'));
    await withApi('filter', {'cell-2':{filterType:'date',type:'equals',dateFrom:'2026-10-25 00:00:00'}});
    assert.equal((await withApi('read')).rows,1,'Dates filter by Philippine calendar day on an overseas browser');
    await withApi('prepare');
    await withApi('filter', {'cell-0':{filterType:'text',type:'contains',filter:'NO MATCH'}});
    const saved = await withApi('read');
    for (const width of [768,700,699,390,320,700,1440]) {
      await page.setViewportSize({width,height:900});
      await page.waitForTimeout(100);
      assert.deepEqual(await withApi('read'),saved,`Filter, sort and columns survive ${width}px`);
      if (width < 700) {
        assert.equal(await page.locator('.mobile-record').count(),0);
        await page.getByText('No records on this page match your column filters.').waitFor();
        assert.equal(await page.locator('.desktop-grid').isVisible(),false);
      }
      assert.equal(await grid.evaluate(el=>el.scrollWidth>el.clientWidth+2),false,`Grid container at ${width}px`);
    }
    await page.getByRole('button',{name:'Clear filters'}).click();
    assert.equal((await withApi('read')).rows,3);
    await page.setViewportSize({width:390,height:844});
    await page.locator('.mobile-record').first().waitFor();
    assert.equal(await page.locator('.mobile-record').count(),3);
    await page.locator('.mobile-sort select').selectOption('1:asc');
    assert.match(await page.locator('.mobile-record').first().innerText(),/Bea/,'Mobile numeric sorting uses raw amounts');
    await page.getByRole('button',{name:'Review b',exact:true}).click();
    assert.equal(await page.evaluate(()=>window.reviewed),'b');
    await page.getByRole('button',{name:'Columns',exact:true}).click();
    await page.getByRole('menuitemcheckbox',{name:'Amount',exact:true}).click();
    await page.keyboard.press('Escape');
    assert.equal((await withApi('read')).columns.find(c=>c.id==='cell-1').hide,true);
    await page.getByRole('button',{name:'Reset table',exact:true}).click();
    assert.ok((await withApi('read')).columns.every(c=>!c.hide && !c.sort),'Mobile reset restores column/sort state');
    await page.evaluate(()=>{window.gridRows.value=[{key:'page-2',cells:['Next server page',700,'Oct 25, 2026','Paid'],sortValues:['Next',700,Date.parse('2026-10-24T16:30:00Z')],source:{}}];});
    await page.waitForFunction(()=>document.querySelectorAll('.mobile-record').length===1);
    assert.match(await page.locator('.mobile-record').innerText(),/Next server page/,'Loaded page replacement updates cards');
    await page.evaluate(()=>{window.gridRows.value=[];});
    await page.getByText('No matching records.',{exact:true}).filter({visible:true}).first().waitFor();
    await page.screenshot({path:`${output}/${theme}-empty-mobile.png`});
    await context.close();
    console.log(`${theme}: typed filters, Philippine dates, responsive state, mobile actions/sort/columns/reset, and changed data passed`);
  }
  assert.deepEqual(errors,[],'No page or AG Grid errors');
} catch (error) {
  const page = browser.contexts()[0]?.pages()[0];
  if (page) {
    await page.screenshot({path:`${output}/failure.png`});
    console.error(await page.locator('.records-grid').evaluate(el=>[...el.querySelectorAll('*')].filter(child=>child.getClientRects().length && child.getBoundingClientRect().right>el.getBoundingClientRect().right+2).slice(0,10).map(child=>({tag:child.tagName,class:child.className,width:child.getBoundingClientRect().width}))));
  }
  throw error;
} finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
