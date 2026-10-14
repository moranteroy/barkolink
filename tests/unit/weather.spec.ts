import { describe,expect,it } from 'vitest';
import { normalizeWeather,departureForecast, normalizeOpenMeteo, openMeteoUrl, weatherCoordinates } from '../../supabase/functions/weather/shared';
const epoch=Date.parse('2026-10-08T04:00:00Z')/1000;
const reading={temp_c:29,wind_kph:18,gust_kph:25,vis_km:9,condition:{text:'Light rain'}};
const response={location:{country:'Philippines'},current:{...reading,last_updated_epoch:epoch},forecast:{forecastday:[{hour:[{...reading,time_epoch:epoch,chance_of_rain:75}]}]}};
describe('port weather normalization',()=>{
  it('selects the correct departure hour using absolute time, including Philippine timezone',()=>{
    const weather=normalizeWeather(response);
    expect(departureForecast(weather,'2026-10-08T12:16:00+08:00')?.rainChance).toBe(75);
    expect(departureForecast(weather,'2026-10-08T05:00:00Z')).toBeNull();
    expect(departureForecast(weather,'2099-10-08T04:16:00Z')).toBeNull();
  });
  it('rejects mismatched locations and missing timestamps without substituting fake measurements',()=>{
    expect(()=>normalizeWeather({...response,location:{country:'USA'}})).toThrow('does not match');
    expect(()=>normalizeWeather({...response,current:{...reading}})).toThrow('timestamp');
    expect(normalizeWeather({...response,current:{...reading,temp_c:undefined,last_updated_epoch:epoch}}).current.temperatureC).toBeNull();
  });
});

describe('Open-Meteo seven-day mapping', () => {
  const value = { current: { time: epoch, temperature_2m: 29, weather_code: 95, wind_speed_10m: 18, cloud_cover: 60 },
    hourly: { time: [epoch], temperature_2m: [28], weather_code: [61], wind_speed_10m: [20], visibility: [9500], precipitation_probability: [75] },
    daily: { time: Array.from({length:7}, (_,i) => Date.parse('2026-10-07T16:00:00Z') / 1000 + i * 86400), weather_code: [0,1,2,3,61,80,95], temperature_2m_max: [30], temperature_2m_min: [24] } };
  it('maps all seven Philippine dates, WMO conditions, units and departure-hour data', () => {
    const result = normalizeOpenMeteo(value);
    expect(result.provider).toBe('open-meteo');
    expect(result.days).toHaveLength(7);
    expect(result.days?.[0].date).toBe('2026-10-08');
    expect(result.days?.[6].date).toBe('2026-10-14');
    expect(result.current).toMatchObject({condition:'Thunderstorm',visibilityKm:9.5,rainChance:75,cloudCover:60});
    expect(departureForecast(result,'2026-10-08T12:16:00+08:00')?.condition).toBe('Light rain');
    expect(result.days?.[1].highC).toBeNull();
  });
  it('requests verified corridor locations with seven days and absolute timestamps', () => {
    const point = weatherCoordinates({code:'BTG',city:'Batangas'});
    expect(point).toEqual([13.7580556,121.0458333]);
    expect(weatherCoordinates({code:'CAL',city:'Calapan'})).toEqual([13.43,121.1966667]);
    expect(weatherCoordinates({city:'Unknown'})).toBeNull();
    const url = openMeteoUrl(point!);
    expect(url.searchParams.get('forecast_days')).toBe('7');
    expect(url.searchParams.get('timezone')).toBe('Asia/Manila');
    expect(url.searchParams.get('timeformat')).toBe('unixtime');
    expect(url.searchParams.has('apikey')).toBe(false);
  });
  it('rejects missing timestamps and invalid payloads', () => {
    expect(() => normalizeOpenMeteo({})).toThrow();
    expect(() => normalizeOpenMeteo({...value,current:{...value.current,time:null}})).toThrow('timestamp');
  });
});
