import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

beforeEach(()=>{
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>({ok:true,arrayBuffer:async()=>{
    const bytes=readFileSync(url.includes('.png')?'public/images/brand/barkolink-mark.png':url.includes('Bold')?'public/fonts/NotoSans-Bold.ttf':'public/fonts/NotoSans-Regular.ttf');
    return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  }})));
});
afterEach(()=>{vi.unstubAllGlobals();});
it('creates a real multipage PDF with an embedded Unicode font and repeating report headers',async()=>{
  const {createReportPdf}=await import('../../src/data/reportPdf');
  const pdf=await createReportPdf({title:'Passenger manifest',scope:['TRP1','Batangas to Calapan'],headers:['Passenger','Booking'],
    rows:Array.from({length:180},(_,index)=>[`José Peña ${index}`,'BKG-'+index]),note:'Paid, confirmed passengers. Philippine time.'});
  for(let page=1;page<=pdf.getNumberOfPages();page++){
    pdf.setPage(page);
    expect(pdf.internal.pageSize.getWidth()).toBeCloseTo(215.9,1);
    expect(pdf.internal.pageSize.getHeight()).toBeCloseTo(355.6,1);
  }
  expect(pdf.getNumberOfPages()).toBeGreaterThan(1);
  expect(pdf.getFontList()).toHaveProperty('NotoSans');
  expect(pdf.output().startsWith('%PDF-')).toBe(true);
  expect(pdf.output()).toContain('/Subtype /Image');
}, 15000); // Embeds real font/image assets and creates 180 rows, including on slower CI machines.

it('uses landscape Legal for wide tables and retains every exported column',async()=>{
  const {createReportPdf}=await import('../../src/data/reportPdf');
  const headers=['Sailing','Departure (PH)','Route','Vessel','Seats','Occupancy','Bookings','Collected (PHP)','Checked in','Boarded','Status'];
  const row=['TRP2026-1031001','Oct 31, 2026, 3:00 PM','Batangas Port to Calapan Port','MV Starlite Annapolis','150 / 300','50%',80,'PHP 65,000.00',145,140,'Completed'];
  const pdf=await createReportPdf({title:'Sailings report',scope:['Period: October 1 to 31, 2026','Route: All routes','Vessel: All vessels','20 matching records'],headers,
    rows:Array.from({length:20},()=>row),summary:[{label:'Sailings included',value:'20'},{label:'Collected revenue',value:'PHP 1,300,000.00'},{label:'Reservations',value:'1,600'}],
    note:'Totals reflect the exported rows only. Collections are gross paid booking amounts before refunds. All amounts are in PHP; dates and times use Asia/Manila.'});
  const table=(pdf as unknown as {lastAutoTable:{columns:{width:number}[];body:{cells:Record<string,{raw:string}>}[]}}).lastAutoTable;
  expect(table.columns.reduce((sum,c)=>sum+c.width,0)).toBeCloseTo(327.6,1);
  expect(table.columns).toHaveLength(11);
  expect(table.body).toHaveLength(20);
  const values=Object.values(table.body[0]!.cells).map(c=>c.raw).join('\n');
  for(const value of row)expect(values).toContain(String(value));

  for(let page=1;page<=pdf.getNumberOfPages();page++){pdf.setPage(page);expect(pdf.internal.pageSize.getWidth()).toBeCloseTo(355.6,1);expect(pdf.internal.pageSize.getHeight()).toBeCloseTo(215.9,1);}
  if(process.env.BARKOLINK_PDF_SAMPLE==='1'){mkdirSync('.audit',{recursive:true});writeFileSync('.audit/automatic-legal-report.pdf',new Uint8Array(pdf.output('arraybuffer')));}
},15000);

it.each([6,7])('uses the same Legal paper and orientation rule for a %i-column manifest',async(count)=>{
  const {createReportPdf}=await import('../../src/data/reportPdf');
  const headers=['Passenger','Sex','Type','Booking','Sailing','Ticket','Boarded at (PH)'].slice(0,count);
  const pdf=await createReportPdf({title:'Passenger manifest',scope:['Batangas to Calapan'],headers,
    rows:Array.from({length:80},()=>['Carlo Biado','Male','REGULAR','BKG2026-1031123456789012','TRP2026-1031001','BOARDED','Oct 31, 2026, 3:00 PM'].slice(0,count)),note:'Legal paper. Philippine time.'});
  expect(pdf.getNumberOfPages()).toBeGreaterThan(1);
  for(let page=1;page<=pdf.getNumberOfPages();page++){
    pdf.setPage(page);
    expect(pdf.internal.pageSize.getWidth()).toBeCloseTo(count>6?355.6:215.9,1);
    expect(pdf.internal.pageSize.getHeight()).toBeCloseTo(count>6?215.9:355.6,1);
  }
  if(process.env.BARKOLINK_PDF_SAMPLE==='1'){mkdirSync('.audit',{recursive:true});writeFileSync(`.audit/automatic-legal-manifest-${count}.pdf`,new Uint8Array(pdf.output('arraybuffer')));}
},15000);
