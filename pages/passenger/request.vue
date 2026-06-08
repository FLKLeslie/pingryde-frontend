<!-- pages/passenger/request.vue — PASSENGER: BOOK A RIDE -->
<template>
  <div class="pr-page">

    <!-- Header -->
    <div class="page-header">
      <div>
        <p class="greeting">Good to see you,</p>
        <h1 class="page-title">{{ firstName }} 👋</h1>
      </div>
      <div v-if="nearbyDrivers.length > 0" class="drivers-badge">
        <span class="pulse-dot"></span>
        {{ nearbyDrivers.length }} driver{{ nearbyDrivers.length !== 1 ? 's' : '' }} nearby
      </div>
      <div v-else-if="!locating" class="drivers-badge drivers-badge--none">No drivers nearby</div>
    </div>

    <!-- ══ MAP ══════════════════════════════════════════════════════
      Shows nearby online drivers before booking.
      When destinationMode is on, tapping the map sets the destination.
    ════════════════════════════════════════════════════════════════ -->
    <div class="map-wrapper">
      <PingMap
        :style="{ height: mapHeight }"
        :passenger-coords="myLocation"
        :passenger-label="townName"
        :location-label="townName"
        :nearby-drivers="nearbyDrivers"
        :show-nearby="true"
        :destination-mode="destinationMode"
        :destination-coords="destCoords"
        @driver-click="openDriverSheet"
        @destination-picked="onDestinationPicked"
        @cancel-destination="destinationMode = false"
      />

      <!-- GPS / town name pill is now rendered inside PingMap (top-right) -->
    </div>

    <!-- Map legend -->
    <div class="map-legend">
      <div class="leg"><div class="leg-dot" style="background:var(--pr-teal)"></div>You</div>
      <div class="leg"><div class="leg-dot" style="background:var(--pr-yellow);border-radius:2px"></div>Taxi</div>
      <div class="leg"><div class="leg-dot" style="background:var(--pr-orange)"></div>Moto</div>
      <span class="leg-hint">Tap a pin for driver info</span>
    </div>

    <!-- ══ FORM ══════════════════════════════════════════════════════ -->
    <div class="form-wrap">

      <!-- STEP 1: Category -->
      <div class="form-section">
        <p class="form-label">What do you need?</p>
        <div class="card-grid">
          <button v-for="cat in categories" :key="cat.value"
                  class="choice-card" :class="{ 'choice-card--active': form.rideCategory === cat.value }"
                  :style="form.rideCategory === cat.value ? `border-color:${cat.color};background:${cat.bg}` : ''"
                  @click="selectCategory(cat.value)">
            <span class="choice-icon">{{ cat.icon }}</span>
            <strong class="choice-name">{{ cat.label }}</strong>
            <span class="choice-sub">{{ cat.sub }}</span>
          </button>
        </div>
      </div>

      <!-- STEP 2: Vehicle (normal) -->
      <Transition name="slide-down">
        <div v-if="form.rideCategory === 'normal'" class="form-section">
          <p class="form-label">Which vehicle?</p>
          <div class="card-grid">
            <button v-for="veh in vehicles" :key="veh.value"
                    class="choice-card" :class="{ 'choice-card--active': form.rideType === veh.value }"
                    :style="form.rideType === veh.value ? `border-color:${veh.color};background:${veh.bg}` : ''"
                    @click="form.rideType = veh.value">
              <span class="choice-icon">{{ veh.icon }}</span>
              <strong class="choice-name">{{ veh.label }}</strong>
              <span class="choice-sub">{{ veh.sub }}</span>
            </button>
          </div>
        </div>
      </Transition>

      <!-- STEP 2b: Vehicle (special) -->
      <Transition name="slide-down">
        <div v-if="form.rideCategory === 'special'" class="form-section">
          <p class="form-label">Which vehicle for transport?</p>
          <p class="form-sub">Your request will only go to that vehicle type.</p>
          <div class="card-grid">
            <button v-for="veh in vehicles" :key="veh.value"
                    class="choice-card" :class="{ 'choice-card--active': form.specialVehicleType === veh.value }"
                    :style="form.specialVehicleType === veh.value ? `border-color:${veh.color};background:${veh.bg}` : ''"
                    @click="form.specialVehicleType = veh.value">
              <span class="choice-icon">{{ veh.icon }}</span>
              <strong class="choice-name">{{ veh.label }}</strong>
              <span class="choice-sub">{{ veh.sub }}</span>
            </button>
          </div>
        </div>
      </Transition>

      <!-- STEP 3: Location fields -->
      <Transition name="slide-down">
        <div v-if="showLocationFields" class="form-section">
          <p class="form-label">Trip details</p>

          <!-- ── PICKUP ────────────────────────────────────────────
            Default: town name from reverse geocode, editable.
            Autocomplete dropdown from Nominatim search.
          ─────────────────────────────────────────────────────── -->
          <div class="loc-row">
            <div class="loc-pin loc-pin--pickup"></div>
            <div class="loc-field">
              <label class="loc-label">Pickup location</label>
              <div class="autocomplete-wrap">
                <input
                  v-model="form.pickupDescription"
                  type="text"
                  class="pr-input"
                  placeholder="e.g. Near Total station, Molyko"
                  maxlength="120"
                  autocomplete="off"
                  @input="onPickupInput"
                  @focus="pickupFocused = true"
                  @blur="hidePickupSuggestions"
                />
                <!-- Suggestions dropdown -->
                <div v-if="pickupFocused && pickupSuggestions.length > 0" class="suggestions-dropdown">
                  <button
                    v-for="(s, i) in pickupSuggestions" :key="i"
                    class="suggestion-item"
                    @mousedown.prevent="selectPickupSuggestion(s)"
                  >
                    <span class="suggestion-icon">📍</span>
                    <div>
                      <p class="suggestion-name">{{ s.name }}</p>
                      <p class="suggestion-full">{{ s.fullName }}</p>
                    </div>
                  </button>
                </div>
              </div>
              <p v-if="myLocation" class="loc-gps">
                📡 GPS: {{ myLocation.lat.toFixed(4) }}, {{ myLocation.lng.toFixed(4) }}
              </p>
              <p v-else class="loc-gps loc-gps--warn">⚠️ GPS not available — enable location</p>
            </div>
          </div>

          <div class="loc-line-wrap"><div class="loc-line"></div></div>

          <!-- ── DESTINATION ────────────────────────────────────────
            Three ways to set destination:
              1. Type a description → autocomplete suggestions appear
              2. Tap "Pick on map" → destinationMode activates → tap the map
              3. Both are combined: picking on map also does reverse geocode
                 to fill the text field automatically
          ─────────────────────────────────────────────────────────── -->
          <div class="loc-row">
            <div class="loc-pin loc-pin--dest"></div>
            <div class="loc-field">
              <label class="loc-label">Destination</label>
              <div class="autocomplete-wrap">
                <input
                  v-model="form.destinationDescription"
                  type="text"
                  class="pr-input"
                  placeholder="e.g. Buea Town market"
                  maxlength="120"
                  autocomplete="off"
                  @input="onDestInput"
                  @focus="destFocused = true"
                  @blur="hideDestSuggestions"
                />
                <!-- Suggestions dropdown -->
                <div v-if="destFocused && destSuggestions.length > 0" class="suggestions-dropdown">
                  <button
                    v-for="(s, i) in destSuggestions" :key="i"
                    class="suggestion-item"
                    @mousedown.prevent="selectDestSuggestion(s)"
                  >
                    <span class="suggestion-icon">🏁</span>
                    <div>
                      <p class="suggestion-name">{{ s.name }}</p>
                      <p class="suggestion-full">{{ s.fullName }}</p>
                    </div>
                  </button>
                </div>
              </div>

              <!-- Pick-on-map button -->
              <button class="pick-on-map-btn" @click="startDestinationMode">
                <span>🗺️</span>
                {{ destCoords ? 'Change on map' : 'Pick on map' }}
              </button>

              <!-- Confirmation when user tapped the map -->
              <p v-if="destCoords && !destinationMode" class="dest-confirmed">
                ✓ Location pinned: {{ destCoords.lat.toFixed(4) }}, {{ destCoords.lng.toFixed(4) }}
              </p>
            </div>
          </div>
        </div>
      </Transition>

      <!-- STEP 3b: Special cargo details -->
      <Transition name="slide-down">
        <div v-if="form.rideCategory === 'special' && showLocationFields" class="form-section">
          <p class="form-label">Cargo details</p>
          <input v-model="form.specialRequest.description" type="text" class="pr-input"
                 placeholder="Describe what needs to be transported" style="margin-bottom:8px" />
          <div class="card-grid">
            <div>
              <label class="loc-label">Cargo type</label>
              <input v-model="form.specialRequest.cargoType" type="text" class="pr-input" placeholder="e.g. Furniture" />
            </div>
            <div>
              <label class="loc-label">Est. weight</label>
              <input v-model="form.specialRequest.estimatedLoad" type="text" class="pr-input" placeholder="e.g. 50 kg" />
            </div>
          </div>
        </div>
      </Transition>

      <!-- Advice -->
      <Transition name="slide-down">
        <div v-if="showLocationFields" class="advice-box">
          <span>💡</span>
          <p>Once your ride is confirmed, stand somewhere visible and easily accessible near the road.</p>
        </div>
      </Transition>

      <div v-if="errorMsg" class="error-box">⚠️ {{ errorMsg }}</div>

      <Transition name="slide-down">
        <button v-if="showLocationFields" @click="requestRide"
                :disabled="loading || locating || !myLocation"
                class="pr-btn pr-btn-primary">
          <span v-if="loading" class="spin">⟳</span>
          <span v-else>📡</span>
          {{ loading ? 'Pinging drivers...' : locating ? 'Getting GPS...' : 'Ping a Ride' }}
        </button>
      </Transition>

    </div>

    <!-- Driver detail sheet -->
    <Transition name="sheet">
      <div v-if="selectedDriver" class="sheet-overlay" @click.self="selectedDriver = null">
        <div class="driver-sheet">
          <button class="sheet-close" @click="selectedDriver = null">✕</button>
          <div class="sheet-photo">
            <span class="sheet-initials">{{ selectedDriverInitials }}</span>
          </div>
          <h3 class="sheet-name">{{ selectedDriver.name }}</h3>
          <p class="sheet-sub">
            {{ selectedDriver.vehicleType === 'taxi' ? '🚕 Taxi' : '🏍️ Motorbike' }}
            <span v-if="selectedDriver.region"> · {{ selectedDriver.region }}</span>
          </p>
          <div class="sheet-info">
            <div class="sheet-row">
              <span class="sheet-key">Status</span>
              <span class="pr-badge pr-badge-active">Online</span>
            </div>
            <div v-if="selectedDriver.plateNumber" class="sheet-row">
              <span class="sheet-key">Plate</span>
              <span class="sheet-val">{{ selectedDriver.plateNumber }}</span>
            </div>
            <div class="sheet-row">
              <span class="sheet-key">Verified</span>
              <span :style="selectedDriver.isVerified ? 'color:var(--pr-teal)' : 'color:var(--pr-muted)'">
                {{ selectedDriver.isVerified ? '✓ Verified' : 'Not yet' }}
              </span>
            </div>
          </div>
          <button class="pr-btn pr-btn-primary" style="margin-top:4px"
                  @click="quickSelect(selectedDriver.vehicleType)">
            Book a {{ selectedDriver.vehicleType === 'taxi' ? 'Taxi' : 'Motorbike' }} Ride
          </button>
        </div>
      </div>
    </Transition>

  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter }      from 'vue-router'
