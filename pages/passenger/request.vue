<!-- pages/passenger/request.vue
════════════════════════════════════════════════════════════════════
PASSENGER — BOOK A RIDE

Flow:
  1. GPS captured silently on load → map shows nearby drivers immediately
  2. Passenger picks category → picks vehicle → location fields appear
  3. No vehicle pre-selected — user must choose
  4. GPS coords sent to backend for driver proximity + map pins
  5. Text fields (pickup/destination) are what the driver reads
════════════════════════════════════════════════════════════════════ -->
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

    <!-- Map — always visible, shows all online drivers before booking -->
    <div class="map-wrapper">
      <PingMap
        :style="{ height: mapHeight }"
        :passenger-coords="myLocation"
        :nearby-drivers="nearbyDrivers"
        :show-nearby="true"
        @driver-click="openDriverSheet"
      />
      <div class="map-gps-badge">
        <span v-if="locating"       class="gps-pill gps-pill--loading">
          <span class="gps-dot gps-dot--yellow"></span>Getting location...
        </span>
        <span v-else-if="myLocation" class="gps-pill gps-pill--ready">
          <span class="gps-dot gps-dot--teal"></span>{{ userStore.region || 'Location ready' }}
        </span>
        <span v-else class="gps-pill gps-pill--error">
          <span class="gps-dot gps-dot--red"></span>Location unavailable
        </span>
      </div>
    </div>

    <!-- Legend -->
    <div class="map-legend">
      <div class="leg"><div class="leg-dot" style="background:var(--pr-teal)"></div>You</div>
      <div class="leg"><div class="leg-dot" style="background:var(--pr-yellow);border-radius:2px"></div>Taxi</div>
      <div class="leg"><div class="leg-dot" style="background:var(--pr-orange)"></div>Moto</div>
      <span class="leg-hint">Tap a pin for driver info</span>
    </div>

    <!-- Form -->
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

      <!-- STEP 2: Vehicle (normal rides) -->
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

      <!-- STEP 2b: Special vehicle selection -->
      <Transition name="slide-down">
        <div v-if="form.rideCategory === 'special'" class="form-section">
          <p class="form-label">Which vehicle for transport?</p>
          <p style="font-size:12px;color:var(--pr-muted);margin:0">
            Your request will only go to drivers with that vehicle type.
          </p>
          <div class="card-grid">
            <button v-for="veh in specialVehicles" :key="veh.value"
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

      <!-- STEP 3: Location fields — appear once vehicle selected -->
      <Transition name="slide-down">
        <div v-if="showLocationFields" class="form-section">
          <p class="form-label">Trip details</p>
          <div class="loc-row">
            <div class="loc-pin loc-pin--pickup"></div>
            <div class="loc-field">
              <label class="loc-label">Pickup location</label>
              <input v-model="form.pickupDescription" type="text" class="pr-input"
                     placeholder="e.g. Near Total station, Molyko" maxlength="120" />
              <p v-if="myLocation" class="loc-gps">
                📡 GPS: {{ myLocation.lat.toFixed(4) }}, {{ myLocation.lng.toFixed(4) }}
              </p>
              <p v-else class="loc-gps loc-gps--warn">⚠️ GPS not available — enable location</p>
            </div>
          </div>
          <div class="loc-line-wrap"><div class="loc-line"></div></div>
          <div class="loc-row">
            <div class="loc-pin loc-pin--dest"></div>
            <div class="loc-field">
              <label class="loc-label">Destination</label>
              <input v-model="form.destinationDescription" type="text" class="pr-input"
                     placeholder="e.g. Buea Town market" maxlength="120" />
            </div>
          </div>
        </div>
      </Transition>

      <!-- STEP 3b: Special details -->
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
          <!-- Photo placeholder — 72×72 circle -->
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
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter }      from 'vue-router'
import { useUserStore }   from '~/store/user'
import { useRideStore }   from '~/store/ride'
import { useGeolocation } from '~/composables/useGeolocation'
import { API_BASE }       from '~/utils/api'

const router    = useRouter()
const userStore = useUserStore()
const rideStore = useRideStore()
const { getOnce } = useGeolocation()

const myLocation     = ref(null)
const nearbyDrivers  = ref([])
const locating       = ref(true)
const loading        = ref(false)
const errorMsg       = ref('')
const selectedDriver = ref(null)
let nearbyInterval   = null

