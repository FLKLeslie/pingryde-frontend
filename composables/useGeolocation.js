// composables/useGeolocation.js
//
// WHAT THIS FILE DOES
// ───────────────────
// Wraps the browser's built-in navigator.geolocation API into two
// easy functions:
//
//   getOnce()        → asks for GPS one time (used at login + ride request)
//   startWatching()  → asks for GPS continuously every ~2s (used during live rides)
//   stopWatching()   → cancels the continuous watch (call when ride ends)
//
// WHY WE NEED THIS
// ─────────────────
// Your backend (userRoutes, driverRoutes) needs coordinates to
// call getRegionFromCoordinates() and auto-detect the Cameroon region.
// During an active ride, the driver's browser sends fresh coordinates
// every 2 seconds through the socket so the passenger sees the marker moving.

import { ref } from 'vue'

export const useGeolocation = () => {
  const coords  = ref(null)   // { lat, lng } — latest known position
  const error   = ref(null)   // string error message if GPS fails
  const loading = ref(false)

  let watchId = null          // ID returned by watchPosition, needed to cancel it

  // Ask for GPS exactly once and return a Promise.
  // Used when: registering a user/driver, creating a ride request.
  const getOnce = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject('This device does not support GPS')
        return
      }
      loading.value = true
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const c = { lat: position.coords.latitude, lng: position.coords.longitude }
          coords.value  = c
          loading.value = false
          resolve(c)
        },
        (err) => {
          error.value   = err.message
          loading.value = false
          reject(err.message)
        },
        { enableHighAccuracy: true, timeout: 10000 }
      )
    })
  }

  // Watch GPS continuously. Calls your callback every time position changes.
  // Used on: driver/map.vue (so driver location streams to passenger)
  //          passenger/tracking.vue (so passenger location updates locally)
  const startWatching = (onUpdate) => {
    if (!navigator.geolocation) {
      error.value = 'This device does not support GPS'
      return
    }
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const c = { lat: position.coords.latitude, lng: position.coords.longitude }
        coords.value = c
        onUpdate(c)       // call the function the page passed in
      },
      (err) => { error.value = err.message },
      { enableHighAccuracy: true, maximumAge: 2000 }
    )
  }

  // Stop the continuous watch. Always call this when leaving a page
  // that was watching, or the GPS keeps running in the background.
  const stopWatching = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId)
      watchId = null
    }
  }

  return { coords, error, loading, getOnce, startWatching, stopWatching }
}