import { useUserStore }   from '~/store/user'
import { useRideStore }   from '~/store/ride'
import { useGeolocation } from '~/composables/useGeolocation'
import { useSocket }      from '~/composables/useSocket'
import { API_BASE }       from '~/utils/api'

const router    = useRouter()
const userStore = useUserStore()
const rideStore = useRideStore()
const { getOnce, reverseGeocode, searchPlaces } = useGeolocation()

// ── State ──────────────────────────────────────────────────────────
const myLocation      = ref(null)    // { lat, lng } from device GPS
const townName        = ref('')      // reverse-geocoded place name e.g. "Molyko, Buea"
const nearbyDrivers   = ref([])
const locating        = ref(true)
const loading         = ref(false)
const errorMsg        = ref('')
const selectedDriver  = ref(null)

// Destination map-picking state
const destinationMode = ref(false)   // true = map click sets destination
const destCoords      = ref(null)    // { lat, lng } picked on map

// Autocomplete state
const pickupSuggestions  = ref([])
const destSuggestions    = ref([])
const pickupFocused      = ref(false)
const destFocused        = ref(false)
let pickupDebounce       = null
let destDebounce         = null

let nearbyInterval = null

// ── Computed ───────────────────────────────────────────────────────
const firstName = computed(() => userStore.name?.split(' ')[0] || 'there')
const selectedDriverInitials = computed(() =>
  (selectedDriver.value?.name || '??').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
)
const mapHeight = computed(() => {
  if (typeof window === 'undefined') return '300px'
  return window.innerWidth >= 640 ? '360px' : '290px'
})
const showLocationFields = computed(() =>
  (form.rideCategory === 'normal'  && form.rideType !== '') ||
  (form.rideCategory === 'special' && form.specialVehicleType !== '')
)

