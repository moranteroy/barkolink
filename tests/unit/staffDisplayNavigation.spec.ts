import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import StaffNavigation from '../../src/components/staff/StaffNavigation.vue';
import { staffPortAccess } from '../../src/services/staffPortAccess';

vi.mock('../../src/services/session', () => ({ auth: { currentUser: { uid: 'counter' } } }));

beforeEach(() => {
  Object.assign(staffPortAccess, {
    uid: 'counter',
    status: 'ready',
    portId: 'calapan',
    portName: 'Calapan Port',
  });
});

async function navigation(role: 'ticketing' | 'boarding' = 'ticketing') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  });
  await router.push('/staff/' + role);
  return mount(StaffNavigation, { props: { role }, global: { plugins: [router] } });
}

describe('ticketing TV shortcut', () => {
  it('opens the assigned port in a separate tab and follows assignment changes', async () => {
    const wrapper = await navigation();
    let link = wrapper.get('a[target="_blank"]');
    expect(link.attributes('href')).toBe('/port-display?port=calapan');
    expect(link.text()).toBe('Port TV Display');
    expect(link.attributes('rel')).toBe('noopener');
    staffPortAccess.portId = 'batangas';
    await wrapper.vm.$nextTick();
    link = wrapper.get('a[target="_blank"]');
    expect(link.attributes('href')).toBe('/port-display?port=batangas');
    wrapper.unmount();
  });
  it('withholds the shortcut for unassigned staff, another session, and boarding', async () => {
    const wrapper = await navigation();
    staffPortAccess.status = 'blocked';
    await wrapper.vm.$nextTick();
    expect(wrapper.find('a[target="_blank"]').exists()).toBe(false);
    staffPortAccess.status = 'ready';
    staffPortAccess.uid = 'another-staff';
    await wrapper.vm.$nextTick();
    expect(wrapper.find('a[target="_blank"]').exists()).toBe(false);
    wrapper.unmount();
    staffPortAccess.uid = 'counter';
    const boarding = await navigation('boarding');
    expect(boarding.find('a[target="_blank"]').exists()).toBe(false);
    boarding.unmount();
  });
});
