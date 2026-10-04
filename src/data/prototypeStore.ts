export type PrototypePassenger = {
  id?: string
  name: string
  type: string
  birthDate?: string
  sex?: string
  phone?: string
  nationality?: string
}

export type PrototypeBooking = {
  reference: string
  from: string
  to: string
  date: string
  departure?: string
  time?: string
  arrival?: string
  duration?: string
  vessel: string
  tripId?: string
  passengers: PrototypePassenger[]
  total?: number
  status: string
  createdAt?: string
}

const BOOKINGS_KEY = 'barkolink-bookings'
const BOARDING_KEY = 'barkolink-boarding-statuses'

export function readPrototypeBookings(): PrototypeBooking[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(BOOKINGS_KEY) || '[]')
    return Array.isArray(value) ? value.filter((item): item is PrototypeBooking => Boolean(item?.reference && Array.isArray(item.passengers))) : []
  } catch {
    return []
  }
}

export function savePrototypeBookings(bookings: PrototypeBooking[]) {
  localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings))
}

export function readBoardingStatuses(): Record<string, string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(BOARDING_KEY) || '{}')
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, string> : {}
  } catch {
    return {}
  }
}

export function saveBoardingStatuses(statuses: Record<string, string>) {
  localStorage.setItem(BOARDING_KEY, JSON.stringify(statuses))
}
