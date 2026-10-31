import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import VouchersPage from '../../src/views/passenger/VouchersPage.vue';
import { toastMessages, clearToasts } from '../../src/composables/toast';
import type { PassengerVoucher } from '../../src/services/vouchers';
const mocks = vi.hoisted(() => ({ list: vi.fn(), claim: vi.fn() }));
vi.mock('../../src/services/supabase', () => ({ requireSupabase: () => ({}) }));
vi.mock('../../src/services/vouchers', () => ({ passengerVouchers: mocks.list, claimVoucher: mocks.claim }));
vi.mock('../../src/components/passenger/PassengerHeader.vue', () => ({ default: { template: '<header />' } }));
vi.mock('../../src/components/passenger/PassengerBottomNav.vue', () => ({ default: { template: '<nav />' } }));
vi.mock('@ionic/vue', async () => {
  const { onMounted } = await import('vue');
  return { IonPage: { template:'<div><slot /></div>' }, IonContent: { template:'<div><slot /></div>' }, onIonViewWillEnter: onMounted };
});
const promo: PassengerVoucher = { id:'event',title:'Weekend sailing treat',description:'A little extra for your journey.',discountType:'FIXED',value:50,minimumSpend:500,startsAt:'2026-10-01T00:00:00Z',expiresAt:'2026-12-01T00:00:00Z',isActive:true,requiredTrips:0,remaining:1,claimedAt:null,code:null,used:false };
const render = () => mount(VouchersPage, { global:{stubs:{RouterLink:{props:['to'],template:'<a :href="to"><slot /></a>'}}} });
beforeEach(() => {
  vi.clearAllMocks(); clearToasts();
  vi.useFakeTimers({toFake:['Date','setInterval','clearInterval']});vi.setSystemTime(new Date('2026-10-31T08:00:00Z'));
  mocks.list.mockResolvedValue({data:{completedTrips:0,vouchers:[{...promo},{...promo,id:'mission',title:'Frequent sailor reward',requiredTrips:3}]}});
});
afterEach(() => vi.useRealTimers());
describe('passenger voucher wallet', () => {
  it('shows direct claims and mission progress without revealing a code before claiming', async () => {
    const wrapper=render();await flushPromises();
    expect(wrapper.findAll('.promo-card')).toHaveLength(2);
    expect(wrapper.find('[aria-label="Claim Weekend sailing treat"]').attributes('disabled')).toBeUndefined();
    expect(wrapper.find('[aria-label="Claim Frequent sailor reward"]').attributes('disabled')).toBeDefined();
    expect(wrapper.find('progress').attributes('value')).toBe('0');
    expect(wrapper.find('.claimed-code').exists()).toBe(false);wrapper.unmount();
  });
  it('claims once, shows the saved code in My vouchers and copies it', async () => {
    const wrapper=render();await flushPromises();
    const claimed={...promo,claimedAt:'2026-10-31T08:00:00Z',code:'EVENT50',remaining:0};
    mocks.claim.mockResolvedValue({data:{code:claimed.code,claimedAt:claimed.claimedAt}});
    mocks.list.mockResolvedValue({data:{completedTrips:0,vouchers:[claimed]}});
    await wrapper.find('[aria-label="Claim Weekend sailing treat"]').trigger('click');await flushPromises();
    expect(mocks.claim).toHaveBeenCalledWith({},'event');expect(wrapper.find('.claimed-code').text()).toContain('EVENT50');
    expect(wrapper.find('.book-link').attributes('href')).toBe('/trips');
    const writeText=vi.fn().mockResolvedValue(undefined);Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText}});
    await wrapper.find('[aria-label="Copy code for Weekend sailing treat"]').trigger('click');await flushPromises();
    expect(writeText).toHaveBeenCalledWith('EVENT50');expect(toastMessages.value.some(t=>t.message==='Voucher code copied.')).toBe(true);wrapper.unmount();
  });
  it('shows load failures separately from an empty promo list and supports retry', async () => {
    mocks.list.mockRejectedValueOnce(new Error('Connection unavailable'));
    const wrapper=render();await flushPromises();expect(wrapper.find('[role="alert"]').text()).toContain('Connection unavailable');
    expect(wrapper.text()).not.toContain('No vouchers available right now');
    await wrapper.find('[role="alert"] button').trigger('click');await flushPromises();expect(wrapper.findAll('.promo-card')).toHaveLength(2);wrapper.unmount();
  });
  it('handles a lost last slot with a toast and refreshes without showing a false claim', async () => {
    const wrapper=render();await flushPromises();mocks.claim.mockRejectedValue(new Error('All available voucher slots have been claimed.'));
    mocks.list.mockResolvedValue({data:{completedTrips:0,vouchers:[]}});
    await wrapper.find('[aria-label="Claim Weekend sailing treat"]').trigger('click');await flushPromises();
    expect(wrapper.find('.claimed-code').exists()).toBe(false);expect(wrapper.text()).toContain('No vouchers available right now');
    expect(toastMessages.value.some(t=>t.message==='All available voucher slots have been claimed.')).toBe(true);wrapper.unmount();
  });
  it('keeps used, paused and expired vouchers visible without a booking action', async () => {
    mocks.list.mockResolvedValue({data:{completedTrips:0,vouchers:[{...promo,id:'used',claimedAt:promo.startsAt,code:'USED',used:true},{...promo,id:'paused',claimedAt:promo.startsAt,code:'PAUSED',isActive:false},{...promo,id:'expired',claimedAt:promo.startsAt,code:'EXPIRED',expiresAt:'2026-10-02T00:00:00Z'}]}});
    const wrapper=render();await flushPromises();await wrapper.findAll('.wallet-tabs button')[1].trigger('click');
    expect(wrapper.findAll('.promo-card')).toHaveLength(3);expect(wrapper.findAll('.book-link')).toHaveLength(0);
    expect(wrapper.findAll('.promo-badge').map(b=>b.text())).toEqual(expect.arrayContaining(['Used','Paused','Expired']));wrapper.unmount();
  });
});
