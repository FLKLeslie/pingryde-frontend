<!-- ─────────────────────────────────────────────────────────────────
  pages/driver/requests.vue
  DRIVER — RIDE REQUESTS PAGE

  WHAT THIS PAGE SHOWS:
  1. "Live" section — rides that arrived via socket (newRide event)
     while the driver is on this page. These show at the top with
     an orange "New request" strip and a pulsing dot.
  2. "Earlier" section — pending rides fetched from the REST API.
     These are rides that were created before the driver opened this
     page, retrieved via GET /api/rides/driver/:driverId.
  3. Filters: region, ride type, from-date.

  ACCEPTING A RIDE:
  The driver taps "Accept Ride" on a card → we emit the acceptRide
  socket event → server marks the ride accepted + notifies the
  passenger → we navigate to /driver/map.

  NOTE: Clear History is NOT on this page. It lives on the driver's
  ride history page (if you build one) or profile page.
──────────────────────────────────────────────────────────────────── -->
<template>
  <div class="pr-page">

    <!-- ── Page header ──────────────────────────────────────────── -->
    <div class="req-header">
      <div>
        <h1 class="req-title">Ride Requests</h1>
        <p class="req-sub">
          {{ loading
              ? 'Loading...'
              : `${totalCount} request${totalCount !== 1 ? 's' : ''} available` }}
        </p>
      </div>

      <!-- Manual refresh button -->
      <button @click="fetchRides" :disabled="loading" class="refresh-btn" title="Refresh">
        <span :class="{ 'spin': loading }">⟳</span>
      </button>
    </div>

    <!-- ── Filters ───────────────────────────────────────────────── -->
    <div class="filter-row">

      <!-- Region filter -->
      <div class="filter-group">
        <label class="filter-label">Region</label>
        <select v-model="filters.region" class="pr-input pr-select filter-input" @change="fetchRides">
          <option value="">All regions</option>
          <option v-for="r in REGIONS" :key="r" :value="r">{{ r }}</option>
        </select>
      </div>

      <!-- Vehicle type filter -->
      <div class="filter-group">
        <label class="filter-label">Type</label>
        <select v-model="filters.rideType" class="pr-input pr-select filter-input" @change="fetchRides">
          <option value="">All types</option>
          <option :value="userStore.vehicleType">
            {{ userStore.vehicleType === 'bike' ? '🏍️ Bike only' : '🚕 Taxi only' }}
          </option>
          <option value="special">📦 Special</option>
        </select>
      </div>

      <!-- Date filter -->
      <div class="filter-group">
        <label class="filter-label">From date</label>
        <input v-model="filters.fromDate" type="date" class="pr-input filter-input" @change="fetchRides" />
      </div>

    </div>

    <!-- ══ LIVE REQUESTS (received via socket while page is open) ══
         These arrive through the newRide / newRideBroadcast events
         and are stored in rideStore.pendingRequests.
    ════════════════════════════════════════════════════════════ -->
    <div v-if="rideStore.pendingRequests.length > 0" class="section">
      <div class="section-header">
        <p class="pr-section-label">🔴 Live — just arrived</p>
        <span class="live-badge">{{ rideStore.pendingRequests.length }} new</span>
      </div>
      <div class="cards-list">
        <RideRequestCard
          v-for="req in rideStore.pendingRequests"
          :key="req.rideId || req._id"
          :request="req"
          @accept="handleAccept(req)"
        />
      </div>
    </div>

    <!-- Divider between live and earlier sections -->
    <div
      v-if="rideStore.pendingRequests.length > 0 && fetchedRides.length > 0"
      class="pr-divider"
      style="margin: 8px 0 20px"
    />

    <!-- ══ EARLIER REQUESTS (fetched from REST API) ════════════════
         These are pending rides that already existed when the driver
         opened this page.
    ════════════════════════════════════════════════════════════ -->
    <div v-if="fetchedRides.length > 0" class="section">
      <p v-if="rideStore.pendingRequests.length > 0"
         class="pr-section-label"
         style="margin-bottom:12px">
        Earlier requests
      </p>
      <div class="cards-list">
        <RideRequestCard
          v-for="ride in fetchedRides"
          :key="ride._id"
          :request="ride"
          @accept="handleAccept(ride)"
        />
      </div>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="loading-list">
      <div v-for="i in 3" :key="i" class="loading-card"></div>
    </div>

    <!-- Empty state -->
    <div
      v-if="!loading && totalCount === 0"
      class="empty-state"
    >
      <p class="empty-icon">📭</p>
      <p class="empty-title">No requests found</p>
      <p class="empty-sub">
        Go online on the Dashboard to start receiving new ride requests.
        <br>Try clearing filters if you expect to see something.
      </p>
    </div>

    <!-- Error message -->
    <div v-if="errorMsg" class="error-msg">⚠️ {{ errorMsg }}</div>

  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter }    from 'vue-router'
import { useUserStore } from '~/store/user'
import { useRideStore } from '~/store/ride'
import { useSocket }    from '~/composables/useSocket'
import { API_BASE }     from '~/utils/api'

const router    = useRouter()
const userStore = useUserStore()
const rideStore = useRideStore()

