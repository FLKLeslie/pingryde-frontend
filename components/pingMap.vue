<!-- components/pingMap.vue (auto-imported as <PingMap>)
════════════════════════════════════════════════════════════════════
THE ONE MAP COMPONENT FOR THE ENTIRE APP

PROPS:
  height            String   CSS height              default "300px"
  zoom              Number   Initial zoom            default 15
  role              String   "passenger" | "driver"  default "passenger"
  passengerCoords   Object   { lat, lng }
  passengerLabel    String   Tooltip / pill text
  driverCoords      Object   { lat, lng }
  driverLabel       String   Tooltip text
  driverType        String   "bike" | "taxi"         default "bike"
  nearbyDrivers     Array    Online drivers for nearby layer
  showNearby        Boolean  Render nearby drivers
  destinationMode   Boolean  Map click/drag picks destination
  destinationCoords Object   { lat, lng } — flag pin
  locationLabel     String   Text in the top-right GPS pill
  showEta           Boolean  Draw route line + ETA banner

EVENTS:
  driver-click(driver)             → nearby driver pin tapped
  destination-picked({ lat, lng }) → map tapped / marker dragged
════════════════════════════════════════════════════════════════════ -->
<template>
  <div class="ping-map-outer" :style="{ height, minHeight: height }">

    <!-- Leaflet container -->
    <div ref="mapEl" class="ping-map-inner" :style="{ height, minHeight: height }" />

    <!-- Location name pill — TOP RIGHT, high contrast -->
    <div v-if="locationLabel" class="ping-location-pill">
      <span class="ping-location-dot"></span>
      {{ locationLabel }}
    </div>

    <!-- ETA banner — shown during active ride -->
    <div v-if="showEta && etaText" class="ping-eta-banner">
      🕐 {{ etaText }}
    </div>

    <!-- Destination-picking hint + cancel — TOP CENTRE -->
    <div v-if="destinationMode" class="ping-dest-overlay">
      <div class="ping-dest-hint">🏁 Drag the flag or tap to set destination</div>
      <button class="ping-dest-cancel" @click="$emit('cancel-destination')">✕ Cancel</button>
    </div>

    <!-- Street / Satellite toggle — BOTTOM LEFT -->
    <button class="ping-layer-btn" @click="toggleLayer"
            :title="isSatellite ? 'Switch to Street' : 'Switch to Satellite'">
      <span>{{ isSatellite ? '🗺️' : '🛰️' }}</span>
      <span class="ping-layer-label">{{ isSatellite ? 'Street' : 'Satellite' }}</span>
    </button>

    <!-- Centre-on-me — BOTTOM RIGHT -->
    <button v-if="canCentre" class="ping-centre-btn"
            title="Centre map on your location" @click="centreOnSelf">📍</button>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'

const props = defineProps({
  height:           { type: String,  default: '360px'    },
  zoom:             { type: Number,  default: 15          },
  role:             { type: String,  default: 'passenger' },
  passengerCoords:  { type: Object,  default: null        },
  passengerLabel:   { type: String,  default: ''          },
  driverCoords:     { type: Object,  default: null        },
  driverLabel:      { type: String,  default: ''          },
  driverType:       { type: String,  default: 'bike'      },
  nearbyDrivers:    { type: Array,   default: () => []    },
  showNearby:       { type: Boolean, default: false       },
  destinationMode:  { type: Boolean, default: false       },
  destinationCoords:{ type: Object,  default: null        },
  locationLabel:    { type: String,  default: ''          },
  showEta:          { type: Boolean, default: false       },
})

const emit = defineEmits(['driver-click', 'destination-picked', 'cancel-destination'])

const mapEl = ref(null)

let L                = null
let map              = null
let passengerMarker  = null
let driverMarker     = null
let destMarker       = null   // draggable destination marker
let nearbyLayer      = null
let streetLayer      = null
let satelliteLayer   = null
let routePolyline    = null
let markerPollId     = null   // interval that keeps markers current

const isSatellite = ref(false)

