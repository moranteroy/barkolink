import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import QueueFreshness from '../../src/components/shared/QueueFreshness.vue';

describe('staff queue loading and recovery', () => {
  it('keeps a loaded queue free of refresh metadata, including background refreshes', async () => {
    const wrapper = mount(QueueFreshness, { props: { updatedAt: Date.now(), loading: false } });
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    await wrapper.setProps({ loading: true });
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    wrapper.unmount();
  });
  it('announces initial loading without a last-updated timestamp', () => {
    const wrapper = mount(QueueFreshness, { props: { updatedAt: null, loading: true } });
    expect(wrapper.get('[role="status"]').text()).toBe('Loading current records…');
    wrapper.unmount();
  });
  it('keeps the failed-update guidance visible until recovery', async () => {
    const wrapper = mount(QueueFreshness, {
      props: { updatedAt: Date.now(), loading: false, error: 'Offline' },
    });
    expect(wrapper.get('[role="status"]').text()).toContain('Showing previously loaded records.');
    expect(wrapper.text()).toContain('Refresh before recording a payment or attendance.');
    expect(wrapper.text()).not.toContain('Updated');
    await wrapper.setProps({ error: '' });
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    wrapper.unmount();
  });
});
