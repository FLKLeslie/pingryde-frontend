<!-- pages/driver/dashboard.vue — DRIVER HOME PAGE -->
<template>
  <div class="pr-page">

    <!-- Header -->
    <div class="flex items-center justify-between px-5 pt-6 pb-4 pr-safe-top">
      <div>
        <p class="text-xs" style="color:var(--pr-muted)">Welcome back,</p>
        <h2 class="text-xl font-bold">{{ firstName }}</h2>
        <!-- Driver's current location shown when online -->
        <p v-if="myLocationLabel" class="text-xs mt-0.5" style="color:var(--pr-teal)">
          📍 {{ myLocationLabel }}
        </p>
      </div>
      <button @click="$router.push('/driver/profile')"
              class="pr-avatar pr-avatar-orange w-10 h-10 text-sm flex-shrink-0">
        {{ userStore.initials }}
      </button>
    </div>

    <div class="px-4 space-y-4 pb-4">

      <!-- ── Online / Offline toggle ──────────────────────────── -->
      <div class="pr-card py-5">
        <div class="flex items-center justify-between">
          <div class="flex-1 min-w-0 mr-4">
            <p class="font-bold text-base">
              {{ isOnline ? "🟢 You're Online" : "⚫ You're Offline" }}
            </p>
            <p class="text-xs mt-1" style="color:var(--pr-muted)">
              {{ isOnline
                ? 'Receiving ride requests — passengers can see you on the map'
                : 'Toggle to start receiving rides' }}
            </p>
            <p v-if="locationError" class="text-xs mt-1" style="color:var(--pr-red)">
              ⚠️ {{ locationError }}
            </p>
          </div>
          <label class="pr-toggle flex-shrink-0">
            <input type="checkbox" v-model="isOnline" @change="handleToggle" />
            <div class="pr-toggle-track" />
            <div class="pr-toggle-thumb" />
          </label>
        </div>
        <div v-if="isOnline"
             class="mt-3 pt-3 flex items-center gap-2"
             style="border-top:1px solid var(--pr-border)">
          <div class="w-2 h-2 rounded-full animate-pulse" style="background:var(--pr-teal)"></div>
          <p class="text-xs" style="color:var(--pr-teal)">
            Live — passengers can see you on the map
          </p>
        </div>
      </div>

      <!-- ── Vehicle + region ───────────────────────────────────── -->
      <div class="pr-card flex items-center gap-3">
        <span style="font-size:24px">
          {{ userStore.vehicleType === 'taxi' ? '🚕' : '🏍️' }}
        </span>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium">
            {{ userStore.vehicleType === 'taxi' ? 'Taxi Driver' : 'Motorbike Driver' }}
          </p>
          <p class="text-xs mt-0.5 truncate" style="color:var(--pr-muted)">
            {{ userStore.region || 'Region not set' }}
          </p>
        </div>
        <span :class="`pr-badge pr-badge-${isOnline ? 'active' : 'inactive'}`">
          {{ isOnline ? 'Online' : 'Offline' }}
        </span>
      </div>

      <!-- ── Stats ──────────────────────────────────────────────── -->
      <!--
        Stats come from two sources:
          1. All-time totals: stored in localStorage so they persist
             across sessions even after clearing ride history in DB.
          2. Accuracy: (completed / accepted) × 100
        Tapping "See full history →" navigates to /driver/history
      -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <p class="pr-section-label">Your stats</p>
          <NuxtLink to="/driver/history"
                    class="text-xs font-medium" style="color:var(--pr-teal)">
            See full history →
          </NuxtLink>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="pr-card text-center py-3 px-2">
            <p class="text-xl font-bold" style="color:var(--pr-teal)">{{ lifetimeStats.completed }}</p>
            <p class="text-xs mt-1" style="color:var(--pr-muted)">Rides Completed</p>
          </div>
          <div class="pr-card text-center py-3 px-2">
            <p class="text-xl font-bold" style="color:var(--pr-orange)">{{ lifetimeStats.accepted }}</p>
            <p class="text-xs mt-1" style="color:var(--pr-muted)">Rides Accepted</p>
          </div>
          <div class="pr-card text-center py-3 px-2">
            <p class="text-xl font-bold" style="color:var(--pr-yellow)">{{ accuracyPct }}%</p>
            <p class="text-xs mt-1" style="color:var(--pr-muted)">Accuracy</p>
          </div>
          <div class="pr-card text-center py-3 px-2">
            <p class="text-xl font-bold" style="color:var(--pr-muted)">{{ lifetimeStats.received }}</p>
            <p class="text-xs mt-1" style="color:var(--pr-muted)">Requests Received</p>
          </div>
        </div>
      </div>

      <!-- ── Active ride shortcut ───────────────────────────────── -->
      <div v-if="rideStore.ride && ['accepted','ongoing'].includes(rideStore.ride.status)"
           class="pr-card flex items-center gap-3 cursor-pointer"
           style="border-color:rgba(0,212,184,0.4)"
           @click="$router.push('/driver/map')">
        <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
             style="background:rgba(0,212,184,0.15)">🚗</div>
        <div class="flex-1">
          <p class="font-semibold text-sm">Active ride in progress</p>
          <p class="text-xs" style="color:var(--pr-muted)">Tap to open the map</p>
        </div>
        <span class="pr-badge pr-badge-active">Live</span>
      </div>

      <!-- ── Recent requests ────────────────────────────────────── -->
      <div v-if="isOnline">
        <div class="pr-section-header">
          <p class="pr-section-label">Nearby requests</p>
          <NuxtLink to="/driver/requests" class="text-xs font-medium" style="color:var(--pr-teal)">
            See all →
          </NuxtLink>
        </div>
        <div v-if="rideStore.pendingRequests.length > 0" class="space-y-3">
          <RideRequestCard
            v-for="req in rideStore.pendingRequests.slice(0,2)"
            :key="req.rideId || req._id"
            :request="req"
            @accept="acceptRide(req)"
          />
        </div>
        <div v-else class="pr-card text-center py-8">
          <p style="font-size:28px" class="mb-2">🔍</p>
          <p class="text-sm" style="color:var(--pr-muted)">No requests yet</p>
          <p class="text-xs mt-1" style="color:var(--pr-muted)">New rides will appear here instantly</p>
        </div>
      </div>

      <!-- Offline state -->
      <div v-else class="pr-card text-center py-10">
        <p style="font-size:36px" class="mb-3">😴</p>
        <p class="font-medium">You are offline</p>
        <p class="text-xs mt-2 mb-4" style="color:var(--pr-muted)">
          Toggle online above to start receiving rides
        </p>
        <button @click="isOnline=true; handleToggle()"
                class="pr-btn pr-btn-primary" style="padding:12px">
          Go Online Now
        </button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter }       from 'vue-router'
