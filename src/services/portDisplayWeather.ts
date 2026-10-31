import { portCoordinates } from '../data/portMaps';
import { normalizeOpenMeteo, openMeteoUrl } from '../../supabase/functions/weather/shared';
import type { WeatherDay } from './weather';
import { manilaDate, type DisplayPort } from './portDisplay';
import { harborWeather, type HarborWeather } from '../data/harborWeather';

export type DisplayWeather = WeatherDay & { portId: string; scene: HarborWeather; isDay: boolean; currentCondition: string; currentAt: string; sunriseAt: string; sunsetAt: string };

// The signed-out terminal uses Open-Meteo directly; the trip weather endpoint requires login.
export async function loadDisplayWeather(port: DisplayPort, date: string, signal?: AbortSignal): Promise<DisplayWeather> {
  const point = portCoordinates(port);
  if (!point) throw new Error('Weather location unavailable.');
  const url = openMeteoUrl(point);
  url.searchParams.delete('forecast_days');
  url.searchParams.set('daily', `${url.searchParams.get('daily')},sunrise,sunset`);
  url.searchParams.set('start_date', date);
  url.searchParams.set('end_date', date);
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('Weather unavailable.');
  const raw = await response.json();
  const payload = normalizeOpenMeteo(raw);
  const day = payload.days?.find(day => day.date === date);
  const scene = harborWeather(raw.current.weather_code);
  if (!day || day.conditionCode === null || [day.highC, day.lowC, day.rainChance, day.windKph].some(value => value === null)) {
    throw new Error('Today’s weather unavailable.');
  }
  if (!scene || ![0, 1].includes(raw.current.is_day) || manilaDate(payload.current.at) !== date) throw new Error('Current weather unavailable.');
  const index = raw.daily.time.findIndex((epoch: number) => manilaDate(new Date(epoch * 1000)) === date);
  const sunrise = raw.daily.sunrise?.[index], sunset = raw.daily.sunset?.[index];
  if (!Number.isFinite(sunrise) || !Number.isFinite(sunset) || sunrise >= sunset) throw new Error('Daylight times unavailable.');
  const sunriseAt = new Date(sunrise * 1000).toISOString(), sunsetAt = new Date(sunset * 1000).toISOString();
  if (manilaDate(sunriseAt) !== date || manilaDate(sunsetAt) !== date) throw new Error('Daylight times do not match this port date.');
  return { ...day, portId: port.id, scene, isDay: raw.current.is_day === 1, currentCondition: payload.current.condition, currentAt: payload.current.at, sunriseAt, sunsetAt };
}
