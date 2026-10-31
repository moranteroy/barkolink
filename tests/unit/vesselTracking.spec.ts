import { clearToasts, toastMessages } from '../../src/composables/toast';
import { mount,flushPromises } from '@vue/test-utils';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import VesselTrackingPanel from '../../src/components/admin/VesselTrackingPanel.vue';
const mocks=vi.hoisted(()=>({list:vi.fn(),confirm:vi.fn()}));
vi.mock('@ionic/vue',()=>({IonModal:{props:['isOpen'],template:'<div v-if="isOpen"><slot /></div>'}}));
vi.mock('../../src/services/session',()=>({staffDatabase:{}}));
vi.mock('../../src/services/database/vesselTracking',()=>({vesselPositions:mocks.list,confirmVesselPort:mocks.confirm}));
vi.mock('../../src/composables/unsavedChanges',()=>({useUnsavedChanges:vi.fn()}));
const data={vessels:[{id:'ship',name:'MV Example',operator:'FastCat',position:{state:'UNKNOWN',reason:'Confirm the vessel port before opening bookings.'}}],ports:[{id:'BTG',name:'Batangas Port'}]};
afterEach(()=>vi.useRealTimers());
beforeEach(()=>{clearToasts(); vi.clearAllMocks();mocks.list.mockResolvedValue({data});mocks.confirm.mockResolvedValue({data:{...data,vessels:[{...data.vessels[0],position:{state:'CONFIRMED',portId:'BTG',portName:'Batangas Port',confirmedPortName:'Batangas Port',confirmedAt:'2026-10-11T09:00:00Z'}}]}});});
it('shows unknown positions without inventing a current port',async()=>{const wrapper=mount(VesselTrackingPanel);await flushPromises();expect(wrapper.text()).toContain('No trip data');expect(wrapper.text()).toContain('No scheduled location');expect(wrapper.text()).toContain('Expected locations follow scheduled voyages');wrapper.unmount();});
it('saves a terminal observation in Philippine time and updates its displayed location',async()=>{const wrapper=mount(VesselTrackingPanel);await flushPromises();await wrapper.get('#correction-vessel').setValue('ship');await wrapper.get('.correction-controls button').trigger('click');await wrapper.get('form select').setValue('BTG');await wrapper.get('input[type="datetime-local"]').setValue('2026-10-11T17:00');await wrapper.get('textarea').setValue('Confirmed by terminal supervisor.');await wrapper.get('form').trigger('submit');await flushPromises();expect(mocks.confirm).toHaveBeenCalledWith({},{vesselId:'ship',portId:'BTG',observedAt:'2026-10-11T09:00:00.000Z',note:'Confirmed by terminal supervisor.'});expect(wrapper.text()).toContain('Batangas Port');expect(wrapper.find('form').exists()).toBe(false);wrapper.unmount();});
it('keeps failed confirmations open without presenting an unsaved position as confirmed',async()=>{mocks.confirm.mockRejectedValue({message:'Choose an active port.'});const wrapper=mount(VesselTrackingPanel);await flushPromises();await wrapper.get('#correction-vessel').setValue('ship');await wrapper.get('.correction-controls button').trigger('click');await wrapper.get('input[type="datetime-local"]').setValue('2026-10-11T17:00');await wrapper.get('form').trigger('submit');await flushPromises();expect(wrapper.find('[role="alert"]').exists()).toBe(false);expect(toastMessages.value.some(toast=>toast.message==='Choose an active port.')).toBe(true);expect(wrapper.find('form').exists()).toBe(true);expect(wrapper.text()).toContain('No trip data');wrapper.unmount();});

