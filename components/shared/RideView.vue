<!-- components/shared/MapView.vue
  Used by: driver/map.vue (active ride), driver/dashboard.vue
  Satellite ↔ Street toggle, all vehicle markers.
-->
<template>
  <div class="pr-map-outer" :style="{ height, minHeight: height }">

    <!-- Leaflet container -->
    <div
      ref="mapEl"
      class="pr-map-el"
      :style="{ height, minHeight: height }"
    />

    <!-- Satellite / Street toggle — bottom-left -->
    <button
      class="pr-layer-btn"
      :title="isSatellite ? 'Switch to Street view' : 'Switch to Satellite view'"
      @click="toggleLayer"
    >
      <span class="pr-layer-icon">{{ isSatellite ? '🗺️' : '🛰️' }}</span>
      <span class="pr-layer-label">{{ isSatellite ? 'Street' : 'Satellite' }}</span>
    </button>

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
  // 'passenger' (default) → centres on passenger, labels "You" / "Your driver"
  // 'driver'              → centres on driver,    labels "Passenger" / "You"
  role:            { type: String,  default: 'passenger' },
})

const mapEl = ref(null)

let map         = null
let myMarker    = null
let otherMarker = null
let nearbyLayer = null
let leafletRef  = null

// Layer toggle
const isSatellite  = ref(false)
let streetLayer    = null
let satelliteLayer = null

// ── Toggle ────────────────────────────────────────────────────────
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

// ── Icon factories ────────────────────────────────────────────────
const makePersonIcon = (L) => L.divIcon({
  className: '',
  html: `
    <div style="position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;inset:0;border-radius:50%;border:2px solid rgba(0,212,184,0.6);animation:prPulse 2s ease-out infinite;"></div>
      <div style="width:32px;height:32px;border-radius:50%;background:#00D4B8;border:2px solid #1E2A32;display:flex;align-items:center;justify-content:center;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="7" r="4" fill="#1E2A32"/>
          <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" fill="#1E2A32"/>
        </svg>
      </div>
    </div>
    <style>@keyframes prPulse{0%{transform:scale(0.8);opacity:1}100%{transform:scale(2.2);opacity:0}}</style>
  `,
  iconSize: [44, 44], iconAnchor: [22, 22], popupAnchor: [0, -22],
})

const makeTaxiIcon = (L, small = false) => {
  const s = small ? 30 : 38
  return L.divIcon({
    className: '',
    html: `
      <div style="width:${s}px;height:${s}px;border-radius:7px;background:#F0C040;border:2.5px solid #1E2A32;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,0.35);">
        <svg width="${s-10}" height="${s-10}" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="9" width="20" height="9" rx="2" fill="#1E2A32"/>
          <rect x="5" y="5" width="14" height="6" rx="2" fill="#1E2A32"/>
          <rect x="6" y="6" width="5" height="4" rx="1" fill="#F0C040" opacity="0.75"/>
          <rect x="13" y="6" width="5" height="4" rx="1" fill="#F0C040" opacity="0.75"/>
          <circle cx="6.5" cy="18" r="2.2" fill="#333"/>
          <circle cx="17.5" cy="18" r="2.2" fill="#333"/>
        </svg>
      </div>`,
    iconSize: [s, s], iconAnchor: [s/2, s/2], popupAnchor: [0, -(s/2)],
  })
}

