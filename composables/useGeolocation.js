// composables/useGeolocation.js
// ─────────────────────────────────────────────────────────────────
// GPS + geocoding helpers for PingRyde
//
// FUNCTIONS:
//   getOnce()                     → one-shot GPS fix → { lat, lng }
//   startWatching(callback)       → continuous GPS stream
//   stopWatching()                → cancel the stream
//   reverseGeocode(lat, lng)      → coords → human-readable place name
//   searchPlaces(query, lat, lng) → text → array of place suggestions
//
// ALL GEOCODING IS FREE — uses OpenStreetMap Nominatim.
// No API key required. Rate limit: 1 request per second (we debounce).
// ─────────────────────────────────────────────────────────────────

import { ref } from 'vue'

export const useGeolocation = () => {
  const coords  = ref(null)
  const error   = ref(null)
  const loading = ref(false)

  let watchId = null

  // ── Get GPS once ────────────────────────────────────────────────
  // We use watchPosition instead of getCurrentPosition because
  // getCurrentPosition can return a stale cached position that is
  // minutes old and from a completely different location.
  //
  // Strategy:
  //   1. Start watching for positions
  //   2. Reject any position older than 30 seconds (stale cache)
  //   3. Reject any position with accuracy worse than 500 metres
  //   4. Accept the first position that passes both checks
  //   5. Hard timeout after 15 seconds — use best available if nothing ideal
  const getOnce = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject('GPS not supported'); return }
      loading.value = true

      let watchId   = null
      let settled   = false
      let bestSoFar = null   // fallback: best position seen even if not ideal

      const done = (pos) => {
        if (settled) return
        settled = true
        if (watchId !== null) navigator.geolocation.clearWatch(watchId)
        loading.value = false
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        console.log("GPS Position:", c)
        coords.value = c
        resolve(c)
      }

      const fail = (msg) => {
        if (settled) return
        settled = true
        if (watchId !== null) navigator.geolocation.clearWatch(watchId)
        loading.value = false
        error.value = msg
        // If we have any position at all, resolve with it rather than rejecting
        if (bestSoFar) {
          const c = { lat: bestSoFar.coords.latitude, lng: bestSoFar.coords.longitude }
          coords.value = c
          resolve(c)
        } else {
          reject(msg)
        }
      }

      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const ageMs    = Date.now() - pos.timestamp
          const accuracy = pos.coords.accuracy   // metres

          // Track best position seen regardless of age/accuracy
          if (!bestSoFar || accuracy < bestSoFar.coords.accuracy) {
            bestSoFar = pos
          }

          // Accept if: position is fresh (< 30s) AND accurate (< 500m)
          if (ageMs < 30_000 && accuracy < 500) {
            done(pos)
          }
          // Also accept if accuracy is very good (< 100m) even if slightly older
          else if (accuracy < 100) {
            done(pos)
          }
        },
        (err) => fail(err.message),
        {
          enableHighAccuracy: true,
          maximumAge:         0,       // do NOT use cached positions
          timeout:            15000,
        }
      )

      // Hard fallback: after 15s use whatever we have
      setTimeout(() => {
        if (!settled) fail('GPS timeout — using best available position')
      }, 15_000)
    })
  }

  // ── Continuous GPS watch ────────────────────────────────────────
  // maximumAge:0 forces fresh positions — no cached readings
  const startWatching = (onUpdate) => {
    if (!navigator.geolocation) { error.value = 'GPS not supported'; return }
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        coords.value = c
        onUpdate(c)
      },
      (err) => { error.value = err.message },
      {
        enableHighAccuracy: true,
        maximumAge:         0,       // always fresh — never use cached position
        timeout:            10000,
      }
    )
  }

  const stopWatching = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId)
      watchId = null
    }
  }

  // ── Reverse geocode: coords → place name ───────────────────────
  // Uses Nominatim (OpenStreetMap). Free, no API key.
  // Returns a short readable name like "Molyko, Buea" or "Bamenda".
  const reverseGeocode = async (lat, lng) => {
    try {
      // zoom=18 = building level — the deepest Nominatim supports.
      // zoom=16 was returning city/division level ("Buea").
      // zoom=18 returns road + neighbourhood level ("Molyko Road, Molyko").
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      const res  = await fetch(url, {
        headers: { 'Accept-Language': 'en', 'User-Agent': 'PingRyde/1.0' }
      })
      if (!res.ok) return null
      const data = await res.json()
      const a    = data.address || {}

      const parts = []

      // Most specific: named place (shop, building, amenity like "Total Station")
      const named = a.amenity || a.shop || a.office || a.tourism || a.leisure
      if (named) parts.push(named)

      // Road with optional house number ("12 Molyko Road" or just "Molyko Road")
      if (a.road) parts.push(a.house_number ? `${a.house_number} ${a.road}` : a.road)

      // Neighbourhood / suburb for local context ("Molyko")
      const area = a.suburb || a.neighbourhood || a.quarter || a.hamlet
      if (area && !parts.some(p => p.includes(area))) parts.push(area)

      // City / town last ("Buea")
      const city = a.city || a.town || a.village || a.county
      if (city && !parts.some(p => p.includes(city))) parts.push(city)

      // Return at most 2 parts for readability, e.g. "Molyko Road, Buea"
      if (parts.length) return parts.slice(0, 2).join(', ')

      // Fallback: take first 2 comma-parts of display_name
      return data.display_name?.split(',').slice(0, 2).join(',').trim() || null
    } catch { return null }
  }

  // ── Place search: text → suggestions ───────────────────────────
  // Uses Nominatim search biased toward user's coords.
  // Returns [{ name, fullName, lat, lng }]
  // Debounce calls to at least 500ms — Nominatim allows 1 req/sec.
  const searchPlaces = async (query, lat, lng) => {
    if (!query || query.length < 2) return []
    try {
      const delta   = 0.5  // ~50km bounding box
      const viewbox = `${lng-delta},${lat-delta},${lng+delta},${lat+delta}`
      const url = [
        'https://nominatim.openstreetmap.org/search',
        `?format=json&q=${encodeURIComponent(query)}`,
        `&viewbox=${viewbox}&bounded=0`,
        `&addressdetails=1&limit=6`,
        `&countrycodes=cm`,
      ].join('')
      const res  = await fetch(url, {
        headers: { 'Accept-Language': 'en', 'User-Agent': 'PingRyde/1.0' }
      })
      if (!res.ok) return []
      const data = await res.json()
      return data.map(item => {
        const a     = item.address || {}
        const short = a.suburb || a.neighbourhood || a.quarter ||
                      a.amenity || a.road || a.village ||
                      a.town || a.city || item.display_name.split(',')[0]
        const ctx   = a.city || a.town || a.county || a.state || ''
        return {
          name:     short,
          fullName: ctx ? `${short}, ${ctx}` : short,
          lat:      parseFloat(item.lat),
          lng:      parseFloat(item.lon),
        }
      })
    } catch { return [] }
  }

  return { coords, error, loading, getOnce, startWatching, stopWatching, reverseGeocode, searchPlaces }
}