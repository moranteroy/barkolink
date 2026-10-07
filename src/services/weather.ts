import { requireSupabase } from './supabase';
export type WeatherReading = { at:string;condition:string;temperatureC:number|null;windKph:number|null;gustKph:number|null;visibilityKm:number|null;rainChance:number|null };
export type TripWeatherData = { configured:boolean;departureAt:string;ports:Array<{id:string;name:string;city:string;role:string;available:boolean;stale?:boolean;fetchedAt?:string;current?:WeatherReading;forecast?:WeatherReading|null}> };
export async function tripWeather(sailingCode:string):Promise<TripWeatherData>{
  const {data,error}=await requireSupabase().functions.invoke('weather',{body:{sailingCode}});
  if(error || data?.error)throw new Error('Weather updates are temporarily unavailable.');
  return data;
}