const firstName = computed(() => userStore.name?.split(' ')[0] || 'there')
const selectedDriverInitials = computed(() =>
  (selectedDriver.value?.name || '??').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)
)
const mapHeight = computed(() => {
  if (typeof window === 'undefined') return '260px'
  return window.innerWidth >= 640 ? '300px' : '240px'
})

const form = reactive({
  rideCategory: '', rideType: '', specialVehicleType: '',
  pickupDescription: '', destinationDescription: '',
  specialRequest: { description: '', cargoType: '', estimatedLoad: '' },
})

// Location fields appear once a vehicle is chosen (or special with vehicle)
const showLocationFields = computed(() =>
  form.rideCategory === 'normal'  && form.rideType !== '' ||
  form.rideCategory === 'special' && form.specialVehicleType !== ''
)

const categories = [
  { value:'normal',  label:'Normal',  sub:'Passenger ride', icon:'🚗', color:'var(--pr-teal)',   bg:'rgba(0,212,184,0.1)' },
  { value:'special', label:'Special', sub:'Cargo/custom',   icon:'📦', color:'var(--pr-yellow)', bg:'rgba(240,192,64,0.1)' },
]
const vehicles = [
  { value:'bike', label:'Motorbike', sub:'Exact pickup',  icon:'🏍️', color:'var(--pr-orange)', bg:'rgba(255,107,53,0.1)' },
  { value:'taxi', label:'Taxi',      sub:'At checkpoint', icon:'🚕', color:'var(--pr-teal)',   bg:'rgba(0,212,184,0.1)' },
]
// Special rides use the same two vehicles as normal rides.
// The vehicle chosen determines WHICH drivers get the request —
// bike requests go only to bike drivers, taxi only to taxi drivers.
const specialVehicles = [
  { value:'bike', label:'Motorbike', sub:'Exact pickup',  icon:'🏍️', color:'var(--pr-orange)', bg:'rgba(255,107,53,0.1)' },
  { value:'taxi', label:'Taxi',      sub:'At checkpoint', icon:'🚕', color:'var(--pr-teal)',   bg:'rgba(0,212,184,0.1)' },
]

const selectCategory = (cat) => { form.rideCategory = cat; form.rideType = ''; form.specialVehicleType = '' }
const openDriverSheet = (driver) => { selectedDriver.value = driver }
const quickSelect = (vehicleType) => {
  form.rideCategory = 'normal'; form.rideType = vehicleType; selectedDriver.value = null
}

const fetchNearby = async () => {
  if (!myLocation.value) return
  try {
    // URL built manually — $fetch params option can silently fail in Nuxt
    const { lat, lng } = myLocation.value
    const data = await $fetch(`${API_BASE}/drivers/nearby?lat=${lat}&lng=${lng}`)
    nearbyDrivers.value = Array.isArray(data) ? data : (data.drivers || [])
  } catch (e) { console.warn('[Request] fetchNearby:', e.message) }
}

onMounted(async () => {
  try {
    myLocation.value = await getOnce()
    rideStore.updatePassengerLocation(myLocation.value)
    await fetchNearby()
    nearbyInterval = setInterval(fetchNearby, 30_000)
  } catch {
    errorMsg.value = 'Could not get location. Enable GPS and refresh.'
  } finally { locating.value = false }
})

onBeforeUnmount(() => { if (nearbyInterval) clearInterval(nearbyInterval) })

const requestRide = async () => {
  errorMsg.value = ''
  if (!myLocation.value)                  { errorMsg.value = 'GPS not available.'; return }
  if (!form.pickupDescription.trim())     { errorMsg.value = 'Please describe your pickup location.'; return }
  if (!form.destinationDescription.trim()){ errorMsg.value = 'Please enter your destination.'; return }
  if (!userStore._id)                     { errorMsg.value = 'You are not logged in.'; return }

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
          lat: myLocation.value.lat, lng: myLocation.value.lng,
          description: form.pickupDescription.trim(),
        },
        destination: { lat:0, lng:0, description: form.destinationDescription.trim() },
        ...(form.rideCategory === 'special' ? { specialRequest: form.specialRequest } : {}),
      },
    })
    rideStore.setRide(res.ride)
    rideStore.updatePassengerLocation(myLocation.value)
    router.push('/passenger/tracking')
  } catch (err) {
    errorMsg.value = err?.data?.error || 'Failed to create ride. Check backend is running.'
  } finally { loading.value = false }
}
</script>