// ── Form ───────────────────────────────────────────────────────────
const form = reactive({
  rideCategory: '', rideType: '', specialVehicleType: '',
  pickupDescription: '', destinationDescription: '',
  specialRequest: { description: '', cargoType: '', estimatedLoad: '' },
})

const categories = [
  { value:'normal',  label:'Normal',  sub:'Passenger ride', icon:'🚗', color:'var(--pr-teal)',   bg:'rgba(0,212,184,0.1)' },
  { value:'special', label:'Special', sub:'Cargo/custom',   icon:'📦', color:'var(--pr-yellow)', bg:'rgba(240,192,64,0.1)' },
]
const vehicles = [
  { value:'bike', label:'Motorbike', sub:'Exact pickup',  icon:'🏍️', color:'var(--pr-orange)', bg:'rgba(255,107,53,0.1)' },
  { value:'taxi', label:'Taxi',      sub:'At checkpoint', icon:'🚕', color:'var(--pr-teal)',   bg:'rgba(0,212,184,0.1)' },
]

const selectCategory = (cat) => {
  form.rideCategory = cat
  form.rideType = ''
  form.specialVehicleType = ''
}
const openDriverSheet = (driver) => { selectedDriver.value = driver }
const quickSelect = (vehicleType) => {
  form.rideCategory = 'normal'
  form.rideType = vehicleType
  selectedDriver.value = null
}

