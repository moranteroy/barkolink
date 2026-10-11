import { mount, flushPromises } from '@vue/test-utils';
import { beforeEach, expect, it, vi } from 'vitest';
import DailySchedulesPanel from '../../src/components/admin/DailySchedulesPanel.vue';
const mocks = vi.hoisted(() => ({ list: vi.fn(), toggle: vi.fn() }));
vi.mock('@ionic/vue', () => ({ IonModal: { template: '<div v-if="false" />' } }));
vi.mock('../../src/services/session', () => ({ staffDatabase: {} }));
vi.mock('../../src/services/database/dailySchedules', () => ({ dailySchedules: mocks.list, setDailyScheduleActive: mocks.toggle, saveDailySchedule: vi.fn() }));
const schedule = { id:'daily-1', operator:'FastCat', routeId:'route-1', routeCode:'BTG-CAL', origin:'Batangas', destination:'Calapan', departureTimes:['09:00'], durationMinutes:120, isActive:true, routeActive:true };
const data = (item = schedule) => ({ schedules:[item], routes:[{id:'route-1', code:'BTG-CAL', origin:'Batangas', destination:'Calapan', isActive:item.routeActive, operators:['FastCat']}] });
beforeEach(() => { vi.setSystemTime(new Date('2026-10-11T00:00:00+08:00')); vi.clearAllMocks(); mocks.list.mockResolvedValue({data:data()}); mocks.toggle.mockImplementation(async (_client, _id, isActive) => ({data:data({...schedule,isActive})})); });
it('keeps a paused card visible under the Active filter until the filter changes', async () => {
  const wrapper = mount(DailySchedulesPanel); await flushPromises();
  await wrapper.get('[aria-label="Schedule status"]').setValue('ACTIVE');
  await wrapper.get('[aria-label="Pause schedule FastCat BTG-CAL"]').trigger('click'); await flushPromises();
  expect(wrapper.findAll('article')).toHaveLength(1);
  expect(wrapper.get('[aria-label="Resume schedule FastCat BTG-CAL"]').attributes('disabled')).toBeUndefined();
  const resume = wrapper.get('[aria-label="Resume recently paused schedule FastCat BTG-CAL"]');
  expect(resume.attributes('disabled')).toBeUndefined();
  await resume.trigger('click'); await flushPromises();
  expect(mocks.toggle).toHaveBeenLastCalledWith({},'daily-1',true);
  expect(wrapper.findAll('article')).toHaveLength(1);
  expect(wrapper.text()).toContain('Daily schedule resumed.');
  wrapper.unmount();
});
it('explains why an inactive route cannot resume', async () => {
  mocks.list.mockResolvedValue({data:data({...schedule,isActive:false,routeActive:false})});
  const wrapper=mount(DailySchedulesPanel);await flushPromises();
  const resume=wrapper.get('[aria-label="Resume schedule FastCat BTG-CAL"]');
  expect(resume.attributes('disabled')).toBeDefined();
  expect(resume.attributes('title')).toContain('Activate the route and both ports');
  await resume.trigger('click');expect(mocks.toggle).not.toHaveBeenCalled();wrapper.unmount();
});
it('does not refresh schedule data while a status update is pending', async () => {
  let resolve!: (value: unknown) => void;
  mocks.toggle.mockImplementation(() => new Promise(r => {resolve=r}));
  const wrapper=mount(DailySchedulesPanel);await flushPromises();
  await wrapper.get('[aria-label="Pause schedule FastCat BTG-CAL"]').trigger('click');
  const panel=wrapper.vm as unknown as {isBusy:()=>boolean;refresh:()=>Promise<void>};
  expect(panel.isBusy()).toBe(true);await panel.refresh();expect(mocks.list).toHaveBeenCalledTimes(1);
  resolve({data:data({...schedule,isActive:false})});await flushPromises();expect(panel.isBusy()).toBe(false);wrapper.unmount();
});

it('preserves card positions after pause, resume and a background refresh', async () => {
  const second = {...schedule,id:'daily-2',operator:'Starlite Ferries'};
  mocks.list.mockResolvedValue({data:{...data(),schedules:[schedule,second]}});
  mocks.toggle.mockImplementation(async (_client,_id,isActive) => ({data:{...data(),schedules:isActive ? [{...schedule,isActive},second] : [second,{...schedule,isActive}]}}));
  const wrapper=mount(DailySchedulesPanel);await flushPromises();
  await wrapper.get('[aria-label="Pause schedule FastCat BTG-CAL"]').trigger('click');await flushPromises();
  expect(wrapper.findAll('article')[0]!.text()).toContain('FastCat');
  mocks.list.mockResolvedValue({data:{...data(),schedules:[second,{...schedule,isActive:false}]}});
  await (wrapper.vm as unknown as {refresh:()=>Promise<void>}).refresh();await flushPromises();
  expect(wrapper.findAll('article')[0]!.text()).toContain('FastCat');
  await wrapper.get('[aria-label="Resume schedule FastCat BTG-CAL"]').trigger('click');await flushPromises();
  expect(wrapper.findAll('article')[0]!.text()).toContain('FastCat');
  wrapper.unmount();
});
it('reapplies the status filter when the administrator changes it', async () => {
  const wrapper=mount(DailySchedulesPanel);await flushPromises();
  await wrapper.get('[aria-label="Schedule status"]').setValue('ACTIVE');
  await wrapper.get('[aria-label="Pause schedule FastCat BTG-CAL"]').trigger('click');await flushPromises();
  expect(wrapper.findAll('article')).toHaveLength(1);
  await wrapper.get('[aria-label="Schedule status"]').setValue('ALL');
  await wrapper.get('[aria-label="Schedule status"]').setValue('ACTIVE');
  expect(wrapper.findAll('article')).toHaveLength(0);wrapper.unmount();
});

it('keeps paused schedules on active routes ahead of inactive ports during updates', async () => {
  const inactive = {...schedule,id:'inactive',operator:'Inactive Operator',routeActive:false,isActive:false};
  const paused = {...schedule,id:'paused',operator:'Paused Operator',isActive:false};
  mocks.list.mockResolvedValue({data:{...data(),schedules:[inactive,paused,schedule]}});
  const wrapper=mount(DailySchedulesPanel);await flushPromises();
  expect(wrapper.findAll('article').map(card=>card.find('strong').text())).toEqual(['Paused Operator','FastCat','Inactive Operator']);
  expect(wrapper.findAll('.inactive-divider')).toHaveLength(1);
  mocks.toggle.mockResolvedValue({data:{...data(),schedules:[inactive,{...schedule,isActive:false},paused]}});
  await wrapper.get('[aria-label="Pause schedule FastCat BTG-CAL"]').trigger('click');await flushPromises();
  expect(wrapper.findAll('article').map(card=>card.find('strong').text())).toEqual(['Paused Operator','FastCat','Inactive Operator']);
  expect(wrapper.get('[aria-label="Resume schedule FastCat BTG-CAL"]').attributes('disabled')).toBeUndefined();
  wrapper.unmount();
});
