import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import SettingsPage from '../../src/views/shared/SettingsPage.vue'
import ProfilePage from '../../src/views/passenger/ProfilePage.vue'
import StaffSettingsPage from '../../src/views/shared/StaffSettingsPage.vue'
const mocks = vi.hoisted(() => ({
  route: { path: '/settings/profile', params: {} as Record<string,string> }, enter: undefined as (() => void) | undefined,
  profile: vi.fn(), save: vi.fn(), sync: vi.fn(), reauth: vi.fn(), password: vi.fn(), logout: vi.fn(), replace: vi.fn(), clear: vi.fn(),
}))
vi.mock('vue-router', () => ({ onBeforeRouteLeave: vi.fn(), onBeforeRouteUpdate: vi.fn(), useRoute: () => mocks.route, useRouter: () => ({ replace: mocks.replace }) }))
vi.mock('@ionic/vue', () => ({
  IonPage: { template: '<div><slot /></div>' }, IonContent: { template: '<div><slot /></div>' },
  IonButton: { template: '<button><slot /></button>' }, IonIcon: { template: '<span />' },
  onIonViewWillEnter: (callback: () => void) => { mocks.enter = callback }, onIonViewDidEnter: vi.fn(), useIonRouter: () => ({ navigate: vi.fn() }),
}))
vi.mock('../../src/services/session', () => ({ database: {}, auth: { currentUser: { uid: 'owner', email: 'owner@example.invalid', displayName: 'Passenger One' } } }))
vi.mock('../../src/services/database/passenger', () => ({ myProfile: mocks.profile, updateMyProfile: mocks.save }))
vi.mock('../../src/services/auth', () => ({ syncAccountProfileName: mocks.sync, PasswordAuthProvider: { credential: (email: string, password: string) => ({ email, password }) }, reauthenticateWithCredential: mocks.reauth, updatePassword: mocks.password, signOut: mocks.logout }))
vi.mock('../../src/composables/sessionViews', () => ({ clearSessionViews: mocks.clear }))
vi.mock('../../src/components/shared/ThemeSwitcher.vue', () => ({ default: { template: '<div />' } }))
const options = { global: { stubs: { PassengerHeader: true, PassengerBottomNav: true, BrandMark: true, ThemeSwitcher: true, RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } } }
const original = { fullName: 'Passenger One', email: 'owner@example.invalid', phone: '09123456789' }
describe('Passenger profile and settings', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.route.path = '/settings/profile'
    mocks.profile.mockResolvedValue({ data: { user: original } }); mocks.save.mockResolvedValue({ data: {} })
    mocks.reauth.mockResolvedValue(undefined); mocks.password.mockResolvedValue(undefined); mocks.logout.mockResolvedValue(undefined)
  })
  it('blocks saving when loading fails and offers a working retry', async () => {
    mocks.profile.mockRejectedValueOnce(new Error('offline'))
    const wrapper = mount(SettingsPage, options); await flushPromises()
    expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined()
    await wrapper.get('form').trigger('submit'); expect(mocks.save).not.toHaveBeenCalled()
    await wrapper.get('[role="alert"] button').trigger('click'); await flushPromises()
    expect(wrapper.get('input[autocomplete="name"]').element).toHaveProperty('value', 'Passenger One')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false); wrapper.unmount()
  })
  it('validates input and saves once, synchronizing the visible name only after success', async () => {
    const wrapper = mount(SettingsPage, options); await flushPromises()
    await wrapper.get('input[autocomplete="name"]').setValue('  Maria   Santos  ')
    await wrapper.get('input[type="tel"]').setValue('bad number')
    await wrapper.get('form').trigger('submit'); expect(mocks.save).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toContain('valid contact number')
    await wrapper.get('input[type="tel"]').setValue('+63 (912) 345-6789')
    let finish!: (value: unknown) => void
    mocks.save.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    await wrapper.get('form').trigger('submit'); await wrapper.get('form').trigger('submit')
    expect(mocks.save).toHaveBeenCalledTimes(1); expect(mocks.sync).not.toHaveBeenCalled()
    expect(mocks.save.mock.calls[0][1]).toEqual({ fullName: 'Maria Santos', phone: '+639123456789' })
    finish({ data: {} }); await flushPromises()
    expect(mocks.sync).toHaveBeenCalledWith('owner', 'Maria Santos')
    expect(wrapper.text()).toContain('Your profile has been updated.')
    expect(wrapper.text()).toContain('Your saved details are up to date.')
    wrapper.unmount()
  })
  it('retains failed edits, protects a draft on reentry, and supports discarding it', async () => {
    const wrapper = mount(SettingsPage, options); await flushPromises()
    await wrapper.get('input[autocomplete="name"]').setValue('New name')
    mocks.enter?.(); await flushPromises(); expect(mocks.profile).toHaveBeenCalledTimes(1)
    mocks.save.mockRejectedValueOnce(new Error('offline'))
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(wrapper.get('input[autocomplete="name"]').element).toHaveProperty('value', 'New name')
    expect(mocks.sync).not.toHaveBeenCalled()
    await wrapper.get('.discard').trigger('click')
    expect(wrapper.get('input[autocomplete="name"]').element).toHaveProperty('value', 'Passenger One')
    mocks.profile.mockResolvedValueOnce({ data: { user: { ...original, fullName: 'Updated elsewhere' } } })
    mocks.enter?.(); await flushPromises()
    expect(wrapper.get('input[autocomplete="name"]').element).toHaveProperty('value', 'Updated elsewhere')
    wrapper.unmount()
  })
  it('shows a dedicated security page and prevents duplicate password changes', async () => {
    mocks.route.path = '/settings/password'
    const wrapper = mount(SettingsPage, options); await flushPromises()
    expect(wrapper.find('#personal-info').exists()).toBe(false)
    const inputs = wrapper.findAll('input[type="password"]')
    await inputs[0].setValue('OldPassword123'); await inputs[1].setValue('NewPassword123'); await inputs[2].setValue('NewPassword123')
    let finish!: () => void
    mocks.reauth.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve }))
    await wrapper.get('form').trigger('submit'); await wrapper.get('form').trigger('submit')
    expect(mocks.reauth).toHaveBeenCalledTimes(1); expect(mocks.password).not.toHaveBeenCalled()
    finish(); await flushPromises(); expect(mocks.password).toHaveBeenCalledTimes(1)
    expect(mocks.password.mock.calls[0][1]).toBe('NewPassword123')
    expect(inputs[0].element).toHaveProperty('value', ''); wrapper.unmount()
  })
  it('loads the real account into a profile hub with working destinations and logout', async () => {
    mocks.route.path = '/profile'
    const wrapper = mount(ProfilePage, options); await flushPromises()
    expect(wrapper.get('h1').text()).toBe('Passenger One')
    expect(wrapper.text()).toContain('09123456789')
    for (const href of ['/settings/profile','/settings/password','/travelers','/notifications','/settings/appearance','/help','/privacy']) expect(wrapper.find(`a[href="${href}"]`).exists()).toBe(true)
    await wrapper.get('.logout').trigger('click'); await flushPromises()
    expect(mocks.logout).toHaveBeenCalledTimes(1); expect(mocks.clear).toHaveBeenCalledTimes(1)
    expect(mocks.replace).toHaveBeenCalledWith('/login'); wrapper.unmount()
  })
})


