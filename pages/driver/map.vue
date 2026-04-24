<!-- pages/driver/map.vue

  DRIVER'S ACTIVE RIDE MAP
  ─────────────────────────────────────────────────────────────────
  Shows after driver accepts a ride.
  
  WHAT THIS PAGE DOES:
  1. Joins the ride's private socket room
  2. Starts sending GPS every ~2 seconds via "driverLocationUpdate"
     → Server forwards this to passenger as "driverLocation"
     → Passenger's map marker moves in real-time
  3. Shows the passenger's position on the map (when available)
  4. "Complete Ride" button emits "completeRide" socket event
     → Server marks ride completed in MongoDB
     → Both parties get "rideCompleted" event
     → Both return to home screens

  SOCKET EVENTS:
    EMIT: "joinRide" { rideId }
    EMIT: "driverLocationUpdate" { rideId, lat, lng }
    EMIT: "completeRide" { rideId }
    RECEIVE: "rideCompleted" (handled in useSocket.js)
-->
<template>
  <div class="pr-page flex flex-col">

    <!-- Header -->
    <div class="px-5 pt-6 pb-3 pr-safe-top">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-xs" style="color: var(--pr-muted)">Active Ride</p>
          <h2 class="text-lg font-bold">En Route</h2>
        </div>
        <span class="pr-badge pr-badge-active">Ongoing</span>
      </div>
    </div>

    <!-- No active ride guard — shown if driver lands here without a ride -->
    <div v-if="!rideStore.ride"
         class="flex-1 flex flex-col items-center justify-center px-6 text-center py-16">
      <p style="font-size: 40px" class="mb-3">🚗</p>
      <p class="font-semibold mb-2">No active ride</p>
      <p class="text-sm mb-5" style="color: var(--pr-muted)">
        Accept a ride request from the Requests tab to see the map.
      </p>
      <button @click="$router.push('/driver/requests')"
              class="pr-btn pr-btn-primary" style="width:auto;padding:13px 28px">
        View Requests
      </button>
    </div>

    <template v-else>
      <!-- Map — fills most of screen
           passengerCoords = teal person icon (updated via rideStore)
           driverCoords    = our own GPS position
      -->
      <div class="px-4 mb-3">
        <SharedMapView
          height="340px"
          :passenger-coords="rideStore.passengerLocation"
          :driver-coords="myLocation"
          :driver-type="rideStore.ride.rideType || 'bike'"
        />
      </div>

      <div class="px-4 space-y-3 pb-6">

        <!-- GPS status indicator -->
        <div class="flex items-center gap-2 px-1">
          <div
            class="w-2 h-2 rounded-full flex-shrink-0"
            :style="myLocation
              ? 'background: var(--pr-teal); animation: pulse 2s infinite'
              : 'background: var(--pr-yellow)'"
          />
          <p class="text-xs" style="color: var(--pr-muted)">
            {{ myLocation
              ? `📡 Broadcasting location (${myLocation.lat.toFixed(4)}, ${myLocation.lng.toFixed(4)})`
              : '📡 Acquiring GPS signal...' }}
          </p>
        </div>

        <!-- Passenger info card -->
        <div class="pr-card">
          <div class="flex items-center gap-3 mb-3">
            <div class="pr-avatar pr-avatar-teal w-11 h-11 text-sm flex-shrink-0">
              {{ passengerInitials }}
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-semibold truncate">{{ passengerName }}</p>
              <p class="text-xs mt-0.5" style="color: var(--pr-muted)">
                {{ rideStore.ride.rideType === 'bike' ? '🏍️ Exact pickup' : '🚕 Checkpoint' }}
                · {{ rideStore.ride.region || '' }}
              </p>
            </div>
            <!-- Call passenger button -->
            <a v-if="passengerPhone"
               :href="`tel:+237${passengerPhone}`"
               class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
               style="background:rgba(0,212,184,0.12);border:1px solid rgba(0,212,184,0.3);font-size:16px;text-decoration:none">
              📞
            </a>
          </div>
          <div class="pr-divider mb-3" />
          <p class="text-xs" style="color: var(--pr-muted)">
            🧭 Move toward the teal person icon — they are also moving toward you.
          </p>
        </div>

        <!-- Complete ride -->
        <button @click="handleComplete" class="pr-btn pr-btn-secondary">
          ✅ Complete Ride
        </button>

        <!-- Cancel (emergency) -->
        <button @click="handleCancel" class="pr-btn pr-btn-danger"
                style="font-size:14px;padding:12px">
          Cancel Ride
        </button>

      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter }      from 'vue-router'
import { useRideStore }   from '~/store/ride'
import { useUserStore }   from '~/store/user'
import { useSocket }      from '~/composables/useSocket'
import { useGeolocation } from '~/composables/useGeolocation'

const router    = useRouter()
const rideStore = useRideStore()
const userStore = useUserStore()
const { joinRide, sendDriverLocation, completeRide } = useSocket()
const { startWatching, stopWatching }                = useGeolocation()

// Our own GPS position (different from rideStore.driverLocation
// which is for the other party's position on the passenger's map)
const myLocation = ref(null)

// Passenger info — read from populated ride.passengerId
const passengerName  = computed(() => {
  const p = rideStore.ride?.passengerId
  if (p && typeof p === 'object') return p.name || 'Passenger'
  return 'Passenger'
})
const passengerPhone = computed(() => {
  const p = rideStore.ride?.passengerId
  if (p && typeof p === 'object') return p.phone || ''
  return ''
})
const passengerInitials = computed(() =>
  passengerName.value.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
)

onMounted(() => {
  if (!rideStore.ride) return

  // Join the ride's private socket room so we can exchange GPS
  joinRide(rideStore.ride._id)

  // Start streaming our GPS to the passenger every ~2 seconds
  // sendDriverLocation emits "driverLocationUpdate" to server
  // server forwards to passenger as "driverLocation"
  startWatching((coords) => {
    myLocation.value = coords
    if (rideStore.ride?._id) {
      sendDriverLocation(rideStore.ride._id, coords.lat, coords.lng)
    }
  })
})

// Always stop GPS watcher when leaving this page
onBeforeUnmount(() => stopWatching())

// Mark the ride complete
const handleComplete = () => {
  if (rideStore.ride?._id) {
    // Emit "completeRide" socket event
    // server.js marks ride as completed in MongoDB
    // and emits "rideCompleted" to everyone in the ride room
    completeRide(rideStore.ride._id)
  }
  rideStore.clearRide()
  // Set driver back to online (ready for next ride)
  userStore.setStatus('online')
  router.push('/driver/dashboard')
}

const handleCancel = () => {
  rideStore.clearRide()
  userStore.setStatus('online')
  router.push('/driver/dashboard')
}
</script>