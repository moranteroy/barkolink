import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
const state = vi.hoisted(() => ({ native: false }));
const app = vi.hoisted(() => ({ addListener: vi.fn(), getLaunchUrl: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => state.native } }));
vi.mock('@capacitor/app', () => ({ App: app }));
import { authRedirect, consumeAuthLink, initializeAuthLinks } from '../../src/services/authLinks';
const auth = {
  getSession: vi.fn(),
  getUser: vi.fn(),
  setSession: vi.fn(),
  exchangeCodeForSession: vi.fn(),
};
const client = { auth } as unknown as SupabaseClient;
beforeEach(() => {
  vi.resetAllMocks();
  state.native = false;
  sessionStorage.clear();
  auth.getSession.mockResolvedValue({ data: { session: null } });
  auth.getUser.mockResolvedValue({ data: { user: { id: 'owner' } } });
  auth.setSession.mockResolvedValue({ data: { session: { user: { id: 'owner' } } } });
  auth.exchangeCodeForSession.mockResolvedValue({ data: { session: { user: { id: 'owner' } } } });
});
describe('email auth destinations', () => {
  it('handles cold-start and running-app callbacks once without changing web startup', async () => {
    const navigate = vi.fn(),
      error = vi.fn();
    await initializeAuthLinks(client, navigate, error);
    expect(app.addListener).not.toHaveBeenCalled();
    state.native = true;
    const url = 'com.barkolink.app://auth/reset-password?code=cold-start';
    app.getLaunchUrl.mockResolvedValue({ url });
    await initializeAuthLinks(client, navigate, error);
    expect(navigate).toHaveBeenCalledWith('/reset-password');
    const listener = app.addListener.mock.calls[0][1];
    listener({ url });
    await vi.waitFor(() => expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1));
    listener({ url: 'com.barkolink.app://auth/login?code=warm-start' });
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/login'));
    expect(error).not.toHaveBeenCalled();
  });
  it('keeps web redirects and uses an app-owned native callback', () => {
    expect(authRedirect('/login')).toBe(location.origin + '/login');
    state.native = true;
    expect(authRedirect('/reset-password')).toBe('com.barkolink.app://auth/reset-password');
  });
  it('rejects unrelated schemes, hosts and routes before touching sessions', async () => {
    for (const url of [
      'https://evil.invalid/login#access_token=x',
      'com.barkolink.app://other/login',
      'com.barkolink.app://auth/admin',
    ])
      expect(await consumeAuthLink(url, client)).toBeNull();
    expect(auth.setSession).not.toHaveBeenCalled();
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
  it('exchanges the PKCE code and grants recovery only after a successful session', async () => {
    expect(
      await consumeAuthLink('com.barkolink.app://auth/reset-password?code=verified', client),
    ).toBe('/reset-password');
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('verified');
    expect(JSON.parse(sessionStorage.getItem('barkolink-password-recovery')!).uid).toBe('owner');
  });
  it('does not grant recovery for an expired code or overwrite an existing account', async () => {
    auth.exchangeCodeForSession.mockResolvedValue({
      error: new Error('Expired'),
      data: { session: null },
    });
    await expect(
      consumeAuthLink('com.barkolink.app://auth/reset-password?code=expired', client),
    ).rejects.toThrow('Expired');
    expect(sessionStorage.getItem('barkolink-password-recovery')).toBeNull();
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'another' } } } });
    await expect(
      consumeAuthLink('com.barkolink.app://auth/login?code=new', client),
    ).rejects.toThrow('Log out');
    expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });
  it('rejects injected bearer-token links rather than skipping PKCE verification', async () => {
    await expect(
      consumeAuthLink('com.barkolink.app://auth/login#access_token=a&refresh_token=r', client),
    ).rejects.toThrow('new email link');
    expect(auth.setSession).not.toHaveBeenCalled();
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});