// ── Destination map-picking ────────────────────────────────────────
const startDestinationMode = () => { destinationMode.value = true }

// Called when PingMap emits 'destination-picked'
const onDestinationPicked = async ({ lat, lng }) => {
  destCoords.value      = { lat, lng }
  destinationMode.value = false
  // Reverse geocode the picked point to fill the text field
  const name = await reverseGeocode(lat, lng)
  if (name) form.destinationDescription = name
}

// ── Autocomplete: pickup field ─────────────────────────────────────
const onPickupInput = () => {
  clearTimeout(pickupDebounce)
  if (!myLocation.value || form.pickupDescription.length < 2) {
    pickupSuggestions.value = []
    return
  }
  pickupDebounce = setTimeout(async () => {
    pickupSuggestions.value = await searchPlaces(
      form.pickupDescription,
      myLocation.value.lat,
      myLocation.value.lng
    )
  }, 500)
}

const selectPickupSuggestion = (s) => {
  form.pickupDescription  = s.fullName
  pickupSuggestions.value = []
  pickupFocused.value     = false
  // Update pickup GPS to the chosen suggestion's coords
  myLocation.value = { lat: s.lat, lng: s.lng }
}

const hidePickupSuggestions = () => {
  setTimeout(() => { pickupFocused.value = false }, 200)
}

