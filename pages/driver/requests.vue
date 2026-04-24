<!-- pages/driver/requests.vue — Improved with dropdown filters + vehicle type separation -->
<template>
  <div class="pr-page">

    <div class="req-header">
      <div>
        <h1 class="req-title">Ride Requests</h1>
        <p class="req-sub">
          {{ loading ? 'Loading...' : `${allRides.length + rideStore.pendingRequests.length} available` }}
        </p>
      </div>
      <button @click="fetchRides" :disabled="loading" class="refresh-btn">
        <span :class="{ 'pr-spin': loading }">⟳</span>
      </button>
    </div>

    <!-- ── FILTER ROW ───────────────────────────────────────────── -->
    <div class="filter-row">

      <!-- Region dropdown (replaces scrollable chips) -->
      <div class="filter-group">
        <label class="filter-label">Region</label>
        <select v-model="filters.region" class="pr-input pr-select filter-select" @change="fetchRides">
          <option value="">All Regions</option>
          <option v-for="r in REGIONS" :key="r" :value="r">{{ r }}</option>
        </select>
      </div>

      <!-- Ride type filter — only shows driver's vehicle type + special -->
      <div class="filter-group">
        <label class="filter-label">Type</label>
        <select v-model="filters.rideType" class="pr-input pr-select filter-select" @change="fetchRides">
          <option value="">All types</option>
          <!-- Drivers only see their own vehicle type in normal rides -->
          <option :value="userStore.vehicleType">
            {{ userStore.vehicleType === 'bike' ? '🏍️ Bike only' : '🚕 Taxi only' }}
          </option>
          <option value="special">📦 Special rides</option>
        </select>
      </div>

      <!-- Date filter -->
      <div class="filter-group">
        <label class="filter-label">From date</label>
        <input v-model="filters.fromDate" type="date" class="pr-input filter-input" @change="fetchRides" />
      </div>

    </div>

    <!-- ── LIVE REQUESTS (socket) ──────────────────────────────── -->
    <div v-if="rideStore.pendingRequests.length > 0" style="margin-bottom:24px">
      <div class="pr-section-header">
        <p class="pr-section-label">🔴 Live — just arrived</p>
        <span class="live-badge">{{ rideStore.pendingRequests.length }} new</span>
      </div>
      <div class="pr-animate-stagger" style="display:flex;flex-direction:column;gap:12px">
        <RideRequestCard
          v-for="req in rideStore.pendingRequests"
          :key="req.rideId || req._id"
          :request="req"
          @accept="acceptRide(req)"
        />
      </div>
    </div>

    <!-- Divider -->
    <div v-if="rideStore.pendingRequests.length > 0 && allRides.length > 0" class="pr-divider" style="margin-bottom:20px" />

    <!-- ── REST-FETCHED RIDES ───────────────────────────────────── -->
    <div v-if="allRides.length > 0">
      <p v-if="rideStore.pendingRequests.length > 0" class="pr-section-label" style="margin-bottom:12px">
        Earlier requests
      </p>
      <div class="pr-animate-stagger" style="display:flex;flex-direction:column;gap:12px">
        <RideRequestCard
          v-for="ride in allRides"
          :key="ride._id"
          :request="ride"
          @accept="acceptRide(ride)"
        />
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-if="!loading && allRides.length === 0 && rideStore.pendingRequests.length === 0"
      style="text-align:center;padding:64px 0"
    >
      <p style="font-size:36px;margin-bottom:12px">📭</p>
      <p style="font-weight:600;margin-bottom:6px">No requests found</p>
      <p style="font-size:13px;color:var(--pr-muted)">
        Try clearing filters or going online to receive new requests
      </p>
    </div>

    <!-- Error -->
    <div v-if="errorMsg" class="pr-error">⚠️ {{ errorMsg }}</div>

  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter }    from 'vue-router'
import { useUserStore } from '~/store/user'
import { useRideStore } from '~/store/ride'
import { useSocket }    from '~/composables/useSocket'
import { API_BASE }     from '~/utils/api'

const router    = useRouter()
const userStore = useUserStore()
const rideStore = useRideStore()
const { acceptRide: socketAccept } = useSocket()

const REGIONS = ['North West','South West','Littoral','Centre','West','East','Far North','North','Adamawa','South']

const allRides = ref([])
const loading  = ref(false)
const errorMsg = ref('')

// Filters object — all filters in one place for easy management
const filters = reactive({
  region:    '',
  rideType:  userStore.vehicleType || '',   // default to driver's own vehicle type
  fromDate:  '',
})

// Fetch from backend with all active filters
const fetchRides = async () => {
  if (!userStore._id) return
  loading.value  = true
  errorMsg.value = ''
  try {
    const params = new URLSearchParams({ status: 'pending' })
    if (filters.region)   params.set('region', filters.region)
    if (filters.rideType) {
      // "special" maps to rideCategory, not rideType
      if (filters.rideType === 'special') params.set('rideCategory', 'special')
      else params.set('rideType', filters.rideType)
    }
    if (filters.fromDate) params.set('fromDate', filters.fromDate)

    const res = await $fetch(`${API_BASE}/rides/driver/${userStore._id}?${params.toString()}`)
    allRides.value = res.rides || []
  } catch (err) {
    errorMsg.value = err?.data?.error || 'Failed to load rides'
  } finally {
    loading.value = false
  }
}

onMounted(fetchRides)

const acceptRide = (req) => {
  const rideId = req.rideId || req._id
  socketAccept(rideId, userStore._id)
  rideStore.removeRequest(rideId)
  allRides.value = allRides.value.filter(r => r._id !== rideId)
  router.push('/driver/map')
}
</script>

<style scoped>
.req-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }
.req-title  { font-size:22px; font-weight:800; margin:0 0 3px; }
.req-sub    { font-size:12px; color:var(--pr-muted); margin:0; }

.refresh-btn {
  width:38px; height:38px; border-radius:50%;
  background:var(--pr-surface2); border:1px solid var(--pr-border);
  font-size:17px; cursor:pointer; display:flex; align-items:center; justify-content:center;
  transition:background 0.15s;
}
.refresh-btn:hover { background:rgba(0,212,184,0.1); }

/* Filter row — responsive grid */
.filter-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  margin-bottom: 24px;
}
@media (min-width: 640px) {
  .filter-row { grid-template-columns: 1fr 1fr 1fr; }
}

.filter-group { display:flex; flex-direction:column; gap:6px; }
.filter-label { font-size:10px; font-weight:700; color:var(--pr-muted); text-transform:uppercase; letter-spacing:0.08em; }
.filter-select, .filter-input { font-size:13px; padding:10px 14px; }

.live-badge {
  font-size:11px; font-weight:700; padding:3px 8px; border-radius:999px;
  background:rgba(255,71,71,0.12); color:var(--pr-red);
  animation:livePulse 2s ease-in-out infinite;
}
@keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
</style>