import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminWorkspacePage from '../../src/views/admin/AdminWorkspacePage.vue'
import { recordsGridStub } from '../support/recordsGridStub'

vi.mock('../../src/services/database/workspaces', () => ({ routes: vi.fn(async () => ({data:{routes:[]}})) }))
vi.mock('../../src/composables/confirmation', () => ({ confirmAction: vi.fn(async () => true) }))
const mocks = vi.hoisted(() => ({
  route: { path: '/admin/trips', params: { section: 'trips' }, query: {} },
  enter: vi.fn(),
  settings: vi.fn(), saveSettings: vi.fn(), createTrip: vi.fn(), nextCode: vi.fn(),
  bookings: vi.fn(), updateTrip: vi.fn(),
  passengerRecords: vi.fn(), board: vi.fn(), checkIn: vi.fn(),
  reports: vi.fn(),
  generatePassword: vi.fn(), createUser: vi.fn(),
}))
vi.mock('vue-router', () => ({ onBeforeRouteLeave: vi.fn(), onBeforeRouteUpdate: vi.fn(), useRoute: () => mocks.route, useRouter: () => ({ replace: vi.fn() }) }))
vi.mock('../../src/services/session', () => ({ auth: null, functions: {}, staffDatabase: {} }))
vi.mock('../../src/services/accountFunctions', () => ({ accountFunction: (_functions: unknown, name: string) => name === 'generateTemporaryPassword' ? mocks.generatePassword : mocks.createUser }))
vi.mock('@ionic/vue', () => ({
  IonPage: { template: '<div><slot /></div>' }, IonContent: { template: '<div><slot /></div>' },
  IonIcon: { template: '<span />' },
  IonModal: { props: ['isOpen'], template: '<div v-if="isOpen"><slot /></div>' },
  onIonViewWillEnter: mocks.enter,
}))
const sailing = {
  code: 'TRP-EXISTING', status: 'SCHEDULED', departureAt: '2099-01-01T08:00:00Z', arrivalAt: '2099-01-01T10:00:00Z',
  origin: { id: 'origin', name: 'Origin' }, destination: { id: 'destination', name: 'Destination' },
  vessel: { id: 'vessel', name: 'Ferry', passengerCapacity: 100 }, availableSeats: 100,
  regularFare: 600, studentFare: 420, seniorFare: 450, childFare: 300, pwdFare: 400,
}
vi.mock('../../src/services/database/staff', () => ({
  adminReports: mocks.reports,
  adminFareSettings: mocks.settings, adminSaveFareSettings: mocks.saveSettings,
  adminNextTripCode: mocks.nextCode,
  adminCreateSailing: mocks.createTrip, adminSailingBookings: mocks.bookings, adminUpdateUnbookedSailing: mocks.updateTrip,
  staffBookings: async () => ({ data: { bookings: [] } }),
  adminSailings: async () => ({ data: { sailings: [sailing] } }),
  adminSailingOptions: async () => ({ data: { sailings: [sailing] } }),
  adminUsers: async () => ({ data: { users: [] } }),
  adminPorts: async () => ({ data: { ports: [{ id: 'origin', code: 'ORG', name: 'Origin', city: 'Origin City', isActive: true }, { id: 'destination', code: 'DST', name: 'Destination', city: 'Destination City', isActive: true }] } }),
  adminVessels: async () => ({ data: { vessels: [{ id: 'vessel', code: 'F1', name: 'Ferry', passengerCapacity: 100, isActive: true }, { id: 'vessel-2', code: 'F2', name: 'Fast Ferry', passengerCapacity: 80, isActive: true }, { id: 'unpriced', code: 'F3', name: 'New Ferry', passengerCapacity: 50, isActive: true }] } }),
  adminPassengerRecords: mocks.passengerRecords,
  adminDashboardStats: async () => ({ data: {} }),
  adminCancelBooking: vi.fn(), adminCreatePort: vi.fn(), adminCreateVessel: vi.fn(), adminRescheduleSailing: vi.fn(),
  adminUpdatePort: vi.fn(), adminUpdateSailingStatus: vi.fn(), adminUpdateVessel: vi.fn(), boardTicket: mocks.board, checkInTicket: mocks.checkIn,
}))

