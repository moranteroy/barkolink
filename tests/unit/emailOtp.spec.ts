import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import VerifyEmailPage from '../../src/views/auth/VerifyEmailPage.vue';
import ResetPasswordPage from '../../src/views/auth/ResetPasswordPage.vue';
const mocks = vi.hoisted(() => ({
  route: { query: { purpose: 'recovery' } }, replace: vi.fn(), verify: vi.fn(), resend: vi.fn(),
  getUser: vi.fn(), getSession: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(),
}));
vi.mock('vue-router', () => ({ useRoute: () => mocks.route, useRouter: () => ({ replace: mocks.replace }), RouterLink: { template: '<a><slot /></a>' } }));
vi.mock('@ionic/vue', () => ({
  IonPage: { template: '<div><slot /></div>' }, IonContent: { template: '<div><slot /></div>' }, IonButton: { template: '<button><slot /></button>' }, IonIcon: { template: '<span />' },
  onIonViewWillEnter: (callback: () => void) => callback(),
}));
vi.mock('../../src/services/auth', () => ({ verifyEmailCode: mocks.verify, resendEmailCode: mocks.resend, signOut: vi.fn(), requireAuth: () => ({ currentUser: null }) }));
vi.mock('../../src/services/session', () => ({ database: {} }));
vi.mock('../../src/services/database/passenger', () => ({ myProfile: vi.fn(), createMyProfile: vi.fn() }));
vi.mock('../../src/services/supabase', () => ({ requireSupabase: () => ({ auth: { getUser: mocks.getUser, getSession: mocks.getSession, updateUser: mocks.updateUser, signOut: mocks.signOut } }) }));
describe('Email code verification and password recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks(); sessionStorage.clear();
    sessionStorage.setItem('barkolink-pending-email', JSON.stringify({ email: 'test@example.invalid', purpose: 'recovery' }));
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    mocks.updateUser.mockResolvedValue({ error: null }); mocks.signOut.mockResolvedValue({ error: null });
  });
  it('keeps invalid codes on the verification page and applies resend cooldown', async () => {
    mocks.verify.mockRejectedValue(new Error('Expired'));
    const wrapper = mount(VerifyEmailPage);
    expect(wrapper.get('.resend button').attributes('disabled')).toBeDefined();
    await wrapper.get('input').setValue('123456');
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('invalid or expired');
    expect(mocks.replace).not.toHaveBeenCalled(); wrapper.unmount();
  });
  it('opens password reset only after recovery code verification', async () => {
    mocks.verify.mockResolvedValue({ user: { uid: 'u1' } });
    const wrapper = mount(VerifyEmailPage);
    await wrapper.get('input').setValue('123456');
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(mocks.verify).toHaveBeenCalledWith('test@example.invalid', '123456', 'recovery');
    expect(mocks.replace).toHaveBeenCalledWith('/reset-password'); wrapper.unmount();
  });
  it('blocks a normal signed-in session from the recovery form', async () => {
    const wrapper = mount(ResetPasswordPage); await flushPromises();
    expect(wrapper.get('button').attributes('disabled')).toBeDefined();
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(mocks.updateUser).not.toHaveBeenCalled(); wrapper.unmount();
  });
  it('rejects expired or mismatched recovery verification', async () => {
    for (const marker of [{ uid: 'u1', verifiedAt: Date.now() - 16 * 60 * 1000 }, { uid: 'other', verifiedAt: Date.now() }]) {
      sessionStorage.setItem('barkolink-password-recovery', JSON.stringify(marker));
      const wrapper = mount(ResetPasswordPage); await flushPromises();
      expect(wrapper.get('button').attributes('disabled')).toBeDefined(); wrapper.unmount();
    }
  });
  it('updates the password and clears recovery access after a verified reset', async () => {
    sessionStorage.setItem('barkolink-password-recovery', JSON.stringify({ uid: 'u1', verifiedAt: Date.now() }));
    const wrapper = mount(ResetPasswordPage); await flushPromises();
    const inputs = wrapper.findAll('input:not([type="checkbox"])');
    await inputs[0].setValue('NewPassword123!'); await inputs[1].setValue('NewPassword123!');
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'NewPassword123!' });
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem('barkolink-password-recovery')).toBeNull();
    expect(wrapper.get('button').attributes('disabled')).toBeDefined(); wrapper.unmount();
  });
});
