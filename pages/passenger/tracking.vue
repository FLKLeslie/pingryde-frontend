<!-- pages/passenger/tracking.vue
  ─────────────────────────────────────────────────────────────────
  COMPLETE TRACKING PAGE — all new features:
    • MapView (NOT SharedMapView — this was the bug)
    • Driver info modal when ride is accepted
    • In-ride chat
    • Ride expiry notification
    • Feedback request when driver marks complete
    • Cancel button
    • Polling backup for ride status
  ─────────────────────────────────────────────────────────────────
-->
<template>
  <div class="pr-page">

    <!-- ── Header ──────────────────────────────────────────────── -->
    <div class="track-header">
      <div>
        <p class="track-sub">Your ride</p>
        <h2 class="track-title">Live Tracking</h2>
      </div>
      <span :class="`pr-badge pr-badge-${statusColor}`">{{ statusLabel }}</span>
    </div>

    <!-- ── Map ─────────────────────────────────────────────────── -->
    <!--
      PingMap shows:
        • Teal pin = passenger (you)
        • Vehicle pin = driver (moves in real-time via socket)
        • Dashed orange line = straight-line route between you and driver
        • ETA banner = estimated minutes until you meet
        • Location pill (centre-top) = your reverse-geocoded location name
    -->
    <div class="track-map-wrap">
      <PingMap
        :height="mapHeight"
        :passenger-coords="rideStore.passengerLocation"
        :passenger-label="townName"
        :driver-coords="rideStore.driverLocation"
        :driver-type="rideStore.ride?.rideType || 'bike'"
        :location-label="townName"
        :show-eta="rideStore.ride?.status === 'accepted'"
      />

      <!-- Chat FAB button — visible when ride is accepted/ongoing -->
      <button
        v-if="rideStore.assignedDriver && rideStore.ride?.status !== 'completed'"
        class="chat-fab"
        @click="chatOpen = !chatOpen"
        :title="chatOpen ? 'Close chat' : 'Open chat'"
      >
        💬
        <!-- Unread indicator -->
        <span v-if="unreadCount > 0" class="chat-unread">{{ unreadCount }}</span>
      </button>

      <!-- Driver info button — open modal -->
      <button
        v-if="rideStore.assignedDriver"
        class="driver-fab"
        @click="driverModalOpen = true"
        title="View driver info"
      >
        👤
      </button>
    </div>

    <!-- ── Status cards ─────────────────────────────────────────── -->
    <div class="track-body">

      <!-- EXPIRED notification -->
      <Transition name="pr-fade-up">
        <div v-if="rideStore.isExpired" class="status-card status-card--expired pr-animate-in">
          <div class="status-icon">⏰</div>
          <div class="status-text">
            <p class="status-title">Ride Request Expired</p>
            <p class="status-desc">
              {{ rideStore.expiredNotification?.message || 'No driver accepted your request in time.' }}
            </p>
          </div>
          <button @click="newRide" class="pr-btn pr-btn-primary pr-btn-inline mt-3">
            Request Again
          </button>
        </div>
      </Transition>

      <!-- CANCELLED notification -->
      <Transition name="pr-fade-up">
        <div v-if="rideStore.isCancelled" class="status-card status-card--cancelled pr-animate-in">
          <div class="status-icon">❌</div>
          <div class="status-text">
            <p class="status-title">Ride Cancelled</p>
            <p class="status-desc">
              {{ rideStore.cancelledBy === 'driver'
                ? 'Your driver cancelled this ride. Please request a new one.'
                : 'This ride was cancelled.' }}
            </p>
          </div>
          <button @click="newRide" class="pr-btn pr-btn-primary pr-btn-inline mt-3">
            Request New Ride
          </button>
        </div>
      </Transition>

      <!-- PENDING — searching -->
      <Transition name="pr-fade-up">
        <div v-if="rideStore.isPending" class="status-card pr-animate-in">
          <div class="searching-dots">
            <span v-for="i in 3" :key="i"
                  class="dot"
                  :style="`animation-delay:${(i-1)*0.18}s`" />
          </div>
          <div class="status-text">
            <p class="status-title">Finding your driver...</p>
            <p class="status-desc">
              Request expires in {{ expiryCountdown }} ·
              Drivers notified in your area
            </p>
          </div>
        </div>
      </Transition>

      <!-- ACCEPTED — driver found -->
      <Transition name="pr-fade-up">
        <div v-if="rideStore.assignedDriver && rideStore.ride?.status !== 'completed'"
             class="status-card status-card--accepted pr-animate-in">
          <div class="accepted-banner">
            <span class="accepted-check">✅</span>
            <div>
              <p class="accepted-title">Driver is on the way!</p>
              <p class="accepted-sub">Tap 👤 to view driver details</p>
            </div>
          </div>

          <div class="driver-mini" @click="driverModalOpen = true">
            <!-- Profile photo or initials -->
            <div class="driver-mini-avatar">
              <img
                v-if="rideStore.assignedDriver.profilePhoto"
                :src="photoUrl(rideStore.assignedDriver.profilePhoto)"
                alt="Driver"
                class="avatar-img"
              />
              <span v-else class="avatar-initials">{{ driverInitials }}</span>
            </div>
            <div class="driver-mini-info">
              <p class="driver-mini-name">
                {{ rideStore.assignedDriver.name }}
                <span v-if="rideStore.assignedDriver.isVerified" class="verified-badge" title="Verified driver">
                  ✓
                </span>
              </p>
              <p class="driver-mini-sub">
                {{ rideStore.assignedDriver.vehicleType === 'bike' ? '🏍️ Motorbike' : '🚕 Taxi' }}
                {{ rideStore.assignedDriver.plateNumber ? '· ' + rideStore.assignedDriver.plateNumber : '' }}
              </p>
            </div>
            <a :href="`tel:+237${rideStore.assignedDriver.phone}`"
               class="call-btn" @click.stop>📞</a>
          </div>
        </div>
      </Transition>

      <!-- ARRIVED — driver and passenger within 2 metres -->
      <Transition name="pr-fade-up">
        <div v-if="arrivedNotification" class="status-card status-card--arrived pr-animate-in">
          <div class="status-icon">🤝</div>
          <div class="status-text">
            <p class="status-title">Your driver is here!</p>
            <p class="status-desc">
              You and your driver are in the same spot. The ride is now ongoing.
              Either of you can mark it complete when you arrive at your destination.
            </p>
          </div>
        </div>
      </Transition>

      <!-- PENDING FEEDBACK — ride timed out without being marked complete -->
      <Transition name="pr-fade-up">
        <div v-if="rideStore.ride?.status === 'pendingFeedback'" class="status-card status-card--feedback pr-animate-in">
          <p class="status-title">⏳ Was this ride completed?</p>
          <p class="status-desc">The ride has been ongoing for a while. Please confirm whether you arrived safely.</p>
          <div class="feedback-buttons">
            <button @click="confirmRide" class="pr-btn pr-btn-primary pr-btn-inline">
              ✅ Yes, arrived safely
            </button>
            <button @click="cancelFromFeedback" class="pr-btn pr-btn-danger pr-btn-inline">
              ❌ No, something went wrong
            </button>
          </div>
        </div>
      </Transition>

      <!-- FEEDBACK REQUEST — driver marked complete -->
      <Transition name="pr-fade-up">
        <div v-if="rideStore.feedbackPending" class="status-card status-card--feedback pr-animate-in">
          <p class="status-title">Did you arrive safely?</p>
          <p class="status-desc">Your driver marked the ride as complete.</p>
          <div class="feedback-buttons">
            <button @click="confirmRide" class="pr-btn pr-btn-primary pr-btn-inline">
              ✅ Yes, completed
            </button>
            <button @click="cancelFromFeedback" class="pr-btn pr-btn-danger pr-btn-inline">
              ❌ No, cancel
            </button>
          </div>
        </div>
      </Transition>

      <!-- COMPLETED -->
      <Transition name="pr-fade-up">
        <div v-if="rideStore.ride?.status === 'completed' && !rideStore.feedbackPending"
             class="status-card status-card--complete pr-animate-in text-center">
          <div class="complete-icon">🎉</div>
          <p class="status-title">Ride Complete!</p>
          <p class="status-desc">Thanks for riding with PingRyde. Safe travels!</p>
          <button @click="newRide" class="pr-btn pr-btn-primary mt-4">
            Request Another Ride
          </button>
        </div>
      </Transition>

      <!-- Cancel button (pending / accepted only) -->
      <button
        v-if="['pending','accepted'].includes(rideStore.ride?.status)"
        @click="cancelRide"
        class="pr-btn pr-btn-danger"
        style="margin-top:8px"
      >
        Cancel Ride
      </button>

    </div>

    <!-- ══════════════════════════════════════════════════════════
         DRIVER INFO MODAL
         Shows when passenger taps the 👤 button after acceptance.
    ════════════════════════════════════════════════════════════ -->
    <Transition name="modal">
      <div v-if="driverModalOpen" class="modal-overlay" @click.self="driverModalOpen = false">
        <div class="modal-card">
          <button class="modal-close" @click="driverModalOpen = false">✕</button>

          <!-- Driver photo -->
          <div class="modal-photo-wrap">
            <img
              v-if="rideStore.assignedDriver?.profilePhoto"
              :src="photoUrl(rideStore.assignedDriver.profilePhoto)"
              alt="Driver photo"
              class="modal-photo"
            />
            <div v-else class="modal-photo-placeholder">
              {{ driverInitials }}
            </div>
            <!-- Verified badge -->
            <span v-if="rideStore.assignedDriver?.isVerified"
                  class="modal-verified-badge">
              ✓ Verified
            </span>
          </div>

          <h3 class="modal-name">{{ rideStore.assignedDriver?.name }}</h3>
          <p class="modal-sub">
            {{ rideStore.assignedDriver?.vehicleType === 'bike' ? '🏍️ Motorbike' : '🚕 Taxi' }}
            {{ rideStore.assignedDriver?.region ? '· ' + rideStore.assignedDriver.region : '' }}
          </p>

          <div class="modal-details">
            <div v-if="rideStore.assignedDriver?.plateNumber" class="modal-detail-row">
              <span class="detail-label">Plate</span>
              <span class="detail-value">{{ rideStore.assignedDriver.plateNumber }}</span>
            </div>
            <div class="modal-detail-row">
              <span class="detail-label">Status</span>
              <span class="pr-badge pr-badge-active">En Route</span>
            </div>
          </div>

          <!-- Action buttons -->
          <div class="modal-actions">
            <a :href="`tel:+237${rideStore.assignedDriver?.phone}`"
               class="pr-btn pr-btn-primary pr-btn-inline">
              📞 Call Driver
            </a>
            <button @click="driverModalOpen = false; chatOpen = true"
                    class="pr-btn pr-btn-outline pr-btn-inline">
              💬 Chat
            </button>
          </div>

        </div>
      </div>
    </Transition>

    <!-- ══════════════════════════════════════════════════════════
         IN-RIDE CHAT PANEL
         Slide-up panel for messaging between passenger and driver.
         Only active while ride status is accepted/ongoing.
    ════════════════════════════════════════════════════════════ -->
    <Transition name="chat-slide">
      <div v-if="chatOpen" class="chat-panel">
        <div class="chat-header">
          <p class="chat-title">💬 Chat with driver</p>
          <button @click="chatOpen = false" class="chat-close">✕</button>
        </div>

        <!-- Message list -->
        <div class="chat-messages" ref="chatEl">
          <div v-if="rideStore.chatMessages.length === 0" class="chat-empty">
            No messages yet. Say hello!
          </div>
          <div
            v-for="(msg, i) in rideStore.chatMessages" :key="i"
            class="chat-bubble"
            :class="msg.sender === 'passenger' ? 'chat-bubble--mine' : 'chat-bubble--theirs'"
          >
            <p class="bubble-text">{{ msg.text }}</p>
            <span class="bubble-time">{{ formatTime(msg.sentAt) }}</span>
          </div>
        </div>

        <!-- Input -->
        <div class="chat-input-row">
          <input
            v-model="chatText"
            type="text"
            placeholder="Type a message..."
            class="chat-input"
            @keydown.enter="sendChat"
            maxlength="300"
          />
          <button @click="sendChat" class="chat-send" :disabled="!chatText.trim()">
            Send
          </button>
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
import { API_BASE, BACKEND_URL } from '~/utils/api'


