<!-- pages/driver/map.vue
════════════════════════════════════════════════════════════════════
DRIVER — ACTIVE RIDE MAP

Critical sequence on mount:
  1. connect()    — open socket (MUST be first, else joinRide is a no-op)
  2. goOnline()   — save socketId to DB so server can target this driver
  3. joinRide()   — enter the private ride room
  4. startWatching() — stream driver GPS every ~2s

How the passenger appears on the map:
  • Passenger's tracking page emits 'passengerLocationUpdate' every ~2s
  • backend/server.js forwards it as 'passengerLocation' to the ride room
  • useSocket's listener calls rideStore.updatePassengerLocation(coords)
  • PingMap watches passengerCoords prop and moves the teal pin
════════════════════════════════════════════════════════════════════ -->
<template>
  <div class="pr-page flex flex-col">

    <!-- Header -->
    <div class="px-5 pt-6 pb-3 pr-safe-top">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-xs" style="color:var(--pr-muted)">Active Ride</p>
          <h2 class="text-lg font-bold">En Route</h2>
        </div>
        <div class="flex items-center gap-2">
          <button class="chat-fab" @click="chatOpen = !chatOpen">
            💬
            <span v-if="unreadCount > 0" class="unread-dot">{{ unreadCount }}</span>
          </button>
          <span class="pr-badge pr-badge-active">Ongoing</span>
        </div>
      </div>
    </div>

    <!-- No active ride -->
    <div v-if="!rideStore.ride"
         class="flex-1 flex flex-col items-center justify-center px-6 text-center py-16">
      <p style="font-size:40px" class="mb-3">🚗</p>
      <p class="font-semibold mb-2">No active ride</p>
      <p class="text-sm mb-5" style="color:var(--pr-muted)">Accept a request first.</p>
      <button @click="$router.push('/driver/requests')"
              class="pr-btn pr-btn-primary" style="width:auto;padding:13px 28px">
        View Requests
      </button>
    </div>

    <template v-else>

      <!--
        PingMap with role="driver":
          • Centres on the driver's own GPS (driverCoords)
          • Teal pin = passenger (rideStore.passengerLocation — updated by socket)
          • Vehicle pin = driver (myLocation — updated by device GPS)
          • Auto-pans to keep driver centred
      -->
      <div style="padding:0 16px 12px;">
        <PingMap
          height="340px"
          role="driver"
          :passenger-coords="rideStore.passengerLocation"
          :driver-coords="myLocation"
          :driver-type="rideStore.ride.rideType || 'bike'"
        />
      </div>

      <div class="px-4 space-y-3 pb-6">

        <!-- GPS status -->
        <div class="flex items-center gap-2 px-1">
          <div class="w-2 h-2 rounded-full flex-shrink-0"
               :style="myLocation
                 ? 'background:var(--pr-teal);animation:pulse 2s infinite'
                 : 'background:var(--pr-yellow)'" />
          <p class="text-xs" style="color:var(--pr-muted)">
            {{ myLocation ? '📡 Broadcasting your location' : '📡 Acquiring GPS...' }}
          </p>
        </div>

        <!-- Passenger card -->
        <div class="pr-card">
          <div class="flex items-center gap-3 mb-3">
            <!-- Photo placeholder — replace <span> with <img> when photos are ready -->
            <div class="passenger-avatar">
              <span>{{ passengerInitials }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-semibold truncate">{{ passengerName }}</p>
              <p class="text-xs mt-0.5" style="color:var(--pr-muted)">
                {{ rideStore.ride.rideType === 'bike' ? '🏍️ Exact pickup' : '🚕 Checkpoint' }}
                <span v-if="rideStore.ride.region"> · {{ rideStore.ride.region }}</span>
              </p>
            </div>
            <a v-if="passengerPhone" :href="`tel:+237${passengerPhone}`"
               class="icon-action-btn">📞</a>
            <button @click="chatOpen = true" class="icon-action-btn relative">
              💬
              <span v-if="unreadCount > 0" class="unread-dot unread-dot--sm">{{ unreadCount }}</span>
            </button>
          </div>

          <!-- Trip pickup + destination -->
          <div v-if="pickupDesc || destDesc" class="trip-block">
            <div v-if="pickupDesc" class="trip-row">
              <span style="color:var(--pr-teal)">📍</span><span>{{ pickupDesc }}</span>
            </div>
            <div v-if="destDesc" class="trip-row">
              <span style="color:var(--pr-orange)">🏁</span><span>{{ destDesc }}</span>
            </div>
          </div>

          <div class="pr-divider mb-2" />
          <p class="text-xs" style="color:var(--pr-muted)">
            🧭 The teal pin is the passenger — head to their location.
            They have been advised to stand somewhere visible.
          </p>
        </div>

        <button @click="handleComplete" class="pr-btn pr-btn-secondary">✅ Mark as Complete</button>
        <button @click="handleCancel"   class="pr-btn pr-btn-danger" style="font-size:14px;padding:12px">Cancel Ride</button>

      </div>
    </template>

    <!-- Chat panel -->
    <Transition name="chat-slide">
      <div v-if="chatOpen" class="chat-panel">
        <div class="chat-hdr">
          <p class="chat-hdr-title">💬 {{ passengerName }}</p>
          <button @click="chatOpen = false" class="chat-hdr-close">✕</button>
        </div>
        <div class="chat-msgs" ref="chatEl">
          <p v-if="!rideStore.chatMessages.length" class="chat-empty">No messages yet. Say hello! 👋</p>
          <div v-for="(m, i) in rideStore.chatMessages" :key="i"
               class="bubble-row" :class="m.sender === 'driver' ? 'bubble-row--mine' : 'bubble-row--theirs'">
            <p class="bubble">{{ m.text }}</p>
            <span class="bubble-time">{{ fmtTime(m.sentAt) }}</span>
          </div>
        </div>
        <div class="chat-footer">
          <input v-model="chatText" class="chat-input" type="text"
                 placeholder="Type a message..." maxlength="300" @keydown.enter="sendChat" />
          <button @click="sendChat" class="chat-send" :disabled="!chatText.trim()">Send</button>
        </div>
      </div>
    </Transition>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRouter }      from 'vue-router'
