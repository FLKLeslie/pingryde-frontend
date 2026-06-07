<!-- pages/driver/dashboard.vue
  ─────────────────────────────────────────────────────────────────
  CHANGES IN THIS VERSION:
  1. Online status PERSISTS across page refreshes using localStorage
     When driver goes online, we save that state. When they refresh,
     we read localStorage and re-emit driverOnline automatically.
  
  2. The toggle stays ON until the driver actively clicks it to go offline.
     It no longer resets when navigating between pages.
  
  3. Better GPS error handling with clear messages.
  ─────────────────────────────────────────────────────────────────
-->
<template>
  <div class="pr-page">

    <!-- Header -->
    <div class="flex items-center justify-between px-5 pt-6 pb-4 pr-safe-top">
      <div>
        <p class="text-xs" style="color: var(--pr-muted)">Welcome back,</p>
        <h2 class="text-xl font-bold">{{ firstName }}</h2>
      </div>
      <div class="flex items-center gap-2">
        <!-- Clear ride history button -->
        <!-- <button
          @click="clearHistory"
          :disabled="clearing"
          style="padding:7px 11px;border-radius:8px;border:1px solid rgba(255,71,71,0.3);background:rgba(255,71,71,0.08);color:var(--pr-red);font-size:11px;font-weight:600;cursor:pointer"
          title="Clear completed/cancelled ride history"
        >
          🗑️
        </button> -->
        <button @click="$router.push('/driver/profile')"
                class="pr-avatar pr-avatar-orange w-10 h-10 text-sm">
          {{ userStore.initials }}
        </button>
      </div>
    </div>

    <div class="px-4 space-y-4 pb-4">

      <!-- ── Online / Offline toggle ──────────────────────────── -->
      <!--
        This is the most important control for a driver.

        HOW PERSISTENCE WORKS:
        When driver taps "Online":
          1. We emit driverOnline(driverId) via socket
          2. Backend saves socketId to MongoDB
          3. We save isOnline=true to localStorage
        
        When driver refreshes the page:
          1. plugins/socket.client.js restores session AND re-emits driverOnline
          2. onMounted here reads localStorage and sets toggle to ON
          3. The driver never loses their online state from a simple refresh
        
        When driver taps "Offline":
          1. Socket disconnects (server auto-sets offline via disconnect event)
          2. We remove online state from localStorage
      -->
      <div class="pr-card py-5">
        <div class="flex items-center justify-between">
          <div class="flex-1 min-w-0 mr-4">
            <p class="font-bold text-base">
              {{ isOnline ? "🟢 You're Online" : "⚫ You're Offline" }}
            </p>
            <p class="text-xs mt-1" style="color: var(--pr-muted)">
              {{ isOnline
                ? 'Receiving ride requests — your location is being shared'
                : 'Toggle to start receiving rides' }}
            </p>
            <!-- GPS error message -->
            <p v-if="locationError" class="text-xs mt-1" style="color: var(--pr-red)">
              ⚠️ {{ locationError }}
            </p>
          </div>
          <!-- Toggle switch -->
          <label class="pr-toggle flex-shrink-0">
            <input type="checkbox" v-model="isOnline" @change="handleToggle" />
            <div class="pr-toggle-track" />
            <div class="pr-toggle-thumb" />
          </label>
        </div>

        <!-- Online indicator bar — visible when online -->
        <div v-if="isOnline"
             class="mt-3 pt-3 flex items-center gap-2"
             style="border-top: 1px solid var(--pr-border)">
          <div class="w-2 h-2 rounded-full animate-pulse" style="background: var(--pr-teal)"></div>
          <p class="text-xs" style="color: var(--pr-teal)">
            Live — passengers can see you on the map and send ride requests
          </p>
        </div>
      </div>

      <!-- ── Vehicle + region info ──────────────────────────────── -->
      <div class="pr-card flex items-center gap-3">
        <span style="font-size: 24px">
          {{ userStore.vehicleType === 'taxi' ? '🚕' : '🏍️' }}
        </span>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium">
            {{ userStore.vehicleType === 'taxi' ? 'Taxi Driver' : 'Motorbike Driver' }}
          </p>
          <p class="text-xs mt-0.5 truncate" style="color: var(--pr-muted)">
            📍 {{ userStore.region || 'Region not set' }}
          </p>
        </div>
        <span :class="`pr-badge pr-badge-${isOnline ? 'active' : 'inactive'}`">
          {{ isOnline ? 'Online' : 'Offline' }}
        </span>
      </div>

      <!-- ── Stats cards ────────────────────────────────────────── -->
      <div>
        <p class="pr-section-label mb-3">Today's overview</p>
        <div class="grid grid-cols-3 gap-3">
          <div class="pr-card text-center py-3 px-2">
            <p class="text-xl font-bold" style="color: var(--pr-teal)">
              {{ stats.completed }}
            </p>
            <p class="text-xs mt-1" style="color: var(--pr-muted)">Completed</p>
          </div>
          <div class="pr-card text-center py-3 px-2">
            <p class="text-xl font-bold" style="color: var(--pr-yellow)">
              {{ rideStore.pendingRequests.length }}
            </p>
            <p class="text-xs mt-1" style="color: var(--pr-muted)">Pending</p>
          </div>
          <div class="pr-card text-center py-3 px-2">
            <p class="text-xl font-bold" style="color: var(--pr-orange)">
              {{ stats.km }} km
            </p>
            <p class="text-xs mt-1" style="color: var(--pr-muted)">Distance</p>
          </div>
        </div>
      </div>

      <!-- ── Recent requests (when online) ─────────────────────── -->
      <div v-if="isOnline">
        <div class="pr-section-header">
          <p class="pr-section-label">Nearby requests</p>
          <NuxtLink to="/driver/requests"
                    class="text-xs font-medium"
                    style="color: var(--pr-teal)">
            See all →
          </NuxtLink>
        </div>

        <div v-if="rideStore.pendingRequests.length > 0" class="space-y-3">
          <!--
            NOTE: Component is now "RideRequestCard" (not DriverRideRequestCard)
            because we moved it to the root components/ folder.
            Nuxt auto-imports it without any import statement needed.
          -->
          <RideRequestCard
            v-for="req in rideStore.pendingRequests.slice(0, 2)"
            :key="req.rideId || req._id"
            :request="req"
            @accept="acceptRide(req)"
          />
        </div>

        <div v-else class="pr-card text-center py-8">
          <p style="font-size: 28px" class="mb-2">🔍</p>
          <p class="text-sm" style="color: var(--pr-muted)">No requests yet</p>
          <p class="text-xs mt-1" style="color: var(--pr-muted)">
            New rides will appear here instantly
          </p>
        </div>
      </div>

      <!-- Offline state prompt -->
      <div v-else class="pr-card text-center py-10">
        <p style="font-size: 36px" class="mb-3">😴</p>
        <p class="font-medium">You are offline</p>
        <p class="text-xs mt-2 mb-4" style="color: var(--pr-muted)">
          Toggle online above to start receiving rides
        </p>
        <button @click="isOnline = true; handleToggle()"
                class="pr-btn pr-btn-primary" style="padding: 12px">
          Go Online Now
        </button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter }      from 'vue-router'
