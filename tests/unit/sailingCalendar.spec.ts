import { afterEach, describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import SailingCalendar from '../../src/components/passenger/SailingCalendar.vue';
import { calendarMonth, sailingDays, type CalendarSailing } from '../../src/data/sailingCalendar';

const sailing = (code: string, departureAt: string, arrivalAt: string): CalendarSailing => ({
  code,
  departureAt,
  arrivalAt,
  origin: { city: 'Batangas', name: 'Batangas Port' },
  destination: { city: 'Calapan', name: 'Calapan Port' },
  vessel: { name: 'MV Test' },
});
describe('sailing calendar', () => {
  it('groups departures and overnight arrivals by their Philippine date', () => {
    const trip = sailing('overnight', '2099-10-12T15:30:00Z', '2099-10-12T17:30:00Z');
    expect([...sailingDays([trip], 'departure').keys()]).toEqual(['2099-10-12']);
    expect([...sailingDays([trip], 'arrival').keys()]).toEqual(['2099-10-13']);
  });
  it('counts each listed sailing and orders by the chosen event time', () => {
    const a = sailing('A', '2099-10-12T08:00:00+08:00', '2099-10-12T14:00:00+08:00');
    const b = sailing('B', '2099-10-12T09:00:00+08:00', '2099-10-12T12:00:00+08:00');
    expect(
      sailingDays([b, a], 'departure')
        .get('2099-10-12')
        ?.map((trip) => trip.code),
    ).toEqual(['A', 'B']);
    expect(
      sailingDays([a, b], 'arrival')
        .get('2099-10-12')
        ?.map((trip) => trip.code),
    ).toEqual(['B', 'A']);
  });
  it('omits invalid timestamps rather than creating calendar markers', () => {
    expect(sailingDays([sailing('bad', 'invalid', 'invalid')], 'departure').size).toBe(0);
  });
  it('aligns weekdays, handles leap years and adds complete calendar weeks', () => {
    const october = calendarMonth('2026-10');
    expect(october.slice(0, 5)).toEqual([null, null, null, null, '2026-10-01']);
    expect(october.filter(Boolean)).toHaveLength(31);
    expect(october.length % 7).toBe(0);
    expect(calendarMonth('2028-02').filter(Boolean)).toHaveLength(29);
    expect(calendarMonth('2027-02').filter(Boolean)).toHaveLength(28);
  });
});

describe('passenger calendar presentation and selection', () => {
  afterEach(() => vi.useRealTimers());
  function render() {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-20T04:00:00Z'));
    return mount(SailingCalendar, {
      props: {
        sailings: [
          sailing('A', '2026-10-29T08:00:00+08:00', '2026-10-29T10:00:00+08:00'),
          sailing('B', '2026-10-29T23:00:00+08:00', '2026-10-30T01:00:00+08:00'),
        ],
        selectedDate: '',
        event: 'departure',
        routeLabel: 'Batangas to Calapan',
      },
    });
  }
  it('shows exact trip counts and empty days while distinguishing past dates', async () => {
    const wrapper = render();
    const available = wrapper.get('button[aria-label="Oct 29, 2026: 2 departures"]');
    expect(available.get('.trip-count').text()).toBe('2');
    expect(wrapper.get('button[aria-label="Oct 30, 2026: 0 departures"]').text()).toContain(
      'No trips',
    );
    expect(
      wrapper.get('button[aria-label="Oct 19, 2026: Past date"]').attributes('disabled'),
    ).toBeDefined();
    expect(wrapper.text()).not.toContain('Departed');
    await available.trigger('click');
    expect(wrapper.emitted('select')).toEqual([['2026-10-29']]);
    wrapper.unmount();
  });
  it('changes months directly and jumps back to a listed date without selecting an empty month', async () => {
    const wrapper = render();
    await wrapper.get('input[type="month"]').setValue('2027-01');
    expect(wrapper.get('.month-controls h3').text()).toBe('January 2027');
    expect(wrapper.emitted('select')).toBeUndefined();
    await wrapper.get('.next-date').trigger('click');
    expect(wrapper.get('.month-controls h3').text()).toBe('October 2026');
    expect(wrapper.emitted('select')).toEqual([['2026-10-29']]);
    await wrapper.get('input[type="month"]').setValue('2026-09');
    expect(wrapper.get('.month-controls h3').text()).toBe('October 2026');
    wrapper.unmount();
  });
  it('keeps departure and arrival counts separate and lets the user clear a selection', async () => {
    const wrapper = render();
    await wrapper.setProps({ selectedDate: '2026-10-29' });
    expect(wrapper.get('.preview-count').text()).toContain('2 departures');
    await wrapper.findAll('.calendar-modes button')[1].trigger('click');
    expect(wrapper.emitted('update:event')).toEqual([['arrival']]);
    await wrapper.setProps({ event: 'arrival', selectedDate: '2026-10-30' });
    expect(wrapper.get('.preview-count').text()).toContain('1 arrival');
    expect(
      wrapper.get('button[aria-label="Oct 30, 2026: 1 arrival"]').get('.trip-count').text(),
    ).toBe('1');
    await wrapper.get('.all-dates').trigger('click');
    expect(wrapper.emitted('select')).toEqual([['']]);
    wrapper.unmount();
  });
});
