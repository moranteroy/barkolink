import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OperationsPanel from '../../src/components/admin/OperationsPanel.vue'
const mocks = vi.hoisted(() => ({ settings: vi.fn(), save: vi.fn(), activity: vi.fn() }))
vi.mock('../../src/services/session', () => ({ staffDatabase: {} }))
vi.mock('../../src/services/database/operations', () => ({ operationSettings: mocks.settings, saveOperationSettings: mocks.save, activityLog: mocks.activity }))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.settings.mockResolvedValue({ data: { reservationMinutes: 1440 } })
  mocks.save.mockResolvedValue({ data: {} })
  mocks.activity.mockResolvedValue({ data: { records: [], totalCount: 0 } })
})
describe('operations settings', () => {
  it('prevents saving fallback settings after loading fails and permits saving after Retry', async () => {
    mocks.settings.mockRejectedValueOnce(new Error('Offline'));
    const wrapper = mount(OperationsPanel, { global: { stubs: { RouterLink: true } } });
    await flushPromises();
    expect(wrapper.find('input').attributes('disabled')).toBeDefined();
    await wrapper.find('form').trigger('submit');
    expect(mocks.save).not.toHaveBeenCalled();
    await wrapper.findAll('button').find(button => button.text().includes('Retry'))!.trigger('click');
    await flushPromises();
    await wrapper.find('input').setValue('12');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(mocks.save).toHaveBeenCalledWith({}, 720);
    wrapper.unmount();
  });
  it('links to settings history without loading a duplicate activity log', async () => {
    const wrapper=mount(OperationsPanel,{global:{stubs:{RouterLink:{props:['to'],template:'<a :href="to"><slot /></a>'}}}}); await flushPromises()
    expect(wrapper.find('.history-link').attributes('href')).toBe('/admin/audit-logs?entityType=operation_settings')
    expect(wrapper.text()).toContain('View settings history')
    expect(wrapper.text()).not.toContain('Operations activity log')
    expect(mocks.activity).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('loads the 24-hour deadline and saves changes in minutes', async () => {
    const wrapper = mount(OperationsPanel,{global:{stubs:{RouterLink:true}}}); await flushPromises()
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('24')
    await wrapper.find('input').setValue('12'); await wrapper.find('form').trigger('submit'); await flushPromises()
    expect(mocks.save).toHaveBeenCalledWith({}, 720)
    expect(wrapper.text()).toContain('saved for new reservations')
    wrapper.unmount()
  })
  it('rejects a payment deadline shorter than five minutes', async () => {
    const wrapper = mount(OperationsPanel,{global:{stubs:{RouterLink:true}}}); await flushPromises()
    await wrapper.find('input').setValue('0'); await wrapper.find('form').trigger('submit')
    expect(mocks.save).not.toHaveBeenCalled()
    expect(wrapper.find('[role=alert]').text()).toContain('5 minutes to 7 days')
    wrapper.unmount()
  })
  it('previews a selected deadline before saving and retains it on failure', async () => {
    const wrapper=mount(OperationsPanel,{global:{stubs:{RouterLink:true}}}); await flushPromises()
    await wrapper.findAll('.deadline-presets button').find(button=>button.text()==='6 hours')!.trigger('click')
    expect(wrapper.find('.deadline-preview strong').text()).toBe('6 hours')
    expect(mocks.save).not.toHaveBeenCalled()
    mocks.save.mockRejectedValueOnce(new Error('Offline'))
    await wrapper.find('form').trigger('submit'); await flushPromises()
    expect(mocks.save).toHaveBeenCalledWith({},360)
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('6')
    wrapper.unmount()
  })

})
