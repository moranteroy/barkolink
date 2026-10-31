import type { DisplayWeather } from '../services/portDisplayWeather';
import { manilaDate } from '../services/portDisplay';
export type HarborPhase = 'dawn' | 'morning' | 'midday' | 'afternoon' | 'dusk' | 'night';
export function currentPortWeather(weather: DisplayWeather | null, now: Date) {
  if (!weather || weather.date !== manilaDate(now)) return false;
  const age = now.getTime() - Date.parse(weather.currentAt);
  return Number.isFinite(age) && age >= -10 * 60000 && age <= 45 * 60000;
}
export function portAtmosphere(weather: DisplayWeather | null, now: Date) {
  if (!weather || !currentPortWeather(weather, now)) return null;
  const instant = now.getTime(), sunrise = Date.parse(weather.sunriseAt), sunset = Date.parse(weather.sunsetAt);
  if (!Number.isFinite(sunrise) || !Number.isFinite(sunset) || sunrise >= sunset) return null;
  const isDay = instant >= sunrise && instant < sunset;
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', hourCycle: 'h23' }).format(now));
  let phase: HarborPhase;
  if (instant >= sunrise - 30 * 60000 && instant < sunrise + 45 * 60000) phase = 'dawn';
  else if (instant >= sunset - 45 * 60000 && instant < sunset + 30 * 60000) phase = 'dusk';
  else if (!isDay) phase = 'night';
  else if (hour < 11) phase = 'morning';
  else if (hour < 14) phase = 'midday';
  else phase = 'afternoon';
  const progress = Math.min(1, Math.max(0, (instant - sunrise) / (sunset - sunrise)));
  let colors: [string, string, string, string] = {
    dawn: ['#5a89ab', '#e8bc95', '#366e8b', '#bd85503b'],
    morning: ['#5fa9d4', '#d2eaf1', '#317fa6', '#40b8e54d'],
    midday: ['#2499d2', '#bbdfed', '#2379a4', '#45bce952'],
    afternoon: ['#568ebd', '#c6dce6', '#31668e', '#518bb747'],
    dusk: ['#665c87', '#d8a383', '#34546f', '#b47b5540'],
    night: ['#06162d', '#193751', '#0a263e', '#29467730'],
  }[phase] as [string, string, string, string];
  if (isDay && ['cloudy','rain','storm','fog','snow'].includes(weather.scene)) {
    colors = weather.scene === 'cloudy' ? ['#708c9e','#bcc9d0','#3e647f','#869ca43d']
      : weather.scene === 'storm' ? ['#283f55','#6e7e8c','#263f57','#526e8538']
      : weather.scene === 'fog' ? ['#83969f','#c4ced0','#607984','#a2b1b13d']
      : weather.scene === 'snow' ? ['#7b96a8','#d3dfe4','#5b8098','#9bbdce38']
      : ['#4c667b','#96a8b2','#345368','#73879840'];
  }
  return { phase, isDay, style: {
    '--harbor-sky-top': colors[0], '--harbor-sky-horizon': colors[1], '--harbor-sea': colors[2], '--harbor-glow': colors[3],
    '--sun-x': `${22 + progress * 52}%`, '--sun-y': `${60 - Math.sin(progress * Math.PI) * 52}%`,
  } };
}
export const harborPhaseLabel: Record<HarborPhase, string> = { dawn: 'Sunrise', morning: 'Morning', midday: 'Midday', afternoon: 'Afternoon', dusk: 'Sunset', night: 'Night' };
