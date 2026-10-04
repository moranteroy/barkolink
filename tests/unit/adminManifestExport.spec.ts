import { Blob } from 'node:buffer'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminManifestExport from '../../src/components/AdminManifestExport.vue'
import { reportNumberFields, type ReportSailing } from '../../src/data/reportAnalytics'
const mocks = vi.hoisted(() => ({ query: vi.fn(), url: vi.fn(), revoke: vi.fn() }))
vi.mock('../../src/services/firebase', () => ({ staffDataConnect: {} }))
vi.mock('../../src/dataconnect-generated/staff', () => ({ adminExportManifest: mocks.query }))
const sailing = { ...Object.fromEntries(reportNumberFields.map(k => [k,0])), code: 'TRP1', departureAt: '2026-10-02T08:00:00Z', status: 'SCHEDULED', originId: 'a', origin: 'A', destinationId: 'b', destination: 'B', vesselId: 'v', vessel: 'Ferry' } as ReportSailing
const passenger = { fullName: 'Test Passenger', sex: 'F', passengerType: 'REGULAR', ticketStatus: 'ISSUED', boardedAt: null, booking: { reference: 'BOOK1', sailing: { code: 'TRP1' } } }
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('Blob',Blob)
  vi.stubGlobal('URL',{ createObjectURL: mocks.url.mockReturnValue('blob:manifest'), revokeObjectURL: mocks.revoke })
  vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(() => {})
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
describe('manifest export in reports', () => {
  it('exports the selected sailing with every page of passengers', async () => {
    mocks.query.mockResolvedValueOnce({ data: { bookingPassengers: Array.from({ length: 500 }, () => passenger) } }).mockResolvedValueOnce({ data: { bookingPassengers: [{ ...passenger, fullName: 'Last Passenger' }] } })
    const wrapper = mount(AdminManifestExport,{ props: { sailings: [sailing] } })
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
    await wrapper.find('select').setValue('TRP1'); await wrapper.find('button').trigger('click'); await flushPromises()
    expect(mocks.query.mock.calls.map(c => c[1])).toEqual([{ sailingCode: 'TRP1', offset: 0 },{ sailingCode: 'TRP1', offset: 500 }])
    const csv = await (mocks.url.mock.calls[0][0] as Blob).text()
    expect(csv.split('\r\n')).toHaveLength(502)
    expect(csv).toContain('Last Passenger')
    expect(wrapper.text()).toContain('Exported 501 passengers for TRP1.')
    wrapper.unmount()
  })
  it('does not download an empty manifest and resets invalid sailing selections', async () => {
    mocks.query.mockResolvedValue({ data: { bookingPassengers: [] } })
    const wrapper = mount(AdminManifestExport,{ props: { sailings: [sailing] } })
    await wrapper.find('select').setValue('TRP1'); await wrapper.find('button').trigger('click'); await flushPromises()
    expect(mocks.url).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('No paid, confirmed passengers')
    await wrapper.setProps({ sailings: [] })
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
    expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('')
    wrapper.unmount()
  })
  it('shows failures without downloading a partial manifest', async () => {
    mocks.query.mockResolvedValueOnce({ data: { bookingPassengers: Array.from({ length: 500 }, () => passenger) } }).mockRejectedValueOnce(new Error('Unavailable'))
    const wrapper = mount(AdminManifestExport,{ props: { sailings: [sailing] } })
    await wrapper.find('select').setValue('TRP1'); await wrapper.find('button').trigger('click'); await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(mocks.url).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
