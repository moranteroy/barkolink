export type HarborWeather =
  'clear' | 'partly-cloudy' | 'cloudy' | 'rain' | 'storm' | 'fog' | 'snow';

export function harborWeather(code: number): HarborWeather | null {
  if ([0, 1].includes(code)) return 'clear';
  if (code === 2) return 'partly-cloudy';
  if (code === 3) return 'cloudy';
  if ([45, 48].includes(code)) return 'fog';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([95, 96, 99].includes(code)) return 'storm';
  return null;
}