describe('All-role settings', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.route.params = {}
    mocks.profile.mockResolvedValue({ data: { user: original } }); mocks.save.mockResolvedValue({ data: {} })
    mocks.reauth.mockResolvedValue(undefined); mocks.password.mockResolvedValue(undefined)
  })
  it('allows administrators to edit their own profile and open security settings', async () => {
    mocks.route.path = '/admin/settings/profile'
    const wrapper = mount(SettingsPage, options); await flushPromises()
    await wrapper.get('input[autocomplete="name"]').setValue('Administrator One')
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(mocks.save.mock.calls[0][1].fullName).toBe('Administrator One')
    expect(wrapper.find('a[href="/admin/settings/password"]').exists()).toBe(true)
    expect(wrapper.find('#appearance').exists()).toBe(false)
    wrapper.unmount()
  })
  for (const role of ['ticketing','boarding']) {
    it(role + ' retains failed contact edits, prevents duplicate saves and supports discard', async () => {
      mocks.route.path = '/staff/' + role + '/settings/account'; mocks.route.params = { role, section: 'account' }
      const wrapper = mount(StaffSettingsPage, options); await flushPromises()
      await wrapper.get('input[type="tel"]').setValue('invalid')
      await wrapper.get('form').trigger('submit'); await flushPromises()
      expect(mocks.save).not.toHaveBeenCalled(); expect(wrapper.get('[role="alert"]').text()).toContain('valid contact number')
      await wrapper.get('input[type="tel"]').setValue('+63 (998) 765-4321')
      let fail!: (error: Error) => void
      mocks.save.mockReturnValueOnce(new Promise((resolve, reject) => { fail = reject }))
      await wrapper.get('form').trigger('submit'); await wrapper.get('form').trigger('submit')
      expect(mocks.save).toHaveBeenCalledTimes(1)
      expect(mocks.save.mock.calls[0][1].phone).toBe('+639987654321')
      fail(new Error('offline')); await flushPromises()
      mocks.enter?.(); await flushPromises(); expect(mocks.profile).toHaveBeenCalledTimes(1)
      expect(wrapper.get('input[type="tel"]').element).toHaveProperty('value', '+63 (998) 765-4321')
      await wrapper.findAll('button').find(button => button.text() === 'Discard changes')!.trigger('click')
      expect(wrapper.get('input[type="tel"]').element).toHaveProperty('value', original.phone)
      wrapper.unmount()
    })
    it(role + ' protects password changes against duplicate submission', async () => {
      mocks.route.path = '/staff/' + role + '/settings/security'; mocks.route.params = { role, section: 'security' }
      const wrapper = mount(StaffSettingsPage, options); await flushPromises()
      const inputs = wrapper.findAll('input[type="password"]')
      await inputs[0].setValue('OldPassword123'); await inputs[1].setValue('NewPassword123'); await inputs[2].setValue('NewPassword123')
      let finish!: () => void
      mocks.reauth.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve }))
      await wrapper.get('form').trigger('submit'); await wrapper.get('form').trigger('submit')
      expect(mocks.reauth).toHaveBeenCalledTimes(1)
      finish(); await flushPromises(); expect(mocks.password.mock.calls[0][1]).toBe('NewPassword123')
      expect(inputs[0].element).toHaveProperty('value', '')
      wrapper.unmount()
    })
  }
})