import { useRideStore }   from '~/store/ride'
import { useUserStore }   from '~/store/user'
import { useSocket }      from '~/composables/useSocket'
import { useGeolocation } from '~/composables/useGeolocation'
import { API_BASE }       from '~/utils/api'

const router    = useRouter()
const rideStore = useRideStore()
const userStore = useUserStore()

// MUST destructure connect + goOnline — they are called before joinRide
const { connect, goOnline, joinRide, sendDriverLocation, completeRide } = useSocket()
const { startWatching, stopWatching } = useGeolocation()

const myLocation = ref(null)
const chatOpen   = ref(false)
const chatText   = ref('')
const chatEl     = ref(null)

const passengerName = computed(() => {
  const p = rideStore.ride?.passengerId
  return (p && typeof p === 'object') ? (p.name || 'Passenger') : 'Passenger'
})
const passengerPhone = computed(() => {
  const p = rideStore.ride?.passengerId
  return (p && typeof p === 'object') ? (p.phone || '') : ''
})
const passengerInitials = computed(() =>
  passengerName.value.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)
)
const pickupDesc = computed(() => rideStore.ride?.pickup?.description      || '')
const destDesc   = computed(() => rideStore.ride?.destination?.description || '')

const unreadCount = computed(() =>
  rideStore.chatMessages.filter(m => m.sender === 'passenger' && !m.read).length
)
const fmtTime = (t) =>
  t ? new Date(t).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : ''

watch(() => rideStore.chatMessages.length, async () => {
  await nextTick()
  if (chatEl.value) chatEl.value.scrollTop = chatEl.value.scrollHeight
})
watch(chatOpen, (open) => {
  if (open) rideStore.chatMessages.forEach(m => { if (m.sender==='passenger') m.read=true })
})

onMounted(async () => {
  if (!rideStore.ride) return

  // Step 1 — open socket (must be first)
  connect()
  // Step 2 — register socketId in DB
  if (userStore._id) goOnline(userStore._id)
  // Step 3 — join the ride room
  joinRide(rideStore.ride._id)
  // Step 4 — stream driver GPS
  startWatching((coords) => {
    myLocation.value = coords
    if (rideStore.ride?._id) sendDriverLocation(rideStore.ride._id, coords.lat, coords.lng)
  })
  // Step 5 — load existing chat
  try {
    const res = await $fetch(`${API_BASE}/rides/${rideStore.ride._id}/chat`)
    rideStore.setChatMessages(res.messages || [])
  } catch {}
})

onBeforeUnmount(() => stopWatching())

const sendChat = async () => {
  const text = chatText.value.trim()
  if (!text || !rideStore.ride?._id) return
  chatText.value = ''
  try {
    await $fetch(`${API_BASE}/rides/${rideStore.ride._id}/chat`, {
      method: 'POST', body: { sender: 'driver', text },
    })
  } catch (err) { chatText.value = text }
}

