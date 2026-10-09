import fs from 'node:fs';

function env(path) {
  return Object.fromEntries(fs.readFileSync(path, 'utf8').split(/\r?\n/)
    .filter(line => /^\w+\s*=/.test(line))
    .map(line => { const at = line.indexOf('='); return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '')]; }));
}
const frontend = env('.env.local');
const credentials = env('.env.supabase-management');
const projectUrl = new URL(frontend.VITE_SUPABASE_URL);
if (!/^[a-z0-9]+\.supabase\.co$/.test(projectUrl.hostname)) throw new Error('Expected a hosted Supabase project URL.');
const project = projectUrl.hostname.split('.')[0];
if (!credentials.SUPABASE_ACCESS_TOKEN) throw new Error('Supabase management access is not configured.');
const templates = {
  mailer_subjects_confirmation: 'Your BarkoLink verification code',
  mailer_templates_confirmation_content: '<h2>Verify your BarkoLink email</h2><p>Enter this code in BarkoLink to confirm your email:</p><p style="font-size:32px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p><p>If you did not create an account, ignore this email.</p>',
  mailer_subjects_recovery: 'Your BarkoLink password reset code',
  mailer_templates_recovery_content: '<h2>Reset your BarkoLink password</h2><p>Enter this code in BarkoLink to verify your password reset request:</p><p style="font-size:32px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p><p>If you did not request a password reset, ignore this email.</p>',
};
async function request(method = 'GET', body) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${project}/config/auth`, {
    method,
    headers: { Authorization: `Bearer ${credentials.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Supabase auth configuration request failed (${response.status}); response omitted to protect credentials.`);
  return response.json();
}
const before = await request();
if (process.argv.includes('--apply')) {
  // Back up only the four public template fields; never write SMTP credentials.
  fs.mkdirSync('.backups', { recursive: true });
  const backup = `.backups/email-otp-${Date.now()}.json`;
  fs.writeFileSync(backup, JSON.stringify({ project, templates: Object.fromEntries(Object.keys(templates).map(key => [key, before[key]])) }, null, 2));
  await request('PATCH', templates);
}
const after = process.argv.includes('--apply') ? await request() : before;
const matches = Object.keys(templates).every(key => after[key] === templates[key]);
console.log(JSON.stringify({
  project, applied: process.argv.includes('--apply'), templatesMatch: matches,
  signupCodeEnabled: after.mailer_templates_confirmation_content?.includes('{{ .Token }}') === true,
  recoveryCodeEnabled: after.mailer_templates_recovery_content?.includes('{{ .Token }}') === true,
  emailConfirmationRequired: after.mailer_autoconfirm === false,
  customSmtpConfigured: Boolean(after.smtp_host && after.smtp_user && after.smtp_admin_email),
}));
if (process.argv.includes('--apply') && !matches) throw new Error('Template verification did not match the requested values.');
