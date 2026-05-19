// composables/useApi.ts
// ─────────────────────────────────────────────────────────────────
// HTTP API HELPERS — thin wrappers around $fetch
//
// CHANGE FROM BEFORE:
//   Old: used useRuntimeConfig() → was undefined outside setup() context
//   New: imports API_BASE directly from utils/api.js → always works
//
// TO CHANGE THE BACKEND URL:
//   Edit BACKEND_HOST in utils/api.js — that's the only place.
//
// NOTE: Most pages import API_BASE and call $fetch directly.
//   Use this composable only when you want typed helper functions.
// ─────────────────────────────────────────────────────────────────

import { API_BASE } from '~/utils/api'

export const useApi = () => {

  // ── Passenger (User) ───────────────────────────────────────────

  // POST /api/users — register a new passenger
  // Body: { name, phone, password, email?, lat, lng }
  // Backend auto-detects region from lat/lng
  const registerPassenger = (body: {
    name: string; phone: string; password: string;
    email?: string; lat: number; lng: number;
  }) => $fetch(`${API_BASE}/users`, { method: 'POST', body })

  // POST /api/users/login — login a passenger
  const loginPassenger = (body: { phone: string; password: string }) =>
    $fetch(`${API_BASE}/users/login`, { method: 'POST', body })

  // ── Driver ────────────────────────────────────────────────────

  // POST /api/drivers — register a new driver
  // Body: { name, phone, vehicleType, capabilities?, currentLocation: { lat, lng } }
  const registerDriver = (body: {
    name: string; phone: string; password: string;
    vehicleType: 'taxi' | 'bike';
    capabilities?: string[];
    currentLocation: { lat: number; lng: number };
  }) => $fetch(`${API_BASE}/drivers`, { method: 'POST', body })

  // POST /api/drivers/login — login a driver
  const loginDriver = (body: { phone: string; password: string }) =>
    $fetch(`${API_BASE}/drivers/login`, { method: 'POST', body })

  // GET /api/drivers/:id
  const getDriver = (id: string) => $fetch(`${API_BASE}/drivers/${id}`)

  // GET /api/drivers/nearby?lat=&lng=&type=
  const getNearbyDrivers = (lat: number, lng: number, type?: string) => {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) })
    if (type && type !== 'all') params.set('type', type)
    return $fetch(`${API_BASE}/drivers/nearby?${params}`)
  }

  // ── Rides ──────────────────────────────────────────────────────

  // POST /api/rides — create a ride and notify nearby drivers
  const createRide = (body: {
    passengerId:    string;
    rideCategory:   'normal' | 'special';
    rideType?:      'taxi' | 'bike';
    pickup:         { lat: number; lng: number; description?: string };
    destination:    { lat: number; lng: number; description?: string };
    specialRequest?: { description?: string; cargoType?: string; estimatedLoad?: string };
  }) => $fetch(`${API_BASE}/rides`, { method: 'POST', body })

  // GET /api/rides/:id
  const getRide = (id: string) => $fetch(`${API_BASE}/rides/${id}`)

  // GET /api/rides/passenger/:passengerId — ride history
  const getPassengerRides = (passengerId: string, status?: string) =>
    $fetch(`${API_BASE}/rides/passenger/${passengerId}${status ? `?status=${status}` : ''}`)

  // GET /api/rides/driver/:driverId — pending/filtered rides for driver
  const getDriverRides = (driverId: string, filters?: {
    status?: string; region?: string; fromDate?: string; toDate?: string;
  }) => {
    const params = new URLSearchParams()
    if (filters?.status)   params.set('status',   filters.status)
    if (filters?.region)   params.set('region',   filters.region)
    if (filters?.fromDate) params.set('fromDate',  filters.fromDate)
    if (filters?.toDate)   params.set('toDate',    filters.toDate)
    return $fetch(`${API_BASE}/rides/driver/${driverId}?${params}`)
  }

  // PATCH /api/rides/:id/cancel
  const cancelRide = (id: string, cancelledBy: 'passenger' | 'driver') =>
    $fetch(`${API_BASE}/rides/${id}/cancel`, { method: 'PATCH', body: { cancelledBy } })

  // POST /api/rides/:id/chat
  const sendChat = (id: string, sender: 'passenger' | 'driver', text: string) =>
    $fetch(`${API_BASE}/rides/${id}/chat`, { method: 'POST', body: { sender, text } })

  // GET /api/rides/:id/chat
  const getChat = (id: string) => $fetch(`${API_BASE}/rides/${id}/chat`)

  // DELETE /api/rides/passenger/:passengerId/clear-history
  const clearPassengerHistory = (passengerId: string) =>
    $fetch(`${API_BASE}/rides/passenger/${passengerId}/clear-history`, { method: 'DELETE' })

  // DELETE /api/rides/driver/:driverId/clear-history
  const clearDriverHistory = (driverId: string) =>
    $fetch(`${API_BASE}/rides/driver/${driverId}/clear-history`, { method: 'DELETE' })

  return {
    registerPassenger, loginPassenger,
    registerDriver,    loginDriver,    getDriver,
    getNearbyDrivers,
    createRide,        getRide,
    getPassengerRides, getDriverRides,
    cancelRide,
    sendChat,          getChat,
    clearPassengerHistory, clearDriverHistory,
  }
}