import { useUserStore }   from '~/store/user'
import { useRideStore }   from '~/store/ride'
import { useSocket }      from '~/composables/useSocket'
import { useGeolocation } from '~/composables/useGeolocation'
import { API_BASE }       from '~/utils/api'

const router    = useRouter()
const userStore = useUserStore()
const rideStore = useRideStore()
const { connect, goOnline, acceptRide: socketAccept } = useSocket()
const { getOnce } = useGeolocation()

const firstName     = computed(() => userStore.name.split(' ')[0])
const locationError = ref('')
const stats         = reactive({ completed: 0, km: 0 })

// ── Persistent online state ────────────────────────────────────────
// localStorage key: "pr_driver_online"
// We read this on mount to restore the toggle state after page refresh.
const ONLINE_KEY = 'pr_driver_online'

const isOnline = ref(false)   // controls the toggle checkbox

onMounted(async () => {
  connect()

  // Restore online state from localStorage so toggle survives page refresh
  const wasOnline = localStorage.getItem(ONLINE_KEY) === 'true'
  if (wasOnline && userStore._id) {
    isOnline.value = true
    goOnline(userStore._id)
  }

  // Fetch today's completed ride count for the stats card.
  // We filter by today's date so the counter resets each day.
  if (userStore._id) {
    try {
      const today = new Date()
      today.setHours(0,0,0,0)
      const res = await $fetch(
        `${API_BASE}/rides/driver/${userStore._id}?status=completed&fromDate=${today.toISOString()}`
      )
      stats.completed = res.total || 0
    } catch {
      // Not critical — just leave stats at 0
    }
  }
})

// ── Toggle handler ─────────────────────────────────────────────────
const handleToggle = async () => {
  locationError.value = ''

  if (isOnline.value) {
    // ── Going ONLINE ─────────────────────────────────────────────
    try {
      // GPS is required to go online — backend needs location for ride matching
      const coords = await getOnce()
      console.log('[Dashboard] Going online with coords:', coords)

      // Emit to socket → server.js saves socketId + status:"online" to MongoDB
      // This socketId is later used by rideRoutes.js to send ride notifications
      goOnline(userStore._id)

      // Save online state to localStorage so it survives page refresh
      localStorage.setItem(ONLINE_KEY, 'true')
      userStore.setStatus('online')

    } catch (err) {
      // GPS failed — revert the toggle and show error
      isOnline.value      = false
      locationError.value = 'GPS is required to go online. Please enable location access in your browser settings.'
      localStorage.removeItem(ONLINE_KEY)
    }
  } else {
    // ── Going OFFLINE ─────────────────────────────────────────────
    // Socket disconnect is handled automatically by server.js:
    // when socket disconnects, it sets status:"offline" and socketId:null in DB.
    // We just clean up our local state.
    localStorage.removeItem(ONLINE_KEY)
    userStore.setStatus('offline')
    console.log('[Dashboard] Gone offline')
  }
}

// ── Accept a ride ──────────────────────────────────────────────────
const acceptRide = (req) => {
  const rideId = req.rideId || req._id
  // Emit to socket → server.js marks ride as accepted in MongoDB
  // and emits "rideAccepted" back to this driver
  socketAccept(rideId, userStore._id)
  rideStore.removeRequest(rideId)
  router.push('/driver/map')
}

// ── Clear ride history ─────────────────────────────────────────────
// Deletes completed/cancelled/expired rides for this driver from the DB.
// Pending and accepted rides are never deleted.
const clearing = ref(false)
const clearHistory = async () => {
  if (!confirm('Clear all completed, cancelled and expired ride history?')) return
  clearing.value = true
  try {
    await $fetch(`${API_BASE}/rides/driver/${userStore._id}/clear-history`, {
      method: 'DELETE',
    })
    // Remove from local pending list too (already filtered but clean up)
    rideStore.pendingRequests = rideStore.pendingRequests.filter(
      r => !['completed','cancelled','expired'].includes(r.status)
    )
    alert('History cleared.')
  } catch (err) {
    console.error('Clear history error:', err)
  } finally {
    clearing.value = false
  }
}
</script>