const router    = useRouter()
const rideStore = useRideStore()
const userStore = useUserStore()
const { connect, registerPassenger, joinRide, sendPassengerLocation, emitProximityCheck } = useSocket()
const { startWatching, stopWatching, reverseGeocode } = useGeolocation()

// UI state
const driverModalOpen     = ref(false)
const chatOpen            = ref(false)
const chatText            = ref('')
const chatEl              = ref(null)
const townName            = ref('')
// arrivedNotification: true when server confirmed <2m proximity.
// Driven from the store so it persists if the component re-renders.
const arrivedNotification = computed(() => !!rideStore.arrivedMessage)
let pollInterval    = null
let waitingInterval = null
let expirySeconds   = ref(600)

// Computed
const driverInitials = computed(() => {
  const name = rideStore.assignedDriver?.name || ''
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) || 'DR'
})

const statusColor = computed(() => ({
  pending:'pending', accepted:'active', ongoing:'active',
  pendingFeedback:'pending',
  completed:'active', cancelled:'inactive', expired:'inactive',
}[rideStore.ride?.status] || 'pending'))

const statusLabel = computed(() => ({
  pending:'Searching...', accepted:'Driver En Route', ongoing:'Ongoing',
  pendingFeedback:'Confirm Ride',
  completed:'Completed', cancelled:'Cancelled', expired:'Expired',
}[rideStore.ride?.status] || 'Pending'))

