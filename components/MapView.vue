<!-- components/MapView.vue
  Used by: passenger/request.vue, passenger/tracking.vue
  Features: loading overlay, centre-on-me, nearby drivers legend,
            satellite ↔ street toggle, all markers.
-->
<template>
  <div class="map-outer" :style="{ height, minHeight: height }">

    <!-- Loading overlay -->
    <div v-if="loading" class="map-loading">
      <div class="map-loading-dot"></div>
      <span>Loading map...</span>
    </div>

    <!-- Leaflet container -->
    <div ref="mapEl" class="map-el" :style="{ height, minHeight: height }" />

    <!-- Satellite / Street toggle — bottom-left -->
    <button
      v-if="!loading"
      class="map-layer-btn"
      :title="isSatellite ? 'Switch to Street view' : 'Switch to Satellite view'"
      @click="toggleLayer"
    >
      <span class="map-layer-icon">{{ isSatellite ? '🗺️' : '🛰️' }}</span>
      <span class="map-layer-label">{{ isSatellite ? 'Street' : 'Satellite' }}</span>
    </button>

    <!-- Centre-on-me — bottom-right -->
    <button
      v-if="!loading && passengerCoords"
      class="map-centre-btn"
      @click="centreOnPassenger"
      title="Centre map on your location"
    >📍</button>

    <!-- Legend — only on nearby view, appears above satellite btn -->
    <div v-if="!loading && showNearby && nearbyDrivers.length > 0" class="map-legend-overlay">
      <div class="legend-row"><div class="leg-dot" style="background:#00D4B8"></div><span>You</span></div>
      <div class="legend-row"><div class="leg-sq"  style="background:#F0C040"></div><span>Taxi</span></div>
      <div class="legend-row"><div class="leg-dot" style="background:#FF6B35"></div><span>Moto</span></div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'

const props = defineProps({
  height: { type: String, default: '400px' },  // Change from '300px'
  passengerCoords: { type: Object, default: null },
  driverCoords: { type: Object, default: null },
  driverType: { type: String, default: 'bike' },
  nearbyDrivers: { type: Array, default: () => [] },
  showNearby: { type: Boolean, default: false },
  zoom: { type: Number, default: 15 },
})

// Emits 'driver-click' with the full driver object when a nearby marker is tapped
const emit = defineEmits(['driver-click'])

const mapEl = ref(null)
const loading = ref(true)

// Leaflet instances
let map = null
let L = null
let myMarker = null
let otherMarker = null
let nearbyLayer = null

// Layer toggle state
const isSatellite = ref(false)
let streetLayer = null
let satelliteLayer = null

// ── Icon factories ────────────────────────────────────────────────
const makePersonIcon = () => L.divIcon({
  className: '',
  html: `
    <div style="position:relative;width:42px;height:42px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;inset:0;border-radius:50%;border:2px solid rgba(0,212,184,0.55);animation:prPulse 2s ease-out infinite;"></div>
      <div style="width:32px;height:32px;border-radius:50%;background:#00D4B8;border:2.5px solid #1E2A32;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,212,184,0.45);position:relative;z-index:1;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="7" r="4" fill="#1E2A32"/>
          <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" fill="#1E2A32"/>
        </svg>
      </div>
    </div>
    <style>@keyframes prPulse{0%{transform:scale(0.8);opacity:1}100%{transform:scale(2.2);opacity:0}}</style>
  `,
  iconSize: [42, 42], iconAnchor: [21, 21], popupAnchor: [0, -22],
})

const makeTaxiIcon = (small = false) => {
  const s = small ? 32 : 40
  return L.divIcon({
    className: '',
    html: `
      <div style="width:${s}px;height:${s * 0.75}px;border-radius:8px;background:#F0C040;border:2.5px solid #1E2A32;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 12px rgba(0,0,0,0.4);">
        <svg width="${s-10}" height="${s-10}" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="9" width="20" height="9" rx="2" fill="#1E2A32"/>
          <rect x="5" y="5" width="14" height="6" rx="2" fill="#1E2A32"/>
          <rect x="6" y="6" width="5" height="4" rx="1" fill="#F0C040" opacity="0.7"/>
          <rect x="13" y="6" width="5" height="4" rx="1" fill="#F0C040" opacity="0.7"/>
          <circle cx="6.5" cy="18" r="2.2" fill="#444"/>
          <circle cx="17.5" cy="18" r="2.2" fill="#444"/>
        </svg>
      </div>`,
    iconSize: [s, s * 0.75], iconAnchor: [s/2, (s*0.75)/2], popupAnchor: [0, -(s*0.75)/2],
  })
}

