<!-- pages/passenger/request.vue
  ─────────────────────────────────────────────────────────────────
  PASSENGER — REQUEST RIDE PAGE

  LAYOUT (responsive):
  Mobile:   Map full width, form below it, stacked.
  Desktop:  Map left (60%), form right (40%) — side by side.

  COMPONENT NAME FIX:
  The map component is now <MapView> (not <SharedMapView>).
  It lives at components/MapView.vue so Nuxt names it "MapView".
-->
<template>
  <div class="pr-page">

    <!-- ── Page header ─────────────────────────────────────────── -->
    <div class="page-header">
      <div>
        <p class="greeting">Good to see you,</p>
        <h1 class="page-title">{{ firstName }} 👋</h1>
      </div>
      <!-- Online drivers count badge -->
      <div v-if="nearbyDrivers.length > 0" class="drivers-badge">
        <span class="pulse-dot"></span>
        {{ nearbyDrivers.length }} driver{{ nearbyDrivers.length !== 1 ? 's' : '' }} nearby
      </div>
    </div>

    <!-- ── Main grid: Map + Form ──────────────────────────────────
         On mobile: stacked (column)
         On desktop: side by side (row)
    ─────────────────────────────────────────────────────────────── -->
    <div class="request-grid">

      <!-- LEFT: Map -->
      <div class="map-col">
        <div class="map-wrapper">

          <!--
            MapView component (was incorrectly called SharedMapView before).
            Components in components/ root are auto-imported as their filename.
            components/MapView.vue → <MapView>
          -->
          <MapView
            class="request-map"
            :style="{ height: mapHeight }"
            :passenger-coords="myLocation"
            :nearby-drivers="nearbyDrivers"
            :show-nearby="true"
          />

          <!-- GPS status badge overlaid on map -->
          <div class="map-badge-tl">
            <span v-if="locating" class="status-badge status-locating">
              <span class="badge-dot badge-yellow"></span>
              Locating...
            </span>
            <span v-else class="status-badge status-located">
              <span class="badge-dot badge-teal"></span>
              {{ userStore.region || 'Location ready' }}
            </span>
          </div>

        </div>

        <!-- Map legend — shown on desktop beside the map -->
        <div class="map-legend">
          <div class="legend-item">
            <div class="legend-dot legend-teal"></div>
            <span>You (passenger)</span>
          </div>
          <div class="legend-item">
            <div class="legend-sq legend-yellow"></div>
            <span>Taxi driver</span>
          </div>
          <div class="legend-item">
            <div class="legend-dot legend-orange"></div>
            <span>Motorbike driver</span>
          </div>
        </div>
      </div>

      <!-- RIGHT: Ride form -->
      <div class="form-col">

        <!-- Ride category selection -->
        <div class="form-section">
          <p class="pr-section-label" style="margin-bottom:12px">Ride category</p>
          <div class="pr-grid-2">
            <button
              v-for="cat in categories" :key="cat.value"
              @click="form.rideCategory = cat.value"
              class="type-card"
              :class="{ 'type-card-active': form.rideCategory === cat.value }"
              :style="form.rideCategory === cat.value ? `border-color: ${cat.color}; background: ${cat.bg}` : ''"
            >
              <span class="type-icon">{{ cat.icon }}</span>
              <strong class="type-name">{{ cat.label }}</strong>
              <span class="type-sub">{{ cat.sub }}</span>
            </button>
          </div>
        </div>

        <!-- Vehicle type (normal rides only) -->
        <div v-if="form.rideCategory === 'normal'" class="form-section">
          <p class="pr-section-label" style="margin-bottom:12px">Vehicle type</p>
          <div class="pr-grid-2">
            <button
              v-for="t in rideTypes" :key="t.value"
              @click="form.rideType = t.value"
              class="type-card"
              :class="{ 'type-card-active': form.rideType === t.value }"
              :style="form.rideType === t.value ? `border-color: ${t.color}; background: ${t.bg}` : ''"
            >
              <span class="type-icon">{{ t.icon }}</span>
              <strong class="type-name">{{ t.label }}</strong>
              <span class="type-sub">{{ t.sub }}</span>
            </button>
          </div>
        </div>

        <!-- Special ride fields -->
        <div v-if="form.rideCategory === 'special'" class="form-section space-y-3">
          <div>
            <label class="pr-section-label block mb-2">Description</label>
            <input v-model="form.specialRequest.description" type="text"
                   placeholder="Describe your special request..." class="pr-input" />
          </div>
          <div class="pr-grid-2">
            <div>
              <label class="pr-section-label block mb-2">Cargo type</label>
              <input v-model="form.specialRequest.cargoType" type="text"
                     placeholder="e.g. Furniture" class="pr-input" />
            </div>
            <div>
              <label class="pr-section-label block mb-2">Est. load</label>
              <input v-model="form.specialRequest.estimatedLoad" type="text"
                     placeholder="e.g. 50 kg" class="pr-input" />
            </div>
          </div>
        </div>

        <!-- Error message -->
        <div v-if="errorMsg" class="error-box">⚠️ {{ errorMsg }}</div>

        <!-- Submit -->
        <button
          @click="requestRide"
          :disabled="loading || locating || !myLocation"
          class="pr-btn pr-btn-primary"
        >
          <span v-if="loading" class="animate-spin inline-block">⟳</span>
          <span v-else>📡</span>
          {{ loading ? 'Pinging drivers...' : locating ? 'Getting location...' : 'Ping a Ride' }}
        </button>

      </div>
    </div>
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