const mapHeight = computed(() => {
  if (typeof window === 'undefined') return '360px'
  // Taller map on wider screens for better visibility during tracking
  return window.innerWidth >= 768 ? '440px' : '360px'
})

// Unread chat messages (from driver, not yet viewed)
const unreadCount = computed(() =>
  rideStore.chatMessages.filter(m => m.sender === 'driver' && !m.read).length
)

// Expiry countdown display
const expiryCountdown = computed(() => {
  const m = Math.floor(expirySeconds.value / 60)
  const s = expirySeconds.value % 60
  return `${m}:${s.toString().padStart(2,'0')}`
})

const photoUrl  = (path) => {
  // Cloudinary URLs are already full URLs, so return as-is
  // Local paths start with "/" — prepend BACKEND_URL only for those
  if (!path) return null
  if (path.startsWith("http")) return path  // Already a full URL
  return `${BACKEND_URL}${path}`             // Local path
}
const formatTime= (sentAt) => sentAt
  ? new Date(sentAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
  : ''

// ── Lifecycle ──────────────────────────────────────────────────────
onMounted(async () => {
  if (!rideStore.ride) { router.push('/passenger/request'); return }

  connect()
  if (userStore._id) registerPassenger(userStore._id)
  joinRide(rideStore.ride._id)

  // Stream passenger GPS to driver AND emit proximity check each update.
  // The server's checkProximity handler compares both coords and fires
  // 'partyArrived' when the distance drops below 2 metres.
  startWatching(async (coords) => {
    rideStore.updatePassengerLocation(coords)
    if (!rideStore.ride?._id) return

    // Send passenger GPS to driver's map
    sendPassengerLocation(rideStore.ride._id, coords.lat, coords.lng)

    // Check proximity if ride is accepted and driver location is known
    if (rideStore.ride.status === 'accepted' && rideStore.driverLocation) {
      emitProximityCheck({
        rideId:       rideStore.ride._id,
        passengerLat: coords.lat,
        passengerLng: coords.lng,
        driverLat:    rideStore.driverLocation.lat,
        driverLng:    rideStore.driverLocation.lng,
      })
    }

    // Reverse geocode once to get a human-readable location name
    if (!townName.value) {
      const name = await reverseGeocode(coords.lat, coords.lng)
      if (name) townName.value = name
    }
  })

  // Expiry countdown (only relevant while ride is pending)
  if (rideStore.ride.expiresAt) {
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.floor((new Date(rideStore.ride.expiresAt) - Date.now()) / 1000))
      expirySeconds.value = remaining
    }
    updateCountdown()
    waitingInterval = setInterval(updateCountdown, 1000)
  }

  // Polling backup — re-fetches ride status every 8s in case a socket
  // event was missed (e.g. due to a brief network interruption)
  pollInterval = setInterval(pollRideStatus, 8000)

  // If the ride was already accepted before this page loaded, fetch chat
  // history. Also: assignedDriver is intentionally NOT persisted to
  // localStorage (only `ride` is), so a reload after acceptance loses
  // the driver card entirely unless we re-fetch it here.
  if (['accepted','ongoing','pendingFeedback'].includes(rideStore.ride.status)) {
    await loadChat()
    if (!rideStore.assignedDriver) {
      try {
        const res = await $fetch(`${API_BASE}/rides/${rideStore.ride._id}`)
        if (res.driver) rideStore.setAssignedDriver(res.driver)
      } catch {}
    }
  }
})

