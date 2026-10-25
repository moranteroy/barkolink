import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(()=>{vi.unstubAllGlobals();});
it('creates a real multipage PDF with an embedded Unicode font and repeating report headers',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>({ok:true,arrayBuffer:async()=>{
    const bytes=readFileSync(url.includes('.png')?'public/images/brand/barkolink-mark.png':url.includes('Bold')?'public/fonts/NotoSans-Bold.ttf':'public/fonts/NotoSans-Regular.ttf');
    return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  }})));
  const {createReportPdf}=await import('../../src/data/reportPdf');
  const pdf=await createReportPdf({title:'Passenger manifest',scope:['TRP1','Batangas to Calapan'],headers:['Passenger','Booking'],
    rows:Array.from({length:180},(_,index)=>[`José Peña ${index}`,'BKG-'+index]),note:'Paid, confirmed passengers. Philippine time.'});
  expect(pdf.getNumberOfPages()).toBeGreaterThan(1);
  expect(pdf.getFontList()).toHaveProperty('NotoSans');
  expect(pdf.output().startsWith('%PDF-')).toBe(true);
  expect(pdf.output()).toContain('/Subtype /Image');
}, 15000); // Embeds real font/image assets and creates 180 rows, including on slower CI machines.
