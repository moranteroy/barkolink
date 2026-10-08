import { requireSupabase } from './supabase';
export type WeatherReading = { at:string;condition:string;temperatureC:number|null;windKph:number|null;gustKph:number|null;visibilityKm:number|null;rainChance:number|null };
export type TripWeatherData = { configured:boolean;departureAt:string;ports:Array<{id:string;name:string;city:string;role:string;available:boolean;stale?:boolean;fetchedAt?:string;current?:WeatherReading;forecast?:WeatherReading|null}> };
export async function tripWeather(sailingCode:string):Promise<TripWeatherData>{
  const {data,error}=await requireSupabase().functions.invoke('weather',{body:{sailingCode}});
  if(error || data?.error)throw new Error('Weather updates are temporarily unavailable.');
  return data;
}
export type WeatherDay = { date:string;condition:string;conditionCode:number|null;highC:number|null;lowC:number|null;rainChance:number|null;windKph:number|null };
export type PortForecastData = { configured:boolean;ports:Array<{id:string;name:string;city:string;available:boolean;stale?:boolean;current?:WeatherReading;days?:WeatherDay[]}> };
export async function portForecast(portId:string):Promise<PortForecastData>{
  const {data,error}=await requireSupabase().functions.invoke('weather',{body:{portId}});
  if(error || data?.error)throw new Error('Weather updates are temporarily unavailable.');
  return data;
}
