export type WeatherReading = {
  at: string; condition: string; temperatureC: number | null; windKph: number | null;
  gustKph: number | null; visibilityKm: number | null; rainChance: number | null;
  cloudCover?: number | null;
};
export type WeatherDay = { date: string; condition: string; conditionCode: number | null; highC: number | null; lowC: number | null; rainChance: number | null; windKph: number | null };
export type WeatherPayload = { provider?: string; current: WeatherReading; hours: WeatherReading[]; days?: WeatherDay[] };
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
function reading(value: any, epoch: unknown): WeatherReading {
  if (typeof epoch !== 'number' || !Number.isFinite(epoch)) throw new Error('Weather timestamp is missing.');
  return { at: new Date(epoch * 1000).toISOString(), condition: String(value.condition?.text || 'Conditions unavailable').slice(0,120),
    temperatureC:number(value.temp_c),windKph:number(value.wind_kph),gustKph:number(value.gust_kph),
    visibilityKm:number(value.vis_km),rainChance:number(value.chance_of_rain) };
}
export function normalizeWeather(value: any): WeatherPayload {
  if (value?.location?.country !== 'Philippines' || !value?.current) throw new Error('Weather location does not match.');
  return { current:reading(value.current,value.current.last_updated_epoch),
    days:(value.forecast?.forecastday || []).filter((day:any)=>/^\d{4}-\d{2}-\d{2}$/.test(day.date)).slice(0,7).map((day:any)=>({
      date:day.date,condition:String(day.day?.condition?.text || 'Conditions unavailable').slice(0,120),conditionCode:number(day.day?.condition?.code),
      highC:number(day.day?.maxtemp_c),lowC:number(day.day?.mintemp_c),rainChance:number(day.day?.daily_chance_of_rain),windKph:number(day.day?.maxwind_kph),
    })),
    hours:(value.forecast?.forecastday || []).flatMap((day: any) => (day.hour || []).map((hour: any) => reading(hour,hour.time_epoch))) };
}
export function departureForecast(payload: WeatherPayload, departureAt: string) {
  const time = new Date(departureAt).getTime();
  return payload.hours.find(hour => {
    const start=new Date(hour.at).getTime();
    return time>=start && time<start+3600000;
  }) || null;
}

const conditions: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Freezing fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 56: 'Freezing drizzle', 57: 'Heavy freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Heavy freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Light rain showers', 81: 'Rain showers', 82: 'Heavy rain showers', 85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Heavy thunderstorm with hail',
};
export function weatherCoordinates(port: { code?: string; city: string }): [number, number] | null {
  if (port.code === 'BTG' || /^batangas(?: city)?$/i.test(port.city.trim())) return [13.7580556, 121.0458333];
  if (port.code === 'CAL' || /^calapan(?: city)?$/i.test(port.city.trim())) return [13.43, 121.1966667];
  return null;
}
export function openMeteoUrl(point: [number, number]) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({ latitude: String(point[0]), longitude: String(point[1]),
    current: 'temperature_2m,weather_code,wind_speed_10m,wind_gusts_10m,cloud_cover,is_day',
    hourly: 'temperature_2m,weather_code,wind_speed_10m,wind_gusts_10m,visibility,precipitation_probability,cloud_cover,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max',
    timezone: 'Asia/Manila', timeformat: 'unixtime', forecast_days: '7', wind_speed_unit: 'kmh', temperature_unit: 'celsius',
  }).toString();
  return url;
}
export function normalizeOpenMeteo(value: any): WeatherPayload {
  if (!value?.current || !Array.isArray(value.hourly?.time) || !Array.isArray(value.daily?.time)) throw new Error('Weather data is missing.');
  const at = (epoch: unknown) => {
    if (typeof epoch !== 'number' || !Number.isFinite(epoch)) throw new Error('Weather timestamp is missing.');
    return new Date(epoch * 1000).toISOString();
  };
  const condition = (code: unknown, isDay?: number) => typeof code !== 'number' ? 'Conditions unavailable' :
    ((code === 0 || code === 1) && isDay === 1 ? 'Sunny' : conditions[code] || 'Conditions unavailable');
  const hours: WeatherReading[] = value.hourly.time.map((epoch: number, i: number) => ({
    at: at(epoch), condition: condition(value.hourly.weather_code?.[i], value.hourly.is_day?.[i]), temperatureC: number(value.hourly.temperature_2m?.[i]),
    windKph: number(value.hourly.wind_speed_10m?.[i]), gustKph: number(value.hourly.wind_gusts_10m?.[i]),
    visibilityKm: number(value.hourly.visibility?.[i]) == null ? null : value.hourly.visibility[i] / 1000,
    rainChance: number(value.hourly.precipitation_probability?.[i]), cloudCover: number(value.hourly.cloud_cover?.[i]),
  }));
  const currentAt = at(value.current.time);
  const hour = departureForecast({ current: {} as WeatherReading, hours }, currentAt);
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' });
  return { provider: 'open-meteo', current: {
    at: currentAt, condition: condition(value.current.weather_code, value.current.is_day), temperatureC: number(value.current.temperature_2m),
    windKph: number(value.current.wind_speed_10m), gustKph: number(value.current.wind_gusts_10m),
    visibilityKm: hour?.visibilityKm ?? null, rainChance: hour?.rainChance ?? null, cloudCover: number(value.current.cloud_cover),
  }, hours, days: value.daily.time.slice(0, 7).map((epoch: number, i: number) => ({
    date: date.format(new Date(at(epoch))), condition: condition(value.daily.weather_code?.[i], 1), conditionCode: number(value.daily.weather_code?.[i]),
    highC: number(value.daily.temperature_2m_max?.[i]), lowC: number(value.daily.temperature_2m_min?.[i]),
    rainChance: number(value.daily.precipitation_probability_max?.[i]), windKph: number(value.daily.wind_speed_10m_max?.[i]),
  })) };
}