const firstName     = computed(() => userStore.name.split(' ')[0] || 'there')
const myLocation    = ref(null)
const nearbyDrivers = ref([])
const locating      = ref(true)
const loading       = ref(false)
const errorMsg      = ref('')

let nearbyInterval = null

// Map height adapts to screen size
const mapHeight = computed(() => {
  if (typeof window === 'undefined') return '280px'
  if (window.innerWidth >= 1024) return '420px'
  if (window.innerWidth >= 640)  return '320px'
  return '260px'
})

const form = reactive({
  rideCategory: 'normal',
  rideType:     'bike',
  specialRequest: { description: '', cargoType: '', estimatedLoad: '' },
})

const categories = [
  { value:'normal',  label:'Normal',  sub:'Standard ride',   icon:'🚗', color:'var(--pr-teal)',   bg:'rgba(0,212,184,0.1)' },
  { value:'special', label:'Special', sub:'Cargo / custom',  icon:'📦', color:'var(--pr-yellow)', bg:'rgba(240,192,64,0.1)' },
]
const rideTypes = [
  { value:'bike', label:'Moto', sub:'Exact pickup', icon:'🏍️', color:'var(--pr-orange)', bg:'rgba(255,107,53,0.1)' },
  { value:'taxi', label:'Taxi', sub:'Checkpoint',   icon:'🚕', color:'var(--pr-teal)',   bg:'rgba(0,212,184,0.1)' },
]

// Fetch nearby online drivers to show on map
const fetchNearby = async () => {
  if (!myLocation.value) return
  try {
    const data = await $fetch(`${API_BASE}/drivers/nearby`, {
      params: { lat: myLocation.value.lat, lng: myLocation.value.lng, type: form.rideType }
    })
    nearbyDrivers.value = Array.isArray(data) ? data : (data.drivers || [])
  } catch (e) {
    console.warn('Nearby fetch failed:', e.message)
  }
}

onMounted(async () => {
  try {
    myLocation.value = await getOnce()
    rideStore.updatePassengerLocation(myLocation.value)
    await fetchNearby()
    nearbyInterval = setInterval(fetchNearby, 30000)
  } catch {
    errorMsg.value = 'Could not get your GPS location. Please enable location access.'
  } finally {
    locating.value = false
  }
})

onBeforeUnmount(() => { if (nearbyInterval) clearInterval(nearbyInterval) })