const handleComplete = async () => {
  if (rideStore.ride?._id) completeRide(rideStore.ride._id)
  rideStore.clearRide()
  router.push('/driver/dashboard')
}
const handleCancel = async () => {
  try {
    await $fetch(`${API_BASE}/rides/${rideStore.ride._id}/cancel`, {
      method: 'PATCH', body: { cancelledBy: 'driver' },
    })
  } catch {}
  rideStore.clearRide()
  router.push('/driver/dashboard')
}
</script>

<style scoped>
.passenger-avatar {
  width:44px; height:44px; border-radius:50%; flex-shrink:0; overflow:hidden;
  background:rgba(0,212,184,0.15); border:1.5px solid rgba(0,212,184,0.3);
  display:flex; align-items:center; justify-content:center;
  font-size:14px; font-weight:700; color:var(--pr-teal); font-family:var(--font-display);
}
.icon-action-btn {
  width:40px; height:40px; border-radius:50%; flex-shrink:0;
  background:var(--pr-surface2); border:1px solid var(--pr-border);
  display:flex; align-items:center; justify-content:center;
  font-size:16px; cursor:pointer; text-decoration:none; color:inherit;
  position:relative; transition:background 0.15s;
}
.icon-action-btn:hover { background:var(--pr-surface); }
.chat-fab {
  position:relative; width:38px; height:38px; border-radius:50%;
  background:rgba(255,107,53,0.15); border:1px solid rgba(255,107,53,0.35);
  font-size:17px; display:flex; align-items:center; justify-content:center;
  cursor:pointer;
}
.unread-dot {
  position:absolute; top:-3px; right:-3px;
  min-width:16px; height:16px; border-radius:8px; padding:0 3px;
  background:var(--pr-orange); color:#fff; font-size:9px; font-weight:700;
  display:flex; align-items:center; justify-content:center;
}
.unread-dot--sm { top:-4px; right:-4px; }
.trip-block { margin-bottom:10px; display:flex; flex-direction:column; gap:5px; }
.trip-row   { display:flex; align-items:flex-start; gap:7px; font-size:12px; color:var(--pr-muted); }
.chat-panel {
  position:fixed; bottom:0; left:0; right:0; z-index:400;
  background:var(--pr-surface); border-radius:20px 20px 0 0;
  border-top:1px solid var(--pr-border);
  display:flex; flex-direction:column; max-height:65vh; max-width:1100px; margin:0 auto;
}
.chat-hdr {
  display:flex; align-items:center; justify-content:space-between;
  padding:14px 16px 10px; border-bottom:1px solid var(--pr-border); flex-shrink:0;
}
.chat-hdr-title { font-size:14px; font-weight:700; margin:0; }
.chat-hdr-close { background:none; border:none; color:var(--pr-muted); font-size:14px; cursor:pointer; }
.chat-msgs { flex:1; overflow-y:auto; padding:14px 16px; display:flex; flex-direction:column; gap:8px; }
.chat-empty { font-size:13px; color:var(--pr-muted); text-align:center; padding:20px 0; }
.bubble-row        { display:flex; flex-direction:column; max-width:75%; }
.bubble-row--mine  { align-self:flex-end;  align-items:flex-end; }
.bubble-row--theirs{ align-self:flex-start;align-items:flex-start; }
.bubble { padding:9px 13px; border-radius:16px; font-size:14px; line-height:1.45; margin:0; }
.bubble-row--mine   .bubble { background:var(--pr-orange); color:#fff; border-bottom-right-radius:4px; }
.bubble-row--theirs .bubble { background:var(--pr-surface2); color:var(--pr-text); border-bottom-left-radius:4px; }
.bubble-time { font-size:10px; color:var(--pr-muted); margin-top:3px; padding:0 4px; }
.chat-footer {
  display:flex; gap:8px; padding:10px 14px 24px;
  border-top:1px solid var(--pr-border); flex-shrink:0;
}
.chat-input {
  flex:1; background:var(--pr-surface2); border:1px solid var(--pr-border);
  border-radius:20px; color:var(--pr-text); font-size:14px; padding:10px 16px; outline:none;
}
.chat-input:focus { border-color:rgba(255,107,53,0.4); }
.chat-send {
  padding:10px 18px; border-radius:20px; background:var(--pr-orange);
  color:#fff; border:none; font-weight:600; font-size:13px; cursor:pointer;
}
.chat-send:disabled { opacity:0.4; cursor:not-allowed; }
.chat-slide-enter-active,.chat-slide-leave-active { transition:transform 0.28s ease; }
.chat-slide-enter-from,.chat-slide-leave-to { transform:translateY(100%); }
</style>