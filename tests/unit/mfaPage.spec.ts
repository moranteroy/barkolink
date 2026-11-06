import { beforeEach, describe, it, expect, vi, onTestFinished } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import MfaPage from '../../src/views/auth/MfaPage.vue';
const mocks = vi.hoisted(() => ({
  listFactors: vi.fn(),
  enroll: vi.fn(),
  unenroll: vi.fn(),
  challengeAndVerify: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
  replace: vi.fn(),
  activate: vi.fn(),
  query: {} as Record<string, string>,
}));
vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useRoute: () => ({ query: mocks.query }),
}));
vi.mock('@ionic/vue', () => ({
  IonPage: { template: '<div><slot /></div>' },
  IonContent: { template: '<div><slot /></div>' },
  onIonViewWillEnter: (callback: () => void) => callback(),
  onIonViewDidLeave: vi.fn(),
}));
vi.mock('../../src/services/mfaSecurity', () => ({
  activateAccountMfaAfterVerification: mocks.activate,
}));
vi.mock('../../src/services/supabase', () => ({
  requireSupabase: () => ({ auth: { mfa: mocks, getUser: mocks.getUser, signOut: mocks.signOut } }),
}));
describe('Account authenticator verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.activate.mockResolvedValue({});
    mocks.query = {};
    mocks.listFactors.mockResolvedValue({
      data: { totp: [{ id: 'verified', status: 'verified' }], all: [] },
      error: null,
    });
    mocks.challengeAndVerify.mockResolvedValue({ error: null });
    mocks.getUser.mockResolvedValue({
      data: { user: { app_metadata: { role: 'TICKETING' } } },
      error: null,
    });
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.unenroll.mockResolvedValue({ error: null });
    mocks.enroll.mockResolvedValue({
      data: {
        id: 'new-factor',
        totp: {
          qr_code: '<svg></svg>',
          secret: 'test-setup-key',
          uri: 'otpauth://totp/BarkoLink:test?secret=JBSWY3DPEHPK3PXP&issuer=BarkoLink',
        },
      },
      error: null,
    });
  });
  it('challenges an existing verified factor and enters the assigned workspace', async () => {
    const wrapper = mount(MfaPage);
    onTestFinished(() => wrapper.unmount());
    await flushPromises();
    expect(mocks.enroll).not.toHaveBeenCalled();
    await wrapper.get('input').setValue('123456');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(mocks.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'verified', code: '123456' });
    expect(mocks.replace).toHaveBeenCalledWith('/staff/ticketing');
  });
  it('enrolls first-time staff, removes only unfinished factors and clears the setup secret on success', async () => {
    mocks.listFactors.mockResolvedValue({
      data: { totp: [], all: [{ id: 'unfinished', status: 'unverified', factor_type: 'totp' }] },
      error: null,
    });
    const wrapper = mount(MfaPage);
    onTestFinished(() => wrapper.unmount());
    await flushPromises();
    expect(mocks.unenroll).toHaveBeenCalledWith({ factorId: 'unfinished' });
    expect(wrapper.get('img[alt="Authenticator setup QR code"]').attributes('src')).toMatch(
      /^data:image\/svg\+xml/,
    );
    expect(wrapper.text()).toContain('test-setup-key');
    await wrapper.get('input').setValue('123456');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).not.toContain('test-setup-key');
    expect(wrapper.find('img[alt="Authenticator setup QR code"]').exists()).toBe(false);
  });
  it('keeps invalid or rejected codes outside the workspace', async () => {
    const wrapper = mount(MfaPage);
    onTestFinished(() => wrapper.unmount());
    await flushPromises();
    await wrapper.get('input').setValue('12');
    await wrapper.get('form').trigger('submit');
    expect(mocks.challengeAndVerify).not.toHaveBeenCalled();
    mocks.challengeAndVerify.mockResolvedValue({ error: { message: 'invalid' } });
    await wrapper.get('input').setValue('123456');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(wrapper.get('[role="alert"]').text()).toContain('Could not verify');
  });
  it.each([
    ['ADMIN', 'admin', '/admin'],
    ['BOARDING', 'boarding staff', '/staff/boarding'],
    ['TICKETING', 'ticketing staff', '/staff/ticketing'],
  ])(
    'shows the trusted %s role and continues to its own workspace',
    async (role, label, destination) => {
      mocks.getUser.mockResolvedValue({
        data: { user: { app_metadata: { role }, user_metadata: { role: 'ADMIN' } } },
        error: null,
      });
      const wrapper = mount(MfaPage);
      onTestFinished(() => wrapper.unmount());
      await flushPromises();
      expect(wrapper.get('h1').text()).toBe(`Verify ${label} access`);
      expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined();
      await wrapper.get('input').setValue('123456');
      expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined();
      await wrapper.get('form').trigger('submit');
      await flushPromises();
      expect(mocks.replace).toHaveBeenCalledWith(destination);
    },
  );
  it('labels first-time boarding setup correctly and accepts only digits', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { app_metadata: { role: 'BOARDING' } } },
      error: null,
    });
    mocks.listFactors.mockResolvedValue({ data: { totp: [], all: [] }, error: null });
    const wrapper = mount(MfaPage);
    onTestFinished(() => wrapper.unmount());
    await flushPromises();
    expect(wrapper.get('h1').text()).toBe('Set up boarding staff verification');
    await wrapper.get('input').setValue('12a3456');
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('123456');
  });
  it('does not enroll or verify when the account role cannot be checked', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'expired' } });
    const wrapper = mount(MfaPage);
    onTestFinished(() => wrapper.unmount());
    await flushPromises();
    expect(mocks.listFactors).not.toHaveBeenCalled();
    expect(mocks.enroll).not.toHaveBeenCalled();
    await wrapper.get('form').trigger('submit');
    expect(mocks.challengeAndVerify).not.toHaveBeenCalled();
    expect(wrapper.get('[role="alert"]').text()).toContain('Could not load');
  });
  it('returns passenger accounts to home without enrolling a staff factor', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { app_metadata: { role: 'PASSENGER' } } },
      error: null,
    });
    const wrapper = mount(MfaPage);
    onTestFinished(() => wrapper.unmount());
    await flushPromises();
    expect(mocks.replace).toHaveBeenCalledWith('/home');
    expect(mocks.enroll).not.toHaveBeenCalled();
  });
  it('generates a sharp QR from the enrollment URI rather than the SDK preview image', async () => {
    mocks.listFactors.mockResolvedValue({ data: { totp: [], all: [] }, error: null });
    const uri = 'otpauth://totp/BarkoLink:test?secret=JBSWY3DPEHPK3PXP&issuer=BarkoLink';
    mocks.enroll.mockResolvedValue({
      data: { id: 'new-factor', totp: { qr_code: 'broken SDK preview', secret: 'test-key', uri } },
      error: null,
    });
    const wrapper = mount(MfaPage);
    onTestFinished(() => wrapper.unmount());
    await flushPromises();
    const img = wrapper.get('img[alt="Authenticator setup QR code"]');
    expect(img.attributes('src')).toMatch(/^data:image\/svg\+xml;charset=utf-8,%3Csvg/);
    expect(Number(img.attributes('width'))).toBeGreaterThanOrEqual(240);
    expect(wrapper.text()).toContain('Time-based');
  });
  it('returns optional setup to its own security page and refuses an external return target', async () => {
    mocks.query = { returnTo: '/staff/ticketing/settings/security' };
    const wrapper = mount(MfaPage);
    onTestFinished(() => wrapper.unmount());
    await flushPromises();
    await wrapper.get('input').setValue('123456');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(mocks.replace).toHaveBeenLastCalledWith('/staff/ticketing/settings/security');
    mocks.query = { returnTo: 'https://example.invalid' };
    const other = mount(MfaPage);
    onTestFinished(() => other.unmount());
    await flushPromises();
    await other.get('input').setValue('123456');
    await other.get('form').trigger('submit');
    await flushPromises();
    expect(mocks.replace).toHaveBeenLastCalledWith('/staff/ticketing');
  });
  it('cancels an unfinished optional enrollment without removing verified factors', async () => {
    mocks.query = { returnTo: '/staff/ticketing/settings/security' };
    mocks.listFactors.mockResolvedValue({ data: { totp: [], all: [] }, error: null });
    const wrapper = mount(MfaPage);
    onTestFinished(() => wrapper.unmount());
    await flushPromises();
    const back = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Back to security settings');
    await back!.trigger('click');
    await flushPromises();
    expect(mocks.unenroll).toHaveBeenCalledExactlyOnceWith({ factorId: 'new-factor' });
    expect(mocks.replace).toHaveBeenCalledWith('/staff/ticketing/settings/security');
  });
});