async function load(section = 'trips') {
  mocks.route.path = `/admin/${section}`
  mocks.route.params.section = section
  const wrapper = mount(AdminWorkspacePage, { global: { stubs: { RecordsGrid:recordsGridStub, RouterLink: { template: '<a><slot /></a>' } } } })
  mocks.enter.mock.calls.at(-1)![0]()
  await flushPromises()
  return wrapper
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.reports.mockResolvedValue({ data: { sailings: [] } })
  mocks.generatePassword.mockResolvedValue({ data: { password: 'Generated-password123' } })
  mocks.createUser.mockResolvedValue({ data: { email: 'new@example.com', role: 'TICKETING' } })
  mocks.settings.mockResolvedValue({ data: { fareSettings: null, vesselFareSettings: [
    { code: 'vessel', regularFare: 1000, studentDiscount: 20, seniorDiscount: 30, childDiscount: 50, pwdDiscount: 25 },
    { code: 'vessel-2', regularFare: 2000, studentDiscount: 10, seniorDiscount: 20, childDiscount: 40, pwdDiscount: 30 },
  ] } })
  mocks.saveSettings.mockResolvedValue({ data: { fareSettings_upsert: { code: 'DEFAULT' } } })
  mocks.nextCode.mockResolvedValue({ data: { nextTripCode: { code: 'TRP2026-1002001' } } })
  mocks.createTrip.mockResolvedValue({ data: { sailing_insert: { code: 'TRP2026-1002002' } } })
  mocks.bookings.mockResolvedValue({ data: { bookings: [] } })
  mocks.updateTrip.mockResolvedValue({ data: { sailing_update: { code: sailing.code } } })
  mocks.passengerRecords.mockResolvedValue({ data: { bookingPassengers: [] } })
  mocks.board.mockResolvedValue({ data: {} })
  mocks.checkIn.mockResolvedValue({ data: {} })
})
describe('port directory filters', () => {
  it('counts ports independently of passenger totals and does not paginate an unpaged catalog', async () => {
    mocks.passengerRecords.mockResolvedValue({ data: { bookingPassengers: [], totalCount: 169 } })
    const wrapper = await load('ports')
    expect(wrapper.find('.table-foot').text()).toContain('2 of 2 ports.')
    expect(wrapper.find('.workspace-pagination').exists()).toBe(false)
    await wrapper.find('#directory-search').setValue('Origin')
    expect(wrapper.find('.table-foot').text()).toContain('1 of 2 ports.')
    wrapper.unmount()
  })
  it('keeps the port code fixed while allowing details and availability to be edited', async () => {
    const wrapper = await load('ports')
    await wrapper.findAll('button').find(button => button.text() === 'Edit')!.trigger('click')
    expect(wrapper.find('#port-code').attributes('disabled')).toBeDefined()
    expect(wrapper.find('#port-name').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('.port-availability input').exists()).toBe(true)
    expect(wrapper.find('.port-form-footer').text()).toContain('Save changes')
    wrapper.unmount()
  })
  it('filters port names and active status and resets both filters', async () => {
    const wrapper = await load('ports')
    expect(wrapper.findAll('.records-grid tbody tr')).toHaveLength(2)
    await wrapper.find('#directory-search').setValue('Origin')
    expect(wrapper.findAll('.records-grid tbody tr')).toHaveLength(1)
    await wrapper.find('#directory-status').setValue('INACTIVE')
    expect(wrapper.findAll('.records-grid tbody tr')).toHaveLength(0)
    await wrapper.findAll('button').find(button => button.text() === 'Reset filters')!.trigger('click')
    expect(wrapper.findAll('.records-grid tbody tr')).toHaveLength(2)
    expect((wrapper.find('#directory-search').element as HTMLInputElement).value).toBe('')
    expect((wrapper.find('#directory-status').element as HTMLSelectElement).value).toBe('ALL')
    wrapper.unmount()
  })
})

