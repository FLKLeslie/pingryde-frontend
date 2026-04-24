<!-- components/MapView.vue
  ─────────────────────────────────────────────────────────────────
  THE MAP COMPONENT

  Used on: passenger/request, passenger/tracking, driver/map

  KEY FIXES FROM PREVIOUS VERSION:
  1. `await nextTick()` before L.map() — ensures DOM has real height
  2. `map.invalidateSize()` after mount — forces tile reload
  3. Loading state shown while tiles load
  4. "Centre on me" button — one tap to re-centre the map
  5. Popup styling matches dark theme (via CSS in main.css)
  6. Better icon sizing that's clearer at a glance

  PROPS:
    height          String   CSS height e.g. "300px" (MUST be explicit pixels)
    passengerCoords Object   { lat, lng } — teal person marker
    driverCoords    Object   { lat, lng } — vehicle marker (during active ride)
    driverType      String   'taxi' | 'bike'
    nearbyDrivers   Array    Online driver documents for nearby display
    showNearby      Boolean  Whether to render the nearby layer
    centreOn        String   'passenger' | 'driver' — which marker to keep centred
    zoom            Number   Initial zoom (default 15)
-->
<template>
  <div class="map-outer" :style="{ height, minHeight: height }">

    <!-- Loading overlay — shown while Leaflet is initialising -->
    <div v-if="loading" class="map-loading">
      <div class="map-loading-dot"></div>
      <span>Loading map...</span>
    </div>

    <!-- The actual Leaflet map container -->
    <!-- ref="mapEl" is how Vue gives us access to the real DOM node -->
    <div ref="mapEl" class="map-el" :style="{ height, minHeight: height }" />

    <!-- "Centre on me" floating button — re-centres the map on passenger -->
    <button
      v-if="!loading && passengerCoords"
      class="map-centre-btn"
      @click="centreOnPassenger"
      title="Centre map on your location"
      aria-label="Centre map on your location"
    >
      📍
    </button>

    <!-- Legend overlay — shows what the icons mean -->
    <div v-if="!loading && showNearby && nearbyDrivers.length > 0" class="map-legend-overlay">
      <div class="legend-row">
        <div class="leg-dot" style="background:#00D4B8"></div>
        <span>You</span>
      </div>
      <div class="legend-row">
        <div class="leg-sq" style="background:#F0C040"></div>
        <span>Taxi</span>
      </div>
      <div class="legend-row">
        <div class="leg-dot" style="background:#FF6B35"></div>
        <span>Moto</span>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'

const props = defineProps({
  height:          { type: String,  default: '300px' },
  passengerCoords: { type: Object,  default: null },
  driverCoords:    { type: Object,  default: null },
  driverType:      { type: String,  default: 'bike' },
  nearbyDrivers:   { type: Array,   default: () => [] },
  showNearby:      { type: Boolean, default: false },
  zoom:            { type: Number,  default: 15 },
})

// Template ref — Vue sets this to the actual <div> DOM element after mount
const mapEl  = ref(null)
const loading = ref(true)   // shows the loading spinner

// Leaflet instance variables
let map         = null
let L           = null   // cached Leaflet module
let myMarker    = null   // passenger "you" marker
let otherMarker = null   // driver marker during active ride
let nearbyLayer = null   // group holding all nearby driver markers

// ── ICON FACTORIES ────────────────────────────────────────────────
//
// Leaflet's default marker is a generic blue pin.
// We replace it with custom HTML/SVG via L.divIcon().
// L.divIcon({ html, iconSize, iconAnchor }) renders any HTML at the coordinate.
// iconAnchor = [x, y] offset so the icon is centred on the coordinate, not top-left.

const makePersonIcon = () => L.divIcon({
  className: '',   // empty string prevents Leaflet's default white-box CSS
  html: `
    <div style="
      position:relative;width:42px;height:42px;
      display:flex;align-items:center;justify-content:center;
    ">
      <!-- Expanding pulse ring — shows this is a live GPS position -->
      <div style="
        position:absolute;inset:0;border-radius:50%;
        border:2px solid rgba(0,212,184,0.55);
        animation:prPulse 2s ease-out infinite;
      "></div>
      <!-- Solid teal circle with person inside -->
      <div style="
        width:32px;height:32px;border-radius:50%;
        background:#00D4B8;border:2.5px solid #1E2A32;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 2px 10px rgba(0,212,184,0.45);
        position:relative;z-index:1;
      ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="7" r="4" fill="#1E2A32"/>
          <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" fill="#1E2A32"/>
        </svg>
      </div>
    </div>
    <style>
      @keyframes prPulse {
        0%   { transform:scale(0.8);opacity:1; }
        100% { transform:scale(2.2);opacity:0; }
      }
    </style>
  `,
  iconSize:   [42, 42],
  iconAnchor: [21, 21],    // centre of 42×42 box
  popupAnchor:[0, -22],
})