onBeforeUnmount(() => {
  stopWatching()
  if (pollInterval)    clearInterval(pollInterval)
  if (waitingInterval) clearInterval(waitingInterval)
})

// Auto-scroll chat to bottom when new messages arrive
watch(() => rideStore.chatMessages.length, async () => {
  await nextTick()
  if (chatEl.value) chatEl.value.scrollTop = chatEl.value.scrollHeight
})

// When the ride gets accepted while this page is open, load chat history.
// rideStore.chatReady is set to true by useSocket's rideAcceptedPassenger handler.
watch(() => rideStore.chatReady, async (ready) => {
  if (ready && rideStore.ride?._id) {
    await loadChat()
    rideStore.setChatReady(false)  // reset so it can fire again on reconnect
  }
})

// ── Actions ─────────────────────────────────────────────────────────

const pollRideStatus = async () => {
  if (!rideStore.ride?._id || rideStore.ride.status !== 'pending') return
  try {
    const res = await $fetch(`${API_BASE}/rides/${rideStore.ride._id}`)
    if (res.ride?.status === 'accepted' && !rideStore.assignedDriver) {
      rideStore.setRide(res.ride)
      rideStore.updateStatus('accepted')
      if (res.driver) rideStore.setAssignedDriver(res.driver)
    }
    if (['expired','cancelled'].includes(res.ride?.status)) {
      rideStore.updateStatus(res.ride.status)
    }
  } catch {}
}

