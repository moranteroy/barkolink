import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminReportsPanel from '../../src/components/admin/AdminReportsPanel.vue'
import { reportNumberFields } from '../../src/data/reportAnalytics'
const mocks = vi.hoisted(() => ({ reports: vi.fn() }))
vi.mock('../../src/services/session', () => ({ staffDatabase: {} }))
vi.mock('../../src/services/database/staff', () => ({ adminReports: mocks.reports }))
const row = (code: string, vesselId: string, vessel: string, revenue: number) => ({ ...Object.fromEntries(reportNumberFields.map(k => [k,0])), code, vesselId, vessel, departureAt: '2026-10-02T08:00:00Z', originId: 'a', origin: 'Origin', destinationId: 'b', destination: 'Destination', status: 'SCHEDULED', collectedRevenue: revenue, capacity: 100, reservedSeats: 25 })
beforeEach(() => { mocks.reports.mockReset(); mocks.reports.mockResolvedValue({ data: { sailings: [row('TRP1','v1','Ferry One',100),row('TRP2','v2','Ferry Two',300)] } }) })
describe('admin reports panel', () => {
  it('loads reports, filters analytics by vessel, and groups the details', async () => {
    const wrapper = mount(AdminReportsPanel, { props: { refreshToken: 0 } }); await flushPromises()
    expect(mocks.reports).toHaveBeenCalledWith({},expect.objectContaining({ startAt: expect.any(String), endAt: expect.any(String) }),{ fetchPolicy: 'SERVER_ONLY' })
    expect(wrapper.findAll('.table-scroll tbody tr')).toHaveLength(2)
    await wrapper.findAll('select')[2].setValue('v2')
    expect(wrapper.findAll('.table-scroll tbody tr')).toHaveLength(1)
    expect(wrapper.find('.metrics').text()).toContain('₱300')
    await wrapper.findAll('.tabs button')[2].trigger('click')
    expect(wrapper.find('.table-scroll tbody').text()).toContain('Ferry Two')
    expect(wrapper.find('.table-scroll tbody').text()).not.toContain('Ferry One')
    wrapper.unmount()
  })
  it('shows service errors and recovers after refresh', async () => {
    mocks.reports.mockRejectedValueOnce(new Error('Offline'))
    const wrapper = mount(AdminReportsPanel, { props: { refreshToken: 0 } }); await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(wrapper.find('.metrics').exists()).toBe(false)
    await wrapper.setProps({ refreshToken: 1 }); await flushPromises()
    expect(wrapper.find('.metrics').exists()).toBe(true)
    wrapper.unmount()
  })
  it('does not request invalid date ranges or show stale charts', async () => {
    const wrapper = mount(AdminReportsPanel, { props: { refreshToken: 0 } }); await flushPromises()
    await wrapper.findAll('input[type="date"]')[0].setValue('2099-01-01'); await flushPromises()
    expect(mocks.reports).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(wrapper.find('.charts').exists()).toBe(false)
    wrapper.unmount()
  })
  it('ignores older requests that finish after a refresh', async () => {
    let finishOld!: (value: unknown) => void
    mocks.reports.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve }))
    const wrapper = mount(AdminReportsPanel, { props: { refreshToken: 0 } })
    await wrapper.setProps({ refreshToken: 1 }); await flushPromises()
    finishOld({ data: { sailings: [row('OLD','v3','Old Ferry',999)] } }); await flushPromises()
    expect(wrapper.find('.table-scroll tbody').text()).toContain('TRP1')
    expect(wrapper.find('.table-scroll tbody').text()).not.toContain('OLD')
    wrapper.unmount()
  })
})
