import { describe,expect,it } from 'vitest';
import { normalizeWeather,departureForecast } from '../../supabase/functions/weather/shared';
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