// We only need the acceptRide emitter from useSocket here
const { acceptRide: socketAcceptRide } = useSocket()

// All Cameroon regions for the filter dropdown
const REGIONS = [
  'North West','South West','Littoral','Centre','West',
  'East','Far North','North','Adamawa','South',
]

// ── State ──────────────────────────────────────────────────────────
const fetchedRides = ref([])    // rides loaded from the REST API
const loading      = ref(false)
const errorMsg     = ref('')

// Filters — all in one reactive object
const filters = reactive({
  region:   '',
  rideType: userStore.vehicleType || '',   // default: driver's own vehicle type
  fromDate: '',
})

// Total shown (live socket + fetched from API)
const totalCount = computed(() =>
  rideStore.pendingRequests.length + fetchedRides.value.length
)

// ── Fetch rides from REST API ──────────────────────────────────────
// Called on mount and whenever a filter changes.
const fetchRides = async () => {
  if (!userStore._id) return
  loading.value  = true
  errorMsg.value = ''

  try {
    const params = new URLSearchParams({ status: 'pending' })
    if (filters.region)   params.set('region', filters.region)
    if (filters.rideType) {
      // 'special' maps to rideCategory, not rideType
      if (filters.rideType === 'special') params.set('rideCategory', 'special')
      else                                params.set('rideType', filters.rideType)
    }
    if (filters.fromDate) params.set('fromDate', filters.fromDate)

    const res = await $fetch(`${API_BASE}/rides/driver/${userStore._id}?${params}`)
    fetchedRides.value = res.rides || []
  } catch (err) {
    errorMsg.value = err?.data?.error || 'Failed to load ride requests. Try refreshing.'
  } finally {
    loading.value = false
  }
}

onMounted(fetchRides)

// ── Handle accept ──────────────────────────────────────────────────
// 1. Emit the acceptRide socket event so the server processes it
// 2. Remove the ride from both local lists (optimistic update)
// 3. Navigate to the active ride map
const handleAccept = (req) => {
  const rideId = req.rideId?.toString() || req._id?.toString()
  if (!rideId || !userStore._id) return

  // Tell the server this driver is accepting
  socketAcceptRide(rideId, userStore._id)

  // Optimistically remove from both lists so it disappears immediately
  rideStore.removeRequest(rideId)
  fetchedRides.value = fetchedRides.value.filter(r => r._id?.toString() !== rideId)

  // Navigate to the map page where the driver tracks the passenger
  router.push('/driver/map')
}
</script>

<style scoped>
/* ── Header ──────────────────────────────────────────────────── */
.req-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 18px;
}
.req-title { font-size: 22px; font-weight: 800; margin: 0 0 3px; }
.req-sub   { font-size: 12px; color: var(--pr-muted); margin: 0; }

.refresh-btn {
  width: 38px; height: 38px; border-radius: 50%;
  background: var(--pr-surface2); border: 1px solid var(--pr-border);
  font-size: 18px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s, transform 0.15s;
}
.refresh-btn:hover  { background: rgba(0,212,184,0.1); }
.refresh-btn:active { transform: scale(0.92); }
.spin { display: inline-block; animation: spinAnim 0.8s linear infinite; }
@keyframes spinAnim { to { transform: rotate(360deg); } }

/* ── Filters ─────────────────────────────────────────────────── */
.filter-row {
  display: grid; grid-template-columns: 1fr; gap: 10px; margin-bottom: 22px;
}
@media (min-width: 640px) { .filter-row { grid-template-columns: 1fr 1fr 1fr; } }

.filter-group  { display: flex; flex-direction: column; gap: 5px; }
.filter-label  {
  font-size: 10px; font-weight: 700; color: var(--pr-muted);
  text-transform: uppercase; letter-spacing: 0.08em;
}
.filter-input  { font-size: 13px; padding: 9px 12px; }

/* ── Sections ────────────────────────────────────────────────── */
.section        { margin-bottom: 20px; }
.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.cards-list     { display: flex; flex-direction: column; gap: 12px; }

.live-badge {
  font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px;
  background: rgba(255,71,71,0.12); color: var(--pr-red);
  animation: livePulse 2s ease-in-out infinite;
}
@keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.55} }

/* ── Loading skeleton ────────────────────────────────────────── */
.loading-list { display: flex; flex-direction: column; gap: 12px; }
.loading-card {
  height: 140px; border-radius: 14px;
  background: var(--pr-surface2);
  animation: shimmer 1.4s ease-in-out infinite;
}
@keyframes shimmer {
  0%,100% { opacity: 0.6; }
  50%     { opacity: 1; }
}

/* ── Empty state ─────────────────────────────────────────────── */
.empty-state { text-align: center; padding: 60px 20px; }
.empty-icon  { font-size: 40px; margin-bottom: 12px; }
.empty-title { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
.empty-sub   { font-size: 13px; color: var(--pr-muted); line-height: 1.6; }

/* ── Error ───────────────────────────────────────────────────── */
.error-msg {
  padding: 12px 16px; border-radius: 10px; font-size: 13px;
  background: rgba(255,71,71,0.08); border: 1px solid rgba(255,71,71,0.25);
  color: var(--pr-red);
}
</style>