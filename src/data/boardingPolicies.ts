// These are reporting deadlines/cutoffs, not verified boarding opening times.
export const boardingPolicies: Record<string, { note: string; url: string }> = {
  'Starlite Ferries': {
    note: 'Official reminder: arrive at the port 3 hours before departure; boarding cutoff is 30 minutes before departure. The boarding start must be confirmed separately.',
    url: 'https://starliteferries.com/passenger-guidelines/',
  },
  OceanJet: {
    note: 'Official reminder: check in at least 30 minutes before departure. This does not state when boarding opens.',
    url: 'https://oceanjet.net/faq',
  },
  'Montenegro Shipping Lines': {
    note: 'Official reminder: passengers must be at the port 1 hour before a short-distance trip or 4 hours before a long-haul trip. Confirm the actual boarding start for this sailing.',
    url: 'https://montenegrolines.com.ph/booking.php',
  },
};