const makeTaxiIcon = (small = false) => {
  const s = small ? 32 : 40
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:${s}px;height:${s * 0.75}px;border-radius:8px;
        background:#F0C040;border:2.5px solid #1E2A32;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 3px 12px rgba(0,0,0,0.4);
      ">
        <svg width="${s-10}" height="${s-10}" viewBox="0 0 24 24" fill="none">
          <rect x="2"  y="9"  width="20" height="9"  rx="2" fill="#1E2A32"/>
          <rect x="5"  y="5"  width="14" height="6"  rx="2" fill="#1E2A32"/>
          <rect x="6"  y="6"  width="5"  height="4"  rx="1" fill="#F0C040" opacity="0.7"/>
          <rect x="13" y="6"  width="5"  height="4"  rx="1" fill="#F0C040" opacity="0.7"/>
          <circle cx="6.5"  cy="18" r="2.2" fill="#444"/>
          <circle cx="17.5" cy="18" r="2.2" fill="#444"/>
        </svg>
      </div>
    `,
    iconSize:   [s, s * 0.75],
    iconAnchor: [s/2, (s * 0.75)/2],
    popupAnchor:[0, -(s * 0.75)/2],
  })
}

const makeBikeIcon = (small = false) => {
  const s = small ? 30 : 38
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:${s}px;height:${s}px;border-radius:50%;
        background:#FF6B35;border:2.5px solid #1E2A32;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 3px 12px rgba(255,107,53,0.45);
      ">
        <svg width="${s-10}" height="${s-10}" viewBox="0 0 24 24" fill="none">
          <circle cx="5"  cy="16" r="3.5" fill="none" stroke="#1E2A32" stroke-width="2"/>
          <circle cx="19" cy="16" r="3.5" fill="none" stroke="#1E2A32" stroke-width="2"/>
          <path d="M5 16L9.5 8H14L19 16" fill="none" stroke="#1E2A32" stroke-width="2" stroke-linejoin="round"/>
          <rect x="8.5" y="5.5" width="7" height="3" rx="1.5" fill="#1E2A32"/>
          <path d="M18 10.5L20.5 8" stroke="#1E2A32" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
    `,
    iconSize:   [s, s],
    iconAnchor: [s/2, s/2],
    popupAnchor:[0, -(s/2)],
  })
}

const makeDriverIcon = (vehicleType, small = false) =>
  vehicleType === 'taxi' ? makeTaxiIcon(small) : makeBikeIcon(small)

// ── INITIALISATION ────────────────────────────────────────────────
onMounted(async () => {
  // STEP 1: Let Vue finish rendering so mapEl.value has real dimensions.
  // Without this, Leaflet sometimes sees height=0 and tiles don't load.
  await nextTick()

  // STEP 2: Dynamically import Leaflet.
  // Leaflet accesses `window` and `document`, which don't exist in Node.js.
  // Dynamic import ensures it only runs in the browser.
  L = await import('leaflet')

  // STEP 3: Determine starting centre for the map
  const centre = props.passengerCoords
    ? [props.passengerCoords.lat, props.passengerCoords.lng]
    : props.driverCoords
      ? [props.driverCoords.lat, props.driverCoords.lng]
      : [5.9631, 10.1591]   // Bamenda, Cameroon — default

  // STEP 4: Create the Leaflet map inside our <div ref="mapEl">
  map = L.map(mapEl.value, {
    center:             centre,
    zoom:               props.zoom,
    zoomControl:        true,    // show +/- zoom buttons
    attributionControl: false,   // hide OpenStreetMap credit (saves space)
  })

  // STEP 5: Add OpenStreetMap tile layer
  // {s}, {z}, {x}, {y} are placeholders that Leaflet fills in automatically
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    subdomains: 'abc',   // spread requests across a, b, c subdomains for speed
  }).addTo(map)

  // STEP 6: CRITICAL — re-measure the container after tiles start loading.
  // This handles cases where the container had 0 height at L.map() time.
  // The 150ms delay ensures the layout has fully settled.
  setTimeout(() => {
    map?.invalidateSize()
    loading.value = false
  }, 150)

  // STEP 7: Place initial markers if coordinates were provided as props
  if (props.passengerCoords) {
    myMarker = L.marker([props.passengerCoords.lat, props.passengerCoords.lng], {
      icon: makePersonIcon(),
    }).addTo(map).bindPopup('<div style="font-family:sans-serif"><strong>📍 You</strong></div>')
  }

  if (props.driverCoords) {
    otherMarker = L.marker([props.driverCoords.lat, props.driverCoords.lng], {
      icon: makeDriverIcon(props.driverType),
    }).addTo(map).bindPopup('<div style="font-family:sans-serif"><strong>Your driver</strong></div>')
  }

  // STEP 8: Set up nearby drivers layer if requested
  if (props.showNearby) {
    // LayerGroup is a container for multiple markers.
    // Calling .clearLayers() removes all markers at once — efficient.
    nearbyLayer = L.layerGroup().addTo(map)
    drawNearbyDrivers()
  }
})

