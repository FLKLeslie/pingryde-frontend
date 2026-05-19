<!-- components/PingMap.vue
════════════════════════════════════════════════════════════════════
THE ONE MAP COMPONENT FOR THE ENTIRE APP — replaces MapView.vue
and shared/RideMap.vue. No naming conflicts possible.

Used as <PingMap> everywhere:
  • pages/passenger/request.vue   — nearby drivers before booking
  • pages/passenger/tracking.vue  — passenger + driver live tracking
  • components/RideRequestCard.vue — passenger pin on driver request card
  • pages/driver/map.vue           — active ride map

PROPS:
  height          String   CSS height e.g. "300px"      default "300px"
  zoom            Number   Initial zoom level            default 15
  role            String   "passenger" | "driver"       default "passenger"
  passengerCoords Object   { lat, lng }  teal person pin
  driverCoords    Object   { lat, lng }  vehicle pin
  driverType      String   "bike" | "taxi"              default "bike"
  nearbyDrivers   Array    Driver docs for nearby layer
  showNearby      Boolean  Render nearby drivers layer

EVENTS:
  driver-click(driver) — fired when nearby driver pin is tapped

ROLE:
  "passenger" → centres on passenger, auto-pans to driver updates
  "driver"    → centres on driver, auto-pans to driver's own GPS
════════════════════════════════════════════════════════════════════ -->
<template>
  <div class="ping-map-outer" :style="{ height, minHeight: height }">

    <!-- Leaflet mounts here — must have explicit CSS height -->
    <div ref="mapEl" class="ping-map-inner" :style="{ height, minHeight: height }" />

    <!-- Street / Satellite toggle, bottom-left corner -->
    <button class="ping-layer-btn" @click="toggleLayer"
            :title="isSatellite ? 'Switch to Street' : 'Switch to Satellite'">
      <span>{{ isSatellite ? '🗺️' : '🛰️' }}</span>
      <span class="ping-layer-label">{{ isSatellite ? 'Street' : 'Satellite' }}</span>
    </button>

    <!-- Centre-on-me button, bottom-right corner.
         Snaps the map back to the relevant pin:
           role="passenger" → centres on passenger pin
           role="driver"    → centres on driver's own pin
         Only shown when the relevant coords are available. -->
    <button
      v-if="canCentre"
      class="ping-centre-btn"
      title="Centre map on your location"
      @click="centreOnSelf"
    >📍</button>

  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'

const props = defineProps({
  height:          { type: String,  default: '300px'    },
  zoom:            { type: Number,  default: 15          },
  role:            { type: String,  default: 'passenger' }, // 'passenger' | 'driver'
  passengerCoords: { type: Object,  default: null        }, // { lat, lng }
  driverCoords:    { type: Object,  default: null        }, // { lat, lng }
  driverType:      { type: String,  default: 'bike'      }, // 'bike' | 'taxi'
  nearbyDrivers:   { type: Array,   default: () => []    },
  showNearby:      { type: Boolean, default: false       },
})

// Fires when passenger taps a nearby driver pin → parent shows detail sheet
const emit = defineEmits(['driver-click'])

// ── Internal refs ──────────────────────────────────────────────────
const mapEl = ref(null)   // DOM div Leaflet mounts into

let L               = null  // Leaflet module (dynamic import — avoids SSR errors)
let map             = null  // L.map instance
let passengerMarker = null  // teal person pin
let driverMarker    = null  // vehicle pin
let nearbyLayer     = null  // LayerGroup holding nearby driver pins
let streetLayer     = null  // OpenStreetMap tile layer
let satelliteLayer  = null  // ESRI satellite tile layer

const isSatellite = ref(false)

// canCentre — true when there is a "self" pin to snap to.
//   passenger role → needs passengerCoords
//   driver role    → needs driverCoords
const canCentre = computed(() =>
  props.role === 'driver'
    ? !!props.driverCoords?.lat
    : !!props.passengerCoords?.lat
)

// centreOnSelf — snaps the map back to the user's own pin.
// Called by the 📍 button in the template.
const centreOnSelf = () => {
  if (!map) return
  const isDriver = props.role === 'driver'
  const coords   = isDriver ? props.driverCoords : props.passengerCoords
  if (coords?.lat) {
    map.setView([coords.lat, coords.lng], map.getZoom(), { animate: true })
  }
}

// ── Toggle street / satellite ──────────────────────────────────────
const toggleLayer = () => {
  if (!map || !streetLayer || !satelliteLayer) return
  if (isSatellite.value) {
    map.removeLayer(satelliteLayer)
    streetLayer.addTo(map)
  } else {
    map.removeLayer(streetLayer)
    satelliteLayer.addTo(map)
  }
  isSatellite.value = !isSatellite.value
}

// ── Icon factories ─────────────────────────────────────────────────