// ── ETA: haversine distance + speed estimate ─────────────────────
// Returns a string like "~4 min · 1.7 km away" or "📍 Driver is here!"
const etaText = computed(() => {
  if (!props.showEta) return ''
  const p = props.passengerCoords
  const d = props.driverCoords
  if (!p?.lat || !d?.lat) return ''
  const R    = 6371
  const dLat = (d.lat - p.lat) * Math.PI / 180
  const dLng = (d.lng - p.lng) * Math.PI / 180
  const a    = Math.sin(dLat/2)**2 +
               Math.cos(p.lat*Math.PI/180) * Math.cos(d.lat*Math.PI/180) *
               Math.sin(dLng/2)**2
  const km   = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  if (km < 0.010) return '📍 Driver is here!'
  const mins = Math.ceil((km / 25) * 60)   // 25 km/h avg city speed
  const dist = km < 1 ? `${Math.round(km*1000)}m` : `${km.toFixed(1)}km`
  return `~${mins} min · ${dist} away`
})

// Centre button: "self" pin depends on role
const canCentre = computed(() =>
  props.role === 'driver' ? !!props.driverCoords?.lat : !!props.passengerCoords?.lat
)
const centreOnSelf = () => {
  if (!map) return
  const c = props.role === 'driver' ? props.driverCoords : props.passengerCoords
  if (c?.lat) map.setView([c.lat, c.lng], map.getZoom(), { animate: true })
}

const toggleLayer = () => {
  if (!map || !streetLayer || !satelliteLayer) return
  if (isSatellite.value) { map.removeLayer(satelliteLayer); streetLayer.addTo(map) }
  else                   { map.removeLayer(streetLayer);    satelliteLayer.addTo(map) }
  isSatellite.value = !isSatellite.value
}

// ── Route line ───────────────────────────────────────────────────
// Dashed orange line between passenger and driver.
// Called whenever either coord updates or showEta turns on.
const updateRouteLine = () => {
  if (!map || !L) return
  const p = props.passengerCoords
  const d = props.driverCoords
  if (!p?.lat || !d?.lat || !props.showEta) {
    if (routePolyline) { routePolyline.remove(); routePolyline = null }
    return
  }
  const latlngs = [[p.lat, p.lng], [d.lat, d.lng]]
  if (routePolyline) {
    routePolyline.setLatLngs(latlngs)
  } else {
    routePolyline = L.polyline(latlngs, {
      color: '#FF6B35', weight: 3, opacity: 0.75, dashArray: '8, 8',
    }).addTo(map)
  }
}

// ── Tooltip content helpers ──────────────────────────────────────
const passengerTooltip = () => {
  const role = props.role === 'driver' ? '📍 Passenger' : '📍 You'
  const name = props.passengerLabel
  return name
    ? `<div style="font:600 13px sans-serif;min-width:110px">${role}<br><span style="font-weight:400;font-size:11px;color:#888">${name}</span></div>`
    : `<div style="font:600 13px sans-serif">${role}</div>`
}
const driverTooltip = () => {
  const role = props.role === 'driver' ? '🚗 You' : '🚗 Your driver'
  const name = props.driverLabel
  return name
    ? `<div style="font:600 13px sans-serif;min-width:110px">${role}<br><span style="font-weight:400;font-size:11px;color:#888">${name}</span></div>`
    : `<div style="font:600 13px sans-serif">${role}</div>`
}
const nearbyTooltip = (d) =>
  `<div style="font:600 13px sans-serif;min-width:110px">
     ${d.name || 'Driver'}
     <br><span style="font-weight:400;font-size:11px;color:#888">
       ${d.vehicleType==='taxi'?'🚕 Taxi':'🏍️ Moto'}
     </span>
   </div>`