// ── DRAW NEARBY DRIVERS ──────────────────────────────────────────
// Clears old markers and redraws one per online driver.
const drawNearbyDrivers = () => {
  if (!nearbyLayer || !L) return
  nearbyLayer.clearLayers()

  props.nearbyDrivers.forEach(driver => {
    if (!driver.currentLocation?.lat) return   // skip if no location saved

    const icon = makeDriverIcon(driver.vehicleType, true)  // small=true for nearby markers

    L.marker([driver.currentLocation.lat, driver.currentLocation.lng], { icon })
      .addTo(nearbyLayer)
      .bindPopup(`
        <div style="font-family:sans-serif;padding:4px 0;min-width:120px;">
          <strong style="font-size:14px">${driver.name || 'Driver'}</strong><br>
          <span style="font-size:12px;color:#888">
            ${driver.vehicleType === 'taxi' ? '🚕 Taxi' : '🏍️ Moto'}
          </span><br>
          <span style="font-size:12px;color:#888">📍 ${driver.region || ''}</span>
        </div>
      `)
  })
}

// ── CENTRE ON PASSENGER ──────────────────────────────────────────
// Called by the "centre" button — flies map smoothly to passenger position
const centreOnPassenger = () => {
  if (map && props.passengerCoords) {
    map.flyTo([props.passengerCoords.lat, props.passengerCoords.lng], 16, {
      duration: 1,   // 1 second smooth animation
    })
  }
}

// ── WATCHERS — update markers when props change ──────────────────
// Vue's watch() runs the callback whenever the watched value changes.
// This is what makes markers move live — the store updates from socket events,
// the prop updates, the watcher fires, and the marker moves.

watch(() => props.passengerCoords, (coords) => {
  if (!coords || !map || !L) return
  if (myMarker) {
    myMarker.setLatLng([coords.lat, coords.lng])
  } else {
    myMarker = L.marker([coords.lat, coords.lng], { icon: makePersonIcon() })
      .addTo(map).bindPopup('<strong>📍 You</strong>')
  }
}, { deep: true })

watch(() => props.driverCoords, (coords) => {
  if (!coords || !map || !L) return
  if (otherMarker) {
    otherMarker.setLatLng([coords.lat, coords.lng])
  } else {
    otherMarker = L.marker([coords.lat, coords.lng], { icon: makeDriverIcon(props.driverType) })
      .addTo(map).bindPopup('<strong>Your driver</strong>')
  }
  // Pan map smoothly to keep driver in view
  map.panTo([coords.lat, coords.lng], { animate: true, duration: 0.6 })
}, { deep: true })

watch(() => props.nearbyDrivers, drawNearbyDrivers, { deep: true })

// ── CLEANUP ──────────────────────────────────────────────────────
// Called when component is removed from DOM (navigating away).
// Without this, revisiting a page creates a second Leaflet map on the
// same div → "Map container is already initialized" error.
onBeforeUnmount(() => {
  map?.remove()
  map = null; L = null
  myMarker = null; otherMarker = null; nearbyLayer = null
})
</script>

<style scoped>
/* Wrapper — sets explicit height so Leaflet always has something to measure */
.map-outer {
  position:      relative;
  width:         100%;
  border-radius: 12px;
  overflow:      hidden;
  background:    var(--pr-surface2);
}

/* The actual Leaflet container must be display:block */
.map-el {
  width:   100%;
  display: block;
}

/* Loading overlay */
.map-loading {
  position:        absolute;
  inset:           0;
  background:      var(--pr-surface2);
  display:         flex;
  align-items:     center;
  justify-content: center;
  gap:             10px;
  z-index:         50;
  font-size:       13px;
  color:           var(--pr-muted);
  border-radius:   12px;
}
.map-loading-dot {
  width:10px;height:10px;border-radius:50%;
  background:var(--pr-teal);
  animation:prSpin 0.8s linear infinite;
}
@keyframes prSpin { to { transform: rotate(360deg); } }

/* Centre-on-me button — floats in the bottom-right of the map */
.map-centre-btn {
  position:        absolute;
  bottom:          14px;
  right:           14px;
  z-index:         30;
  width:           38px;
  height:          38px;
  border-radius:   50%;
  background:      rgba(30,42,50,0.92);
  border:          1px solid rgba(255,255,255,0.1);
  display:         flex;
  align-items:     center;
  justify-content: center;
  font-size:       16px;
  cursor:          pointer;
  transition:      background 0.15s, transform 0.15s;
  backdrop-filter: blur(8px);
}
.map-centre-btn:hover  { background: rgba(0,212,184,0.2); transform: scale(1.08); }
.map-centre-btn:active { transform: scale(0.95); }

/* Legend overlay — bottom-left */
.map-legend-overlay {
  position:    absolute;
  bottom:      14px;
  left:        14px;
  z-index:     30;
  background:  rgba(30,42,50,0.88);
  border:      1px solid rgba(255,255,255,0.08);
  border-radius:8px;
  padding:     8px 10px;
  display:     flex;
  flex-direction:column;
  gap:         5px;
  backdrop-filter:blur(8px);
}
.legend-row {
  display:     flex;
  align-items: center;
  gap:         6px;
  font-size:   11px;
  color:       rgba(255,255,255,0.75);
}
.leg-dot { width:10px;height:10px;border-radius:50%;flex-shrink:0; }
.leg-sq  { width:10px;height:8px; border-radius:2px;flex-shrink:0; }
</style>