import { useUserStore }    from '~/store/user'
import { useRideStore }    from '~/store/ride'
import { useSocket }       from '~/composables/useSocket'
import { useGeolocation }  from '~/composables/useGeolocation'
import { useDriverStats }  from '~/composables/useDriverStats'
import { API_BASE }        from '~/utils/api'

const router    = useRouter()
const userStore = useUserStore()
const rideStore = useRideStore()
const { connect, goOnline, goOffline, acceptRide: socketAccept, broadcastDriverLocation } = useSocket()
const { getOnce, reverseGeocode, startWatching, stopWatching } = useGeolocation()

const firstName       = computed(() => userStore.name?.split(' ')[0] || 'Driver')
const locationError   = ref('')
const myLocationLabel = ref('')

// ── Online state (persisted in localStorage) ───────────────────────
const ONLINE_KEY = 'pr_driver_online'
const isOnline   = ref(false)

// ── Lifetime stats (persisted via useDriverStats) ──────────────────
const { stats: lifetimeStats, increment: incrementStat, accuracy: accuracyPct } =
  useDriverStats(userStore._id)

onMounted(async () => {
  connect()

  // Also re-register any pending ride request count
  // (socket will re-deliver newRide if the driver re-connects)

  const wasOnline = localStorage.getItem(ONLINE_KEY) === 'true'
  if (wasOnline && userStore._id) {
    isOnline.value = true
    goOnline(userStore._id)
    
    // Resume GPS watching and broadcasting
    startWatching((coords) => {
      broadcastDriverLocation(userStore._id, coords.lat, coords.lng)
    })
  }

  // Show driver's current location in the header
  try {
    const coords = await getOnce()
    const name   = await reverseGeocode(coords.lat, coords.lng)
    if (name) myLocationLabel.value = name
  } catch {}
})

onBeforeUnmount(() => {
  // Clean up GPS watching
  if (isOnline.value) {
    stopWatching()
  }
})

// ── Toggle online/offline ──────────────────────────────────────────
const handleToggle = async () => {
  locationError.value = ''
  if (isOnline.value) {
    try {
      const coords = await getOnce()
      goOnline(userStore._id)
      localStorage.setItem(ONLINE_KEY, 'true')
      userStore.setStatus('online')
      
      // Start watching GPS to broadcast location to nearby passengers
      startWatching((coords) => {
        broadcastDriverLocation(userStore._id, coords.lat, coords.lng)
      })
    } catch {
      isOnline.value      = false
      locationError.value = 'GPS is required to go online. Please enable location access.'
      localStorage.removeItem(ONLINE_KEY)
      stopWatching()
    }
  } else {
    goOffline(userStore._id)
    localStorage.removeItem(ONLINE_KEY)
    userStore.setStatus('offline')
    stopWatching()
  }
}

// ── Accept a ride from dashboard ──────────────────────────────────
const acceptRide = (req) => {
  const rideId = req.rideId || req._id
  socketAccept(rideId, userStore._id)
  rideStore.removeRequest(rideId)
  incrementStat('accepted')
  router.push('/driver/map')
}
</script>