const loadChat = async () => {
  try {
    const res = await $fetch(`${API_BASE}/rides/${rideStore.ride._id}/chat`)
    rideStore.setChatMessages(res.messages || [])
  } catch {}
}

const sendChat = async () => {
  const text = chatText.value.trim()
  if (!text || !rideStore.ride?._id) return
  chatText.value = ''
  try {
    await $fetch(`${API_BASE}/rides/${rideStore.ride._id}/chat`, {
      method: 'POST',
      body:   { sender: 'passenger', text },
    })
    // Message will arrive back via socket "chatMessage" event
  } catch (err) {
    console.error('Chat error:', err)
  }
}

const cancelRide = async () => {
  try {
    await $fetch(`${API_BASE}/rides/${rideStore.ride._id}/cancel`, {
      method: 'PATCH',
      body:   { cancelledBy: 'passenger' },
    })
  } catch {}
  rideStore.clearRide()
  router.push('/passenger/request')
}

const confirmRide = async () => {
  try {
    await $fetch(`${API_BASE}/rides/${rideStore.ride._id}/confirm`, { method: 'PATCH' })
    rideStore.setFeedbackPending(false)
    rideStore.updateStatus('completed')
  } catch {}
}

const cancelFromFeedback = async () => {
  // Passenger says ride didn't complete
  await cancelRide()
}

