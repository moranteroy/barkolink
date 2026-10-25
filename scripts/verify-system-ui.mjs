import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

// Reviewed fixture-only browser checks. Never run live-data setup/reset scripts here.
const checks = [
  'verify-workspace-density', 'verify-experience-ui', 'verify-records-grid-ui',
  'verify-reservation-payment-flow', 'verify-payment-ui', 'verify-ticket-qr-ui',
  'verify-staff-port-access-ui', 'verify-browser-session-ui',
  'verify-port-display-ui', 'verify-security-browser', 'verify-role-navigation-ui',
];
const selected = process.argv.slice(2);
if (selected.some(name => !checks.includes(name))) throw new Error('Choose one of the reviewed fixture-only browser checks.');
const output = '.audit/system-ui';
fs.mkdirSync(output, { recursive: true });
const scheduled = selected.length ? selected : checks;
const resultsPath = path.join(output, 'results.json');
const results = fs.existsSync(resultsPath) ? JSON.parse(fs.readFileSync(resultsPath,'utf8')).filter(result => !scheduled.includes(result.name)) : [];
for (const name of scheduled) {
  const started = Date.now();
  const logPath = path.join(output, `${name}.log`);
  const log = fs.openSync(logPath, 'w');
  console.log(`START ${name}`);
  const result = await new Promise(resolve => {
    const child = spawn(process.execPath, [`scripts/${name}.mjs`], {
      env: { ...process.env, BARKOLINK_UI_URL: process.env.BARKOLINK_UI_URL || 'http://127.0.0.1:8127' },
      stdio: ['ignore', log, log], windowsHide: true,
    });
    let timeout = false;
    const timer = setTimeout(() => { timeout = true;child.kill(); }, 600000);
    child.on('error', error => { clearTimeout(timer);resolve({ passed: false, error: error.code }); });
    child.on('exit', code => { clearTimeout(timer);resolve({ passed: code === 0 && !timeout, code, timeout }); });
  });
  fs.closeSync(log);
  const receipt = { name, ...result, seconds: Math.round((Date.now() - started) / 1000), log: logPath };
  results.push(receipt);
  fs.writeFileSync(path.join(output, `${name}.json`),JSON.stringify(receipt,null,2));
  // A focused rerun must not overwrite results completed by another audit process.
  const latest = fs.existsSync(resultsPath) ? JSON.parse(fs.readFileSync(resultsPath,'utf8')) : [];
  fs.writeFileSync(resultsPath, JSON.stringify([...latest.filter(item => item.name !== name),receipt], null, 2));
  console.log(`${result.passed ? 'PASS' : 'FAIL'} ${name} (${results.at(-1).seconds}s); ${logPath}`);
}
const completed = results.filter(result => scheduled.includes(result.name));
console.log(`${completed.filter(result => result.passed).length}/${completed.length} selected browser checks passed.`);
if (completed.some(result => !result.passed)) process.exitCode = 1;
