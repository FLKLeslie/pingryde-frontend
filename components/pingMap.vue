<!-- components/pingMap.vue (auto-imported as <PingMap>)
════════════════════════════════════════════════════════════════════
THE ONE MAP COMPONENT FOR THE ENTIRE APP

NEW IN THIS VERSION:
  • passengerLabel / driverLabel props — shown in tooltip on hover
  • Tooltips replace popups: hover over a pin to see location name
  • destinationMode prop — when true, clicking the map fires
    @destination-picked with { lat, lng } so the request page can
    set the destination pin without typing
  • destinationCoords prop — renders a flag pin for the destination

PROPS:
  height            String   CSS height e.g. "300px"     default "300px"
  zoom              Number   Initial zoom level           default 15
  role              String   "passenger" | "driver"      default "passenger"
  passengerCoords   Object   { lat, lng }
  passengerLabel    String   Shown in pin tooltip         default "You" / "Passenger"
  driverCoords      Object   { lat, lng }
  driverLabel       String   Shown in pin tooltip         default "Your driver" / "You"
  driverType        String   "bike" | "taxi"             default "bike"
  nearbyDrivers     Array    For the nearby layer
  showNearby        Boolean  Render nearby drivers layer
  destinationMode   Boolean  Map click picks destination default false
  destinationCoords Object   { lat, lng } — destination pin

EVENTS:
  driver-click(driver)             — nearby driver pin tapped
  destination-picked({ lat, lng }) — map clicked in destinationMode
════════════════════════════════════════════════════════════════════ -->
<template>
  <div class="ping-map-outer" :style="{ height, minHeight: height }">

    <!-- Leaflet container -->
    <div ref="mapEl" class="ping-map-inner" :style="{ height, minHeight: height }" />

    <!-- GPS location pill — centre-top of map (not left) -->
    <div v-if="locationLabel" class="ping-location-pill">
      <span class="ping-location-dot"></span>
      {{ locationLabel }}
    </div>

    <!-- ETA + distance banner — shown during active ride when both coords exist -->
    <div v-if="showEta && etaText" class="ping-eta-banner">
      🕐 {{ etaText }}
    </div>

    <!-- Destination-picking hint — shown when destinationMode is active -->
    <div v-if="destinationMode" class="ping-dest-hint">
      🏁 Tap anywhere on the map to set your destination
    </div>

    <!-- Street / Satellite toggle, bottom-left -->
    <button class="ping-layer-btn" @click="toggleLayer"
            :title="isSatellite ? 'Switch to Street' : 'Switch to Satellite'">
      <span>{{ isSatellite ? '🗺️' : '🛰️' }}</span>
      <span class="ping-layer-label">{{ isSatellite ? 'Street' : 'Satellite' }}</span>
    </button>

    <!-- Centre-on-me, bottom-right -->
    <button v-if="canCentre" class="ping-centre-btn"
            title="Centre map on your location" @click="centreOnSelf">📍</button>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'

const props = defineProps({
  height:           { type: String,  default: '350px'    },
  zoom:             { type: Number,  default: 15          },
  role:             { type: String,  default: 'passenger' },
  passengerCoords:  { type: Object,  default: null        },
  passengerLabel:   { type: String,  default: ''          }, // e.g. "Molyko, Buea"
  driverCoords:     { type: Object,  default: null        },
  driverLabel:      { type: String,  default: ''          }, // e.g. "Yaoundé Centre"
  driverType:       { type: String,  default: 'bike'      },
  nearbyDrivers:    { type: Array,   default: () => []    },
  showNearby:       { type: Boolean, default: false       },
  destinationMode:  { type: Boolean, default: false       },
  destinationCoords:{ type: Object,  default: null        },
  // locationLabel: text shown in the centre-top GPS pill on the map.
  // Pass the reverse-geocoded town name here so the user can see
  // exactly where they are without leaving the map view.
  locationLabel:    { type: String,  default: ''          },
  // showEta: when true and both passengerCoords + driverCoords exist,
  // draws a straight line between them and shows ETA in a banner.
  showEta:          { type: Boolean, default: false       },
})

