import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AuthPage from '../../src/views/auth/AuthPage.vue'

const mocks = vi.hoisted(() => ({
  route: { path: '/login', fullPath: '/login', query: {} },
  replace: vi.fn(), signIn: vi.fn(), register: vi.fn(), reset: vi.fn(), profile: vi.fn(), createProfile: vi.fn(),
}))
vi.mock('vue-router', () => ({
  useRoute: () => mocks.route, useRouter: () => ({ replace: mocks.replace }),
  RouterLink: { template: '<a><slot /></a>' },
}))
vi.mock('@ionic/vue', () => ({
  IonPage: { template: '<div><slot /></div>' }, IonContent: { template: '<div><slot /></div>' },
  IonButton: { template: '<button><slot /></button>' }, IonIcon: { template: '<span />' },
}))
vi.mock('../../src/services/session', () => ({ database: {}, requireAuth: () => ({}) }))
vi.mock('../../src/services/auth', () => ({
  registerAccount: mocks.register, signInWithPassword: mocks.signIn, sendPasswordResetEmail: mocks.reset,
  updateAccountProfile: vi.fn(),
}))
vi.mock('../../src/services/database/passenger', () => ({ myProfile: mocks.profile, createMyProfile: mocks.createProfile }))

describe('Account forms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.route.path = '/login'; mocks.route.fullPath = '/login'
    mocks.replace.mockResolvedValue(undefined)
  })
  it('prevents repeated sign-in submissions and preserves staff destinations', async () => {
    let finish!: (value: unknown) => void
    mocks.signIn.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const wrapper = mount(AuthPage)
    await wrapper.get('#email').setValue('staff@example.invalid')
    await wrapper.get('#password').setValue('Password123!')
    await wrapper.get('form').trigger('submit')
    await wrapper.get('form').trigger('submit')
    expect(mocks.signIn).toHaveBeenCalledTimes(1)
    expect(wrapper.get('.submit-button').attributes('disabled')).toBeDefined()
    finish({ user: { getRoleSession: async () => ({ claims: { role: 'TICKETING' } }) } })
    await flushPromises()
    expect(mocks.replace).toHaveBeenCalledWith('/staff/ticketing')
    expect(mocks.profile).not.toHaveBeenCalled()
    expect(wrapper.get('.submit-button').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })
  it('restores the submit button after invalid credentials', async () => {
    mocks.signIn.mockRejectedValue({ code: 'invalid_credentials' })
    const wrapper = mount(AuthPage)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('do not match')
    expect(wrapper.get('.submit-button').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })
  it('requires privacy acknowledgement before registration', async () => {
    mocks.route.path = '/register'
    const wrapper = mount(AuthPage)
    await wrapper.get('#password').setValue('Password123!')
    await wrapper.get('#confirm-password').setValue('Password123!')
    await wrapper.get('form').trigger('submit')
    expect(mocks.register).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toContain('privacy notice')
    wrapper.unmount()
  })
  it('shows email confirmation instructions and allows a subsequent submission', async () => {
    mocks.route.path = '/register'
    mocks.register.mockResolvedValue({ user: { email: 'test@example.invalid' }, session: null })
    const wrapper = mount(AuthPage)
    await wrapper.get('#password').setValue('Password123!')
    await wrapper.get('#confirm-password').setValue('Password123!')
    await wrapper.get('#terms').setValue(true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toContain('confirm your account')
    expect(wrapper.get('.submit-button').attributes('disabled')).toBeUndefined()
    expect(mocks.createProfile).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
