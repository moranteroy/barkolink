import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PaymentReturn from '../../src/components/passenger/PaymentReturn.vue';
const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../../src/services/payments', () => ({ paymentRequest: mocks.request }));
const render = (cancelled = false, ticketEligible = true) => mount(PaymentReturn, { props: { bookingId: 'booking-1', reference: 'BL-1', cancelled, ticketEligible }, global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } } });
beforeEach(() => vi.clearAllMocks());
describe('checkout return verification', () => {
  it('shows staff verification pending after payment receipt and withholds the ticket link', async () => {
    mocks.request.mockResolvedValue({ status: 'PAID' });
    const wrapper = render(false, false);
    await wrapper.setProps({ awaitingVerification: true });
    await flushPromises();
    expect(wrapper.text()).toContain('Awaiting staff verification');
    expect(wrapper.text()).toContain('Do not pay again');
    expect(wrapper.get('a').attributes('href')).toBe('/booking-details?reference=BL-1');
    wrapper.unmount();
  });
  it('does not promise an e-ticket for a closed booking with a recorded payment', async () => {
    mocks.request.mockResolvedValue({ status: 'PAID' });
    const wrapper = render(false, false); await flushPromises();
    expect(wrapper.get('a').attributes('href')).toBe('/booking-details?reference=BL-1');
    expect(wrapper.text()).not.toContain('your e-ticket is ready');
    wrapper.unmount();
  });
  it('shows verification before confirmation and only offers a ticket after the server confirms payment', async () => {
    let resolve!: (value: { status: string }) => void;
    mocks.request.mockReturnValue(new Promise(done => { resolve = done; }));
    const wrapper = render();
    expect(wrapper.text()).toContain('Confirming payment receipt');
    expect(wrapper.find('a').exists()).toBe(false);
    expect(wrapper.emitted('updated')).toBeUndefined();
    resolve({ status: 'PAID' }); await flushPromises();
    expect(mocks.request).toHaveBeenCalledWith('status', 'booking-1');
    expect(wrapper.text()).toContain('Payment successful');
    expect(wrapper.get('a').attributes('href')).toBe('/ticket?reference=BL-1');
    expect(wrapper.emitted('updated')).toHaveLength(1);
    wrapper.unmount();
  });
  it.each(['UNPAID', 'REVIEW'])('does not show success or an e-ticket for %s', async status => {
    mocks.request.mockResolvedValue({ status });
    const wrapper = render(); await flushPromises();
    expect(wrapper.find('a').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Payment successful');
    expect(wrapper.text()).toContain(status === 'REVIEW' ? 'Do not pay again' : 'awaiting payment');
    wrapper.unmount();
  });
  it('keeps payment unverified on connection failure and allows verification retry', async () => {
    mocks.request.mockRejectedValueOnce(new Error('Connection unavailable')).mockResolvedValueOnce({ status: 'PAID' });
    const wrapper = render(); await flushPromises();
    expect(wrapper.text()).toContain('Could not verify payment');
    expect(wrapper.emitted('updated')).toBeUndefined();
    await wrapper.get('button').trigger('click'); await flushPromises();
    expect(wrapper.text()).toContain('Payment successful');
    wrapper.unmount();
  });
  it('does not treat a cancelled return as proof of payment failure when the server confirms payment', async () => {
    mocks.request.mockResolvedValue({ status: 'PAID' });
    const wrapper = render(true); await flushPromises();
    expect(wrapper.text()).toContain('Payment successful');
    wrapper.unmount();
  });
});
