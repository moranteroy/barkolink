import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import WorkspacePagination from '../../src/components/shared/WorkspacePagination.vue';
describe('shared workspace pagination', () => {
  it('shows page totals and emits zero-based pages only inside the range', async () => {
    const wrapper = mount(WorkspacePagination, { props: { page: 0, total: 61 } });
    expect(wrapper.text()).toContain('Page 1 of 3');
    expect(wrapper.findAll('button')[0].attributes('disabled')).toBeDefined();
    await wrapper.findAll('button')[1].trigger('click');
    expect(wrapper.emitted('change')).toEqual([[1]]);
    await wrapper.setProps({ page: 2 });
    expect(wrapper.text()).toContain('Page 3 of 3');
    expect(wrapper.findAll('button')[1].attributes('disabled')).toBeDefined();
    await wrapper.findAll('button')[0].trigger('click');
    expect(wrapper.emitted('change')).toEqual([[1], [1]]);
  });
  it('locks both buttons during a request and respects custom page sizes', async () => {
    const wrapper = mount(WorkspacePagination, { props: { page: 1, total: 21, pageSize: 10, disabled: true } });
    expect(wrapper.text()).toContain('Page 2 of 3');
    for (const button of wrapper.findAll('button')) { expect(button.attributes('disabled')).toBeDefined(); await button.trigger('click'); }
    expect(wrapper.emitted('change')).toBeUndefined();
  });
  it('handles empty and single-page results without navigating past them', async () => {
    const wrapper = mount(WorkspacePagination, { props: { page: 0, total: 0 } });
    expect(wrapper.text()).toContain('Page 1 of 1');
    await wrapper.setProps({ total: 30 });
    for (const button of wrapper.findAll('button')) { expect(button.attributes('disabled')).toBeDefined(); await button.trigger('click'); }
    expect(wrapper.emitted('change')).toBeUndefined();
  });
});
