import { flushPromises, mount } from '@vue/test-utils'
import HomePage from '@/views/passenger/HomePage.vue'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ enter: undefined as (() => void) | undefined, profile: vi.fn(), bookings: vi.fn() }))
vi.mock('@ionic/vue', () => ({
  IonPage: { template: '<div><slot /></div>' },
  IonContent: { template: '<div><slot /></div>' },
  IonButton: { template: '<button><slot /></button>' },
  IonIcon: { template: '<span />' },
  onIonViewWillEnter: (callback: () => void) => { mocks.enter = callback },
}))
vi.mock('../../src/services/session', () => ({
  auth: { currentUser: { uid: 'passenger-test', displayName: 'Passenger One', email: 'test@example.invalid' } },
  database: {},
}))
vi.mock('../../src/services/database/passenger', () => ({ myProfile: mocks.profile, myBookings: mocks.bookings }))

const options = { global: { stubs: { PassengerHeader: true, PassengerBottomNav: true, TripSearchCard: true, AdvisoryBanner: true, 'router-link': { template: '<a><slot /></a>' } } } }

describe('HomePage.vue', () => {
  beforeEach(() => {
    mocks.profile.mockReset().mockResolvedValue({ data: { user: { fullName: 'Passenger One' } } })
    mocks.bookings.mockReset().mockResolvedValue({ data: { bookings: [] } })
  })

  test('loads the signed-in passenger and shows an empty upcoming trip', async () => {
    const wrapper = mount(HomePage, options)
    mocks.enter?.()
    await flushPromises()
    expect(wrapper.text()).toContain('Passenger!')
    expect(wrapper.text()).toContain('No upcoming trip')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    wrapper.unmount()
  })

  test('explains a permission failure and reloads successfully on Retry', async () => {
    mocks.profile.mockRejectedValueOnce(new Error('{"error":{"code":403,"status":"PERMISSION_DENIED","message":"@auth rejected the request"}}'))
    const wrapper = mount(HomePage, options)
    mocks.enter?.()
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Sign in again')
    expect(wrapper.text()).not.toContain('@auth rejected')
    await wrapper.get('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
