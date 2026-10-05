import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PaymentDeadline from '../../src/components/passenger/PaymentDeadline.vue'
vi.mock('@ionic/vue', () => ({ IonIcon: { template: '<span />' } }))
afterEach(() => vi.useRealTimers())
describe('Stored reservation deadline', () => {
  it('does not reset on remount and requests authoritative status once when time runs out', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-04T12:00:00Z'))
    const deadline = '2026-10-04T12:00:05Z'
    const first = mount(PaymentDeadline, { props: { deadline } })
    expect(first.text()).toContain('0h 00m 05s')
    await vi.advanceTimersByTimeAsync(3000)
    first.unmount()
    const second = mount(PaymentDeadline, { props: { deadline } })
    expect(second.text()).toContain('0h 00m 02s')
    await vi.advanceTimersByTimeAsync(5000)
    expect(second.emitted('expired')).toHaveLength(1)
    expect(second.text()).toContain('Checking your reservation status')
    second.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('checks an already elapsed deadline and ignores invalid timestamps', () => {
    vi.useFakeTimers()
    const past = mount(PaymentDeadline, { props: { deadline: '2000-01-01T00:00:00Z' } })
    expect(past.emitted('expired')).toHaveLength(1)
    past.unmount()
    const invalid = mount(PaymentDeadline, { props: { deadline: 'invalid' } })
    expect(invalid.text()).toBe('')
    expect(invalid.emitted('expired')).toBeUndefined()
    invalid.unmount()
  })
})