// ── Autocomplete: destination field ───────────────────────────────
const onDestInput = () => {
  clearTimeout(destDebounce)
  if (!myLocation.value || form.destinationDescription.length < 2) {
    destSuggestions.value = []
    return
  }
  destDebounce = setTimeout(async () => {
    destSuggestions.value = await searchPlaces(
      form.destinationDescription,
      myLocation.value.lat,
      myLocation.value.lng
    )
  }, 500)
}

const selectDestSuggestion = (s) => {
  form.destinationDescription = s.fullName
  destSuggestions.value       = []
  destFocused.value           = false
  // Store the destination coords from the suggestion
  destCoords.value = { lat: s.lat, lng: s.lng }
}

const hideDestSuggestions = () => {
  setTimeout(() => { destFocused.value = false }, 200)
}

// ── Nearby drivers fetch ───────────────────────────────────────────
const fetchNearby = async () => {
  if (!myLocation.value) return
  try {
    const { lat, lng } = myLocation.value
    const data = await $fetch(`${API_BASE}/drivers/nearby?lat=${lat}&lng=${lng}`)
    nearbyDrivers.value = Array.isArray(data) ? data : (data.drivers || [])
  } catch (e) { console.warn('[Request] fetchNearby:', e.message) }
}

// ── Real-time nearby driver updates ──────────────────────────────
const registerNearbyDriverListeners = (socket) => {
  // When a driver comes online, add them to the nearby drivers list
  socket.on('driverStatusUpdate', (data) => {
    if (data.type === 'online' && data.driver) {
      // Check if this driver is near the passenger
      if (!myLocation.value) return
      const { lat: pLat, lng: pLng } = myLocation.value
      const { lat: dLat, lng: dLng } = data.driver.currentLocation || {}
      if (!dLat || !dLng) return
      
      const RADIUS = 0.09 // ~10km
      const latDiff = Math.abs(dLat - pLat)
      const lngDiff = Math.abs(dLng - pLng)
      
      if (latDiff < RADIUS && lngDiff < RADIUS) {
        // Check if driver already in list
        const exists = nearbyDrivers.value.some(d => d._id?.toString() === data.driver._id?.toString())
        if (!exists) {
          nearbyDrivers.value.push(data.driver)
        }
      }
    } else if (data.type === 'offline' && data.driverId) {
      // Remove driver from nearby list when they go offline
      nearbyDrivers.value = nearbyDrivers.value.filter(
        d => d._id?.toString() !== data.driverId?.toString()
      )
    }
  })
  
  // When a driver's location updates, update their position in the nearby list
  socket.on('nearbyDriverLocationUpdate', (data) => {
    if (data.driverId && data.lat !== undefined && data.lng !== undefined) {
      const driver = nearbyDrivers.value.find(d => d._id?.toString() === data.driverId?.toString())
      if (driver && driver.currentLocation) {
        driver.currentLocation.lat = data.lat
        driver.currentLocation.lng = data.lng
      }
    }
  })
}

// ── Mount ──────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    const coords = await getOnce()
    myLocation.value = coords
    rideStore.updatePassengerLocation(coords)

    // Reverse geocode to get the town name for the GPS pill + pickup default
    const name = await reverseGeocode(coords.lat, coords.lng)
    if (name) {
      townName.value             = name
      // Pre-fill pickup with the town name so user doesn't have to type
      form.pickupDescription     = name
    }

    await fetchNearby()
    nearbyInterval = setInterval(fetchNearby, 30_000)
    
    // ── Real-time socket listeners for nearby drivers ───────────────────
    const { socket } = useSocket()
    if (socket?.connected) {
      registerNearbyDriverListeners(socket)
    } else {
      // If socket not ready yet, wait and register listeners
      const checkSocket = setInterval(() => {
        const { socket: s } = useSocket()
        if (s?.connected) {
          registerNearbyDriverListeners(s)
          clearInterval(checkSocket)
        }
      }, 100)
    }
  } catch {
    errorMsg.value = 'Could not get location. Enable GPS and refresh.'
  } finally {
    locating.value = false
  }
})

