<!-- components/shared/MapView.vue

  THE MAP COMPONENT — used everywhere a map is needed.

  ─────────────────────────────────────────────────────────────────
  WHY THE MAP WASN'T SHOWING BEFORE — and how we fixed it
  ─────────────────────────────────────────────────────────────────
  Leaflet requires the container <div> to have a real pixel size
  when L.map() is called. If the div is still 0×0 at that moment
  (because the parent component hasn't finished laying out), Leaflet
  initialises but renders nothing — tiles never load.

  FIX 1: We call `await nextTick()` before L.map() so Vue finishes
          rendering the parent first.
  FIX 2: We call `map.invalidateSize()` after mount so Leaflet
          re-measures the container and loads the correct tiles.
  FIX 3: The container now uses an explicit inline height in pixels
          so there is never any ambiguity.

  ─────────────────────────────────────────────────────────────────
  PROPS
  ─────────────────────────────────────────────────────────────────
  height          String   CSS height, e.g. "300px"
  passengerCoords Object   { lat, lng } — shown as animated teal person
  driverCoords    Object   { lat, lng } — shown as car/bike icon
  driverType      String   'taxi' | 'bike'  (which driver icon to use)
  nearbyDrivers   Array    List of online Driver documents for nearby view
  showNearby      Boolean  Whether to render the nearby drivers layer
  zoom            Number   Initial zoom level (default 15)

  ─────────────────────────────────────────────────────────────────
  CUSTOM ICONS
  ─────────────────────────────────────────────────────────────────
  Leaflet normally shows a generic blue pin. We use L.divIcon() to
  render any HTML/SVG as a marker. Each icon is a self-contained
  HTML string with inline styles.

    🧍 Passenger   — teal circle with person SVG + pulsing ring
    🚕 Taxi        — yellow rounded square with top-down car SVG
    🏍️  Motorbike   — orange circle with bike frame SVG
-->
<template>
  <!--
    The map container div.
    Leaflet mounts into this element. It MUST have a real height — we
    set it both via the :style binding AND via CSS class to be safe.
  -->
  <div
    ref="mapEl"
    class="pr-map w-full rounded-xl overflow-hidden"
    :style="{ height: height, minHeight: height }"
  />
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'

// ── Props ────────────────────────────────────────────────────────
const props = defineProps({
  height:          { type: String,  default: '300px' },
  passengerCoords: { type: Object,  default: null },
  driverCoords:    { type: Object,  default: null },
  driverType:      { type: String,  default: 'bike' },
  nearbyDrivers:   { type: Array,   default: () => [] },
  showNearby:      { type: Boolean, default: false },
  zoom:            { type: Number,  default: 15 },
})

// mapEl is a Vue template ref — it gets set to the actual <div> DOM node
const mapEl = ref(null)

// Leaflet instances — we keep references so we can update/remove them
let map         = null   // The main Leaflet map object
let myMarker    = null   // "You" marker (passenger or driver's own position)
let otherMarker = null   // The other party's marker during an active ride
let nearbyLayer = null   // LayerGroup holding all nearby driver markers
let leafletRef  = null   // Cached Leaflet module so we don't re-import it

// ── Icon factories ────────────────────────────────────────────────
// Each function returns a Leaflet divIcon — Leaflet renders the html
// string as a real DOM node at the marker's coordinates.

// PERSON ICON: used for the passenger (or any "you" position)
// Has a teal pulsing ring to show it is a live GPS position
const makePersonIcon = (L) => L.divIcon({
  className: '',  // prevents Leaflet adding its own white box CSS class
  html: `
    <div style="
      position:relative;width:44px;height:44px;
      display:flex;align-items:center;justify-content:center;
    ">
      <!-- Outer pulsing ring — draws attention to live position -->
      <div style="
        position:absolute;inset:0;border-radius:50%;
        border:2px solid rgba(0,212,184,0.6);
        animation:prPulse 2s ease-out infinite;
      "></div>
      <!-- Inner filled circle -->
      <div style="
        width:32px;height:32px;border-radius:50%;
        background:#00D4B8;border:2px solid #1E2A32;
        display:flex;align-items:center;justify-content:center;
      ">
        <!-- Person silhouette SVG -->
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="7" r="4" fill="#1E2A32"/>
          <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" fill="#1E2A32"/>
        </svg>
      </div>
    </div>
    <style>
      /* Keyframe defined once — repeated divIcons reuse it */
      @keyframes prPulse {
        0%   { transform:scale(0.8); opacity:1; }
        100% { transform:scale(2.2); opacity:0; }
      }
    </style>
  `,
  iconSize:   [44, 44],
  iconAnchor: [22, 22],  // anchor at centre of the 44×44 box
  popupAnchor:[0, -22],  // popup appears above the marker
})

// TAXI ICON: yellow rounded square with top-down car drawing
const makeTaxiIcon = (L, small = false) => {
  const s = small ? 30 : 38
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:${s}px;height:${s}px;border-radius:7px;
        background:#F0C040;border:2.5px solid #1E2A32;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 3px 10px rgba(0,0,0,0.35);
      ">
        <svg width="${s-10}" height="${s-10}" viewBox="0 0 24 24" fill="none">
          <rect x="2"  y="9"  width="20" height="9" rx="2" fill="#1E2A32"/>
          <rect x="5"  y="5"  width="14" height="6" rx="2" fill="#1E2A32"/>
          <rect x="6"  y="6"  width="5"  height="4" rx="1" fill="#F0C040" opacity="0.75"/>
          <rect x="13" y="6"  width="5"  height="4" rx="1" fill="#F0C040" opacity="0.75"/>
          <circle cx="6.5"  cy="18" r="2.2" fill="#333"/>
          <circle cx="17.5" cy="18" r="2.2" fill="#333"/>
        </svg>
      </div>
    `,
    iconSize:   [s, s],
    iconAnchor: [s/2, s/2],
    popupAnchor:[0, -(s/2)],
  })
}

// BIKE ICON: orange circle with bicycle/motorbike frame drawing
const makeBikeIcon = (L, small = false) => {
  const s = small ? 30 : 38
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:${s}px;height:${s}px;border-radius:50%;
        background:#FF6B35;border:2.5px solid #1E2A32;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 3px 10px rgba(0,0,0,0.35);
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

// Helper — picks taxi or bike icon based on vehicleType string
const makeDriverIcon = (L, vehicleType, small = false) =>
  vehicleType === 'taxi' ? makeTaxiIcon(L, small) : makeBikeIcon(L, small)

// ── Map initialisation ────────────────────────────────────────────
onMounted(async () => {
  // STEP 1: Wait for Vue to finish rendering the DOM.
  // Without nextTick, mapEl.value might still be null or have 0px height.
  await nextTick()

  // STEP 2: Dynamically import Leaflet (browser-only).
  // `ssr: false` in nuxt.config already prevents SSR, but this is
  // an extra safety net — Leaflet accesses `window` which crashes Node.js.
  const L = await import('leaflet')
  leafletRef = L  // cache it so watchers can use it without re-importing

  // STEP 3: Determine the initial map centre.
  // Priority: passenger position > driver position > Bamenda default
  const center = props.passengerCoords
    ? [props.passengerCoords.lat, props.passengerCoords.lng]
    : props.driverCoords
      ? [props.driverCoords.lat, props.driverCoords.lng]
      : [5.9631, 10.1591]  // Bamenda, Cameroon

  // STEP 4: Create the Leaflet map object, mounted inside our <div>
  map = L.map(mapEl.value, {
    center,
    zoom:               props.zoom,
    zoomControl:        true,
    attributionControl: false,
  })

  // STEP 5: Add the OpenStreetMap tile layer.
  // This is what draws the actual street map. Free, no API key needed.
  // We apply a CSS filter in main.css to dim it for our dark UI.
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    // The subdomains a/b/c spread requests across OSM servers for speed
    subdomains: 'abc',
  }).addTo(map)

  // STEP 6: CRITICAL — tell Leaflet the container's actual size.
  // Without this call, if the container was 0px tall at L.map() time,
  // the tiles never load. invalidateSize() forces a re-measurement.
  setTimeout(() => { map?.invalidateSize() }, 100)

  // STEP 7: Place initial markers if coordinates were already provided
  if (props.passengerCoords) {
    myMarker = L.marker(
      [props.passengerCoords.lat, props.passengerCoords.lng],
      { icon: makePersonIcon(L) }
    ).addTo(map).bindPopup('<b>You</b>')
  }

  if (props.driverCoords) {
    otherMarker = L.marker(
      [props.driverCoords.lat, props.driverCoords.lng],
      { icon: makeDriverIcon(L, props.driverType) }
    ).addTo(map).bindPopup('<b>Your driver</b>')
  }

  // STEP 8: Set up the nearby drivers layer if requested
  if (props.showNearby) {
    // LayerGroup is a container for multiple markers.
    // We clear + rebuild it whenever nearbyDrivers changes.
    nearbyLayer = L.layerGroup().addTo(map)
    renderNearbyDrivers()
  }
})

// ── Render nearby driver markers ──────────────────────────────────
// Clears the entire layer and re-adds one marker per online driver.
// Called on mount and whenever the nearbyDrivers prop updates.
const renderNearbyDrivers = () => {
  if (!nearbyLayer || !leafletRef) return
  nearbyLayer.clearLayers()

  props.nearbyDrivers.forEach(driver => {
    // Skip any driver without a valid saved location
    if (!driver.currentLocation?.lat || !driver.currentLocation?.lng) return

    const icon = makeDriverIcon(leafletRef, driver.vehicleType, true)

    leafletRef.marker(
      [driver.currentLocation.lat, driver.currentLocation.lng],
      { icon }
    )
    .addTo(nearbyLayer)
    .bindPopup(`
      <div style="font-family:sans-serif;padding:4px 0;min-width:130px">
        <strong style="font-size:14px">${driver.name || 'Driver'}</strong><br>
        <span style="color:#666;font-size:12px">
          ${driver.vehicleType === 'taxi' ? '🚕 Taxi' : '🏍️ Motorbike'}
        </span><br>
        <span style="color:#666;font-size:12px">📍 ${driver.region || ''}</span>
      </div>
    `)
  })
}

// ── Reactive watchers ─────────────────────────────────────────────
// Vue calls these functions whenever the watched value changes.
// This is what makes the map "live" — store updates from socket events
// automatically move the markers without any manual code in pages.

// Watch passenger position — update the person marker
watch(() => props.passengerCoords, (coords) => {
  if (!coords || !map || !leafletRef) return
  if (myMarker) {
    // Marker already exists — just move it
    myMarker.setLatLng([coords.lat, coords.lng])
  } else {
    // Create it for the first time
    myMarker = leafletRef.marker(
      [coords.lat, coords.lng],
      { icon: makePersonIcon(leafletRef) }
    ).addTo(map).bindPopup('<b>You</b>')
  }
  // Centre the map on the passenger's position
  map.setView([coords.lat, coords.lng], map.getZoom(), { animate: true })
}, { deep: true })

// Watch driver position — update the vehicle marker
watch(() => props.driverCoords, (coords) => {
  if (!coords || !map || !leafletRef) return
  if (otherMarker) {
    otherMarker.setLatLng([coords.lat, coords.lng])
  } else {
    otherMarker = leafletRef.marker(
      [coords.lat, coords.lng],
      { icon: makeDriverIcon(leafletRef, props.driverType) }
    ).addTo(map).bindPopup('<b>Your driver</b>')
  }
  // Pan to keep driver visible — but only if they are far from current view
  map.panTo([coords.lat, coords.lng], { animate: true, duration: 0.5 })
}, { deep: true })

// Watch the list of nearby drivers — refresh all their markers
watch(() => props.nearbyDrivers, renderNearbyDrivers, { deep: true })

// ── Cleanup ───────────────────────────────────────────────────────
// Called automatically when the component is removed from the page.
// Without this, navigating away and back creates a second Leaflet map
// on the same div, causing "Map container already initialized" errors.
onBeforeUnmount(() => {
  map?.remove()
  map         = null
  myMarker    = null
  otherMarker = null
  nearbyLayer = null
  leafletRef  = null
})
</script>