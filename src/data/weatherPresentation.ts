/** Use broad categories for icons while keeping the provider's wording visible. */
export function weatherPresentation(condition: string) {
  const text = condition.toLowerCase();
  if (/thunder/.test(text)) return { kind: 'storm', label: 'Thunderstorms' } as const;
  if (/snow|sleet|blizzard|ice pellet/.test(text)) return { kind: 'snow', label: 'Snow / sleet' } as const;
  if (/fog|mist/.test(text)) return { kind: 'fog', label: 'Foggy' } as const;
  if (/rain|drizzle|shower/.test(text)) return { kind: 'rain', label: 'Rainy' } as const;
  if (/wind/.test(text)) return { kind: 'wind', label: 'Windy' } as const;
  if (/partly/.test(text)) return { kind: 'partly', label: 'Partly cloudy' } as const;
  if (/cloud|overcast/.test(text)) return { kind: 'cloud', label: 'Cloudy' } as const;
  if (/sunny/.test(text)) return { kind: 'sun', label: 'Sunny' } as const;
  if (/clear/.test(text)) return { kind: 'clear', label: 'Clear' } as const;
  return { kind: 'unknown', label: 'Unavailable' } as const;
}
