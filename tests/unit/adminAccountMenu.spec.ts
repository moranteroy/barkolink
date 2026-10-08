import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminAccountMenu from '../../src/components/admin/AdminAccountMenu.vue';
const mocks = vi.hoisted(() => ({ signOut: vi.fn(), replace: vi.fn(), clear: vi.fn(), sync: vi.fn() }));
vi.mock('@ionic/vue', () => ({ IonIcon: { template: '<span />' } }));
vi.mock('vue-router', () => ({ useRouter: () => ({ replace: mocks.replace }), RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } }));
vi.mock('../../src/services/session', () => ({ auth: { currentUser: { displayName: 'Roy Morante', email: 'roy@example.test' } } }));
vi.mock('../../src/services/auth', () => ({ signOut: mocks.signOut }));
vi.mock('../../src/composables/sessionViews', () => ({ clearSessionViews: mocks.clear }));
vi.mock('../../src/composables/notificationUnread', () => ({ syncNotificationOwner: mocks.sync }));
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: { template: '<div><slot /></div>' },
  DropdownMenuTrigger: { template: '<div><slot /></div>' },
  DropdownMenuContent: { template: '<div><slot /></div>' },
  DropdownMenuLabel: { template: '<div><slot /></div>' },
  DropdownMenuItem: { props: ['disabled'], emits: ['select'], template: '<button :disabled="disabled" @click="$emit(\'select\', $event)"><slot /></button>' },
}));
vi.mock('reka-ui', () => ({ DropdownMenuSeparator: { template: '<hr />' } }));
beforeEach(() => { vi.clearAllMocks(); mocks.signOut.mockResolvedValue(undefined); mocks.replace.mockResolvedValue(undefined); });
describe('administrator account menu', () => {
  it('shows the administrator identity and links to profile settings', () => {
    const wrapper = mount(AdminAccountMenu);
    expect(wrapper.find('.admin-account-trigger').text()).toContain('Roy Morante');
    expect(wrapper.find('a').attributes('href')).toBe('/admin/settings/profile');
    wrapper.unmount();
  });
  it('signs out, resets notification ownership and redirects before clearing cached views', async () => {
    const wrapper = mount(AdminAccountMenu);
    await wrapper.find('.account-logout').trigger('click'); await flushPromises();
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.sync).toHaveBeenCalledOnce();
    expect(mocks.replace).toHaveBeenCalledWith('/login');
    expect(mocks.clear).toHaveBeenCalledOnce();
    expect(mocks.clear.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.replace.mock.invocationCallOrder[0]);
    wrapper.unmount();
  });
  it('keeps the current page on sign-out failure and allows retry', async () => {
    mocks.signOut.mockRejectedValueOnce(new Error('Offline'));
    const wrapper = mount(AdminAccountMenu);
    await wrapper.find('.account-logout').trigger('click'); await flushPromises();
    expect(wrapper.find('[role="alert"]').text()).toContain('Please try again');
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.clear).not.toHaveBeenCalled();
    await wrapper.find('.account-logout').trigger('click'); await flushPromises();
    expect(mocks.signOut).toHaveBeenCalledTimes(2);
    expect(mocks.replace).toHaveBeenCalledWith('/login');
    wrapper.unmount();
  });
});