const makeBikeIcon = (L, small = false) => {
  const s = small ? 30 : 38
  return L.divIcon({
    className: '',
    html: `
      <div style="width:${s}px;height:${s}px;border-radius:50%;background:#FF6B35;border:2.5px solid #1E2A32;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,0.35);">
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

const makeDriverIcon = (L, vehicleType, small = false) =>
  vehicleType === 'taxi' ? makeTaxiIcon(L, small) : makeBikeIcon(L, small)

// ── Mount ─────────────────────────────────────────────────────────
onMounted(async () => {
  await nextTick()

  const L = await import('leaflet')
  leafletRef = L

  const isDriver = props.role === 'driver'

  // Driver sees themselves centred; passenger sees themselves centred
  const center = isDriver
    ? (props.driverCoords
        ? [props.driverCoords.lat, props.driverCoords.lng]
        : props.passengerCoords
          ? [props.passengerCoords.lat, props.passengerCoords.lng]
          : [5.9631, 10.1591])
    : (props.passengerCoords
        ? [props.passengerCoords.lat, props.passengerCoords.lng]
        : props.driverCoords
          ? [props.driverCoords.lat, props.driverCoords.lng]
          : [5.9631, 10.1591])

  map = L.map(mapEl.value, {
    center,
    zoom:               props.zoom,
    zoomControl:        true,
    attributionControl: false,
  })

  // Both layers created upfront — swap is instant
  streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, subdomains: 'abc',
  })

  satelliteLayer = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, attribution: 'Tiles © Esri' }
  )

  streetLayer.addTo(map)  // default: street

  setTimeout(() => { map?.invalidateSize() }, 150)

  // Passenger marker (teal person) — label differs by who is viewing
  if (props.passengerCoords) {
    myMarker = L.marker(
      [props.passengerCoords.lat, props.passengerCoords.lng],
      { icon: makePersonIcon(L) }
    ).addTo(map).bindPopup(isDriver ? '<b>📍 Passenger</b>' : '<b>📍 You</b>')
  }

  // Driver marker (vehicle icon) — label differs by who is viewing
  if (props.driverCoords) {
    otherMarker = L.marker(
      [props.driverCoords.lat, props.driverCoords.lng],
      { icon: makeDriverIcon(L, props.driverType) }
    ).addTo(map).bindPopup(isDriver ? '<b>🚗 You</b>' : '<b>🚗 Your driver</b>')
  }

  if (props.showNearby) {
    nearbyLayer = L.layerGroup().addTo(map)
    renderNearbyDrivers()
  }
})

// ── Nearby ────────────────────────────────────────────────────────
const renderNearbyDrivers = () => {
  if (!nearbyLayer || !leafletRef) return
  nearbyLayer.clearLayers()
  props.nearbyDrivers.forEach(driver => {
    if (!driver.currentLocation?.lat || !driver.currentLocation?.lng) return
    leafletRef.marker(
      [driver.currentLocation.lat, driver.currentLocation.lng],
      { icon: makeDriverIcon(leafletRef, driver.vehicleType, true) }
    ).addTo(nearbyLayer).bindPopup(`
      <div style="font-family:sans-serif;padding:4px 0;min-width:130px">
        <strong>${driver.name || 'Driver'}</strong><br>
        <span style="color:#666;font-size:12px">${driver.vehicleType === 'taxi' ? '🚕 Taxi' : '🏍️ Moto'}</span>
      </div>`)
  })
}

// ── Watchers ──────────────────────────────────────────────────────
watch(() => props.passengerCoords, (coords) => {
  if (!coords || !map || !leafletRef) return
  const isDriver = props.role === 'driver'
  if (myMarker) {
    myMarker.setLatLng([coords.lat, coords.lng])
  } else {
    myMarker = leafletRef.marker([coords.lat, coords.lng], { icon: makePersonIcon(leafletRef) })
      .addTo(map).bindPopup(isDriver ? '<b>📍 Passenger</b>' : '<b>📍 You</b>')
  }
  // Only auto-pan to passenger if the passenger is the one viewing
  if (!isDriver) {
    map.setView([coords.lat, coords.lng], map.getZoom(), { animate: true })
  }
}, { deep: true })

watch(() => props.driverCoords, (coords) => {
  if (!coords || !map || !leafletRef) return
  const isDriver = props.role === 'driver'
  if (otherMarker) {
    otherMarker.setLatLng([coords.lat, coords.lng])
  } else {
    otherMarker = leafletRef.marker([coords.lat, coords.lng], { icon: makeDriverIcon(leafletRef, props.driverType) })
      .addTo(map).bindPopup(isDriver ? '<b>🚗 You</b>' : '<b>🚗 Your driver</b>')
  }
  // Pan to keep driver visible — for driver's own view, follow themselves
  if (isDriver) {
    map.setView([coords.lat, coords.lng], map.getZoom(), { animate: true })
  } else {
    map.panTo([coords.lat, coords.lng], { animate: true, duration: 0.5 })
  }
}, { deep: true })

watch(() => props.nearbyDrivers, renderNearbyDrivers, { deep: true })

// ── Cleanup ───────────────────────────────────────────────────────
onBeforeUnmount(() => {
  map?.remove()
  map = null; leafletRef = null
  myMarker = null; otherMarker = null; nearbyLayer = null
  streetLayer = null; satelliteLayer = null
})
</script>

<style scoped>
/* Outer wrapper — provides height context and clips map corners */
.pr-map-outer {
  position:      relative;
  width:         100%;
  border-radius: var(--pr-radius, 12px);
  overflow:      hidden;
  background:    var(--pr-surface2);
}

/* Leaflet target div */
.pr-map-el {
  width:   100%;
  display: block;
}

/* Satellite / Street toggle — bottom-left */
.pr-layer-btn {
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
.pr-layer-btn:hover  { background: rgba(0,212,184,0.2); border-color: rgba(0,212,184,0.4); }
.pr-layer-btn:active { transform: scale(0.95); }
.pr-layer-icon  { font-size: 15px; line-height: 1; }
.pr-layer-label { font-family: var(--font-body); }
</style>