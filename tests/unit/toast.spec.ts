import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ToastHost from '../../src/components/shared/ToastHost.vue';
import { clearToasts, dismissToast, notifyError, notifySuccess, toastMessages } from '../../src/composables/toast';

describe('shared action feedback', () => {
  beforeEach(() => { clearToasts(); vi.useFakeTimers(); });
  afterEach(() => { clearToasts(); vi.useRealTimers(); });
  const mountHost = () => mount(ToastHost, { global: { stubs: { AppIcon: true, Transition: true } } });
  it('queues errors after success and suppresses duplicate pending messages', async () => {
    const wrapper = mountHost();
    expect(notifySuccess('Traveler saved.')).toBe('Traveler saved.');
    notifySuccess('Traveler saved.');
    notifyError('Could not delete traveler.');
    await nextTick();
    expect(toastMessages.value).toHaveLength(2);
    expect(wrapper.get('[role="status"]').text()).toContain('Traveler saved.');
    await vi.advanceTimersByTimeAsync(4500);
    expect(wrapper.get('[role="alert"]').text()).toContain('Could not delete traveler.');
    await vi.advanceTimersByTimeAsync(7999);
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(wrapper.find('.app-toast').exists()).toBe(false);
    wrapper.unmount();
  });
  it('pauses expiry while reading and allows dismissing an error', async () => {
    const wrapper = mountHost();
    notifyError('Save failed. Please retry.');
    await nextTick();
    await vi.advanceTimersByTimeAsync(3000);
    await wrapper.get('.app-toast').trigger('mouseenter');
    await vi.advanceTimersByTimeAsync(10000);
    expect(wrapper.find('.app-toast').exists()).toBe(true);
    await wrapper.get('.app-toast').trigger('mouseleave');
    await vi.advanceTimersByTimeAsync(4999);
    expect(wrapper.find('.app-toast').exists()).toBe(true);
    await wrapper.get('button').trigger('click');
    expect(toastMessages.value).toHaveLength(0);
    wrapper.unmount();
  });
  it('renders backend messages as text and clears feedback on account changes', async () => {
    const wrapper = mountHost();
    notifyError('<img src=x onerror=alert(1)>');
    await nextTick();
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>');
    clearToasts();
    await nextTick();
    expect(wrapper.find('.app-toast').exists()).toBe(false);
    dismissToast(999);
    wrapper.unmount();
  });
});