const requestRide = async () => {
  if (!myLocation.value || !userStore._id) return
  loading.value  = true
  errorMsg.value = ''
  try {
    const res = await $fetch(`${API_BASE}/rides`, {
      method: 'POST',
      body: {
        passengerId:  userStore._id,
        rideCategory: form.rideCategory,
        rideType:     form.rideCategory === 'normal' ? form.rideType : undefined,
        pickup:       { lat: myLocation.value.lat, lng: myLocation.value.lng },
        destination:  { lat: 0, lng: 0 },
        ...(form.rideCategory === 'special' ? { specialRequest: form.specialRequest } : {}),
      },
    })
    rideStore.setRide(res.ride)
    rideStore.updatePassengerLocation(myLocation.value)
    router.push('/passenger/tracking')
  } catch (err) {
    errorMsg.value = err?.data?.error || 'Failed to create ride. Is your backend running on port 5000?'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
/* ── Page header ─────────────────────────────────────────────── */
.page-header {
  display:         flex;
  align-items:     center;
  justify-content: space-between;
  margin-bottom:   24px;
  flex-wrap:       wrap;
  gap:             12px;
}
.greeting    { font-size:12px; color:var(--pr-muted); margin:0 0 2px; }
.page-title  { font-size:22px; font-weight:800; margin:0; }

.drivers-badge {
  display:     flex;
  align-items: center;
  gap:         7px;
  padding:     7px 14px;
  border-radius: 999px;
  font-size:   13px;
  font-weight: 500;
  color:       var(--pr-orange);
  background:  rgba(255,107,53,0.1);
  border:      1px solid rgba(255,107,53,0.25);
}
.pulse-dot {
  width:8px; height:8px; border-radius:50%;
  background:var(--pr-orange);
  animation: pulse 1.5s ease-in-out infinite;
  display:inline-block;
}
@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.3)} }

/* ── Request grid — responsive ───────────────────────────────── */
.request-grid {
  display:        flex;
  flex-direction: column;  /* stacked on mobile */
  gap:            24px;
}
@media (min-width: 1024px) {
  .request-grid {
    flex-direction: row;    /* side by side on desktop */
    align-items:    flex-start;
    gap:            32px;
  }
  .map-col  { flex: 3; }   /* map takes 60% */
  .form-col { flex: 2; }   /* form takes 40% */
}

/* ── Map ─────────────────────────────────────────────────────── */
.map-wrapper {
  position:      relative;
  margin-bottom: 10px;
}
.request-map {
  width:         100%;
  height:        260px;    /* mobile default */
  min-height:    260px;
  border-radius: 12px;
  display:       block;
}
@media (min-width: 640px)  { .request-map { height: 320px; min-height: 320px; } }
@media (min-width: 1024px) { .request-map { height: 420px; min-height: 420px; } }

/* Overlaid status badge on map */
.map-badge-tl { position:absolute; top:12px; left:12px; z-index:15; }
.status-badge {
  display:     flex;
  align-items: center;
  gap:         6px;
  padding:     6px 12px;
  border-radius: 999px;
  font-size:   12px;
  font-weight: 500;
  backdrop-filter: blur(8px);
}
.status-locating {
  background: rgba(36,51,64,0.9);
  border:     1px solid var(--pr-border);
  color:      var(--pr-muted);
}
.status-located {
  background: rgba(0,212,184,0.15);
  border:     1px solid rgba(0,212,184,0.3);
  color:      var(--pr-teal);
}
.badge-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
.badge-yellow { background: var(--pr-yellow); animation: pulse 1.2s infinite; }
.badge-teal   { background: var(--pr-teal); }

/* Map legend */
.map-legend {
  display: flex;
  gap:     16px;
  flex-wrap: wrap;
}
.legend-item {
  display:     flex;
  align-items: center;
  gap:         6px;
  font-size:   11px;
  color:       var(--pr-muted);
}
.legend-dot  { width:12px; height:12px; border-radius:50%; flex-shrink:0; }
.legend-sq   { width:12px; height:12px; border-radius:3px; flex-shrink:0; }
.legend-teal   { background: var(--pr-teal); }
.legend-orange { background: var(--pr-orange); }
.legend-yellow { background: var(--pr-yellow); }

/* ── Form ────────────────────────────────────────────────────── */
.form-section { margin-bottom: 20px; }

.type-card {
  display:        flex;
  flex-direction: column;
  align-items:    center;
  gap:            6px;
  padding:        16px 8px;
  border-radius:  12px;
  border:         1px solid var(--pr-border);
  background:     var(--pr-surface);
  cursor:         pointer;
  transition:     all 0.18s;
  -webkit-tap-highlight-color: transparent;
}
.type-card:hover { border-color: rgba(0,212,184,0.3); }
.type-card-active { border-width: 1.5px !important; }

.type-icon { font-size: 26px; line-height: 1; }
.type-name { font-size: 14px; font-weight: 600; }
.type-sub  { font-size: 11px; color: var(--pr-muted); text-align: center; }

.error-box {
  padding:      12px 16px;
  border-radius:10px;
  margin-bottom:16px;
  font-size:    13px;
  background:   rgba(255,71,71,0.08);
  border:       1px solid rgba(255,71,71,0.25);
  color:        var(--pr-red);
}
</style>