const newRide = () => { rideStore.clearRide(); router.push('/passenger/request') }
</script>

<style scoped>
/* ── Page structure ──────────────────────────────────────────── */
.track-header {
  display:     flex;
  align-items: center;
  justify-content: space-between;
  padding:     20px var(--pr-px) 12px;
}
.track-sub   { font-size:11px; color:var(--pr-muted); margin:0 0 2px; text-transform:uppercase; letter-spacing:0.06em; }
.track-title { font-size:20px; font-weight:800; margin:0; }

.track-map-wrap { padding:0 var(--pr-px) 12px; position:relative; }

.track-body { padding:0 var(--pr-px) 32px; display:flex; flex-direction:column; gap:12px; }

/* ── Status cards ────────────────────────────────────────────── */
.status-card {
  background:    var(--pr-surface);
  border:        1px solid var(--pr-border);
  border-radius: var(--pr-radius);
  padding:       18px;
}
.status-card--expired  { border-color: rgba(255,71,71,0.3); background: rgba(255,71,71,0.04); }
.status-card--cancelled{ border-color: rgba(255,71,71,0.3); }
.status-card--accepted { border-color: rgba(0,212,184,0.3); }
.status-card--feedback { border-color: rgba(240,192,64,0.3); background: rgba(240,192,64,0.04); }
.status-card--complete { border-color: rgba(0,212,184,0.3); background: rgba(0,212,184,0.04); }

.status-icon  { font-size:28px; margin-bottom:8px; }
.status-title { font-size:16px; font-weight:700; margin:0 0 4px; }
.status-desc  { font-size:13px; color:var(--pr-muted); margin:0; line-height:1.55; }

/* Searching dots animation */
.searching-dots {
  display:    flex;
  gap:        6px;
  margin-bottom: 12px;
}
.dot {
  width:9px; height:9px; border-radius:50%;
  background:var(--pr-teal);
  animation: dotBounce 0.8s ease-in-out infinite;
  display:   inline-block;
}
@keyframes dotBounce {
  0%,80%,100% { transform:translateY(0); }
  40%         { transform:translateY(-8px); }
}

/* Accepted banner */
.accepted-banner { display:flex; align-items:center; gap:10px; margin-bottom:14px; padding-bottom:14px; border-bottom:1px solid var(--pr-border); }
.accepted-check  { font-size:20px; }
.accepted-title  { font-size:15px; font-weight:700; margin:0 0 2px; color:var(--pr-teal); }
.accepted-sub    { font-size:12px; color:var(--pr-muted); margin:0; }

/* Driver mini card (clickable) */
.driver-mini {
  display:     flex;
  align-items: center;
  gap:         12px;
  cursor:      pointer;
  padding:     10px;
  border-radius:10px;
  background:  rgba(255,255,255,0.02);
  transition:  background 0.15s;
}
.driver-mini:hover { background: rgba(0,212,184,0.06); }

