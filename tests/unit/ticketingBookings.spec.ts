import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TicketingPage from '../../src/views/staff/ticketing/TicketingPage.vue'

vi.mock('../../src/composables/confirmation', () => ({ confirmAction: vi.fn(async () => true) }))
const mocks = vi.hoisted(() => ({ enter: vi.fn(), bookings: vi.fn(), collectPayment: vi.fn(), verify: vi.fn(), refund: vi.fn() }))
vi.mock('../../src/services/database/workspaces', () => ({ staffDashboard: vi.fn(async () => ({data:{bookings:1,paid:0,unpaid:1,trips:1}})) }))
vi.mock('../../src/services/database/operations', () => ({ verifyPassengerDiscount: mocks.verify, refundBooking: mocks.refund }))
vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/staff/ticketing/bookings', params: { role: 'ticketing' } }),
  useRouter: () => ({ replace: vi.fn() }),
}))
vi.mock('../../src/services/session', () => ({ auth: null, staffDatabase: {} }))
vi.mock('../../src/services/auth', () => ({ signOut: vi.fn() }))
vi.mock('../../src/services/database/staff', () => ({
  staffBookings: mocks.bookings, collectBookingPayment: mocks.collectPayment,
  boardingActivity: vi.fn(), boardingManifest: vi.fn(), boardingSailings: vi.fn(),
  boardTicket: vi.fn(), checkInTicket: vi.fn(),
}))
vi.mock('@ionic/vue', () => ({
  IonPage: { template: '<div><slot /></div>' },
  IonContent: { template: '<div><slot /></div>' },
  IonIcon: { template: '<span />' },
  IonButton: { props: ['disabled'], template: '<button :disabled="disabled"><slot /></button>' },
  IonModal: { props: ['isOpen'], template: '<div v-if="isOpen"><slot /></div>' },
  onIonViewWillEnter: mocks.enter, onIonViewDidEnter: vi.fn(),
}))

function booking(status = 'PENDING', paymentStatus = 'UNPAID', departureAt = '2099-10-10T02:00:00Z') {
  return {
    id: 'booking-1', reference: 'BL-2026-CBD008A6', status, paymentStatus,
    total: 500, passengerCount: 1, bookingChannel: 'ONLINE', createdAt: '2026-10-03T01:00:00Z',
    owner: { fullName: 'Carlo Biado' },
    sailing: { departureAt, regularFare: 500, vessel: { name: 'Test Ferry' }, origin: { name: 'Batangas Port' }, destination: { name: 'Calapan Port' } },
    bookingPassengers_on_booking: [{
      id: 'person-1', fare: 500, fullName: 'Carlo Biado', passengerType: 'REGULAR', ticketCode: 'ticket-1',
      ticketStatus: paymentStatus === 'PAID' ? 'ISSUED' : 'PENDING',
    }],
  }
}

async function openDetails(record = booking()) {
  mocks.bookings.mockResolvedValue({ data: { bookings: [record] } })
  const wrapper = mount(TicketingPage, {
    global: { stubs: { StaffWorkspaceHeader: true, StaffLogoutButton: true, RouterLink: { template: '<a><slot /></a>' }, BrandMark: true, TicketingGuide: true } },
  })
  await mocks.enter.mock.calls.at(-1)![0]()
  await flushPromises()
  await wrapper.find('.queue-update').trigger('click')
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.collectPayment.mockResolvedValue({ data: {} })
  mocks.verify.mockResolvedValue({ data: {} })
  mocks.refund.mockResolvedValue({ data: {} })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})
afterEach(() => vi.restoreAllMocks())

