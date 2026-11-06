import { mount, flushPromises } from '@vue/test-utils';
import { beforeEach, expect, it, vi } from 'vitest';
import TwoFactorSettings from '../../src/components/shared/TwoFactorSettings.vue';
const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  disable: vi.fn(),
  enable: vi.fn(),
  save: vi.fn(),
  push: vi.fn(),
  success: vi.fn(),
}));
vi.mock('../../src/services/mfaSecurity', () => ({
  loadMfaSettings: mocks.load,
  disableAccountMfa: mocks.disable,
  enableAccountMfa: mocks.enable,
  setStaffMfaRequired: mocks.save,
}));
vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/admin/settings/password' }),
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock('../../src/composables/unsavedChanges', () => ({ useUnsavedChanges: vi.fn() }));
vi.mock('../../src/composables/toast', () => ({ notifySuccess: mocks.success }));
const settings = {
  role: 'ADMIN',
  enabled: false,
  staffRequired: true,
  policyRequired: false,
  mfaRequired: false,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.load.mockResolvedValue(settings);
  mocks.disable.mockResolvedValue({ ...settings, enabled: false, authenticatorLinked: true });
  mocks.enable.mockResolvedValue({ ...settings, enabled: true, authenticatorLinked: true });
  mocks.save.mockResolvedValue({ ...settings, staffRequired: false });
});
it('opens authenticator setup with a return to the current security page', async () => {
  const wrapper = mount(TwoFactorSettings);
  await flushPromises();
  await wrapper.get('button').trigger('click');
  expect(mocks.push).toHaveBeenCalledWith({
    path: '/verify-staff',
    query: { returnTo: '/admin/settings/password' },
  });
  wrapper.unmount();
});
it('locks disabling when staff policy requires 2FA and does not expose policy controls to staff', async () => {
  mocks.load.mockResolvedValue({
    ...settings,
    role: 'BOARDING',
    enabled: true,
    policyRequired: true,
    mfaRequired: true,
  });
  const wrapper = mount(TwoFactorSettings);
  await flushPromises();
  expect(wrapper.text()).toContain('You cannot turn it off');
  expect(wrapper.get('button').attributes('disabled')).toBeDefined();
  expect(wrapper.find('.staff-mfa-policy').exists()).toBe(false);
  wrapper.unmount();
});
it('asks for a code, handles failed verification, then updates the disabled state', async () => {
  mocks.load.mockResolvedValueOnce({ ...settings, enabled: true }).mockResolvedValue(settings);
  const wrapper = mount(TwoFactorSettings);
  await flushPromises();
  await wrapper.get('button').trigger('click');
  expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined();
  await wrapper.get('input[inputmode="numeric"]').setValue('123456');
  mocks.disable.mockRejectedValueOnce(new Error('Invalid code'));
  await wrapper.get('form').trigger('submit');
  await flushPromises();
  expect(wrapper.get('[role="alert"]').text()).toContain('Invalid code');
  expect(wrapper.get('input[inputmode="numeric"]').element.value).toBe('');
  await wrapper.get('input[inputmode="numeric"]').setValue('654321');
  await wrapper.get('form').trigger('submit');
  await flushPromises();
  expect(mocks.disable).toHaveBeenLastCalledWith('654321');
  expect(wrapper.find('form').exists()).toBe(false);
  expect(wrapper.get('[aria-label="Two-factor authentication"]').attributes('aria-checked')).toBe(
    'false',
  );
  wrapper.unmount();
});
it('saves the staff switch immediately and displays only the saved state', async () => {
  const wrapper = mount(TwoFactorSettings);
  await flushPromises();
  const toggle = wrapper.get('[aria-label="Require 2FA for staff"]');
  expect(toggle.attributes('aria-checked')).toBe('true');
  await toggle.trigger('click');
  await flushPromises();
  expect(mocks.save).toHaveBeenCalledWith(false);
  expect(toggle.attributes('aria-checked')).toBe('false');
  expect(wrapper.text()).not.toContain('Save staff policy');
  wrapper.unmount();
});
it('keeps the staff switch on if saving fails', async () => {
  mocks.save.mockRejectedValue(new Error('Offline'));
  const wrapper = mount(TwoFactorSettings);
  await flushPromises();
  const toggle = wrapper.get('[aria-label="Require 2FA for staff"]');
  await toggle.trigger('click');
  await flushPromises();
  expect(toggle.attributes('aria-checked')).toBe('true');
  expect(wrapper.get('[role="alert"]').text()).toContain('Could not save');
  wrapper.unmount();
});
it('keeps the account switch on until verified and restores it when cancelled', async () => {
  mocks.load.mockResolvedValue({ ...settings, enabled: true });
  const wrapper = mount(TwoFactorSettings);
  await flushPromises();
  const toggle = wrapper.get('[aria-label="Two-factor authentication"]');
  await toggle.trigger('click');
  expect(toggle.attributes('aria-checked')).toBe('true');
  expect(toggle.attributes('disabled')).toBeDefined();
  await wrapper.get('.mfa-actions button[type="button"]').trigger('click');
  expect(toggle.attributes('aria-checked')).toBe('true');
  expect(toggle.attributes('disabled')).toBeUndefined();
  expect(mocks.disable).not.toHaveBeenCalled();
  wrapper.unmount();
});
it('keeps controls unavailable if security settings cannot be loaded', async () => {
  mocks.load.mockRejectedValue(new Error('Offline'));
  const wrapper = mount(TwoFactorSettings);
  await flushPromises();
  expect(wrapper.text()).toContain('Retry security settings');
  expect(wrapper.text()).not.toContain('Turn off 2FA');
  wrapper.unmount();
});

it('reenables a linked authenticator with a code instead of opening QR setup', async () => {
  mocks.load.mockResolvedValue({ ...settings, authenticatorLinked: true });
  const wrapper = mount(TwoFactorSettings);
  await flushPromises();
  const toggle = wrapper.get('[aria-label="Two-factor authentication"]');
  await toggle.trigger('click');
  expect(mocks.push).not.toHaveBeenCalled();
  expect(wrapper.text()).toContain('Verify and turn on');
  expect(toggle.attributes('aria-checked')).toBe('false');
  await wrapper.get('input[inputmode="numeric"]').setValue('123456');
  await wrapper.get('form').trigger('submit');
  await flushPromises();
  expect(mocks.enable).toHaveBeenCalledWith('123456');
  expect(toggle.attributes('aria-checked')).toBe('true');
  wrapper.unmount();
});