<style scoped>
.page-header {
  display:flex; align-items:center; justify-content:space-between;
  margin-bottom:16px; flex-wrap:wrap; gap:10px;
}
.greeting   { font-size:12px; color:var(--pr-muted); margin:0 0 2px; }
.page-title { font-size:22px; font-weight:800; margin:0; }
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

.map-wrapper  { position:relative; margin-bottom:10px; }
.map-gps-badge{ position:absolute; top:12px; left:12px; z-index:20; }
.gps-pill {
  display:inline-flex; align-items:center; gap:6px; padding:5px 11px;
  border-radius:999px; font-size:12px; font-weight:500; backdrop-filter:blur(8px);
}
.gps-pill--loading { background:rgba(30,42,50,0.9); border:1px solid var(--pr-border); color:var(--pr-muted); }
.gps-pill--ready   { background:rgba(0,212,184,0.14); border:1px solid rgba(0,212,184,0.35); color:var(--pr-teal); }
.gps-pill--error   { background:rgba(255,71,71,0.12); border:1px solid rgba(255,71,71,0.3); color:var(--pr-red); }
.gps-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
.gps-dot--yellow { background:var(--pr-yellow); animation:pulsate 1.2s infinite; }
.gps-dot--teal   { background:var(--pr-teal); }
.gps-dot--red    { background:var(--pr-red); }

.map-legend {
  display:flex; align-items:center; gap:12px; margin-bottom:18px;
  flex-wrap:wrap; font-size:11px; color:var(--pr-muted);
}
.leg { display:flex; align-items:center; gap:5px; }
.leg-dot { width:10px; height:10px; border-radius:50%; }
.leg-hint { margin-left:auto; font-style:italic; }

.form-wrap    { display:flex; flex-direction:column; gap:16px; }
.form-section { display:flex; flex-direction:column; gap:10px; }
.form-label   { font-size:13px; font-weight:700; color:var(--pr-text); margin:0; }

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

.loc-row { display:flex; align-items:flex-start; gap:12px; }
.loc-pin { width:14px; flex-shrink:0; margin-top:28px; display:flex; align-items:center; justify-content:center; }
.loc-pin::before { content:''; display:block; width:12px; height:12px; border-radius:50%; }
.loc-pin--pickup::before { background:var(--pr-teal);   box-shadow:0 0 0 3px rgba(0,212,184,0.2); }
.loc-pin--dest::before   { background:var(--pr-orange); box-shadow:0 0 0 3px rgba(255,107,53,0.2); border-radius:3px; }
.loc-field { flex:1; display:flex; flex-direction:column; gap:4px; }
.loc-label { font-size:11px; font-weight:700; color:var(--pr-muted); text-transform:uppercase; letter-spacing:0.05em; }
.loc-gps   { font-size:10px; color:var(--pr-muted); margin:0; }
.loc-gps--warn { color:var(--pr-yellow); }
.loc-line-wrap { padding-left:6px; padding-top:2px; padding-bottom:2px; }
.loc-line { width:2px; height:14px; background:linear-gradient(to bottom,var(--pr-teal),var(--pr-orange)); opacity:0.45; border-radius:1px; }

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
/* Photo placeholder — 72×72 circle, ready for real photo */
.sheet-photo {
  width:72px; height:72px; border-radius:50%; overflow:hidden;
  background:rgba(255,107,53,0.15); border:2px solid rgba(255,107,53,0.3);
  display:flex; align-items:center; justify-content:center; margin:0 auto 12px;
}
.sheet-initials { font-size:24px; font-weight:700; color:var(--pr-orange); font-family:var(--font-display); }
.sheet-name { font-size:19px; font-weight:800; margin:0 0 4px; }
.sheet-sub  { font-size:13px; color:var(--pr-muted); margin:0 0 14px; }
.sheet-info { background:var(--pr-surface2); border-radius:10px; padding:10px 14px; margin-bottom:14px; text-align:left; }
.sheet-row { display:flex; align-items:center; justify-content:space-between; padding:5px 0; }
.sheet-row:not(:last-child) { border-bottom:1px solid var(--pr-border); }
.sheet-key { font-size:12px; color:var(--pr-muted); }
.sheet-val { font-size:13px; font-weight:600; }

.sheet-enter-active,.sheet-leave-active { transition:all 0.26s ease; }
.sheet-enter-from,.sheet-leave-to { opacity:0; }
.sheet-enter-from .driver-sheet,.sheet-leave-to .driver-sheet { transform:translateY(100%); }
</style>