describe('vessel directory', () => {
  it('filters vessel names and status and resets both filters', async () => {
    const wrapper = await load('vessels')
    expect(wrapper.findAll('.records-grid tbody tr')).toHaveLength(3)
    await wrapper.find('#directory-search').setValue('Fast Ferry')
    expect(wrapper.findAll('.records-grid tbody tr')).toHaveLength(1)
    await wrapper.find('#directory-status').setValue('INACTIVE')
    expect(wrapper.findAll('.records-grid tbody tr')).toHaveLength(0)
    await wrapper.findAll('button').find(button => button.text() === 'Reset filters')!.trigger('click')
    expect(wrapper.findAll('.records-grid tbody tr')).toHaveLength(3)
    wrapper.unmount()
  })
  it('keeps existing vessel code and capacity locked while allowing name edits', async () => {
    const wrapper = await load('vessels')
    await wrapper.findAll('button').find(button => button.text() === 'Edit')!.trigger('click')
    expect(wrapper.find('#vessel-code').attributes('disabled')).toBeDefined()
    expect(wrapper.find('#vessel-capacity').attributes('disabled')).toBeDefined()
    expect(wrapper.find('#vessel-name').attributes('disabled')).toBeUndefined()
    expect(wrapper.text()).toContain('Capacity is fixed after creation')
    wrapper.unmount()
  })
})

