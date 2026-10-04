import { describe, expect, it } from 'vitest'
import { calculateFares, defaultFareSettings, validFareSettings } from '../../src/data/fareSettings'

describe('fare settings', () => {
  it('uses the regular fare with independently configured discounts', () => {
    expect(calculateFares(1000, { ...defaultFareSettings, studentDiscount: 20, seniorDiscount: 30, childDiscount: 50, pwdDiscount: 25 })).toEqual({ regularFare: 1000, studentFare: 800, seniorFare: 700, childFare: 500, pwdFare: 750 })
  })
  it('rounds to whole pesos and keeps deeply discounted fares positive', () => {
    expect(calculateFares(503, defaultFareSettings).studentFare).toBe(402)
    expect(calculateFares(1, { ...defaultFareSettings, childDiscount: 99 }).childFare).toBe(1)
  })
  it.each([0, -1, 12.5, NaN, 2147483648])('rejects invalid regular fare %s', regularFare => {
    expect(validFareSettings({ ...defaultFareSettings, regularFare })).toBe(false)
  })
  it.each([-1, 100, 20.5, NaN])('rejects invalid discount %s', childDiscount => {
    expect(validFareSettings({ ...defaultFareSettings, childDiscount })).toBe(false)
  })
  it('allows no discount and preserves the base fare', () => {
    const settings = { ...defaultFareSettings, studentDiscount: 0 }
    expect(validFareSettings(settings)).toBe(true)
    expect(calculateFares(500, settings).studentFare).toBe(500)
  })
})
