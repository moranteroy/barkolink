import { clearToasts, toastMessages } from '../../src/composables/toast';
import { Blob } from 'node:buffer'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminManifestExport from '../../src/components/admin/AdminManifestExport.vue'
import { reportNumberFields, type ReportSailing } from '../../src/data/reportAnalytics'
const mocks = vi.hoisted(() => ({ query: vi.fn(), url: vi.fn(), revoke: vi.fn(), pdf: vi.fn() }))
vi.mock('../../src/data/reportPdf', () => ({ createReportPdf: mocks.pdf }))
vi.mock('../../src/services/session', () => ({ staffDatabase: {} }))
vi.mock('../../src/services/database/staff', () => ({ adminExportManifest: mocks.query }))
const sailing = { ...Object.fromEntries(reportNumberFields.map(k => [k,0])), code: 'TRP1', departureAt: '2026-10-02T08:00:00Z', status: 'SCHEDULED', originId: 'a', origin: 'A', destinationId: 'b', destination: 'B', vesselId: 'v', vessel: 'Ferry' } as ReportSailing
const passenger = { fullName: 'Test Passenger', sex: 'F', passengerType: 'REGULAR', ticketStatus: 'ISSUED', boardedAt: null, booking: { reference: 'BOOK1', sailing: { code: 'TRP1' } } }
beforeEach(() => { clearToasts();
  vi.clearAllMocks()
  mocks.pdf.mockResolvedValue({output: () => new Blob(['%PDF-1.4'],{type:'application/pdf'})})
  vi.stubGlobal('Blob',Blob)
  vi.stubGlobal('URL',{ createObjectURL: mocks.url.mockReturnValue('blob:manifest'), revokeObjectURL: mocks.revoke })
  vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(() => {})
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
describe('manifest export in reports', () => {
  it('uses the page sailing filter without displaying a second selector', async () => {
    mocks.query.mockResolvedValue({ data: { bookingPassengers: [] } })
    const wrapper = mount(AdminManifestExport, { props: { sailings: [sailing], sailingCode: '', externalSelection: true } })
    expect(wrapper.find('select').exists()).toBe(false)
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
    await wrapper.setProps({ sailingCode: 'TRP1' })
    await wrapper.find('button').trigger('click'); await flushPromises(); await vi.dynamicImportSettled(); await flushPromises()
    expect(mocks.query).toHaveBeenCalledWith({}, { sailingCode: 'TRP1', offset: 0 }, { fetchPolicy: 'SERVER_ONLY' })
    await wrapper.setProps({ sailingCode: '' })
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
    expect(wrapper.find('select').exists()).toBe(false)
    wrapper.unmount()
  })
  it('exports the workspace sailing without a second selector and updates when the sailing changes', async () => {
    mocks.query.mockResolvedValue({ data: { bookingPassengers: [] } })
    const wrapper = mount(AdminManifestExport, { props: { sailings: [sailing], sailingCode: 'TRP1' } })
    expect(wrapper.find('select').exists()).toBe(false)
    await wrapper.find('button').trigger('click'); await flushPromises(); await vi.dynamicImportSettled(); await flushPromises()
    expect(mocks.query).toHaveBeenLastCalledWith({}, { sailingCode: 'TRP1', offset: 0 }, { fetchPolicy: 'SERVER_ONLY' })
    await wrapper.setProps({ sailings: [{ ...sailing, code: 'TRP2' }], sailingCode: 'TRP2' })
    await wrapper.find('button').trigger('click'); await flushPromises(); await vi.dynamicImportSettled(); await flushPromises()
    expect(mocks.query).toHaveBeenLastCalledWith({}, { sailingCode: 'TRP2', offset: 0 }, { fetchPolicy: 'SERVER_ONLY' })
    wrapper.unmount()
  })
  it('exports the selected sailing with every page of passengers', async () => {
    mocks.query.mockResolvedValueOnce({ data: { bookingPassengers: Array.from({ length: 500 }, () => passenger) } }).mockResolvedValueOnce({ data: { bookingPassengers: [{ ...passenger, fullName: 'Last Passenger',sex:'  ' }] } })
    const wrapper = mount(AdminManifestExport,{ props: { sailings: [sailing] } })
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
    await wrapper.find('select').setValue('TRP1'); await wrapper.find('button').trigger('click'); await flushPromises(); await vi.dynamicImportSettled(); await flushPromises()
    expect(mocks.query.mock.calls.map(c => c[1])).toEqual([{ sailingCode: 'TRP1', offset: 0 },{ sailingCode: 'TRP1', offset: 500 }])
    expect((mocks.url.mock.calls[0][0] as Blob).type).toBe('application/pdf')
    const input = mocks.pdf.mock.calls[0][0]
    expect(input.rows).toHaveLength(501)
    expect(input.rows.at(-1)[0]).toBe('Last Passenger')
    expect(input.rows[0][1]).toBe('F')
    expect(input.rows.at(-1)[1]).toBe('Not provided')
    expect(toastMessages.value.filter(toast => toast.message === 'Exported 501 passengers for TRP1.')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('Exported 501 passengers for TRP1.')
    wrapper.unmount()
  })
  it('does not download an empty manifest and resets invalid sailing selections', async () => {
    mocks.query.mockResolvedValue({ data: { bookingPassengers: [] } })
    const wrapper = mount(AdminManifestExport,{ props: { sailings: [sailing] } })
    await wrapper.find('select').setValue('TRP1'); await wrapper.find('button').trigger('click'); await flushPromises(); await vi.dynamicImportSettled(); await flushPromises()
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
    await wrapper.find('select').setValue('TRP1'); await wrapper.find('button').trigger('click'); await flushPromises(); await vi.dynamicImportSettled(); await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(toastMessages.value.some(toast => toast.tone === 'error')).toBe(true)
    expect(mocks.url).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('discards the PDF if its sailing selection changes while rendering', async () => {
    let finish!: (value: unknown) => void
    mocks.query.mockResolvedValue({data:{bookingPassengers:[passenger]}})
    mocks.pdf.mockImplementation(()=>new Promise(resolve=>{finish=resolve}))
    const wrapper=mount(AdminManifestExport,{props:{sailings:[sailing],sailingCode:'TRP1'}})
    await wrapper.find('button').trigger('click');await flushPromises();await vi.dynamicImportSettled();await flushPromises()
    await wrapper.setProps({sailings:[{...sailing,code:'TRP2'}],sailingCode:'TRP2'})
    finish({output:()=>new Blob(['%PDF-1.4'],{type:'application/pdf'})});await flushPromises()
    expect(mocks.url).not.toHaveBeenCalled();wrapper.unmount()
  })
})
