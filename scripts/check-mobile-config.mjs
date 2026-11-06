// Vite embeds these public values in the APK. Never supply a service-role key.
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key)
  throw new Error(
    'Configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) in GitHub Actions secrets.',
  );
if (new URL(url).protocol !== 'https:') throw new Error('The APK requires an HTTPS Supabase URL.');
if (key.startsWith('sb_secret_'))
  throw new Error('A secret Supabase key must never be embedded in the APK.');
if (!key.startsWith('sb_publishable_')) {
  let role;
  try {
    role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role;
  } catch {
    throw new Error('Use a Supabase publishable key or legacy anon key.');
  }
  if (role !== 'anon')
    throw new Error('Only a publishable key or anon key may be embedded in the APK.');
}
console.log('Public Supabase configuration is ready for the Android build.');
