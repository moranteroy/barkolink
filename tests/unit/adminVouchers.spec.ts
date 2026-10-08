import { flushPromises, mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import VouchersPanel from '../../src/components/admin/VouchersPanel.vue';
import type { Voucher } from '../../src/services/vouchers';
const voucherStyles = readFileSync('src/theme/admin-vouchers.css', 'utf8');

const mocks = vi.hoisted(() => ({ list: vi.fn(), save: vi.fn(), settings: vi.fn(), saveSettings: vi.fn() }));
vi.mock('../../src/services/supabase', () => ({ requireSupabase: () => ({}) }));
vi.mock('../../src/services/vouchers', () => ({ listVouchers: mocks.list, saveVoucher: mocks.save, adminLoyaltySettings: mocks.settings, saveLoyaltySettings: mocks.saveSettings }));
vi.mock('@ionic/vue', () => ({
  IonIcon: { template: '<span />' },
  IonModal: { props: ['isOpen'], template: '<div v-if="isOpen"><slot /></div>' },
}));
const voucher: Voucher = { id: 'one', code: 'SAIL50', discountType: 'FIXED', value: 50, minimumSpend: 0, usageLimit: 100, used: 5, startsAt: '2026-10-01T00:00:00Z', expiresAt: '2026-10-31T00:00:00Z', isActive: true };
const records = [voucher,
  { ...voucher, id: 'two', code: 'PAUSED', isActive: false },
  { ...voucher, id: 'three', code: 'USEDUP', used: 100 },
  { ...voucher, id: 'four', code: 'COMING', startsAt: '2026-10-20T00:00:00Z' },
  { ...voucher, id: 'five', code: 'EXPIRED', expiresAt: '2026-10-02T00:00:00Z' },
];
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(new Date('2026-10-08T12:00:00Z'));
  mocks.list.mockResolvedValue({ data: { vouchers: records } });
  mocks.save.mockResolvedValue({ data: {} });
  mocks.settings.mockResolvedValue({ data: { settings: { tripsPerReward: 4, silverReward: 125, goldReward: 250, platinumReward: 400, expiryDays: 60 } } });
  mocks.saveSettings.mockImplementation(async (_client, settings) => ({ data: { settings } }));
});
afterEach(() => { vi.useRealTimers(); });

