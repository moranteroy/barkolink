export const mockTrips = [
  { id: 'TRP-001', vessel: 'MV Island Star', from: 'Calapan', to: 'Batangas', departure: '6:00 AM', arrival: '8:30 AM', duration: '2h 30m', fare: '₱528', available: 72, status: 'AVAILABLE', accent: 'blue' },
  { id: 'TRP-002', vessel: 'MV Ocean Crest', from: 'Calapan', to: 'Batangas', departure: '9:30 AM', arrival: '12:00 PM', duration: '2h 30m', fare: '₱548', available: 124, status: 'AVAILABLE', accent: 'teal' },
  { id: 'TRP-003', vessel: 'MV Verde Express', from: 'Calapan', to: 'Batangas', departure: '2:00 PM', arrival: '4:30 PM', duration: '2h 30m', fare: '₱498', available: 38, status: 'LIMITED', accent: 'amber' }
]

export const mockBookings = [
  { reference: 'BL-2026-000125', from: 'Calapan', to: 'Batangas', date: 'Oct 10, 2026', time: '6:00 AM', vessel: 'MV Island Star', status: 'CONFIRMED', passengers: 2 },
  { reference: 'BL-2026-000098', from: 'Batangas', to: 'Calapan', date: 'Sep 04, 2026', time: '9:30 AM', vessel: 'MV Ocean Crest', status: 'COMPLETED', passengers: 1 },
  { reference: 'BL-2026-000076', from: 'Calapan', to: 'Puerto Galera', date: 'Aug 22, 2026', time: '7:00 AM', vessel: 'MV Verde Express', status: 'CANCELLED', passengers: 3 }
]

export const mockNotifications = [
  { title: 'Booking confirmed', body: 'Your Calapan to Batangas trip is ready.', time: '2 min ago', type: 'BOOKINGS', unread: true },
  { title: 'Trip reminder', body: 'Your ferry departs tomorrow at 6:00 AM.', time: 'Yesterday', type: 'TRIPS', unread: true },
  { title: 'Schedule update', body: 'MV Island Star is now boarding at Gate 3.', time: 'Sep 28', type: 'SYSTEM', unread: false }
]