// Teal person with pulsing ring — passenger pin
const makePersonIcon = () => L.divIcon({
  className: '',
  html: `
    <div style="position:relative;width:46px;height:46px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;inset:0;border-radius:50%;border:2px solid rgba(0,212,184,0.5);animation:pingPulse 2s ease-out infinite;"></div>
      <div style="width:32px;height:32px;border-radius:50%;background:#00D4B8;border:2.5px solid #1E2A32;display:flex;align-items:center;justify-content:center;position:relative;z-index:1;box-shadow:0 2px 8px rgba(0,212,184,0.4);">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="7" r="4" fill="#1E2A32"/>
          <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" fill="#1E2A32"/>
        </svg>
      </div>
    </div>
    <style>@keyframes pingPulse{0%{transform:scale(0.8);opacity:1}100%{transform:scale(2.2);opacity:0}}</style>`,
  iconSize:[46,46], iconAnchor:[23,23], popupAnchor:[0,-24],
})

// Yellow taxi icon
const makeTaxiIcon = (small = false) => {
  const s = small ? 30 : 38
  return L.divIcon({
    className: '',
    html: `<div style="width:${s}px;height:${s}px;border-radius:7px;background:#F0C040;border:2.5px solid #1E2A32;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,0.35);">
      <svg width="${s-10}" height="${s-10}" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="9" width="20" height="9" rx="2" fill="#1E2A32"/>
        <rect x="5" y="5" width="14" height="6" rx="2" fill="#1E2A32"/>
        <rect x="6" y="6" width="5" height="4" rx="1" fill="#F0C040" opacity=".7"/>
        <rect x="13" y="6" width="5" height="4" rx="1" fill="#F0C040" opacity=".7"/>
        <circle cx="6.5" cy="18" r="2.2" fill="#333"/>
        <circle cx="17.5" cy="18" r="2.2" fill="#333"/>
      </svg></div>`,
    iconSize:[s,s], iconAnchor:[s/2,s/2], popupAnchor:[0,-(s/2)],
  })
}

// Orange bike icon
const makeBikeIcon = (small = false) => {
  const s = small ? 30 : 38
  return L.divIcon({
    className: '',
    html: `<div style="width:${s}px;height:${s}px;border-radius:50%;background:#FF6B35;border:2.5px solid #1E2A32;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(255,107,53,0.4);">
      <svg width="${s-10}" height="${s-10}" viewBox="0 0 24 24" fill="none">
        <circle cx="5" cy="16" r="3.5" fill="none" stroke="#1E2A32" stroke-width="2"/>
        <circle cx="19" cy="16" r="3.5" fill="none" stroke="#1E2A32" stroke-width="2"/>
        <path d="M5 16L9.5 8H14L19 16" fill="none" stroke="#1E2A32" stroke-width="2" stroke-linejoin="round"/>
        <rect x="8.5" y="5.5" width="7" height="3" rx="1.5" fill="#1E2A32"/>
        <path d="M18 10.5L20.5 8" stroke="#1E2A32" stroke-width="2" stroke-linecap="round"/>
      </svg></div>`,
    iconSize:[s,s], iconAnchor:[s/2,s/2], popupAnchor:[0,-(s/2)],
  })
}

const makeVehicleIcon = (type, small = false) =>
  type === 'taxi' ? makeTaxiIcon(small) : makeBikeIcon(small)

// ── Draw nearby drivers ────────────────────────────────────────────
// Called on mount and when nearbyDrivers prop changes.
// Tapping a pin fires 'driver-click' so the parent shows a detail sheet.
const drawNearby = () => {
  if (!nearbyLayer || !L) return
  nearbyLayer.clearLayers()
  props.nearbyDrivers.forEach(driver => {
    if (!driver.currentLocation?.lat) return
    const m = L.marker(
      [driver.currentLocation.lat, driver.currentLocation.lng],
      { icon: makeVehicleIcon(driver.vehicleType, true) }
    ).addTo(nearbyLayer)
    m.on('click', () => emit('driver-click', driver))
  })
}

// ── Mount ──────────────────────────────────────────────────────────
onMounted(async () => {
  await nextTick()

  // Dynamic import — Leaflet requires window/document, so it must be
  // imported client-side only. This also avoids SSR crashes.
  L = await import('leaflet')

  const isDriver = props.role === 'driver'

  // Choose the best initial centre point
  const center =
    isDriver
      ? (props.driverCoords?.lat
          ? [props.driverCoords.lat, props.driverCoords.lng]
          : props.passengerCoords?.lat
            ? [props.passengerCoords.lat, props.passengerCoords.lng]
            : [5.9631, 10.1591])
      : (props.passengerCoords?.lat
          ? [props.passengerCoords.lat, props.passengerCoords.lng]
          : props.driverCoords?.lat
            ? [props.driverCoords.lat, props.driverCoords.lng]
            : [5.9631, 10.1591])

  map = L.map(mapEl.value, {
    center,
    zoom:               props.zoom,
    zoomControl:        true,
    attributionControl: false,
  })

  // OpenStreetMap (free, no API key)
  streetLayer = L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { maxZoom: 19, subdomains: 'abc' }
  )

  // ESRI satellite (free, no API key)
  satelliteLayer = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19 }
  )

  streetLayer.addTo(map)

  // Leaflet needs a moment after Vue renders to measure the container
  setTimeout(() => map?.invalidateSize(), 150)

  // Passenger pin
  if (props.passengerCoords?.lat) {
    passengerMarker = L.marker(
      [props.passengerCoords.lat, props.passengerCoords.lng],
      { icon: makePersonIcon() }
    ).addTo(map).bindPopup(isDriver ? '<b>📍 Passenger</b>' : '<b>📍 You</b>')
  }

  // Driver / vehicle pin
  if (props.driverCoords?.lat) {
    driverMarker = L.marker(
      [props.driverCoords.lat, props.driverCoords.lng],
      { icon: makeVehicleIcon(props.driverType) }
    ).addTo(map).bindPopup(isDriver ? '<b>🚗 You</b>' : '<b>🚗 Your driver</b>')
  }

  // Nearby drivers layer (passenger request page)
  if (props.showNearby) {
    nearbyLayer = L.layerGroup().addTo(map)
    drawNearby()
  }
})

