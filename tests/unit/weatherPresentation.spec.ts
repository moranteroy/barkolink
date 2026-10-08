import { describe, expect, it } from 'vitest';
import { weatherPresentation } from '../../src/data/weatherPresentation';

describe('weather condition presentation', () => {
  it.each([
    ['Sunny', 'sun'], ['Clear', 'clear'], ['Partly cloudy', 'partly'],
    ['Overcast', 'cloud'], ['Light rain shower', 'rain'], ['Patchy rain nearby', 'rain'],
    ['Mist', 'fog'], ['Freezing fog', 'fog'], ['Moderate rain with thunder', 'storm'],
    ['Patchy light snow with thunder', 'storm'], ['Blowing snow', 'snow'],
    ['Light sleet showers', 'snow'], ['Windy', 'wind'], ['Conditions unavailable', 'unknown'],
  ])('uses the appropriate icon category for %s', (condition, kind) => {
    expect(weatherPresentation(condition).kind).toBe(kind);
  });
});
