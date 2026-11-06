import { Capacitor } from '@capacitor/core';
import type { SupabaseClient } from '@supabase/supabase-js';

const scheme = 'com.barkolink.app:';
export function authRedirect(path: '/login' | '/reset-password') {
  return Capacitor.isNativePlatform() ? `${scheme}//auth${path}` : `${location.origin}${path}`;
}

// Only the two app-owned auth destinations may supply a session.
export async function consumeAuthLink(raw: string, client: SupabaseClient): Promise<string | null> {
  const url = new URL(raw);
  if (
    url.protocol !== scheme ||
    url.hostname !== 'auth' ||
    !['/login', '/reset-password'].includes(url.pathname)
  )
    return null;
  const fragment = new URLSearchParams(url.hash.slice(1));
  if (fragment.has('error') || url.searchParams.has('error'))
    throw new Error('This email link has expired. Request a new link or use your email code.');
  const code = url.searchParams.get('code');
  if (code) {
    const existing = await client.auth.getSession();
    if (existing.error) throw existing.error;
    if (existing.data.session)
      throw new Error(
        'Log out before opening a new email verification link, or use your email code.',
      );
    const result = await client.auth.exchangeCodeForSession(code);
    if (result.error || !result.data.session)
      throw result.error || new Error('Could not verify this email link.');
    if (url.pathname === '/reset-password')
      sessionStorage.setItem(
        'barkolink-password-recovery',
        JSON.stringify({ uid: result.data.session.user.id, verifiedAt: Date.now() }),
      );
    return url.pathname;
  }
  // Native requests use PKCE. A different app cannot inject a bearer-token
  // session by opening our scheme; code exchange requires our local verifier.
  if (fragment.has('access_token') || fragment.has('refresh_token'))
    throw new Error('Request a new email link in this app, or use the email code.');
  return null;
}

export async function initializeAuthLinks(
  client: SupabaseClient,
  navigate: (path: string) => Promise<unknown>,
  onError: (message: string) => void,
) {
  if (!Capacitor.isNativePlatform()) return;
  const { App } = await import('@capacitor/app');
  let pending = Promise.resolve();
  let consumed: string | undefined;
  const consume = (url: string) => {
    pending = pending.then(async () => {
      if (url === consumed) return;
      try {
        const path = await consumeAuthLink(url, client);
        if (path) {
          consumed = url;
          await navigate(path);
        }
      } catch {
        onError(
          'Could not open the verification link. Check the account you are signed into, or request a new email code.',
        );
      }
    });
    return pending;
  };
  await App.addListener('appUrlOpen', (event) => {
    void consume(event.url);
  });
  const launch = await App.getLaunchUrl();
  if (launch?.url) await consume(launch.url);
}