describe('voucher management', () => {
  it('loads live milestones, saves new settings and renders the returned values', async () => {
    const wrapper = mount(VouchersPanel); await flushPromises();
    expect(wrapper.find('.loyalty-tiers').text()).toContain('PHP 125');
    expect(wrapper.find('.loyalty-tiers').text()).toContain('12 completed trips');
    const inputs = wrapper.findAll('.loyalty-fields input');
    await inputs[0].setValue('3'); await inputs[2].setValue('150');
    await wrapper.find('.loyalty-editor form').trigger('submit'); await flushPromises();
    expect(mocks.saveSettings).toHaveBeenCalledWith({}, expect.objectContaining({ tripsPerReward: 3, silverReward: 150 }));
    expect(wrapper.find('.loyalty-tiers').text()).toContain('PHP 150');
    expect(wrapper.find('.loyalty-tiers').text()).toContain('9 completed trips');
    wrapper.unmount();
  });
  it('does not show invented milestones when the settings service fails', async () => {
    mocks.settings.mockRejectedValue(new Error('Unavailable'));
    const wrapper = mount(VouchersPanel); await flushPromises();
    expect(wrapper.find('.loyalty-tiers').exists()).toBe(false);
    expect(wrapper.find('.loyalty-body [role="alert"]').exists()).toBe(true);
    wrapper.unmount();
  });
  it('applies the directory stylesheet to counts, filters and table cells', async () => {
    const style = document.createElement('style');
    style.textContent = voucherStyles;
    document.head.append(style);
    const wrapper = mount(VouchersPanel, { attachTo: document.body });
    try {
      await flushPromises();
      expect(voucherStyles).toContain('.admin-vouchers.voucher-panel');
      expect(wrapper.find('.voucher-panel').classes()).toContain('admin-vouchers');
      const css = (selector: string) => getComputedStyle(wrapper.find(selector).element);
      expect(css('.voucher-panel').padding).toBe('0px');
      expect(css('.voucher-summary').display).toBe('grid');
      expect(css('.voucher-summary').gridTemplateColumns).toBe('repeat(4, minmax(0, 1fr))');
      expect(css('.voucher-summary article').display).toBe('flex');
      expect(css('.directory-heading').display).toBe('flex');
      expect(css('.search-field').display).toBe('flex');
      expect(css('td').padding).toBe('12px 14px');
      expect(css('td small').display).toBe('block');
      expect(css('th').position).toBe('sticky');
      await wrapper.find('.create-voucher').trigger('click');
      expect(css('.voucher-dialog').display).toBe('flex');
      expect(css('.form-grid').display).toBe('grid');
    } finally { wrapper.unmount(); style.remove(); }
  });
  it('keeps creation separate from records and filters code and derived availability', async () => {
    const wrapper = mount(VouchersPanel); await flushPromises();
    expect(wrapper.find('.voucher-dialog').exists()).toBe(false);
    expect(wrapper.findAll('tbody tr')).toHaveLength(5);
    expect(wrapper.findAll('.status-badge').map(b => b.text())).toEqual(['Active', 'Paused', 'Fully used', 'Scheduled', 'Expired']);
    await wrapper.find('input[type="search"]').setValue('sail');
    expect(wrapper.findAll('tbody tr')).toHaveLength(1);
    await wrapper.find('.reset-filters').trigger('click');
    await wrapper.find('.directory-tools select').setValue('EXHAUSTED');
    expect(wrapper.find('tbody').text()).toContain('USEDUP');
    expect(wrapper.findAll('tbody tr')).toHaveLength(1);
    wrapper.unmount();
  });
  it('creates a voucher using Philippine time and shows the refreshed directory', async () => {
    const wrapper = mount(VouchersPanel); await flushPromises();
    await wrapper.find('.create-voucher').trigger('click');
    await wrapper.find('input[placeholder="SAIL50"]').setValue('NEW50');
    const dates = wrapper.findAll('input[type="datetime-local"]');
    await dates[0].setValue('2026-10-09T08:00'); await dates[1].setValue('2026-10-19T08:00');
    await wrapper.find('form.voucher-dialog').trigger('submit'); await flushPromises();
    expect(mocks.save).toHaveBeenCalledWith({}, expect.objectContaining({ code: 'NEW50', startsAt: '2026-10-09T00:00:00.000Z', expiresAt: '2026-10-19T00:00:00.000Z', isActive: true }));
    expect(wrapper.find('.voucher-dialog').exists()).toBe(false);
    expect(wrapper.find('[role="status"]').text()).toContain('Voucher created.');
    expect(mocks.list).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });
  it('rejects an expiry before the start without losing the draft', async () => {
    const wrapper = mount(VouchersPanel); await flushPromises();
    await wrapper.find('.create-voucher').trigger('click');
    await wrapper.find('input[placeholder="SAIL50"]').setValue('NEW50');
    const dates = wrapper.findAll('input[type="datetime-local"]');
    await dates[0].setValue('2026-10-19T08:00'); await dates[1].setValue('2026-10-09T08:00');
    await wrapper.find('form.voucher-dialog').trigger('submit'); await flushPromises();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(wrapper.find('.voucher-dialog [role="alert"]').text()).toContain('Expiry must be later');
    expect((wrapper.find('input[placeholder="SAIL50"]').element as HTMLInputElement).value).toBe('NEW50');
    wrapper.unmount();
  });
  it('pauses a voucher and refreshes its status without changing offer details', async () => {
    mocks.list.mockResolvedValueOnce({ data: { vouchers: [voucher] } }).mockResolvedValueOnce({ data: { vouchers: [{ ...voucher, isActive: false }] } });
    const wrapper = mount(VouchersPanel); await flushPromises();
    await wrapper.find('.action-cell button').trigger('click'); await flushPromises();
    expect(mocks.save).toHaveBeenCalledWith({}, { id: 'one', isActive: false });
    expect(wrapper.find('.status-badge').text()).toBe('Paused');
    expect(wrapper.find('.action-cell button').text()).toContain('Activate');
    wrapper.unmount();
  });
  it('shows a creation failure inside the modal and keeps the draft editable', async () => {
    mocks.save.mockRejectedValue(new Error('Unavailable'));
    const wrapper = mount(VouchersPanel); await flushPromises();
    await wrapper.find('.create-voucher').trigger('click');
    await wrapper.find('input[placeholder="SAIL50"]').setValue('NEW50');
    await wrapper.findAll('input[type="datetime-local"]')[1].setValue('2026-10-19T08:00');
    await wrapper.find('form.voucher-dialog').trigger('submit'); await flushPromises();
    expect(wrapper.find('.voucher-dialog [role="alert"]').exists()).toBe(true);
    expect(wrapper.find('.voucher-dialog fieldset').attributes('disabled')).toBeUndefined();
    expect((wrapper.find('input[placeholder="SAIL50"]').element as HTMLInputElement).value).toBe('NEW50');
    wrapper.unmount();
  });
});
