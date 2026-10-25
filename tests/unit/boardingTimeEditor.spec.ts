import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import BoardingTimeEditor from '../../src/components/staff/boarding/BoardingTimeEditor.vue';
const mocks = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn(), success: vi.fn() }));
vi.mock('@ionic/vue', () => ({ IonModal: { props:['isOpen'], template:'<section v-if="isOpen"><slot /></section>' } }));
vi.mock('../../src/services/session', () => ({staffDatabase:{}}));
vi.mock('../../src/services/database/sailingStatus', () => ({ boardingSailingTiming:mocks.load, setBoardingSailingTiming:mocks.save }));
vi.mock('../../src/composables/toast', () => ({notifySuccess:mocks.success}));
const timing = {
  sailingCode:'TEST-TRIP',departureAt:'2099-01-01T08:00:00Z',boardingAt:null,
  effectiveBoardingAt:'2099-01-01T07:30:00Z',boardingTimeSource:'Operator default',
  usesOperatorDefault:true,updatedAt:'2026-10-24T00:00:00Z',status:'SCHEDULED',canEdit:true,
};
const open = async (wrapper: ReturnType<typeof mount>) => { await wrapper.get('.boarding-time-control > button').trigger('click'); await flushPromises(); };
describe('Boarding staff trip-time editor',()=>{
  beforeEach(()=>{vi.clearAllMocks();mocks.load.mockResolvedValue({data:{timing:{...timing}}});mocks.save.mockResolvedValue({data:{timing:{...timing,usesOperatorDefault:false}}});});
  it('loads the selected trip and saves converted hours with reason and concurrency version',async()=>{
    const wrapper=mount(BoardingTimeEditor,{props:{sailingCode:'TEST-TRIP'}});await flushPromises();
    expect(wrapper.text()).toContain('Operator default');await open(wrapper);
    await wrapper.get('select').setValue('hours');await wrapper.get('input').setValue(1.5);
    await wrapper.get('textarea').setValue('Crew confirmed earlier boarding');await wrapper.get('form').trigger('submit');await flushPromises();
    expect(mocks.save).toHaveBeenCalledWith(expect.anything(),{sailingCode:'TEST-TRIP',boardingAt:'2099-01-01T06:30:00.000Z',expectedUpdatedAt:timing.updatedAt,reason:'Crew confirmed earlier boarding'});
    expect(wrapper.emitted('updated')).toHaveLength(1);expect(wrapper.find('form').exists()).toBe(false);wrapper.unmount();
  });
  it('blocks invalid lead times and missing reasons before calling the server',async()=>{
    const wrapper=mount(BoardingTimeEditor,{props:{sailingCode:'TEST-TRIP'}});await flushPromises();await open(wrapper);
    await wrapper.get('input').setValue(0);await wrapper.get('form').trigger('submit');await flushPromises();
    expect(mocks.save).not.toHaveBeenCalled();expect(wrapper.findAll('[aria-invalid="true"]')).toHaveLength(2);wrapper.unmount();
  });
  it('retains the entered adjustment after a conflict and reloads a fresh version before retry',async()=>{
    mocks.save.mockRejectedValueOnce(new Error('This trip changed. Reload its boarding details and try again.'));
    const wrapper=mount(BoardingTimeEditor,{props:{sailingCode:'TEST-TRIP'}});await flushPromises();await open(wrapper);
    await wrapper.get('textarea').setValue('Crew confirmed earlier boarding');await wrapper.get('input').setValue(75);await wrapper.get('form').trigger('submit');await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('trip changed');expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('Crew confirmed earlier boarding');
    mocks.load.mockResolvedValue({data:{timing:{...timing,updatedAt:'2026-10-24T01:00:00Z'}}});await wrapper.get('[role="alert"] button').trigger('click');await flushPromises();
    await wrapper.get('form').trigger('submit');await flushPromises();expect(mocks.save.mock.lastCall?.[1].expectedUpdatedAt).toBe('2026-10-24T01:00:00Z');wrapper.unmount();
  });
  it('does not expose editing for a closed trip and offers retry for unavailable details',async()=>{
    mocks.load.mockResolvedValueOnce({data:{timing:{...timing,canEdit:false,status:'COMPLETED'}}});
    const wrapper=mount(BoardingTimeEditor,{props:{sailingCode:'TEST-TRIP'}});await flushPromises();expect(wrapper.find('.boarding-time-control > button').exists()).toBe(false);
    mocks.load.mockRejectedValueOnce(new Error('Unavailable'));await wrapper.setProps({sailingCode:'SECOND-TRIP'});await flushPromises();expect(wrapper.get('[role="alert"]').text()).toContain('Unavailable');wrapper.unmount();
  });
});