onBeforeUnmount(() => {
  if (nearbyInterval) clearInterval(nearbyInterval)
  clearTimeout(pickupDebounce)
  clearTimeout(destDebounce)
})

// ── Submit ─────────────────────────────────────────────────────────
const requestRide = async () => {
  errorMsg.value = ''
  if (!myLocation.value)                   { errorMsg.value = 'GPS not available.'; return }
  if (!form.pickupDescription.trim())      { errorMsg.value = 'Please describe your pickup location.'; return }
  if (!form.destinationDescription.trim()) { errorMsg.value = 'Please enter your destination.'; return }
  if (!userStore._id)                      { errorMsg.value = 'You are not logged in.'; return }

  loading.value = true
  try {
    const res = await $fetch(`${API_BASE}/rides`, {
      method: 'POST',
      body: {
        passengerId:  userStore._id,
        rideCategory: form.rideCategory,
        rideType: form.rideCategory === 'normal'
          ? form.rideType
          : form.specialVehicleType || undefined,
        pickup: {
          lat:         myLocation.value.lat,
          lng:         myLocation.value.lng,
          description: form.pickupDescription.trim(),
        },
        destination: {
          lat:         destCoords.value?.lat || 0,
          lng:         destCoords.value?.lng || 0,
          description: form.destinationDescription.trim(),
        },
        ...(form.rideCategory === 'special' ? { specialRequest: form.specialRequest } : {}),
      },
    })
    rideStore.setRide(res.ride)
    rideStore.updatePassengerLocation(myLocation.value)
    router.push('/passenger/tracking')
  } catch (err) {
    errorMsg.value = err?.data?.error || 'Failed to create ride. Check backend is running.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.page-header {
  display:flex; align-items:center; justify-content:space-between;
  margin-bottom:16px; flex-wrap:wrap; gap:10px;
  /* Ensure header never overflows on small screens */
  min-width:0;
}
.greeting   { font-size:12px; color:var(--pr-muted); margin:0 0 2px; }
.page-title { font-size:clamp(18px, 5vw, 22px); font-weight:800; margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.drivers-badge {
  display:flex; align-items:center; gap:7px; padding:6px 13px; border-radius:999px;
  font-size:12px; font-weight:600; color:var(--pr-orange);
  background:rgba(255,107,53,0.1); border:1px solid rgba(255,107,53,0.25);
}
.drivers-badge--none { color:var(--pr-muted); background:var(--pr-surface2); border-color:var(--pr-border); }
.pulse-dot {
  width:7px; height:7px; border-radius:50%; background:var(--pr-orange);
  animation:pulsate 1.5s ease-in-out infinite;
}
@keyframes pulsate { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(1.5)} }

/* Map */
.map-wrapper   { position:relative; margin-bottom:10px; }
.map-gps-badge { position:absolute; top:12px; left:12px; z-index:20; }
.gps-pill {
  display:inline-flex; align-items:center; gap:6px; padding:5px 11px;
  border-radius:999px; font-size:12px; font-weight:500; backdrop-filter:blur(8px);
  max-width: 200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.gps-pill--loading { background:rgba(30,42,50,0.9); border:1px solid var(--pr-border); color:var(--pr-muted); }
.gps-pill--ready   { background:rgba(0,212,184,0.14); border:1px solid rgba(0,212,184,0.35); color:var(--pr-teal); }
.gps-pill--error   { background:rgba(255,71,71,0.12); border:1px solid rgba(255,71,71,0.3); color:var(--pr-red); }
.gps-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
.gps-dot--yellow { background:var(--pr-yellow); animation:pulsate 1.2s infinite; }
.gps-dot--teal   { background:var(--pr-teal); }
.gps-dot--red    { background:var(--pr-red); }

/* Cancel button shown in destination-picking mode */
.dest-mode-cancel {
  position:absolute; bottom:14px; left:50%; transform:translateX(-50%); z-index:30;
  padding:8px 20px; border-radius:20px;
  background:rgba(30,42,50,0.92); border:1px solid rgba(255,71,71,0.4);
  color:var(--pr-red); font-size:13px; font-weight:600; cursor:pointer;
  backdrop-filter:blur(8px); white-space:nowrap;
}

.map-legend {
  display:flex; align-items:center; gap:12px; margin-bottom:18px;
  flex-wrap:wrap; font-size:11px; color:var(--pr-muted);
}
.leg { display:flex; align-items:center; gap:5px; }
.leg-dot { width:10px; height:10px; border-radius:50%; }
.leg-hint { margin-left:auto; font-style:italic; }

/* Form */
.form-wrap    { display:flex; flex-direction:column; gap:16px; }
.form-section { display:flex; flex-direction:column; gap:10px; }
.form-label   { font-size:13px; font-weight:700; color:var(--pr-text); margin:0; }
.form-sub     { font-size:12px; color:var(--pr-muted); margin:0; }

.card-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.choice-card {
  display:flex; flex-direction:column; align-items:center; gap:5px;
  padding:14px 8px; border-radius:12px; cursor:pointer;
  background:var(--pr-surface2); border:1.5px solid var(--pr-border);
  transition:all 0.16s; -webkit-tap-highlight-color:transparent;
}
.choice-card:hover   { border-color:rgba(0,212,184,0.3); }
.choice-card--active { border-width:2px !important; }
.choice-icon { font-size:24px; line-height:1; }
.choice-name { font-size:13px; font-weight:700; margin:0; }
.choice-sub  { font-size:11px; color:var(--pr-muted); text-align:center; }

/* Location rows */
.loc-row  { display:flex; align-items:flex-start; gap:12px; }
.loc-pin  { width:14px; flex-shrink:0; margin-top:28px; display:flex; align-items:center; justify-content:center; }
.loc-pin::before { content:''; display:block; width:12px; height:12px; border-radius:50%; }
.loc-pin--pickup::before { background:var(--pr-teal);   box-shadow:0 0 0 3px rgba(0,212,184,0.2); }
.loc-pin--dest::before   { background:var(--pr-orange); box-shadow:0 0 0 3px rgba(255,107,53,0.2); border-radius:3px; }
.loc-field { flex:1; display:flex; flex-direction:column; gap:4px; }
.loc-label { font-size:11px; font-weight:700; color:var(--pr-muted); text-transform:uppercase; letter-spacing:0.05em; }
.loc-gps   { font-size:10px; color:var(--pr-muted); margin:0; }
.loc-gps--warn { color:var(--pr-yellow); }
.loc-line-wrap { padding-left:6px; padding-top:2px; padding-bottom:2px; }
.loc-line { width:2px; height:14px; background:linear-gradient(to bottom,var(--pr-teal),var(--pr-orange)); opacity:0.45; border-radius:1px; }

/* Autocomplete */
.autocomplete-wrap { position:relative; }
.suggestions-dropdown {
  position:absolute; top:calc(100% + 4px); left:0; right:0; z-index:100;
  background:var(--pr-surface); border:1px solid var(--pr-border);
  border-radius:10px; overflow:hidden;
  box-shadow:0 8px 24px rgba(0,0,0,0.3);
  max-height:220px; overflow-y:auto;
}
.suggestion-item {
  display:flex; align-items:flex-start; gap:10px;
  padding:10px 14px; width:100%; border:none; background:transparent;
  cursor:pointer; text-align:left; transition:background 0.12s;
}
.suggestion-item:hover { background:var(--pr-surface2); }
.suggestion-item:not(:last-child) { border-bottom:1px solid var(--pr-border); }
.suggestion-icon { font-size:14px; flex-shrink:0; margin-top:1px; }
.suggestion-name { font-size:13px; font-weight:600; color:var(--pr-text); margin:0 0 1px; }
.suggestion-full { font-size:11px; color:var(--pr-muted); margin:0; }

/* Pick-on-map button */
.pick-on-map-btn {
  display:inline-flex; align-items:center; gap:5px;
  padding:6px 12px; border-radius:8px; margin-top:4px;
  background:var(--pr-surface2); border:1px solid var(--pr-border);
  color:var(--pr-text); font-size:12px; font-weight:600; cursor:pointer;
  transition:background 0.15s, border-color 0.15s;
}
.pick-on-map-btn:hover { background:rgba(255,107,53,0.1); border-color:rgba(255,107,53,0.35); }

.dest-confirmed {
  font-size:11px; color:var(--pr-teal); margin:4px 0 0; font-weight:600;
}

.advice-box {
  display:flex; align-items:flex-start; gap:10px; padding:11px 14px; border-radius:10px;
  background:rgba(0,212,184,0.06); border:1px solid rgba(0,212,184,0.18);
  font-size:12px; color:var(--pr-muted); line-height:1.5;
}
.error-box {
  padding:11px 14px; border-radius:10px; font-size:13px;
  background:rgba(255,71,71,0.08); border:1px solid rgba(255,71,71,0.25); color:var(--pr-red);
}
.spin { display:inline-block; animation:spinAnim 0.7s linear infinite; }
@keyframes spinAnim { to { transform:rotate(360deg); } }

.slide-down-enter-active { transition:all 0.28s ease; }
.slide-down-leave-active { transition:all 0.18s ease; }
.slide-down-enter-from   { opacity:0; transform:translateY(-10px); }
.slide-down-leave-to     { opacity:0; transform:translateY(-6px); }

/* Driver sheet */
.sheet-overlay {
  position:fixed; inset:0; z-index:500;
  background:rgba(0,0,0,0.55); backdrop-filter:blur(3px);
  display:flex; align-items:flex-end; justify-content:center;
}
.driver-sheet {
  background:var(--pr-surface); border-radius:22px 22px 0 0;
  padding:26px 22px 40px; width:100%; max-width:480px;
  position:relative; text-align:center;
}
.sheet-close {
  position:absolute; top:12px; right:12px; width:28px; height:28px; border-radius:50%;
  background:var(--pr-surface2); border:none; color:var(--pr-muted);
  font-size:13px; cursor:pointer; display:flex; align-items:center; justify-content:center;
}
.sheet-photo {
  width:72px; height:72px; border-radius:50%; overflow:hidden;
  background:rgba(255,107,53,0.15); border:2px solid rgba(255,107,53,0.3);
  display:flex; align-items:center; justify-content:center; margin:0 auto 12px;
}
.sheet-initials { font-size:24px; font-weight:700; color:var(--pr-orange); font-family:var(--font-display); }
.sheet-name { font-size:19px; font-weight:800; margin:0 0 4px; }
.sheet-sub  { font-size:13px; color:var(--pr-muted); margin:0 0 14px; }
.sheet-info { background:var(--pr-surface2); border-radius:10px; padding:10px 14px; margin-bottom:14px; text-align:left; }
.sheet-row  { display:flex; align-items:center; justify-content:space-between; padding:5px 0; }
.sheet-row:not(:last-child) { border-bottom:1px solid var(--pr-border); }
.sheet-key  { font-size:12px; color:var(--pr-muted); }
.sheet-val  { font-size:13px; font-weight:600; }
.sheet-enter-active,.sheet-leave-active { transition:all 0.26s ease; }
.sheet-enter-from,.sheet-leave-to { opacity:0; }
.sheet-enter-from .driver-sheet,.sheet-leave-to .driver-sheet { transform:translateY(100%); }
</style>