import { describe, expect, it } from 'vitest';
import { currentPortWeather, portAtmosphere } from '../../src/data/portAtmosphere';
import type { DisplayWeather } from '../../src/services/portDisplayWeather';

const at = (time: string) => new Date(`2026-10-31T${time}:00+08:00`);
function weather(time = '12:00', scene: DisplayWeather['scene'] = 'clear'): DisplayWeather {
  return {
    portId: 'cal',
    date: '2026-10-31',
    condition: 'Rain',
    conditionCode: 61,
    highC: 30,
    lowC: 25,
    rainChance: 80,
    windKph: 20,
    scene,
    isDay: true,
    currentCondition: 'Sunny',
    currentAt: at(time).toISOString(),
    sunriseAt: at('06:00').toISOString(),
    sunsetAt: at('18:00').toISOString(),
  };
}
describe('port atmosphere in Philippine time', () => {
  it.each([
    ['05:40', 'dawn', false],
    ['06:00', 'dawn', true],
    ['08:00', 'morning', true],
    ['12:00', 'midday', true],
    ['15:00', 'afternoon', true],
    ['17:45', 'dusk', true],
    ['18:00', 'dusk', false],
    ['21:00', 'night', false],
  ])('shows %s as %s', (time, phase, isDay) => {
    expect(portAtmosphere(weather(time), at(time))).toMatchObject({ phase, isDay });
  });
  it('updates daylight from solar times even before the provider refreshes its day flag', () => {
    expect(portAtmosphere(weather('17:55'), at('18:01'))?.isDay).toBe(false);
    const value = weather('05:55');
    value.isDay = false;
    expect(portAtmosphere(value, at('06:01'))?.isDay).toBe(true);
    expect(portAtmosphere(weather(), new Date('2026-10-31T04:00:00Z'))?.phase).toBe('midday');
  });
  it('rejects old, future, invalid or wrong-date readings', () => {
    expect(currentPortWeather(weather('11:15'), at('12:00'))).toBe(true);
    expect(currentPortWeather(weather('11:14'), at('12:00'))).toBe(false);
    expect(currentPortWeather(weather('12:11'), at('12:00'))).toBe(false);
    const value = weather();
    value.currentAt = 'invalid';
    expect(currentPortWeather(value, at('12:00'))).toBe(false);
    value.currentAt = at('12:00').toISOString();
    value.date = '2026-10-30';
    expect(portAtmosphere(value, at('12:00'))).toBeNull();
    expect(portAtmosphere(null, at('12:00'))).toBeNull();
  });
  it('uses muted skies for overcast, rain and storms and a darker night palette', () => {
    const sky = (scene: DisplayWeather['scene'], time = '12:00') =>
      portAtmosphere(weather(time, scene), at(time))?.style['--harbor-sky-top'];
    expect(sky('clear')).not.toBe(sky('cloudy'));
    expect(sky('cloudy')).not.toBe(sky('storm'));
    expect(sky('clear', '21:00')).not.toBe(sky('clear'));
    expect(sky('rain')).not.toBe(sky('clear'));
  });
  it('does not invent daylight if solar times are invalid', () => {
    const value = weather();
    value.sunsetAt = value.sunriseAt;
    expect(portAtmosphere(value, at('12:00'))).toBeNull();
  });
});