describe('ticketing booking details', () => {
  it.each(['2099-10-10T02:00:00Z', '2020-10-10T02:00:00Z'])('shows cancelled reservations without payment or ticket promises (%s)', async departureAt => {
    const wrapper = await openDetails(booking('CANCELLED', 'UNPAID', departureAt))
    const details = wrapper.find('.ticket-list-modal')
    expect(details.get('.booking-amount > span').text()).toBe('Original booking amount')
    expect(details.get('.booking-amount > strong').text()).toContain('PHP 500')
    expect(details.text()).toContain('No payment is due and tickets cannot be issued.')
    expect(details.find('.ticket-record').text()).toContain('REGULAR · Cancelled')
    expect(details.text()).toContain('Ticket unavailable')
    expect(details.text()).not.toContain('Awaiting payment')
    expect(details.text()).not.toContain('Ticket issued after payment')
    expect(details.text()).not.toContain('This sailing has departed')
    expect(details.find('code').exists()).toBe(false)
    expect(details.find('.payment-actions').exists()).toBe(false)
    expect(mocks.collectPayment).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('lets staff collect cash for an active unpaid reservation', async () => {
    const wrapper = await openDetails()
    const details = wrapper.find('.ticket-list-modal')
    expect(details.get('.booking-amount > span').text()).toBe('Amount due')
    expect(details.get('.booking-amount > strong').text()).toContain('PHP 500')
    expect(details.text()).toContain('Awaiting payment')
    expect(details.text()).toContain('Ticket issued after payment')
    await details.find('.payment-actions button').trigger('click')
    await flushPromises()
    expect(mocks.collectPayment).toHaveBeenCalledTimes(1)
    expect(mocks.collectPayment).toHaveBeenCalledWith({}, { bookingId: 'booking-1', method: 'CASH' })
    wrapper.unmount()
  })

  it('shows the issued ticket for a paid booking without another payment action', async () => {
    const wrapper = await openDetails(booking('CONFIRMED', 'PAID'))
    const details = wrapper.find('.ticket-list-modal')
    expect(details.text()).toContain('Paid')
    expect(details.find('.ticket-record').text()).toContain('ISSUED')
    expect(details.find('code').text()).toBe('ticket-1')
    expect(details.find('.payment-actions').exists()).toBe(false)
    wrapper.unmount()
  })

  it('keeps departed unpaid reservations in history without a payment action', async () => {
    const wrapper = await openDetails(booking('PENDING', 'UNPAID', '2020-10-10T02:00:00Z'))
    const details = wrapper.find('.ticket-list-modal')
    expect(details.text()).toContain('This sailing has departed')
    expect(details.find('.payment-actions').exists()).toBe(false)
    wrapper.unmount()
  })
  it('shows expired reservations without suggesting payment', async () => {
    const wrapper = await openDetails(booking('EXPIRED'))
    const details = wrapper.find('.ticket-list-modal')
    expect(details.text()).toContain('This reservation expired. Its seats were released.')
    expect(details.text()).not.toContain('Awaiting payment')
    expect(details.find('.payment-actions').exists()).toBe(false)
    wrapper.unmount()
  })
  it('blocks payment until a discounted passenger is verified', async () => {
    const record = { ...booking(), sailing: { ...booking().sailing, regularFare: 600 }, bookingPassengers_on_booking: [{ id: 'student-1', fullName: 'Student Test', passengerType: 'STUDENT', fare: 480, ticketCode: 'student-ticket', ticketStatus: 'PENDING', discountVerifiedAt: null as string | null }] }
    const wrapper = await openDetails(record)
    expect(wrapper.find('.payment-actions button').attributes('disabled')).toBeDefined()
    await wrapper.find('.discount-verification input[type=checkbox]').setValue(true)
    await wrapper.find('.discount-verification input[maxlength]').setValue('Student ID checked')
    mocks.bookings.mockResolvedValue({ data: { bookings: [{ ...record, bookingPassengers_on_booking: [{ ...record.bookingPassengers_on_booking[0], discountVerifiedAt: '2026-10-03T01:00:00Z' }] }] } })
    await wrapper.find('.discount-verification button').trigger('click'); await flushPromises()
    expect(mocks.verify).toHaveBeenCalledWith({}, 'student-1', 'Student ID checked')
    expect(wrapper.find('.payment-actions button').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })
  it('records cash returned for a cancelled paid booking without exposing its ticket', async () => {
    const wrapper = await openDetails(booking('CANCELLED', 'REFUND_PENDING'))
    const details = wrapper.find('.ticket-list-modal')
    expect(details.text()).toContain('Refund pending')
    expect(details.find('code').exists()).toBe(false)
    expect(details.find('.payment-actions').exists()).toBe(false)
    await details.find('.refund-actions input').setValue('Receipt TEST-01, cash returned')
    await details.find('.refund-actions').trigger('submit'); await flushPromises()
    expect(mocks.refund).toHaveBeenCalledWith({}, 'booking-1', 'Receipt TEST-01, cash returned')
    wrapper.unmount()
  })
})

describe('ticketing queue pagination', () => {
  it('loads the next queue page with the shared pager', async () => {
    mocks.bookings.mockResolvedValue({ data: { bookings: [booking()], totalCount: 61 } })
    const wrapper = mount(TicketingPage, { global: { stubs: { StaffWorkspaceHeader: true, StaffLogoutButton: true, RouterLink: { template: '<a><slot /></a>' }, BrandMark: true, TicketingGuide: true } } })
    await mocks.enter.mock.calls.at(-1)![0](); await flushPromises()
    expect(wrapper.find('.workspace-pagination').text()).toContain('Page 1 of 3')
    await wrapper.findAll('.workspace-pagination button')[1].trigger('click'); await flushPromises()
    expect(mocks.bookings).toHaveBeenLastCalledWith({},expect.objectContaining({page:1,pageSize:30}))
    expect(wrapper.find('.workspace-pagination').text()).toContain('Page 2 of 3')
    wrapper.unmount()
  })
})