// ── Watchers — update pins in real-time as GPS changes ─────────────

watch(() => props.passengerCoords, (c) => {
  if (!c?.lat || !map || !L) return
  const isDriver = props.role === 'driver'
  if (passengerMarker) {
    passengerMarker.setLatLng([c.lat, c.lng])
  } else {
    passengerMarker = L.marker([c.lat, c.lng], { icon: makePersonIcon() })
      .addTo(map).bindPopup(isDriver ? '<b>📍 Passenger</b>' : '<b>📍 You</b>')
  }
  // Passenger role: keep map centred on the passenger
  if (!isDriver) map.setView([c.lat, c.lng], map.getZoom(), { animate: true })
}, { deep: true })

watch(() => props.driverCoords, (c) => {
  if (!c?.lat || !map || !L) return
  const isDriver = props.role === 'driver'
  if (driverMarker) {
    driverMarker.setLatLng([c.lat, c.lng])
  } else {
    driverMarker = L.marker([c.lat, c.lng], { icon: makeVehicleIcon(props.driverType) })
      .addTo(map).bindPopup(isDriver ? '<b>🚗 You</b>' : '<b>🚗 Your driver</b>')
  }
  // Driver role: follow own GPS; Passenger role: pan gently to driver
  if (isDriver) map.setView([c.lat, c.lng], map.getZoom(), { animate: true })
  else          map.panTo([c.lat, c.lng], { animate: true, duration: 0.5 })
}, { deep: true })

watch(() => props.nearbyDrivers, drawNearby, { deep: true })

// ── Cleanup ────────────────────────────────────────────────────────
onBeforeUnmount(() => {
  map?.remove()
  map = null; L = null
  passengerMarker = null; driverMarker = null; nearbyLayer = null
  streetLayer = null; satelliteLayer = null
})
</script>

<style scoped>
.ping-map-outer {
  position:      relative;
  width:         100%;
  border-radius: var(--pr-radius, 12px);
  overflow:      hidden;
  background:    var(--pr-surface2);
}
/* display:block prevents height collapse in flex/grid parents */
.ping-map-inner {
  width:   100%;
  display: block;
}
/* Toggle button — sits above Leaflet panes (z-index 10-20) */
.ping-layer-btn {
  position:        absolute;
  bottom:          14px; left: 14px;
  z-index:         30;
  display:         flex; align-items: center; gap: 5px;
  padding:         7px 12px 7px 9px;
  border-radius:   10px;
  border:          1px solid rgba(255,255,255,0.15);
  background:      rgba(30,42,50,0.88);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color:           #fff; font-size: 13px; font-weight: 600;
  cursor:          pointer;
  box-shadow:      0 2px 10px rgba(0,0,0,0.5);
  transition:      background 0.18s, border-color 0.18s, transform 0.1s;
  white-space:     nowrap;
  -webkit-tap-highlight-color: transparent;
}
.ping-layer-btn:hover  { background: rgba(0,212,184,0.2); border-color: rgba(0,212,184,0.4); }
.ping-layer-btn:active { transform: scale(0.95); }
.ping-layer-label      { font-family: var(--font-body); font-size: 12px; }

/* Centre-on-me button — bottom-right, mirrors the toggle style */
.ping-centre-btn {
  position:        absolute;
  bottom:          14px;
  right:           14px;
  z-index:         30;
  width:           40px;
  height:          40px;
  border-radius:   50%;
  border:          1px solid rgba(255,255,255,0.15);
  background:      rgba(30,42,50,0.88);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  font-size:       18px;
  display:         flex;
  align-items:     center;
  justify-content: center;
  cursor:          pointer;
  box-shadow:      0 2px 10px rgba(0,0,0,0.5);
  transition:      background 0.18s, border-color 0.18s, transform 0.1s;
  -webkit-tap-highlight-color: transparent;
}
.ping-centre-btn:hover  { background: rgba(0,212,184,0.2); border-color: rgba(0,212,184,0.4); }
.ping-centre-btn:active { transform: scale(0.95); }
</style>