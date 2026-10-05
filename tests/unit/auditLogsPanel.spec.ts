import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AuditLogsPanel from '../../src/components/admin/AuditLogsPanel.vue'
import { recordsGridStub } from '../support/recordsGridStub'

const mocks=vi.hoisted(()=>({audit:vi.fn()}))
const route=reactive<{query:Record<string,string>}>({query:{}})
vi.mock('vue-router',()=>({useRoute:()=>route}))
vi.mock('../../src/services/session',()=>({staffDatabase:{}}))
vi.mock('../../src/services/database/operations',()=>({auditLog:mocks.audit}))
beforeEach(()=>{
  vi.clearAllMocks(); route.query={}
  mocks.audit.mockResolvedValue({data:{records:[
    {id:'1',actorName:'Maria',actorRole:'ADMIN',actorRoleRecorded:true,action:'UPDATE',entityType:'operation_settings',entityId:'DEFAULT',createdAt:'2026-10-05T01:00:00Z',details:{reservationMinutes:{before:1440,after:720}}},
    {id:'2',actorName:'Juan',actorRole:'TICKETING',actorRoleRecorded:false,action:'PAYMENT_RECEIVED',entityType:'booking',entityId:'BOOKING',createdAt:'2026-10-05T01:00:00Z',details:{}},
    {id:'3',actorName:'System',actorRole:'SYSTEM',actorRoleRecorded:true,action:'RESERVATION_EXPIRED',entityType:'booking',entityId:'EXPIRED',createdAt:'2026-10-05T01:00:00Z',details:{}}
  ],totalCount:3,actions:['UPDATE','PAYMENT_RECEIVED']}})
})
describe('central audit history',()=>{
  it('shows trusted actor roles and identifies legacy current roles',async()=>{
    const wrapper=mount(AuditLogsPanel,{global:{stubs:{RecordsGrid:recordsGridStub}}}); await flushPromises()
    const actors=wrapper.findAll('.actor-info')
    expect(actors[0].text()).toContain('MariaAdministrator')
    expect(actors[0].text()).not.toContain('current role')
    expect(actors[1].text()).toContain('Ticketing staff')
    expect(actors[1].text()).not.toContain('current role')
    expect(actors[1].find('.actor-role').attributes('title')).toContain('present role')
    expect(wrapper.find('.legacy-role-help summary').text()).toBe('About roles in older records')
    expect((wrapper.find('.legacy-role-help').element as HTMLDetailsElement).open).toBe(false)
    expect(actors[2].text()).toContain('System')
    expect(wrapper.find('details summary').text()).toBe('View changes')
    expect(wrapper.text()).toContain('Changed from 24 hours to 12 hours')
    wrapper.unmount()
  })
  it('opens settings-only history from the URL and can reset to all records',async()=>{
    route.query={entityType:'operation_settings'}
    const wrapper=mount(AuditLogsPanel,{global:{stubs:{RecordsGrid:recordsGridStub}}}); await flushPromises()
    expect(mocks.audit).toHaveBeenLastCalledWith({},{entityType:'operation_settings',page:0})
    expect((wrapper.find('[aria-label="Record type"]').element as HTMLSelectElement).value).toBe('operation_settings')
    await wrapper.findAll('button').find(button=>button.text()==='Reset')!.trigger('click'); await flushPromises()
    expect(mocks.audit.mock.lastCall?.[1].entityType).toBe('')
    route.query={}; await flushPromises()
    route.query={entityType:'operation_settings'}; await flushPromises()
    expect(mocks.audit.mock.lastCall?.[1].entityType).toBe('operation_settings')
    wrapper.unmount()
  })
})