const makeBikeIcon = (small = false) => {
  const s = small ? 30 : 38
  return L.divIcon({
    className: '',
    html: `
      <div style="width:${s}px;height:${s}px;border-radius:50%;background:#FF6B35;border:2.5px solid #1E2A32;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 12px rgba(255,107,53,0.45);">
        <svg width="${s-10}" height="${s-10}" viewBox="0 0 24 24" fill="none">
          <circle cx="5" cy="16" r="3.5" fill="none" stroke="#1E2A32" stroke-width="2"/>
          <circle cx="19" cy="16" r="3.5" fill="none" stroke="#1E2A32" stroke-width="2"/>
          <path d="M5 16L9.5 8H14L19 16" fill="none" stroke="#1E2A32" stroke-width="2" stroke-linejoin="round"/>
          <rect x="8.5" y="5.5" width="7" height="3" rx="1.5" fill="#1E2A32"/>
          <path d="M18 10.5L20.5 8" stroke="#1E2A32" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>`,
    iconSize: [s, s], iconAnchor: [s/2, s/2], popupAnchor: [0, -(s/2)],
  })
}

const makeDriverIcon = (vehicleType, small = false) =>
  vehicleType === 'taxi' ? makeTaxiIcon(small) : makeBikeIcon(small)

// ── Layer toggle ──────────────────────────────────────────────────
const toggleLayer = () => {
  if (!map || !streetLayer || !satelliteLayer) return
  if (isSatellite.value) {
    map.removeLayer(satelliteLayer)
    streetLayer.addTo(map)
    isSatellite.value = false
  } else {
    map.removeLayer(streetLayer)
    satelliteLayer.addTo(map)
    isSatellite.value = true
  }
}

// ── Centre on passenger ───────────────────────────────────────────
const centreOnPassenger = () => {
  if (map && props.passengerCoords) {
    map.setView([props.passengerCoords.lat, props.passengerCoords.lng], map.getZoom(), { animate: true })
  }
}

// ── Initialisation ────────────────────────────────────────────────
onMounted(async () => {
  await nextTick()

  L = await import('leaflet')

  const center = props.passengerCoords
    ? [props.passengerCoords.lat, props.passengerCoords.lng]
    : props.driverCoords
      ? [props.driverCoords.lat, props.driverCoords.lng]
      : [5.9631, 10.1591]  // Bamenda

  map = L.map(mapEl.value, {
    center,
    zoom:               props.zoom,
    zoomControl:        true,
    attributionControl: false,
  })

  // Create both tile layers — only one is added at a time
  streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    subdomains: 'abc',
  })

  satelliteLayer = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, attribution: 'Tiles © Esri' }
  )

  // Start with street view
  streetLayer.addTo(map)

  setTimeout(() => {
    map?.invalidateSize()
    loading.value = false
  }, 150)

  if (props.passengerCoords) {
    myMarker = L.marker(
      [props.passengerCoords.lat, props.passengerCoords.lng],
      { icon: makePersonIcon() }
    ).addTo(map).bindPopup('<div style="font-family:sans-serif"><strong>📍 You</strong></div>')
  }

  if (props.driverCoords) {
    otherMarker = L.marker(
      [props.driverCoords.lat, props.driverCoords.lng],
      { icon: makeDriverIcon(props.driverType) }
    ).addTo(map).bindPopup('<div style="font-family:sans-serif"><strong>Your driver</strong></div>')
  }

  if (props.showNearby) {
    nearbyLayer = L.layerGroup().addTo(map)
    drawNearbyDrivers()
  }
})

// ── Draw nearby drivers ───────────────────────────────────────────
const drawNearbyDrivers = () => {
  if (!nearbyLayer || !L) return
  nearbyLayer.clearLayers()
  props.nearbyDrivers.forEach(driver => {
    if (!driver.currentLocation?.lat || !driver.currentLocation?.lng) return
    const marker = L.marker(
      [driver.currentLocation.lat, driver.currentLocation.lng],
      { icon: makeDriverIcon(driver.vehicleType, true) }
    ).addTo(nearbyLayer)

    // Clicking a driver marker emits the driver object to the parent page
    // so it can show a detail panel without Leaflet's default popup
    marker.on('click', () => emit('driver-click', driver))
  })
}

