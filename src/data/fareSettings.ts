export const discountTypes = [
  { key: 'studentDiscount', fareKey: 'studentFare', label: 'Student' },
  { key: 'seniorDiscount', fareKey: 'seniorFare', label: 'Senior' },
  { key: 'childDiscount', fareKey: 'childFare', label: 'Child' },
  { key: 'pwdDiscount', fareKey: 'pwdFare', label: 'PWD' },
] as const

export type FareSettings = {
  regularFare: number
  studentDiscount: number
  seniorDiscount: number
  childDiscount: number
  pwdDiscount: number
}

// Match the existing create-trip defaults until administrators save their rates.
export const defaultFareSettings: FareSettings = {
  regularFare: 500, studentDiscount: 20, seniorDiscount: 20, childDiscount: 20, pwdDiscount: 20,
}

export function validFareSettings(settings: FareSettings) {
  return Number.isSafeInteger(settings.regularFare) && settings.regularFare > 0 && settings.regularFare <= 2147483647 &&
    discountTypes.every(type => Number.isInteger(settings[type.key]) && settings[type.key] >= 0 && settings[type.key] < 100)
}

export function calculateFares(regularFare: number, settings: FareSettings) {
  return {
    regularFare,
    ...Object.fromEntries(discountTypes.map(type => [type.fareKey, Math.max(1, Math.round(regularFare * (100 - settings[type.key]) / 100))])),
  } as { regularFare: number; studentFare: number; seniorFare: number; childFare: number; pwdFare: number }
}