.driver-mini-avatar {
  width:44px; height:44px; border-radius:50%; flex-shrink:0;
  background:rgba(255,107,53,0.15); overflow:hidden;
  display:flex; align-items:center; justify-content:center;
}
.avatar-img      { width:100%; height:100%; object-fit:cover; }
.avatar-initials { font-size:15px; font-weight:700; color:var(--pr-orange); font-family:var(--font-display); }

.driver-mini-info { flex:1; min-width:0; }
.driver-mini-name { font-size:14px; font-weight:600; margin:0 0 2px; display:flex; align-items:center; gap:5px; }
.driver-mini-sub  { font-size:12px; color:var(--pr-muted); margin:0; }

.verified-badge {
  font-size:10px; font-weight:700;
  background:rgba(0,212,184,0.15); color:var(--pr-teal);
  padding:2px 6px; border-radius:999px;
}

.call-btn {
  width:38px; height:38px; border-radius:50%;
  background:rgba(0,212,184,0.12); border:1px solid rgba(0,212,184,0.3);
  display:flex; align-items:center; justify-content:center;
  font-size:16px; text-decoration:none; flex-shrink:0;
}

/* Feedback buttons */
.feedback-buttons { display:flex; gap:10px; flex-wrap:wrap; margin-top:14px; }

/* Complete */
.complete-icon { font-size:48px; margin-bottom:12px; }

/* ── FAB buttons on map ──────────────────────────────────────── */
.chat-fab, .driver-fab {
  position:   absolute;
  width:      44px; height:44px;
  border-radius:50%;
  display:    flex; align-items:center; justify-content:center;
  font-size:  18px;
  cursor:     pointer;
  border:     1px solid rgba(255,255,255,0.1);
  backdrop-filter:blur(8px);
  transition: transform 0.15s;
  z-index:    20;
}
.chat-fab   { bottom:72px; right:calc(var(--pr-px) + 12px); background:rgba(30,42,50,0.9); }
.driver-fab { bottom:26px; right:calc(var(--pr-px) + 12px); background:rgba(0,212,184,0.2); }
.chat-fab:hover, .driver-fab:hover { transform:scale(1.08); }

.chat-unread {
  position:  absolute;
  top:-2px; right:-2px;
  width:16px; height:16px; border-radius:50%;
  background:var(--pr-orange); color:white;
  font-size:9px; font-weight:700;
  display:flex; align-items:center; justify-content:center;
}

/* ── Driver modal ────────────────────────────────────────────── */
.modal-overlay {
  position:fixed; inset:0; z-index:500;
  background:rgba(0,0,0,0.6);
  display:flex; align-items:flex-end; justify-content:center;
  backdrop-filter:blur(4px);
}
.modal-card {
  background:    var(--pr-surface);
  border-radius: 24px 24px 0 0;
  padding:       28px 24px 40px;
  width:         100%;
  max-width:     480px;
  position:      relative;
  max-height:    85vh;
  overflow-y:    auto;
}
.modal-close {
  position:absolute; top:16px; right:16px;
  width:32px; height:32px; border-radius:50%;
  background:var(--pr-surface2); border:none;
  color:var(--pr-muted); font-size:13px; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
}

.modal-photo-wrap { text-align:center; margin-bottom:16px; position:relative; display:inline-block; }
.modal-photo      { width:80px; height:80px; border-radius:50%; object-fit:cover; border:3px solid var(--pr-border); display:block; margin:0 auto; }
.modal-photo-placeholder {
  width:80px; height:80px; border-radius:50%;
  background:rgba(255,107,53,0.15); color:var(--pr-orange);
  font-size:26px; font-weight:700; font-family:var(--font-display);
  display:flex; align-items:center; justify-content:center;
  margin:0 auto;
}
.modal-verified-badge {
  position:absolute; bottom:-4px; left:50%; transform:translateX(-50%);
  white-space:nowrap;
  font-size:10px; font-weight:700; padding:3px 8px; border-radius:999px;
  background:var(--pr-teal); color:#1E2A32;
}

