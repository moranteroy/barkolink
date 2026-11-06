import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadDisplayWeather } from '../../src/services/portDisplayWeather';
import { harborWeather } from '../../src/data/harborWeather';

const port = { id: 'cal', name: 'Calapan Port', city: 'Calapan City' };
function payload(date = '2026-10-25') {
  const epoch = Date.parse(`${date}T00:00:00+08:00`) / 1000;
  return {
    current: { time: epoch, temperature_2m: 28, weather_code: 3, is_day: 1 },
    hourly: { time: [] },
    daily: {
      sunrise: [epoch + 6 * 3600],
      sunset: [epoch + 18 * 3600],
      time: [epoch],
      weather_code: [61],
      temperature_2m_max: [30],
      temperature_2m_min: [25],
      precipitation_probability_max: [80],
      wind_speed_10m_max: [24],
    },
  };
}
afterEach(() => vi.unstubAllGlobals());
describe('public terminal weather', () => {
  it('requests only the selected Philippine date and correct port coordinates without login', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload() });
    vi.stubGlobal('fetch', fetchMock);
    const signal = new AbortController().signal;
    expect(await loadDisplayWeather(port, '2026-10-25', signal)).toEqual({
      portId: 'cal',
      date: '2026-10-25',
      condition: 'Light rain',
      conditionCode: 61,
      highC: 30,
      lowC: 25,
      rainChance: 80,
      windKph: 24,
      scene: 'cloudy',
      isDay: true,
      currentCondition: 'Overcast',
      currentAt: '2026-10-24T16:00:00.000Z',
      sunriseAt: '2026-10-24T22:00:00.000Z',
      sunsetAt: '2026-10-25T10:00:00.000Z',
    });
    const url = fetchMock.mock.calls[0][0] as URL;
    expect(url.origin).toBe('https://api.open-meteo.com');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      latitude: '13.43',
      longitude: '121.1966667',
      timezone: 'Asia/Manila',
      start_date: '2026-10-25',
      end_date: '2026-10-25',
    });
    expect(url.searchParams.has('forecast_days')).toBe(false);
    expect(url.searchParams.get('daily')).toContain('sunrise,sunset');
    expect(fetchMock.mock.calls[0][1]).toEqual({ signal });
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload('2026-10-26') });
    const result = await loadDisplayWeather(
      { id: 'btg', name: 'Batangas Port', city: 'Batangas City' },
      '2026-10-26',
    );
    expect(result).toMatchObject({ portId: 'btg', date: '2026-10-26' });
    expect((fetchMock.mock.calls[1][0] as URL).searchParams.get('latitude')).toBe('13.7580556');
  });
  it('rejects yesterday’s forecast, missing readings and provider failures', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload() });
    vi.stubGlobal('fetch', fetchMock);
    await expect(loadDisplayWeather(port, '2026-10-26')).rejects.toThrow('weather unavailable');
    const missing = payload();
    missing.daily.temperature_2m_max = [];
    fetchMock.mockResolvedValue({ ok: true, json: async () => missing });
    await expect(loadDisplayWeather(port, '2026-10-25')).rejects.toThrow('weather unavailable');
    fetchMock.mockResolvedValue({ ok: false });
    await expect(loadDisplayWeather(port, '2026-10-25')).rejects.toThrow('Weather unavailable');
  });
  it('rejects missing or mismatched solar times', async () => {
    const value = payload();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => value }));
    value.daily.sunrise = [];
    await expect(loadDisplayWeather(port, '2026-10-25')).rejects.toThrow(
      'Daylight times unavailable',
    );
    value.daily.sunrise = [value.daily.time[0] - 86400];
    await expect(loadDisplayWeather(port, '2026-10-25')).rejects.toThrow(
      'Daylight times do not match',
    );
  });
  it('does not substitute another location for an unknown port', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      loadDisplayWeather({ id: 'unknown', name: 'Unknown', city: 'Unknown' }, '2026-10-25'),
    ).rejects.toThrow('location unavailable');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('uses current weather for the sky rather than the day’s worst forecast, and respects night', async () => {
    const value = payload();
    value.current.weather_code = 0;
    value.current.is_day = 0;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => value }));
    expect(await loadDisplayWeather(port, '2026-10-25')).toMatchObject({
      scene: 'clear',
      isDay: false,
      currentCondition: 'Clear sky',
      condition: 'Light rain',
    });
    value.current.time -= 86400;
    await expect(loadDisplayWeather(port, '2026-10-25')).rejects.toThrow(
      'Current weather unavailable',
    );
  });
  it('maps WMO weather codes to the harbor animation and leaves unknown codes neutral', () => {
    for (const [code, scene] of [
      [0, 'clear'],
      [1, 'clear'],
      [2, 'partly-cloudy'],
      [3, 'cloudy'],
      [45, 'fog'],
      [61, 'rain'],
      [82, 'rain'],
      [95, 'storm'],
      [99, 'storm'],
      [71, 'snow'],
    ] as const) {
      expect(harborWeather(code)).toBe(scene);
    }
    expect(harborWeather(123)).toBeNull();
  });
});