// ── Icon factories ───────────────────────────────────────────────
const makePersonIcon = () => L.divIcon({
  className: '',
  html: `<div style="position:relative;width:46px;height:46px;display:flex;align-items:center;justify-content:center;">
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

const makeTaxiIcon = (small=false) => {
  const s = small ? 30 : 38
  return L.divIcon({ className:'',
    html:`<div style="width:${s}px;height:${s}px;border-radius:7px;background:#F0C040;border:2.5px solid #1E2A32;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,0.35);">
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
const makeBikeIcon = (small=false) => {
  const s = small ? 30 : 38
  return L.divIcon({ className:'',
    html:`<div style="width:${s}px;height:${s}px;border-radius:50%;background:#FF6B35;border:2.5px solid #1E2A32;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(255,107,53,0.4);">
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

// Draggable destination flag icon
const makeDestIcon = () => L.divIcon({ className:'',
  html:`<div style="display:flex;flex-direction:column;align-items:center;cursor:grab;">
    <div style="width:36px;height:36px;border-radius:50%;background:#FF6B35;border:2.5px solid #1E2A32;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(255,107,53,0.5);font-size:17px;">🏁</div>
    <div style="width:2px;height:14px;background:#FF6B35;"></div>
  </div>`,
  iconSize:[36,50], iconAnchor:[18,50], popupAnchor:[0,-50],
})

const makeVehicleIcon = (type, small=false) =>
  type === 'taxi' ? makeTaxiIcon(small) : makeBikeIcon(small)

// ── Nearby drivers ────────────────────────────────────────────────
const drawNearby = () => {
  if (!nearbyLayer || !L) return
  nearbyLayer.clearLayers()
  props.nearbyDrivers.forEach(d => {
    if (!d.currentLocation?.lat) return
    const m = L.marker(
      [d.currentLocation.lat, d.currentLocation.lng],
      { icon: makeVehicleIcon(d.vehicleType, true) }
    ).addTo(nearbyLayer)
    m.bindTooltip(nearbyTooltip(d), { direction:'top', offset:[0,-20] })
    m.on('click', () => emit('driver-click', d))
  })
}

// ── Mount ─────────────────────────────────────────────────────────
onMounted(async () => {
  await nextTick()
  L = await import('leaflet')

  const isDriver = props.role === 'driver'
  const center =
    isDriver
      ? (props.driverCoords?.lat   ? [props.driverCoords.lat,   props.driverCoords.lng]
          : props.passengerCoords?.lat ? [props.passengerCoords.lat, props.passengerCoords.lng]
          : [5.9631, 10.1591])
      : (props.passengerCoords?.lat ? [props.passengerCoords.lat, props.passengerCoords.lng]
          : props.driverCoords?.lat   ? [props.driverCoords.lat,   props.driverCoords.lng]
          : [5.9631, 10.1591])

  map = L.map(mapEl.value, { center, zoom: props.zoom, zoomControl: true, attributionControl: false })

  streetLayer    = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, subdomains:'abc' })
  satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom:19 })
  streetLayer.addTo(map)
  setTimeout(() => map?.invalidateSize(), 150)

  // Passenger pin
  if (props.passengerCoords?.lat) {
    passengerMarker = L.marker([props.passengerCoords.lat, props.passengerCoords.lng], { icon: makePersonIcon() }).addTo(map)
    passengerMarker.bindTooltip(passengerTooltip(), { direction:'top', offset:[0,-24] })
  }

  // Driver pin
  if (props.driverCoords?.lat) {
    driverMarker = L.marker([props.driverCoords.lat, props.driverCoords.lng], { icon: makeVehicleIcon(props.driverType) }).addTo(map)
    driverMarker.bindTooltip(driverTooltip(), { direction:'top', offset:[0,-20] })
  }

  // Destination pin — DRAGGABLE so user can fine-tune position
  if (props.destinationCoords?.lat) {
    destMarker = L.marker(
      [props.destinationCoords.lat, props.destinationCoords.lng],
      { icon: makeDestIcon(), draggable: true }
    ).addTo(map)
    destMarker.on('dragend', (e) => {
      const ll = e.target.getLatLng()
      emit('destination-picked', { lat: ll.lat, lng: ll.lng })
    })
  }

  // Nearby drivers layer
  if (props.showNearby) { nearbyLayer = L.layerGroup().addTo(map); drawNearby() }

  // ── Polling fallback — reads props every 2s and moves markers ─────
  // All watcher/prop/reactivity approaches can silently miss updates in
  // Nuxt 3. This interval reads the prop values directly and calls
  // Leaflet's setLatLng regardless of reactivity. It is the guaranteed
  // last resort that works even when everything else fails.
  let lastPLat = null, lastPLng = null
  let lastDLat = null, lastDLng = null
  markerPollId = setInterval(() => {
    const pc = props.passengerCoords
    if (pc?.lat && pc?.lng && (pc.lat !== lastPLat || pc.lng !== lastPLng)) {
      lastPLat = pc.lat; lastPLng = pc.lng
      if (passengerMarker) {
        passengerMarker.setLatLng([pc.lat, pc.lng])
      } else {
        passengerMarker = L.marker([pc.lat,pc.lng],{icon:makePersonIcon()}).addTo(map)
        passengerMarker.bindTooltip(passengerTooltip(),{direction:'top',offset:[0,-24]})
      }
      if (props.role !== 'driver') map.setView([pc.lat,pc.lng], map.getZoom(), {animate:true})
    }
    const dc = props.driverCoords
    if (dc?.lat && dc?.lng && (dc.lat !== lastDLat || dc.lng !== lastDLng)) {
      lastDLat = dc.lat; lastDLng = dc.lng
      if (driverMarker) {
        driverMarker.setLatLng([dc.lat, dc.lng])
      } else {
        driverMarker = L.marker([dc.lat,dc.lng],{icon:makeVehicleIcon(props.driverType)}).addTo(map)
        driverMarker.bindTooltip(driverTooltip(),{direction:'top',offset:[0,-20]})
      }
      if (props.role === 'driver') map.setView([dc.lat,dc.lng], map.getZoom(), {animate:true})
      else map.panTo([dc.lat,dc.lng], {animate:true, duration:0.5})
    }
  }, 2000)

  // Map click in destinationMode → place/move draggable destination marker
  map.on('click', (e) => {
    if (!props.destinationMode) return
    const { lat, lng } = e.latlng
    if (destMarker) {
      destMarker.setLatLng([lat, lng])
    } else {
      destMarker = L.marker([lat, lng], { icon: makeDestIcon(), draggable: true }).addTo(map)
      destMarker.on('dragend', (ev) => {
        const ll = ev.target.getLatLng()
        emit('destination-picked', { lat: ll.lat, lng: ll.lng })
      })
    }
    emit('destination-picked', { lat, lng })
  })

  // Cursor changes to crosshair when destinationMode is on
  watch(() => props.destinationMode, (val) => {
    if (mapEl.value) mapEl.value.style.cursor = val ? 'crosshair' : ''
  }, { immediate: true })

  // Draw route line if both coords already present when showEta turns on
  if (props.showEta) updateRouteLine()
})

// ── Watchers ──────────────────────────────────────────────────────

watch(() => [props.passengerCoords?.lat, props.passengerCoords?.lng], ([lat, lng]) => {
  if (!lat || !lng || !map || !L) return
  const isDriver = props.role === 'driver'
  if (passengerMarker) {
    passengerMarker.setLatLng([lat, lng])
    passengerMarker.setTooltipContent(passengerTooltip())
  } else {
    passengerMarker = L.marker([lat, lng], { icon: makePersonIcon() }).addTo(map)
    passengerMarker.bindTooltip(passengerTooltip(), { direction: 'top', offset: [0, -24] })
  }
  if (!isDriver) map.setView([lat, lng], map.getZoom(), { animate: true })
  if (props.showEta) updateRouteLine()
})

watch(() => [props.driverCoords?.lat, props.driverCoords?.lng], ([lat, lng]) => {
  if (!lat || !lng || !map || !L) return
  const isDriver = props.role === 'driver'
  if (driverMarker) {
    driverMarker.setLatLng([lat, lng])
    driverMarker.setTooltipContent(driverTooltip())
  } else {
    driverMarker = L.marker([lat, lng], { icon: makeVehicleIcon(props.driverType) }).addTo(map)
    driverMarker.bindTooltip(driverTooltip(), { direction: 'top', offset: [0, -20] })
  }
  if (isDriver) map.setView([lat, lng], map.getZoom(), { animate: true })
  else          map.panTo([lat, lng], { animate: true, duration: 0.5 })
  if (props.showEta) updateRouteLine()
})

// CRITICAL: redraw route when showEta switches on (both coords may already exist)
watch(() => props.showEta, () => updateRouteLine())

watch(() => props.passengerLabel, () => {
  if (passengerMarker) passengerMarker.setTooltipContent(passengerTooltip())
})
watch(() => props.driverLabel, () => {
  if (driverMarker) driverMarker.setTooltipContent(driverTooltip())
})

watch(() => props.destinationCoords, (c) => {
  if (!map || !L) return
  if (!c?.lat) {
    if (destMarker) { destMarker.remove(); destMarker = null }
    return
  }
  if (destMarker) { destMarker.setLatLng([c.lat, c.lng]) }
  else {
    destMarker = L.marker([c.lat,c.lng],{icon:makeDestIcon(),draggable:true}).addTo(map)
    destMarker.on('dragend',(e)=>{
      const ll=e.target.getLatLng(); emit('destination-picked',{lat:ll.lat,lng:ll.lng})
    })
  }
}, { deep: true })

watch(() => props.nearbyDrivers, drawNearby, { deep: true })

// ── Cleanup ───────────────────────────────────────────────────────
onBeforeUnmount(() => {
  if (markerPollId) { clearInterval(markerPollId); markerPollId = null }
  map?.remove()
  map=null; L=null
  passengerMarker=null; driverMarker=null; destMarker=null
  nearbyLayer=null; streetLayer=null; satelliteLayer=null; routePolyline=null
})

</script>

<style scoped>
.ping-map-outer { position:relative; width:100%; border-radius:var(--pr-radius,12px); overflow:hidden; background:var(--pr-surface2); }
.ping-map-inner { width:100%; display:block; }

/* Location name — TOP RIGHT, high contrast background */
.ping-location-pill {
  position:absolute; top:10px; right:10px; z-index:30;
  display:inline-flex; align-items:center; gap:6px;
  max-width:55%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  padding:6px 12px; border-radius:20px;
  background:rgba(0,212,184,0.92); color:#1E2A32;
  font-size:12px; font-weight:700;
  box-shadow:0 2px 10px rgba(0,0,0,0.35);
  pointer-events:none;
}
.ping-location-dot { width:7px; height:7px; border-radius:50%; background:#1E2A32; flex-shrink:0; animation:pingLocPulse 2s ease-in-out infinite; }
@keyframes pingLocPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

/* ETA banner — below location pill */
.ping-eta-banner {
  position:absolute; top:46px; right:10px; z-index:30;
  display:inline-flex; align-items:center; gap:5px;
  padding:5px 12px; border-radius:16px;
  background:rgba(255,107,53,0.92); color:#fff;
  font-size:12px; font-weight:700;
  box-shadow:0 2px 8px rgba(0,0,0,0.3);
  pointer-events:none;
}

/* Destination-picking overlay — top-centre */
.ping-dest-overlay {
  position:absolute; top:10px; left:50%; transform:translateX(-50%);
  z-index:30; display:flex; flex-direction:column; align-items:center; gap:6px;
}
.ping-dest-hint {
  padding:7px 16px; border-radius:20px;
  background:rgba(255,107,53,0.92); color:#fff;
  font-size:13px; font-weight:600;
  box-shadow:0 2px 10px rgba(0,0,0,0.3);
  pointer-events:none; white-space:nowrap;
}
.ping-dest-cancel {
  padding:6px 16px; border-radius:20px;
  background:rgba(30,42,50,0.92); color:var(--pr-red,#ff6b6b);
  border:1px solid rgba(255,71,71,0.4);
  font-size:12px; font-weight:700; cursor:pointer;
  box-shadow:0 2px 8px rgba(0,0,0,0.3); white-space:nowrap;
}

/* Satellite / Street toggle — bottom-left */
.ping-layer-btn {
  position:absolute; bottom:14px; left:14px; z-index:30;
  display:flex; align-items:center; gap:5px;
  padding:7px 12px 7px 9px; border-radius:10px;
  border:1px solid rgba(255,255,255,0.15);
  background:rgba(30,42,50,0.88); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
  color:#fff; font-size:13px; font-weight:600; cursor:pointer;
  box-shadow:0 2px 10px rgba(0,0,0,0.5);
  transition:background 0.18s, border-color 0.18s, transform 0.1s;
  white-space:nowrap; -webkit-tap-highlight-color:transparent;
}
.ping-layer-btn:hover  { background:rgba(0,212,184,0.2); border-color:rgba(0,212,184,0.4); }
.ping-layer-btn:active { transform:scale(0.95); }
.ping-layer-label      { font-family:var(--font-body); font-size:12px; }

/* Centre-on-me — bottom-right */
.ping-centre-btn {
  position:absolute; bottom:14px; right:14px; z-index:30;
  width:40px; height:40px; border-radius:50%;
  border:1px solid rgba(255,255,255,0.15);
  background:rgba(30,42,50,0.88); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
  font-size:18px; display:flex; align-items:center; justify-content:center;
  cursor:pointer; box-shadow:0 2px 10px rgba(0,0,0,0.5);
  transition:background 0.18s, border-color 0.18s, transform 0.1s;
  -webkit-tap-highlight-color:transparent;
}
.ping-centre-btn:hover  { background:rgba(0,212,184,0.2); border-color:rgba(0,212,184,0.4); }
.ping-centre-btn:active { transform:scale(0.95); }
</style>