.modal-name { text-align:center; font-size:20px; font-weight:800; margin:12px 0 4px; }
.modal-sub  { text-align:center; font-size:13px; color:var(--pr-muted); margin:0 0 20px; }

.modal-details     { background:var(--pr-surface2); border-radius:10px; padding:14px; margin-bottom:20px; }
.modal-detail-row  { display:flex; align-items:center; justify-content:space-between; padding:6px 0; }
.modal-detail-row:not(:last-child) { border-bottom:1px solid var(--pr-border); }
.detail-label { font-size:12px; color:var(--pr-muted); }
.detail-value { font-size:13px; font-weight:600; }

.modal-actions { display:flex; gap:10px; }

/* ── Chat panel ──────────────────────────────────────────────── */
.chat-panel {
  position:fixed;
  bottom:0; left:0; right:0;
  z-index:400;
  background:    var(--pr-surface);
  border-radius: 20px 20px 0 0;
  border-top:    1px solid var(--pr-border);
  display:       flex;
  flex-direction:column;
  max-height:    65vh;
  max-width:     1100px;
  margin:        0 auto;
}

.chat-header {
  display:     flex;
  align-items: center;
  justify-content: space-between;
  padding:     14px 16px 10px;
  border-bottom:1px solid var(--pr-border);
  flex-shrink: 0;
}
.chat-title { font-size:14px; font-weight:700; margin:0; }
.chat-close { background:none; border:none; color:var(--pr-muted); font-size:14px; cursor:pointer; padding:4px; }

.chat-messages {
  flex:1; overflow-y:auto;
  padding:14px 16px;
  display:flex; flex-direction:column; gap:8px;
}
.chat-empty { font-size:13px; color:var(--pr-muted); text-align:center; padding:20px 0; }

.chat-bubble { display:flex; flex-direction:column; max-width:75%; }
.chat-bubble--mine   { align-self:flex-end; align-items:flex-end; }
.chat-bubble--theirs { align-self:flex-start; align-items:flex-start; }

.bubble-text {
  padding:9px 13px; border-radius:16px;
  font-size:14px; line-height:1.45; margin:0;
}
.chat-bubble--mine   .bubble-text { background:var(--pr-teal);   color:#1E2A32; border-bottom-right-radius:4px; }
.chat-bubble--theirs .bubble-text { background:var(--pr-surface2);color:var(--pr-text); border-bottom-left-radius:4px; }

.bubble-time { font-size:10px; color:var(--pr-muted); margin-top:3px; padding:0 4px; }

.chat-input-row {
  display:     flex;
  gap:         8px;
  padding:     10px 14px 20px;
  border-top:  1px solid var(--pr-border);
  flex-shrink: 0;
}
.chat-input { flex:1; background:var(--pr-surface2); border:1px solid var(--pr-border); border-radius:20px; color:var(--pr-text); font-family:var(--font-body); font-size:14px; padding:10px 16px; outline:none; }
.chat-input:focus { border-color:rgba(0,212,184,0.4); }
.chat-send { padding:10px 18px; border-radius:20px; background:var(--pr-teal); color:#1E2A32; border:none; font-weight:600; font-size:13px; cursor:pointer; transition:filter 0.15s; }
.chat-send:hover:not(:disabled) { filter:brightness(1.1); }
.chat-send:disabled { opacity:0.4; cursor:not-allowed; }

/* ── Transitions ─────────────────────────────────────────────── */
.modal-enter-active, .modal-leave-active { transition:all 0.3s ease; }
.modal-enter-from, .modal-leave-to { opacity:0; transform:translateY(100%); }

.chat-slide-enter-active, .chat-slide-leave-active { transition:transform 0.3s ease; }
.chat-slide-enter-from, .chat-slide-leave-to { transform:translateY(100%); }

.pr-fade-up-enter-active { transition:all 0.3s ease; }
.pr-fade-up-enter-from   { opacity:0; transform:translateY(8px); }
</style>