import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StaffBookingTickets from '../../src/components/staff/StaffBookingTickets.vue';
import { staffTicket, type StaffTicketBooking } from '../../src/data/staffTicket';

const exports = vi.hoisted(() => ({
  print: vi.fn().mockResolvedValue(undefined),
  download: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/data/ticketExport', () => ({
  printTicketDocument: exports.print,
  downloadTicket: exports.download,
}));
const booking: StaffTicketBooking = {
  id: 'booking-walk-in',
  reference: 'WALK-IN-PAID',
  status: 'CONFIRMED',
  paymentStatus: 'PAID',
  paymentMethod: 'CASH',
  passengerCount: 1,
  total: 600,
  serviceFee: 0,
  bookingChannel: 'WALK_IN',
  createdAt: '2026-11-05T00:00:00Z',
  owner: { fullName: 'Counter Guest', email: 'guest@walkin.barkolink.invalid' },
  sailing: {
    code: 'FUTURE-WALK-IN',
    status: 'SCHEDULED',
    departureAt: '2099-11-06T05:00:00Z',
    arrivalAt: '2099-11-06T07:00:00Z',
    origin: { name: 'Calapan Port' },
    destination: { name: 'Batangas Port' },
    vessel: { name: 'Fixture Ferry' },
  },
  bookingPassengers_on_booking: [
    {
      fullName: 'Counter Guest',
      passengerType: 'REGULAR',
      fare: 600,
      ticketCode: '11111111-1111-4111-8111-111111111111',
      ticketQrPayload: JSON.stringify({
        Booking: 'WALK-IN-PAID',
        Verification: 'server-issued-token',
      }),
      ticketStatus: 'ISSUED',
    },
  ],
};
beforeEach(() => vi.clearAllMocks());
describe('Staff-issued passenger e-tickets', () => {
  it('retains the server-issued QR and Philippine clock time in the export model', () => {
    expect(staffTicket(booking)).toMatchObject({
      reference: booking.reference,
      departure: '1:00 PM',
      vessel: 'Fixture Ferry',
      passengers: [
        {
          name: 'Counter Guest',
          ticketQrPayload: booking.bookingPassengers_on_booking[0].ticketQrPayload,
        },
      ],
    });
  });
  it('shows a QR and permits printing/downloading a paid walk-in without creating another sale', async () => {
    const wrapper = mount(StaffBookingTickets, { props: { booking } });
    await flushPromises();
    await vi.waitFor(() => expect(wrapper.find('img').exists()).toBe(true));
    expect(wrapper.find('img').attributes('src')).toMatch(/^data:image\/png/);
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Print/PDF e-ticket')!
      .trigger('click');
    await flushPromises();
    expect(exports.print).toHaveBeenCalledWith(staffTicket(booking));
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Download e-ticket')!
      .trigger('click');
    await flushPromises();
    expect(exports.download).toHaveBeenCalledWith(staffTicket(booking));
    wrapper.unmount();
  });
  it('withholds tickets for unpaid, cancelled and unverified online payments', async () => {
    for (const changes of [
      { paymentStatus: 'UNPAID' },
      { status: 'CANCELLED' },
      { paymentVerificationRequired: true, paymentMethod: 'PAYMONGO_TEST' },
    ]) {
      const wrapper = mount(StaffBookingTickets, {
        props: { booking: { ...booking, ...changes } },
      });
      await flushPromises();
      expect(wrapper.find('img').exists()).toBe(false);
      expect(wrapper.find('button').exists()).toBe(false);
      wrapper.unmount();
    }
  });
  it('never substitutes a bare ticket code when its verified payload is missing', async () => {
    const wrapper = mount(StaffBookingTickets, {
      props: {
        booking: {
          ...booking,
          bookingPassengers_on_booking: [
            { ...booking.bookingPassengers_on_booking[0], ticketQrPayload: null },
          ],
        },
      },
    });
    await flushPromises();
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.text()).toContain('Verified QR is unavailable');
    expect(
      wrapper.findAll('button').every((button) => button.attributes('disabled') !== undefined),
    ).toBe(true);
    wrapper.unmount();
  });
  it('exports used tickets as historical records with no reusable QR', async () => {
    const used = {
      ...booking,
      bookingPassengers_on_booking: [
        { ...booking.bookingPassengers_on_booking[0], ticketStatus: 'BOARDED' },
      ],
    };
    const wrapper = mount(StaffBookingTickets, { props: { booking: used } });
    await flushPromises();
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.text()).toContain('Used · Boarded');
    await wrapper.findAll('button')[0].trigger('click');
    await flushPromises();
    expect(exports.print).toHaveBeenCalledWith(staffTicket(used));
    wrapper.unmount();
  });
});