it('automatically refreshes from origin to underway to destination and stops when unmounted',async()=>{
  vi.useFakeTimers();
  const ports=[...data.ports,{id:'CAL',name:'Calapan Port'}];
  mocks.list.mockResolvedValueOnce({data:{...data,ports,vessels:[{...data.vessels[0],position:{state:'EXPECTED',portId:'BTG',portName:'Batangas Port'}}]}})
    .mockResolvedValueOnce({data:{...data,ports,vessels:[{...data.vessels[0],position:{state:'UNDERWAY',originPortId:'BTG',destinationPortId:'CAL',arrivalAt:'2026-10-11T01:30:00Z'}}]}})
    .mockResolvedValue({data:{...data,ports,vessels:[{...data.vessels[0],position:{state:'EXPECTED',portId:'CAL',portName:'Calapan Port'}}]}});
  const wrapper=mount(VesselTrackingPanel);await flushPromises();
  expect(wrapper.text()).toContain('Batangas Port');
  expect(wrapper.find('.tracking-sync').exists()).toBe(false);
  expect(wrapper.findAll('button').some(button => button.text() === 'Refresh')).toBe(false);
  await vi.advanceTimersByTimeAsync(30000);await flushPromises();
  expect(wrapper.text()).toContain('Expected underway');
  expect(wrapper.text()).toContain('Batangas Port \u2192 Calapan Port');
  expect(wrapper.text()).toContain('Arrival Oct 11');
  await vi.advanceTimersByTimeAsync(30000);await flushPromises();
  expect(wrapper.text()).toContain('Expected at port');
  expect(wrapper.text()).toContain('Calapan Port');
  expect(wrapper.text()).not.toContain('Last confirmed:');
  wrapper.unmount();await vi.advanceTimersByTimeAsync(60000);
  expect(mocks.list).toHaveBeenCalledTimes(3);
});

it('retains the last location on refresh failure and recovers automatically',async()=>{
  vi.useFakeTimers();
  mocks.list.mockResolvedValueOnce({data}).mockRejectedValueOnce(new Error('Network unavailable')).mockResolvedValue({data});
  const wrapper=mount(VesselTrackingPanel);await flushPromises();
  await vi.advanceTimersByTimeAsync(30000);await flushPromises();
  expect(wrapper.text()).toContain('MV Example');
  expect(wrapper.text()).toContain('Updates delayed');
  await vi.advanceTimersByTimeAsync(30000);await flushPromises();
  expect(wrapper.text()).not.toContain('Updates delayed');
  wrapper.unmount();
});

it('does not poll while editing a port confirmation',async()=>{
  vi.useFakeTimers();const wrapper=mount(VesselTrackingPanel);await flushPromises();
  await wrapper.get('#correction-vessel').setValue('ship');await wrapper.get('.correction-controls button').trigger('click');
  await wrapper.get('textarea').setValue('Unsaved terminal observation');
  await vi.advanceTimersByTimeAsync(60000);await flushPromises();
  expect(mocks.list).toHaveBeenCalledTimes(1);
  expect(wrapper.get('textarea').element.value).toBe('Unsaved terminal observation');
  wrapper.unmount();
});

it('keeps routine tracking free of confirmation actions and paginates compact rows',async()=>{
  mocks.list.mockResolvedValue({data:{...data,vessels:Array.from({length:12},(_,i)=>({...data.vessels[0],id:`ship-${i}`,name:`Vessel ${i}`,position:{state:'EXPECTED',portName:'Calapan Port'}}))}});
  const wrapper=mount(VesselTrackingPanel);await flushPromises();
  expect(wrapper.findAll('.location-list article')).toHaveLength(5);
  expect(wrapper.text()).not.toContain('Confirm port');
  expect(wrapper.text()).toContain('No confirmation is needed');
  expect(wrapper.find('.manual-correction').attributes('open')).toBeUndefined();
  await wrapper.get('.tracking-pagination button:last-child').trigger('click');
  expect(wrapper.get('.tracking-pagination').text()).toContain('6-10 of 12');
  await wrapper.get('input[type="search"]').setValue('Vessel 11');
  expect(wrapper.findAll('.location-list article')).toHaveLength(1);
  expect(wrapper.find('.tracking-pagination').exists()).toBe(false);
  wrapper.unmount();
});
