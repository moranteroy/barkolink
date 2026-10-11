import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

// Derive web and Android artwork from the same source used by BrandMark.
const root = fileURLToPath(new URL('../', import.meta.url));
const svg = await fs.readFile(path.join(root, 'public/images/brand/barkolink-mark.svg'), 'utf8');
const res = path.join(root, 'android/app/src/main/res');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
async function render(target, width, height, kind = 'mark') {
  const size = kind === 'splash' ? Math.round(Math.min(width, height) * .23)
    : kind === 'foreground' ? Math.round(width * .6) : width;
  await page.setViewportSize({ width, height });
  await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;}body{display:flex;align-items:center;justify-content:center;background:${kind === 'splash' ? '#f5f7fa' : 'transparent'};}svg{width:${size}px;height:${size}px;}</style>${svg}`);
  await page.screenshot({ path: target, omitBackground: kind !== 'splash' });
}
try {
  await render(path.join(root, 'public/favicon.png'), 64, 64);
  await render(path.join(root, 'public/apple-touch-icon.png'), 180, 180);
  let count = 2;
  for (const entry of await fs.readdir(res, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const name of await fs.readdir(path.join(res, entry.name))) {
      if (!/^(ic_launcher(?:_round|_foreground)?|splash)\.png$/.test(name)) continue;
      const target = path.join(res, entry.name, name);
      const png = await fs.readFile(target);
      const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
      await render(target, width, height, name === 'splash.png' ? 'splash' : name.includes('foreground') ? 'foreground' : 'mark');
      count++;
    }
  }
  console.log(`Generated ${count} branding assets from barkolink-mark.svg.`);
} finally { await browser.close(); }