// ── Watchers ──────────────────────────────────────────────────────
watch(() => props.passengerCoords, (coords) => {
  if (!coords || !map || !L) return
  if (myMarker) {
    myMarker.setLatLng([coords.lat, coords.lng])
  } else {
    myMarker = L.marker([coords.lat, coords.lng], { icon: makePersonIcon() })
      .addTo(map).bindPopup('<strong>📍 You</strong>')
  }
  map.setView([coords.lat, coords.lng], map.getZoom(), { animate: true })
}, { deep: true })

watch(() => props.driverCoords, (coords) => {
  if (!coords || !map || !L) return
  if (otherMarker) {
    otherMarker.setLatLng([coords.lat, coords.lng])
  } else {
    otherMarker = L.marker([coords.lat, coords.lng], { icon: makeDriverIcon(props.driverType) })
      .addTo(map).bindPopup('<strong>Your driver</strong>')
  }
  map.panTo([coords.lat, coords.lng], { animate: true, duration: 0.5 })
}, { deep: true })

watch(() => props.nearbyDrivers, drawNearbyDrivers, { deep: true })

// ── Cleanup ───────────────────────────────────────────────────────
onBeforeUnmount(() => {
  map?.remove()
  map = null; L = null
  myMarker = null; otherMarker = null; nearbyLayer = null
  streetLayer = null; satelliteLayer = null
})
</script>

<style scoped>
.map-outer {
  position:      relative;
  width:         100%;
  border-radius: 12px;
  overflow:      hidden;
  background:    var(--pr-surface2);
  height: 100vh;
}

.map-el {
  width:   100%;
  display: block;
}

/* Loading overlay */
.map-loading {
  position: absolute; inset: 0;
  background: var(--pr-surface2);
  display: flex; align-items: center; justify-content: center;
  gap: 10px; z-index: 50;
  font-size: 13px; color: var(--pr-muted);
  border-radius: 12px;
}
.map-loading-dot {
  width:10px; height:10px; border-radius:50%;
  background:var(--pr-teal);
  animation: prSpin 0.8s linear infinite;
}
@keyframes prSpin { to { transform: rotate(360deg); } }

/* Satellite / Street toggle — bottom-left */
.map-layer-btn {
  position:        absolute;
  bottom:          14px;
  left:            14px;
  z-index:         30;
  display:         flex;
  align-items:     center;
  gap:             5px;
  padding:         7px 12px 7px 9px;
  border-radius:   10px;
  border:          1px solid rgba(255,255,255,0.15);
  background:      rgba(30,42,50,0.88);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color:           #fff;
  font-size:       12px;
  font-weight:     600;
  cursor:          pointer;
  box-shadow:      0 2px 10px rgba(0,0,0,0.5);
  transition:      background 0.18s, border-color 0.18s, transform 0.1s;
  white-space:     nowrap;
  -webkit-tap-highlight-color: transparent;
}
.map-layer-btn:hover  { background: rgba(0,212,184,0.2); border-color: rgba(0,212,184,0.4); }
.map-layer-btn:active { transform: scale(0.95); }
.map-layer-icon  { font-size: 15px; line-height: 1; }
.map-layer-label { font-family: var(--font-body); }

/* Centre-on-me — bottom-right */
.map-centre-btn {
  position: absolute; bottom: 14px; right: 14px; z-index: 30;
  width: 38px; height: 38px; border-radius: 50%;
  background: rgba(30,42,50,0.92);
  border: 1px solid rgba(255,255,255,0.1);
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; cursor: pointer;
  transition: background 0.15s, transform 0.15s;
  backdrop-filter: blur(8px);
}
.map-centre-btn:hover  { background: rgba(0,212,184,0.2); transform: scale(1.08); }
.map-centre-btn:active { transform: scale(0.95); }

/* Legend — sits above satellite toggle */
.map-legend-overlay {
  position: absolute; bottom: 60px; left: 14px; z-index: 30;
  background: rgba(30,42,50,0.88);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px; padding: 8px 10px;
  display: flex; flex-direction: column; gap: 5px;
  backdrop-filter: blur(8px);
}
.legend-row { display:flex; align-items:center; gap:6px; font-size:11px; color:rgba(255,255,255,0.75); }
.leg-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
.leg-sq  { width:10px; height:8px;  border-radius:2px; flex-shrink:0; }
</style>