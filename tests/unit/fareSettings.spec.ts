import { describe, expect, it } from 'vitest'
import { calculateFares, copyFareSettings, defaultFareSettings, validFareSettings, passengerFare, passengerTypeCode } from '../../src/data/fareSettings'

describe('fare settings', () => {
  it('uses the regular fare with independently configured discounts', () => {
    expect(calculateFares(1000, { ...defaultFareSettings, studentDiscount: 20, seniorDiscount: 30, childDiscount: 50, pwdDiscount: 25 })).toEqual({ regularFare: 1000, studentFare: 800, seniorFare: 700, childFare: 500, pwdFare: 750, pregnantFare: 1000 })
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

const custom = {id:'11111111-1111-4111-8111-111111111111',name:'Special discount',percentage:15,isActive:true}
describe('custom passenger fares', () => {
  it('preserves custom names and prices alongside standard passenger codes', () => {
    expect(passengerTypeCode('Special discount')).toBe('Special discount')
    expect(passengerTypeCode('Senior Citizen')).toBe('SENIOR')
    const trip={...calculateFares(1000, defaultFareSettings),customDiscounts:[{...custom,fare:850}]}
    expect(passengerFare(trip,'Special discount')).toBe(850)
    expect(passengerFare(trip,'Student')).toBe(800)
    expect(passengerFare(trip,'Fake discount')).toBe(0)
  })
  it('rejects duplicate/reserved names, invalid percentages and shares no mutable drafts', () => {
    const settings={...defaultFareSettings,customDiscounts:[custom]}
    expect(validFareSettings(settings)).toBe(true)
    for(const item of [{...custom,name:'Student'},{...custom,percentage:100},{...custom,percentage:1.5}]) expect(validFareSettings({...settings,customDiscounts:[item]})).toBe(false)
    expect(validFareSettings({...settings,customDiscounts:[custom,{...custom,id:'22222222-2222-4222-8222-222222222222',name:'  special   discount '}]})).toBe(false)
    const draft=copyFareSettings(settings);draft.customDiscounts![0].name='Changed'
    expect(settings.customDiscounts[0].name).toBe('Special discount')
  })
})