const emit = defineEmits(['driver-click', 'destination-picked'])

const mapEl = ref(null)

let L               = null
let map             = null
let passengerMarker = null
let driverMarker    = null
let destinationMarker = null
let nearbyLayer     = null
let streetLayer     = null
let satelliteLayer  = null
let routePolyline   = null  // Leaflet polyline drawn between driver and passenger

const isSatellite = ref(false)

// ── ETA calculation ────────────────────────────────────────────
// Uses haversine formula to get straight-line distance in km,
// then divides by average motorbike city speed (25 km/h) to get
// estimated minutes. Shown as "~3 min · 1.2 km" in the banner.
const etaText = computed(() => {
  if (!props.showEta) return ''
  const p = props.passengerCoords
  const d = props.driverCoords
  if (!p?.lat || !d?.lat) return ''

  // Haversine distance in km
  const R    = 6371
  const dLat = (d.lat - p.lat) * Math.PI / 180
  const dLng = (d.lng - p.lng) * Math.PI / 180
  const a    = Math.sin(dLat/2)**2 +
               Math.cos(p.lat * Math.PI/180) * Math.cos(d.lat * Math.PI/180) *
               Math.sin(dLng/2)**2
  const km   = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

  if (km < 0.01) return '📍 Driver is here!'   // within ~10m

  // Average motorbike city speed in Cameroon: ~25 km/h
  const minutes = Math.ceil((km / 25) * 60)
  const dist    = km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`
  return `~${minutes} min · ${dist} away`
})

// Centre button: show when "self" pin exists
const canCentre = computed(() =>
  props.role === 'driver'
    ? !!props.driverCoords?.lat
    : !!props.passengerCoords?.lat
)

const centreOnSelf = () => {
  if (!map) return
  const c = props.role === 'driver' ? props.driverCoords : props.passengerCoords
  if (c?.lat) map.setView([c.lat, c.lng], map.getZoom(), { animate: true })
}

const toggleLayer = () => {
  if (!map || !streetLayer || !satelliteLayer) return
  if (isSatellite.value) {
    map.removeLayer(satelliteLayer); streetLayer.addTo(map)
  } else {
    map.removeLayer(streetLayer); satelliteLayer.addTo(map)
  }
  isSatellite.value = !isSatellite.value
}

// ── Tooltip content ──────────────────────────────────────────────
// Shows on hover (permanent=false, sticky=false).
// Includes the location name if provided, plus lat/lng.
const passengerTooltip = (label) => {
  const isDriver = props.role === 'driver'
  const role     = isDriver ? '📍 Passenger' : '📍 You'
  const name     = label || props.passengerLabel
  return name
    ? `<div style="font-family:sans-serif;font-size:13px;font-weight:600;min-width:120px">${role}<br><span style="font-weight:400;font-size:12px;color:#666">${name}</span></div>`
    : `<div style="font-family:sans-serif;font-size:13px;font-weight:600">${role}</div>`
}

const driverTooltip = (label) => {
  const isDriver = props.role === 'driver'
  const role     = isDriver ? '🚗 You' : '🚗 Your driver'
  const name     = label || props.driverLabel
  return name
    ? `<div style="font-family:sans-serif;font-size:13px;font-weight:600;min-width:120px">${role}<br><span style="font-weight:400;font-size:12px;color:#666">${name}</span></div>`
    : `<div style="font-family:sans-serif;font-size:13px;font-weight:600">${role}</div>`
}

const nearbyTooltip = (driver) =>
  `<div style="font-family:sans-serif;font-size:13px;font-weight:600;min-width:120px">
    ${driver.name || 'Driver'}<br>
    <span style="font-weight:400;font-size:12px;color:#666">
      ${driver.vehicleType === 'taxi' ? '🚕 Taxi' : '🏍️ Motorbike'}
      ${driver.currentLocation?.lat ? ` · ${Number(driver.currentLocation.lat).toFixed(4)}, ${Number(driver.currentLocation.lng).toFixed(4)}` : ''}
    </span>
  </div>`

// ── Icon factories ───────────────────────────────────────────────
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

// Destination flag icon — orange flag with white 🏁
const makeDestIcon = () => L.divIcon({
  className: '',
  html: `<div style="display:flex;flex-direction:column;align-items:center;">
    <div style="width:34px;height:34px;border-radius:50%;background:#FF6B35;border:2.5px solid #1E2A32;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(255,107,53,0.5);font-size:16px;">🏁</div>
    <div style="width:2px;height:12px;background:#FF6B35;margin-top:0;"></div>
  </div>`,
  iconSize:[34,46], iconAnchor:[17,46], popupAnchor:[0,-46],
})

const makeVehicleIcon = (type, small = false) =>
  type === 'taxi' ? makeTaxiIcon(small) : makeBikeIcon(small)

// ── Nearby drivers layer ─────────────────────────────────────────
const drawNearby = () => {
  if (!nearbyLayer || !L) return
  nearbyLayer.clearLayers()
  props.nearbyDrivers.forEach(driver => {
    if (!driver.currentLocation?.lat) return
    const m = L.marker(
      [driver.currentLocation.lat, driver.currentLocation.lng],
      { icon: makeVehicleIcon(driver.vehicleType, true) }
    ).addTo(nearbyLayer)
    // Hover tooltip with driver name + vehicle
    m.bindTooltip(nearbyTooltip(driver), { direction: 'top', offset: [0,-20] })
    m.on('click', () => emit('driver-click', driver))
  })
}

// ── Mount ────────────────────────────────────────────────────────
onMounted(async () => {
  await nextTick()
  L = await import('leaflet')

  const isDriver = props.role === 'driver'
  const center =
    isDriver
      ? (props.driverCoords?.lat ? [props.driverCoords.lat, props.driverCoords.lng]
          : props.passengerCoords?.lat ? [props.passengerCoords.lat, props.passengerCoords.lng]
          : [5.9631, 10.1591])
      : (props.passengerCoords?.lat ? [props.passengerCoords.lat, props.passengerCoords.lng]
          : props.driverCoords?.lat ? [props.driverCoords.lat, props.driverCoords.lng]
          : [5.9631, 10.1591])

  map = L.map(mapEl.value, { center, zoom: props.zoom, zoomControl: true, attributionControl: false })

  streetLayer = L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { maxZoom: 19, subdomains: 'abc' }
  )
  satelliteLayer = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19 }
  )
  streetLayer.addTo(map)
  setTimeout(() => map?.invalidateSize(), 150)

  // Passenger pin with hover tooltip
  if (props.passengerCoords?.lat) {
    passengerMarker = L.marker(
      [props.passengerCoords.lat, props.passengerCoords.lng],
      { icon: makePersonIcon() }
    ).addTo(map)
    passengerMarker.bindTooltip(passengerTooltip(), { direction: 'top', offset: [0,-24] })
  }

  // Driver pin with hover tooltip
  if (props.driverCoords?.lat) {
    driverMarker = L.marker(
      [props.driverCoords.lat, props.driverCoords.lng],
      { icon: makeVehicleIcon(props.driverType) }
    ).addTo(map)
    driverMarker.bindTooltip(driverTooltip(), { direction: 'top', offset: [0,-20] })
  }

  // Destination pin
  if (props.destinationCoords?.lat) {
    destinationMarker = L.marker(
      [props.destinationCoords.lat, props.destinationCoords.lng],
      { icon: makeDestIcon() }
    ).addTo(map)
    destinationMarker.bindTooltip('<b>🏁 Destination</b>', { direction: 'top', offset: [0,-48] })
  }

  // Nearby layer
  if (props.showNearby) {
    nearbyLayer = L.layerGroup().addTo(map)
    drawNearby()
  }

  // Destination-picking: click on map → emit coords
  map.on('click', (e) => {
    if (!props.destinationMode) return
    emit('destination-picked', { lat: e.latlng.lat, lng: e.latlng.lng })
  })

  // Change cursor when in destination-picking mode
  watch(() => props.destinationMode, (val) => {
    if (!mapEl.value) return
    mapEl.value.style.cursor = val ? 'crosshair' : ''
  }, { immediate: true })
})

// ── Watchers ─────────────────────────────────────────────────────

// Update tooltip when passengerLabel changes (after reverse geocode resolves)
watch(() => props.passengerLabel, () => {
  if (passengerMarker) passengerMarker.setTooltipContent(passengerTooltip())
})
watch(() => props.driverCoords, (c) => {
  if (!c?.lat || !map || !L) return
  const isDriver = props.role === 'driver'
  if (driverMarker) {
    driverMarker.setLatLng([c.lat, c.lng])
    driverMarker.setTooltipContent(driverTooltip())
  } else {
    driverMarker = L.marker([c.lat, c.lng], { icon: makeVehicleIcon(props.driverType) }).addTo(map)
    driverMarker.bindTooltip(driverTooltip(), { direction: 'top', offset: [0,-20] })
  }
  if (isDriver) map.setView([c.lat, c.lng], map.getZoom(), { animate: true })
  else          map.panTo([c.lat, c.lng], { animate: true, duration: 0.5 })

  // Update route line if showEta is on and passenger coords are also available
  if (props.showEta) updateRouteLine()
}, { deep: true })

// Also redraw route when passenger coords update (in case driver coords arrived first)
watch(() => props.passengerCoords, (c) => {
  if (!c?.lat || !map || !L) return
  const isDriver = props.role === 'driver'
  if (passengerMarker) {
    passengerMarker.setLatLng([c.lat, c.lng])
    passengerMarker.setTooltipContent(passengerTooltip())
  } else {
    passengerMarker = L.marker([c.lat, c.lng], { icon: makePersonIcon() }).addTo(map)
    passengerMarker.bindTooltip(passengerTooltip(), { direction: 'top', offset: [0,-24] })
  }
  if (!isDriver) map.setView([c.lat, c.lng], map.getZoom(), { animate: true })
  if (props.showEta) updateRouteLine()
}, { deep: true })

watch(() => props.driverLabel, () => {
  if (driverMarker) driverMarker.setTooltipContent(driverTooltip())
})

// Destination pin watcher
watch(() => props.destinationCoords, (c) => {
  if (!map || !L) return
  if (!c?.lat) {
    if (destinationMarker) { destinationMarker.remove(); destinationMarker = null }
    return
  }
  if (destinationMarker) {
    destinationMarker.setLatLng([c.lat, c.lng])
  } else {
    destinationMarker = L.marker([c.lat, c.lng], { icon: makeDestIcon() }).addTo(map)
    destinationMarker.bindTooltip('<b>🏁 Destination</b>', { direction: 'top', offset: [0,-48] })
  }
}, { deep: true })

watch(() => props.nearbyDrivers, drawNearby, { deep: true })

// ── Route line between driver and passenger ───────────────────────
// Draws a dashed orange polyline showing the straight-line path
// between the driver's position and the passenger's position.
// This is a straight line (not a road-following route) because
// getting a real road route requires a routing API.
// The line updates every time either party's GPS updates.
const updateRouteLine = () => {
  if (!map || !L) return
  const p = props.passengerCoords
  const d = props.driverCoords
  if (!p?.lat || !d?.lat) {
    // Remove the line if either position is missing
    if (routePolyline) { routePolyline.remove(); routePolyline = null }
    return
  }

  const latlngs = [[p.lat, p.lng], [d.lat, d.lng]]

  if (routePolyline) {
    // Just update the existing line — cheaper than remove + recreate
    routePolyline.setLatLngs(latlngs)
  } else {
    // Create the dashed polyline with PingRyde orange colour
    routePolyline = L.polyline(latlngs, {
      color:     '#FF6B35',   // PingRyde orange
      weight:    3,
      opacity:   0.7,
      dashArray: '8, 8',      // dashed so it looks like a path, not a solid road
    }).addTo(map)
  }
}

// ── Cleanup ──────────────────────────────────────────────────────
onBeforeUnmount(() => {
  map?.remove()
  map = null; L = null
  passengerMarker = null; driverMarker = null
  destinationMarker = null; nearbyLayer = null
  streetLayer = null; satelliteLayer = null
  routePolyline = null
})
</script>

<style scoped>
.ping-map-outer {
  position: relative; width: 100%;
  border-radius: var(--pr-radius, 12px);
  overflow: hidden; background: var(--pr-surface2);
}
.ping-map-inner { width: 100%; display: block; }

/* Destination-picking hint */
.ping-dest-hint {
  position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
  z-index: 30; white-space: nowrap;
  padding: 7px 14px; border-radius: 20px;
  background: rgba(255,107,53,0.92); color: #fff;
  font-size: 13px; font-weight: 600;
  box-shadow: 0 2px 10px rgba(0,0,0,0.3);
  pointer-events: none;
}

/* GPS location pill — centre-top of map.
   Shows the reverse-geocoded place name so the user knows
   exactly where they are without leaving the map. */
.ping-location-pill {
  position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
  z-index: 30; white-space: nowrap; max-width: 75%;
  overflow: hidden; text-overflow: ellipsis;
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 14px; border-radius: 20px;
  background: rgba(30,42,50,0.88); backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: #fff; font-size: 12px; font-weight: 600;
  border: 1px solid rgba(0,212,184,0.3);
  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  pointer-events: none; /* doesn't block map interaction */
}
.ping-location-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--pr-teal, #00D4B8); flex-shrink: 0;
  animation: pingLocPulse 2s ease-in-out infinite;
}
@keyframes pingLocPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

/* ETA banner — shown during active ride.
   Appears below the location pill. */
.ping-eta-banner {
  position: absolute; top: 46px; left: 50%; transform: translateX(-50%);
  z-index: 30; white-space: nowrap;
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 12px; border-radius: 16px;
  background: rgba(255,107,53,0.88); backdrop-filter: blur(8px);
  color: #fff; font-size: 12px; font-weight: 600;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  pointer-events: none;
}

/* Satellite / Street toggle */
.ping-layer-btn {
  position: absolute; bottom: 14px; left: 14px; z-index: 30;
  display: flex; align-items: center; gap: 5px;
  padding: 7px 12px 7px 9px; border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.15);
  background: rgba(30,42,50,0.88); backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: #fff; font-size: 13px; font-weight: 600; cursor: pointer;
  box-shadow: 0 2px 10px rgba(0,0,0,0.5);
  transition: background 0.18s, border-color 0.18s, transform 0.1s;
  white-space: nowrap; -webkit-tap-highlight-color: transparent;
}
.ping-layer-btn:hover  { background: rgba(0,212,184,0.2); border-color: rgba(0,212,184,0.4); }
.ping-layer-btn:active { transform: scale(0.95); }
.ping-layer-label      { font-family: var(--font-body); font-size: 12px; }

/* Centre-on-me button */
.ping-centre-btn {
  position: absolute; bottom: 14px; right: 14px; z-index: 30;
  width: 40px; height: 40px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.15);
  background: rgba(30,42,50,0.88); backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  font-size: 18px; display: flex; align-items: center; justify-content: center;
  cursor: pointer; box-shadow: 0 2px 10px rgba(0,0,0,0.5);
  transition: background 0.18s, border-color 0.18s, transform 0.1s;
  -webkit-tap-highlight-color: transparent;
}
.ping-centre-btn:hover  { background: rgba(0,212,184,0.2); border-color: rgba(0,212,184,0.4); }
.ping-centre-btn:active { transform: scale(0.95); }
</style>