describe('reports workspace', () => {
  it('offers authorized export on the manifest page with sailing choices', async () => {
    const wrapper = await load('manifest')
    expect(wrapper.findAll('button').some(b => b.text() === 'Export manifest')).toBe(true)
    expect(wrapper.find('#export-manifest-sailing').text()).toContain('TRP-EXISTING')
    wrapper.unmount()
  })
  it('loads aggregate reports without fetching the limited dashboard records', async () => {
    const wrapper = await load('reports')
    expect(mocks.reports).toHaveBeenCalled()
    expect(mocks.settings).not.toHaveBeenCalled()
    expect(mocks.passengerRecords).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Collection trend')
    expect(wrapper.text()).toContain('No sailings in this report')
    wrapper.unmount()
  })
})
describe('managed accounts', () => {
  async function openUser() {
    const wrapper = await load('users')
    await wrapper.findAll('button').find(button => button.text() === 'Add user')!.trigger('click')
    return wrapper
  }
  it('generates a password and prevents concurrent account requests', async () => {
    let finish!: (value: unknown) => void
    mocks.generatePassword.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const wrapper = await openUser()
    await wrapper.findAll('button').find(button => button.text() === 'Generate')!.trigger('click')
    expect(wrapper.find('form fieldset').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Generating...')
    finish({ data: { password: 'Strong-generated123' } }); await flushPromises()
    expect((wrapper.find('form input[minlength="8"]').element as HTMLInputElement).value).toBe('Strong-generated123')
    expect(wrapper.find('form fieldset').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })
  it('shows a readable connection failure for Generate', async () => {
    mocks.generatePassword.mockRejectedValueOnce({ code: 'functions/internal', message: 'internal' })
    const wrapper = await openUser()
    await wrapper.findAll('button').find(button => button.text() === 'Generate')!.trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('The account service is unavailable.')
    wrapper.unmount()
  })
  it('creates an account with the displayed password and reports duplicate emails', async () => {
    const wrapper = await openUser()
    await wrapper.find('form input[maxlength="120"]').setValue('New Staff')
    await wrapper.find('form input[type="email"]').setValue('new@example.com')
    await wrapper.find('form select').setValue('TICKETING')
    await wrapper.find('form input[minlength="8"]').setValue('Strong-password123')
    mocks.createUser.mockRejectedValueOnce({ code: 'functions/already-exists', message: 'An account already uses this email address.' })
    await wrapper.find('main form, .modal-body form').trigger('submit'); await flushPromises()
    expect(wrapper.text()).toContain('An account already uses this email address.')
    await wrapper.find('main form, .modal-body form').trigger('submit'); await flushPromises()
    expect(mocks.createUser).toHaveBeenLastCalledWith(expect.objectContaining({ fullName: 'New Staff', email: 'new@example.com', role: 'TICKETING', password: 'Strong-password123' }))
    expect(wrapper.find('.user-dialog h2').text()).toBe('Account created')
    expect(wrapper.find('.created code').text()).toBe('Strong-password123')
    wrapper.unmount()
  })
})
function gatePassenger(sailingStatus = 'BOARDING', ticketStatus = 'CHECKED_IN') {
  return { id: 'passenger', fullName: 'Test Passenger', ticketStatus, checkedInAt: '2026-10-02T08:00:00Z', booking: {
    reference: 'BOOKING-1', status: 'CONFIRMED', paymentStatus: 'PAID',
    sailing: { code: 'TRP2026-1002001', status: sailingStatus, departureAt: '2099-01-01T08:00:00Z' },
  } }
}

describe('editable passenger discounts', () => {
  it('renames existing Student, changes its percentage, and deletes every default discount', async () => {
    const wrapper = await load('fares')
    const student=wrapper.findAll('.custom-discount-row')[0]
    await student.find('input').setValue('Scholar')
    await student.find('input[type="number"]').setValue('35')
    expect(wrapper.find('.fare-preview').text()).toContain('PHP 650')
    await wrapper.find('main form').trigger('submit'); await flushPromises()
    expect(mocks.saveSettings).toHaveBeenLastCalledWith({},expect.objectContaining({passengerDiscounts:expect.arrayContaining([expect.objectContaining({name:'Scholar',percentage:35})])}))
    for(const row of wrapper.findAll('.custom-discount-row')) await row.find('button').trigger('click')
    await wrapper.find('main form').trigger('submit'); await flushPromises()
    expect(mocks.saveSettings).toHaveBeenLastCalledWith({},expect.objectContaining({passengerDiscounts:[]}))
    expect(wrapper.text()).toContain('regular fare only')
    wrapper.unmount()
  })
  it('adds, previews, saves and removes a named vessel discount', async () => {
    const wrapper = await load('fares')
    await wrapper.findAll('button').find(b => b.text() === '+ Add discount')!.trigger('click')
    const row = wrapper.findAll('.custom-discount-row').at(-1)!
    await row.find('input[placeholder="Special discount"]').setValue('Special discount')
    await row.find('input[type="number"]').setValue('15')
    expect(wrapper.find('.fare-preview').text()).toContain('PHP 850')
    await wrapper.find('main form').trigger('submit'); await flushPromises()
    expect(mocks.saveSettings).toHaveBeenLastCalledWith({}, expect.objectContaining({passengerDiscounts:expect.arrayContaining([expect.objectContaining({name:'Special discount',percentage:15,isActive:true})])}))
    await row.find('button').trigger('click')
    await wrapper.find('main form').trigger('submit'); await flushPromises()
    expect(mocks.saveSettings).toHaveBeenLastCalledWith({}, expect.objectContaining({passengerDiscounts:expect.not.arrayContaining([expect.objectContaining({name:'Special discount'})])}))
    wrapper.unmount()
  })
  it('rejects reserved names and keeps independent drafts per vessel', async () => {
    const wrapper = await load('fares')
    await wrapper.findAll('button').find(b => b.text() === '+ Add discount')!.trigger('click')
    await wrapper.findAll('.custom-discount-row').at(-1)!.find('input').setValue('Student')
    await wrapper.find('main form').trigger('submit'); await flushPromises()
    expect(mocks.saveSettings).not.toHaveBeenCalled()
    await wrapper.findAll('.custom-discount-row').at(-1)!.find('input').setValue('Special discount')
    await wrapper.find('#fare-vessel').setValue('unpriced')
    expect(wrapper.findAll('.custom-discount-row')).toHaveLength(5)
    await wrapper.find('#fare-vessel').setValue('vessel')
    expect((wrapper.findAll('.custom-discount-row').at(-1)!.find('input').element as HTMLInputElement).value).toBe('Special discount')
    wrapper.unmount()
  })
})

describe('admin boarding actions', () => {
  it('disables Board and explains that a scheduled trip must open boarding first', async () => {
    mocks.passengerRecords.mockResolvedValue({ data: { bookingPassengers: [gatePassenger('SCHEDULED')] } })
    const wrapper = await load('boarding')
    const button = wrapper.findAll('button').find(button => button.text() === 'Board')!
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.attributes('title')).toContain('Set trip TRP2026-1002001 to BOARDING')
    expect(wrapper.find('.boarding-row-action small').exists()).toBe(false)
    expect(wrapper.findAll('th').map(cell => cell.text())).toContain('Sailing status')
    await button.trigger('click')
    expect(mocks.board).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('boards an eligible passenger and refreshes the completed record', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    mocks.passengerRecords.mockResolvedValueOnce({ data: { bookingPassengers: [gatePassenger()] } }).mockResolvedValue({ data: { bookingPassengers: [gatePassenger('BOARDING', 'BOARDED')] } })
    const wrapper = await load('boarding')
    const button = wrapper.findAll('button').find(button => button.text() === 'Board')!
    expect(button.attributes('disabled')).toBeUndefined()
    await button.trigger('click'); await flushPromises()
    expect(mocks.board).toHaveBeenCalledWith({}, { passengerId: 'passenger' })
    expect(wrapper.text()).toContain('Test Passenger boarded for TRP2026-1002001.')
    expect(wrapper.findAll('button').find(button => button.text() === 'Boarded')!.attributes('disabled')).toBeDefined()
    confirm.mockRestore(); wrapper.unmount()
  })
  it('refreshes stale records after rejection and shows a readable error', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    mocks.passengerRecords.mockResolvedValueOnce({ data: { bookingPassengers: [gatePassenger()] } }).mockResolvedValue({ data: { bookingPassengers: [gatePassenger('DELAYED')] } })
    mocks.board.mockRejectedValue(new Error('DataConnect error while performing request: [{"message":"Trip must be BOARDING. (aborted)\\n(rolled back)","extensions":{"code":"PERMISSION_DENIED"}},{"message":"(aborted)"}]'))
    const wrapper = await load('boarding')
    await wrapper.findAll('button').find(button => button.text() === 'Board')!.trigger('click'); await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toBe('Trip must be BOARDING.')
    expect(wrapper.text()).not.toContain('DataConnect error')
    expect(wrapper.findAll('button').find(button => button.text() === 'Board')!.attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('button').find(button => button.text() === 'Board')!.attributes('title')).toContain('Current status: DELAYED.')
    confirm.mockRestore(); wrapper.unmount()
  })
})

describe('admin fare flow', () => {
  it('blocks creation if the next daily trip code cannot be loaded', async () => {
    mocks.nextCode.mockRejectedValue(new Error('Unavailable'))
    const wrapper = await load()
    await wrapper.findAll('button').find(button => button.text() === 'Create trip')!.trigger('click')
    expect(wrapper.find('main form, .modal-body form').exists()).toBe(false)
    expect(wrapper.text()).toContain('Refresh the trip code before creating a trip.')
    expect(mocks.createTrip).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('switches fare settings between vessels and preserves unsaved drafts separately', async () => {
    const wrapper = await load('fares')
    expect((wrapper.find('input[type="number"]').element as HTMLInputElement).value).toBe('1000')
    await wrapper.find('input[type="number"]').setValue('1500')
    await wrapper.find('#fare-vessel').setValue('vessel-2')
    expect((wrapper.find('input[type="number"]').element as HTMLInputElement).value).toBe('2000')
    expect(wrapper.find('.fare-preview').text()).toContain('PHP 1,800')
    await wrapper.find('main form, .modal-body form').trigger('submit'); await flushPromises()
    expect(mocks.saveSettings).toHaveBeenCalledWith({}, expect.objectContaining({ vesselId: 'vessel-2', regularFare: 2000, studentDiscount: 10 }))
    await wrapper.find('#fare-vessel').setValue('vessel')
    expect((wrapper.find('input[type="number"]').element as HTMLInputElement).value).toBe('1500')
    wrapper.unmount()
  })
  it('recalculates trip fares whenever its vessel changes', async () => {
    const wrapper = await load()
    await wrapper.findAll('button').find(button => button.text() === 'Create trip')!.trigger('click')
    const selector = wrapper.findAll('form select')[2]
    await selector.setValue('vessel')
    expect(wrapper.findAll('input[type="number"]').map(input => (input.element as HTMLInputElement).value)).toEqual(['1000', '800', '700', '500', '750', '1000'])
    await selector.setValue('vessel-2')
    expect(wrapper.findAll('input[type="number"]').map(input => (input.element as HTMLInputElement).value)).toEqual(['2000', '1800', '1600', '1200', '1400', '2000'])
    wrapper.unmount()
  })
  it('blocks an unpriced vessel and clears the previous vessel fares', async () => {
    const wrapper = await load()
    await wrapper.findAll('button').find(button => button.text() === 'Create trip')!.trigger('click')
    const selector = wrapper.findAll('form select')[2]
    await selector.setValue('vessel'); await selector.setValue('unpriced')
    expect(wrapper.findAll('input[type="number"]').map(input => (input.element as HTMLInputElement).value)).toEqual(['0', '0', '0', '0', '0', '0'])
    expect(wrapper.findAll('button').filter(button => button.text() === 'Create trip').at(-1)!.attributes('disabled')).toBeDefined()
    await wrapper.find('main form, .modal-body form').trigger('submit'); await flushPromises()
    expect(mocks.createTrip).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Save fare settings for the selected vessel')
    wrapper.unmount()
  })
  it('uses legacy global rates only as an unsaved starting point for vessel settings', async () => {
    mocks.settings.mockResolvedValue({ data: { fareSettings: { regularFare: 900, studentDiscount: 20, seniorDiscount: 20, childDiscount: 40, pwdDiscount: 20 }, vesselFareSettings: [] } })
    const wrapper = await load('fares')
    expect((wrapper.find('input[type="number"]').element as HTMLInputElement).value).toBe('900')
    expect(wrapper.text()).toContain('Rates not saved yet')
    await wrapper.find('main form, .modal-body form').trigger('submit'); await flushPromises()
    expect(mocks.saveSettings).toHaveBeenCalledWith({}, expect.objectContaining({ vesselId: 'vessel', regularFare: 900 }))
    expect(wrapper.text()).toContain('Saved rates')
    wrapper.unmount()
  })
  it('previews only active editable discounts when creating a new trip', async () => {
    mocks.settings.mockResolvedValue({data:{fareSettings:null,vesselFareSettings:[{code:'vessel',regularFare:1000,studentDiscount:0,seniorDiscount:0,childDiscount:0,pwdDiscount:0,pregnantDiscount:0,passengerDiscounts:[{id:'ffffffff-0000-4000-8000-000000000001',name:'Scholar',percentage:35,isActive:true},{id:'ffffffff-0000-4000-8000-000000000004',name:'PWD',percentage:20,isActive:false}]}]}})
    const wrapper = await load()
    await wrapper.findAll('button').find(b=>b.text()==='Create trip')!.trigger('click')
    await wrapper.findAll('form select')[2].setValue('vessel')
    expect(wrapper.find('.trip-discount-fares').text()).toContain('Scholar')
    expect(wrapper.find('.trip-discount-fares').text()).not.toContain('Student')
    expect(wrapper.find('.trip-discount-fares').text()).not.toContain('PWD')
    expect((wrapper.find('.trip-discount-fares input').element as HTMLInputElement).value).toBe('650')
    wrapper.unmount()
  })
  it('creates a trip with an automatic code and saved discounted fares', async () => {
    const wrapper = await load()
    await wrapper.findAll('button').find(button => button.text() === 'Create trip')!.trigger('click')
    const inputs = wrapper.findAll('main input, .modal-body input')
    expect(inputs[1].attributes('readonly')).toBeDefined()
    expect((inputs[1].element as HTMLInputElement).value).toBe('TRP2026-1002001')
    const selects = wrapper.findAll('form select')
    await selects[0].setValue('origin'); await selects[1].setValue('destination'); await selects[2].setValue('vessel')
    const amounts = wrapper.findAll('input[type="number"]')
    expect(amounts.map(input => (input.element as HTMLInputElement).value)).toEqual(['1000', '800', '700', '500', '750', '1000'])
    expect(amounts.every(input => input.attributes('readonly') !== undefined)).toBe(true)
    const dates = wrapper.findAll('input[type="datetime-local"]')
    await dates[0].setValue('2099-01-02T08:00'); await dates[1].setValue('2099-01-02T10:00')
    await wrapper.find('main form, .modal-body form').trigger('submit'); await flushPromises()
    expect(mocks.createTrip).toHaveBeenCalledWith({}, expect.objectContaining({ regularFare: 1000, studentFare: 800, seniorFare: 700, childFare: 500, pwdFare: 750 }))
    expect(wrapper.text()).toContain('TRP2026-1002002 created.')
    wrapper.unmount()
  })
  it('saves rates from the sidebar page with a live preview', async () => {
    const wrapper = await load('fares')
    await wrapper.find('input[type="number"]').setValue('2000')
    expect(wrapper.find('.fare-preview').text()).toContain('PHP 1,600')
    await wrapper.find('main form, .modal-body form').trigger('submit'); await flushPromises()
    expect(mocks.saveSettings).toHaveBeenCalledWith({}, expect.objectContaining({ vesselId: 'vessel', regularFare: 2000, studentDiscount: 20, seniorDiscount: 30, childDiscount: 50, pwdDiscount: 25, pregnantDiscount: 0 }))
    expect(wrapper.text()).toContain('New trips for this vessel will use these rates.')
    wrapper.unmount()
  })
  it('blocks creation when saved rates cannot be loaded', async () => {
    mocks.settings.mockRejectedValue(new Error('Unavailable'))
    const wrapper = await load()
    await wrapper.findAll('button').find(button => button.text() === 'Create trip')!.trigger('click')
    expect(wrapper.find('main form, .modal-body form').exists()).toBe(false)
    expect(wrapper.text()).toContain('Refresh fare settings before creating a trip.')
    expect(mocks.createTrip).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('preserves existing fares on opening an edit and recalculates when regular fare changes', async () => {
    const wrapper = await load()
    await wrapper.findAll('button').find(button => button.text() === 'Edit')!.trigger('click'); await flushPromises()
    const amounts = wrapper.findAll('input[type="number"]')
    expect(amounts.map(input => (input.element as HTMLInputElement).value)).toEqual(['600', '420', '450', '300', '400', '600'])
    await amounts[0].setValue('1200')
    expect(amounts.map(input => (input.element as HTMLInputElement).value)).toEqual(['1200', '960', '840', '600', '900', '1200'])
    wrapper.unmount()
  })
  it('keeps fares locked for trips with active reservations', async () => {
    mocks.bookings.mockResolvedValue({ data: { bookings: [{ id: 'booking', bookingChannel: 'ONLINE' }] } })
    const wrapper = await load()
    await wrapper.findAll('button').find(button => button.text() === 'Edit')!.trigger('click'); await flushPromises()
    expect(wrapper.find('input[type="number"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Only departure and arrival can be changed.')
    wrapper.unmount()
  })
})
