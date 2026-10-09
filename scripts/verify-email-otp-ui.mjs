import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const browser = await chromium.launch({channel:'msedge',headless:true});
try {
 for(const width of [1240,390]) {
  const context = await browser.newContext({viewport:{width,height:800}});
  await context.route('**/*.supabase.co/**', route => {
   const url=route.request().url();
   if(url.includes('/auth/v1/signup')) return route.fulfill({json:{user:{id:'11111111-1111-4111-8111-111111111111',email:'otp@example.invalid',identities:[{provider:'email'}],app_metadata:{},user_metadata:{fullName:'OTP Test'}},session:null}});
   if(url.includes('/auth/v1/token')) return route.fulfill({status:400,json:{code:'email_not_confirmed',error_code:'email_not_confirmed',message:'Email not confirmed'}});
   if(url.includes('/auth/v1/resend')) return route.fulfill({json:{}});
   if(url.includes('/auth/v1/verify')) return route.fulfill({status:403,json:{code:'otp_expired',message:'Token has expired or is invalid'}});
   return route.fulfill({status:401,json:{message:'Mocked UI check'}});
  });
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:8110/register');
  await page.locator('#full-name').fill('OTP Test');
  await page.locator('#email').fill('otp@example.invalid');
  await page.locator('#password').fill('TestPassword123!');
  await page.locator('#confirm-password').fill('TestPassword123!');
  await page.locator('#terms').check();
  await page.getByRole('button',{name:'Create account',exact:true}).click();
  await page.waitForURL(url=>url.pathname==='/verify-email');
  await page.locator('#email-code').waitFor();
  assert.ok((await page.locator('.verification-card').innerText()).includes('otp@example.invalid'));
  await page.locator('#email-code').fill('123456');
  await page.getByRole('button',{name:'Verify code',exact:true}).click();
  await page.getByRole('alert').filter({visible:true}).waitFor();
  assert.equal(new URL(page.url()).pathname,'/verify-email');
  await page.reload();
  await page.locator('#email-code').waitFor();
  assert.equal(new URL(page.url()).pathname,'/verify-email');
  await page.goto('http://127.0.0.1:8110/login');
  await page.locator('#email').fill('otp@example.invalid');
  await page.locator('#password').fill('TestPassword123!');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.waitForURL(url=>url.pathname==='/verify-email');
  await page.locator('#email-code').waitFor();
  console.log(`Guest signup goes directly to OTP, reload stays public, invalid code stays on OTP, unconfirmed login resends and opens OTP: ${width}px`);
  await context.close();
 }
} finally {await browser.close();}