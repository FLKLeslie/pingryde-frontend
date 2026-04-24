// utils/regions.ts
// Exact region names from your backend models (Driver.js, User.js, Ride.js)
// IMPORTANT: spelling and spacing must match the backend enum exactly.

export const REGIONS = [
  'North West',
  'South West',
  'Littoral',
  'Centre',
  'West',
  'East',
  'Far North',
  'North',
  'Adamawa',
  'South',
] as const

export type Region = typeof REGIONS[number]