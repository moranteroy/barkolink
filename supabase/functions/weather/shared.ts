export type WeatherReading = {
  at: string; condition: string; temperatureC: number | null; windKph: number | null;
  gustKph: number | null; visibilityKm: number | null; rainChance: number | null;
};
export type WeatherDay = { date: string; condition: string; conditionCode: number | null; highC: number | null; lowC: number | null; rainChance: number | null; windKph: number | null };
export type WeatherPayload = { current: WeatherReading; hours: WeatherReading[]; days?: WeatherDay[] };
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
