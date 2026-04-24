// composables/useApi.ts
// ─────────────────────────────────────────────────────────────
// Centralizes all HTTP calls to the Express backend.
// Endpoint map (from server.js routes):
//
//   POST /api/users          → register passenger
//   POST /api/drivers        → register driver
//   GET  /api/rides/driver/:driverId  → driver notification panel
//   POST /api/rides          → create ride request
//
// NOTE: Your backend has NO login endpoint yet — registration
// returns the full user/driver object. We store it directly.
// A login route would be: POST /api/users/login (not yet built).
// ─────────────────────────────────────────────────────────────

export const useApi = () => {
  const config = useRuntimeConfig()
  const base   = config.public.apiBase  // http://localhost:5000/api

  // ── Passenger (User) ───────────────────────────────────────

  // POST /api/users
  // Body: { name, phone, password, email?, lat, lng }
  // The backend auto-detects region from lat/lng via getRegionFromCoordinates()
  // Returns: full User document from MongoDB
  const registerPassenger = (body: {
    name: string; phone: string; password: string;
    email?: string; lat: number; lng: number;
  }) => $fetch(`${base}/users`, { method: 'POST', body })

  // ── Driver ────────────────────────────────────────────────

  // POST /api/drivers
  // Body: { name, phone, vehicleType, capabilities?, currentLocation: { lat, lng } }
  // The backend auto-detects region from currentLocation.lat/lng
  // Returns: full Driver document from MongoDB
  const registerDriver = (body: {
    name: string; phone: string;
    vehicleType: 'taxi' | 'bike';
    capabilities?: string[];
    currentLocation: { lat: number; lng: number };
  }) => $fetch(`${base}/drivers`, { method: 'POST', body })

  // GET /api/drivers/:id (not yet in your routes — placeholder)
  const getDriver = (id: string) =>
    $fetch(`${base}/drivers/${id}`)

  // ── Rides ─────────────────────────────────────────────────

  // POST /api/rides
  // Body: { passengerId, rideCategory, rideType, pickup, destination?, region? }
  // Returns: { message, ride, nearestDrivers }
  // Also fires "newRide" socket event to nearby drivers
  const createRide = (body: {
    passengerId:   string
    rideCategory:  'normal' | 'special'
    rideType?:     'taxi' | 'bike'
    pickup:        { lat: number; lng: number; description?: string }
    destination?:  { lat: number; lng: number }
    region?:       string
    specialRequest?: { description?: string; cargoType?: string; estimatedLoad?: string }
  }) => $fetch(`${base}/rides`, { method: 'POST', body })

  // GET /api/rides/driver/:driverId
  // Query params: region?, status?, fromDate?, toDate?
  // Returns: { total, filters, rides[] }
  const getDriverRides = (driverId: string, filters?: {
    region?: string; status?: string; fromDate?: string; toDate?: string;
  }) => {
    const params = new URLSearchParams()
    if (filters?.region)   params.set('region', filters.region)
    if (filters?.status)   params.set('status', filters.status)
    if (filters?.fromDate) params.set('fromDate', filters.fromDate)
    if (filters?.toDate)   params.set('toDate', filters.toDate)
    const qs = params.toString()
    return $fetch(`${base}/rides/driver/${driverId}${qs ? '?' + qs : ''}`)
  }

  return {
    registerPassenger,
    registerDriver,
    getDriver,
    createRide,
    getDriverRides,
  }
}