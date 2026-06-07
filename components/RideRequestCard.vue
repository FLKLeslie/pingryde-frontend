<!-- components/RideRequestCard.vue
════════════════════════════════════════════════════════════════════
DRIVER — RIDE REQUEST CARD

Shows one ride request. Driver sees this before deciding to accept.
PingMap is used with role="driver" so the passenger pin is correctly
labelled "Passenger" and the map centres on their location.
════════════════════════════════════════════════════════════════════ -->
<template>
  <div class="rrc" :class="{ 'rrc--new': isNew, 'rrc--special': isSpecial }">

    <!-- "New" strip -->
    <div v-if="isNew" class="rrc-new-strip">
      <span class="rrc-new-dot"></span>New request
    </div>

    <!-- Top: passenger info + badge -->
    <div class="rrc-top">
      <div class="rrc-passenger">
        <!-- Photo or initials -->
        <div class="rrc-avatar">
          <img v-if="passengerPhoto"
               :src="passengerPhoto.startsWith('http') ? passengerPhoto : `${BACKEND_URL}${passengerPhoto}`"
               class="rrc-avatar-img" />
          <span v-else class="rrc-initials">{{ passengerInitials }}</span>
        </div>
        <div>
          <p class="rrc-name">{{ passengerName }}</p>
          <p class="rrc-time">{{ timeAgo }}</p>
        </div>
      </div>
      <div class="rrc-right">
        <span class="rrc-badge" :class="badgeClass">{{ typeLabel }}</span>
        <p v-if="expiresIn" class="rrc-expiry">⏰ {{ expiresIn }}</p>
      </div>
    </div>

    <!-- Pickup + Destination -->
    <div class="rrc-trip">
      <div class="rrc-trip-row">
        <div class="tdot tdot--pickup"></div>
        <div>
          <p class="tlabel">Pickup</p>
          <p class="ttext">{{ pickupText }}</p>
        </div>
      </div>
      <div class="tconnector"><div class="tline"></div></div>
      <div class="rrc-trip-row">
        <div class="tdot tdot--dest"></div>
        <div>
          <p class="tlabel">Destination</p>
          <p class="ttext">{{ destText }}</p>
        </div>
      </div>
    </div>

    <!-- Region -->
    <div class="rrc-meta">
      <span class="rrc-meta-item">🗺️ {{ request.region || 'Unknown region' }}</span>
      <span v-if="isSpecial" class="rrc-meta-item rrc-meta-item--special">📦 Special</span>
    </div>

    <!-- Special description -->
    <p v-if="isSpecial && request.specialRequest?.description" class="rrc-special-desc">
      "{{ request.specialRequest.description }}"
    </p>

    <!-- ── "See on map" toggle ────────────────────────────────────
         Driver can expand a mini-map to see exactly where the
         passenger is BEFORE deciding to accept the ride.
         PingMap with role="driver" centres on the passenger pin.
    ─────────────────────────────────────────────────────────────── -->
    <div v-if="passengerCoords" class="rrc-map-section">
      <button class="rrc-map-toggle" @click="showMap = !showMap">
        <span>🗺️</span>
        {{ showMap ? 'Hide map' : 'See passenger on map' }}
        <span class="rrc-map-toggle-arrow">{{ showMap ? '▲' : '▼' }}</span>
      </button>
      <Transition name="map-expand">
        <div v-if="showMap" class="rrc-map-wrap">
          <PingMap
            :passenger-coords="passengerCoords"
            height="210px"
            :zoom="14"
            role="driver"
          />
        </div>
      </Transition>
    </div>

    <!-- Accept -->
    <button class="rrc-accept" @click="$emit('accept')">
      ✅ Accept Ride
    </button>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { BACKEND_URL } from '~/utils/api'

const props = defineProps({
  request: { type: Object, required: true },
})
defineEmits(['accept'])

// Toggle state for the mini-map — collapsed by default
const showMap = ref(false)

// ── Passenger info ─────────────────────────────────────────────────
const passengerName = computed(() =>
  props.request.passengerId?.name || props.request.passengerName || 'Passenger'
)
const passengerPhoto = computed(() =>
  props.request.passengerId?.profilePhoto || null
)
const passengerInitials = computed(() =>
  passengerName.value.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) || '??'
)

// ── Trip text ──────────────────────────────────────────────────────
const pickupText = computed(() => {
  const p = props.request.pickup
  if (!p) return 'Not specified'
  if (p.description) return p.description
  if (p.lat) return `GPS ${Number(p.lat).toFixed(4)}, ${Number(p.lng).toFixed(4)}`
  return 'Not specified'
})
const destText = computed(() => {
  const d = props.request.destination
  if (!d) return 'Not specified'
  return d.description || 'Not specified'
})

// ── Passenger GPS for the mini-map ────────────────────────────────
// Socket payload puts coords in passengerCoords.
// DB documents put them in pickup.lat/lng.
const passengerCoords = computed(() => {
  if (props.request.passengerCoords?.lat) return props.request.passengerCoords
  const p = props.request.pickup
  if (p?.lat && p.lat !== 0) return { lat: p.lat, lng: p.lng }
  return null
})

// ── Flags ──────────────────────────────────────────────────────────
const isNew     = computed(() =>
  !props.request.createdAt || Date.now() - new Date(props.request.createdAt) < 3 * 60 * 1000
)
const isSpecial = computed(() => props.request.rideCategory === 'special')

// ── Badge ──────────────────────────────────────────────────────────
const typeLabel = computed(() => {
  if (isSpecial.value) return '📦 Special'
  if (props.request.rideType === 'bike') return '🏍️ Bike'
  if (props.request.rideType === 'taxi') return '🚕 Taxi'
  return props.request.rideType || 'Ride'
})
const badgeClass = computed(() => ({
  'badge--bike':    props.request.rideType === 'bike' && !isSpecial.value,
  'badge--taxi':    props.request.rideType === 'taxi' && !isSpecial.value,
  'badge--special': isSpecial.value,
}))

// ── Expiry countdown ───────────────────────────────────────────────
const expiresIn = computed(() => {
  if (!props.request.expiresAt) return null
  const s = Math.floor((new Date(props.request.expiresAt) - Date.now()) / 1000)
  if (s <= 0) return 'Expired'
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}m ${s % 60}s left` : `${s}s left`
})

// ── Smart timestamp ────────────────────────────────────────────────
const timeAgo = computed(() => {
  if (!props.request.createdAt) return 'Just now'
  const now  = new Date(), then = new Date(props.request.createdAt)
  const mins = Math.floor((now - then) / 60_000)
  const hrs  = Math.floor((now - then) / 3_600_000)
  if (mins < 1)  return 'Just now'
  if (mins < 60) return `${mins}m ago`
  if (hrs  < 24) return `${hrs}h ago`
  const yd = new Date(now); yd.setDate(yd.getDate() - 1)
  const t  = then.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
  const isYday = then.getDate()===yd.getDate() && then.getMonth()===yd.getMonth()
  if (isYday) return `Yesterday ${t}`
  return `${then.toLocaleDateString([],{day:'numeric',month:'short'})} ${t}`
})
</script>

<style scoped>
.rrc {
  background:var(--pr-surface); border:1px solid var(--pr-border);
  border-radius:14px; overflow:hidden;
  transition:border-color 0.2s, transform 0.15s;
  animation:rrcIn 0.3s ease both;
}
@keyframes rrcIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
.rrc:hover    { border-color:rgba(0,212,184,0.25); transform:translateY(-1px); }
.rrc--new     { border-color:rgba(255,107,53,0.45); }
.rrc--special { border-color:rgba(240,192,64,0.35); }

.rrc-new-strip {
  display:flex; align-items:center; gap:6px; padding:6px 14px;
  background:rgba(255,107,53,0.08); border-bottom:1px solid rgba(255,107,53,0.15);
  font-size:11px; font-weight:600; color:var(--pr-orange);
}
.rrc-new-dot {
  width:7px; height:7px; border-radius:50%; background:var(--pr-orange);
  animation:rrcPulse 1.5s ease-in-out infinite;
}
@keyframes rrcPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }

.rrc-top {
  display:flex; align-items:center; justify-content:space-between;
  padding:14px 16px 10px; gap:10px;
}
.rrc-passenger { display:flex; align-items:center; gap:10px; min-width:0; }

/* Photo placeholder — 42×42 circle, ready for a real photo */
.rrc-avatar {
  width:42px; height:42px; border-radius:50%; flex-shrink:0; overflow:hidden;
  background:rgba(0,212,184,0.12); border:1.5px solid rgba(0,212,184,0.2);
  display:flex; align-items:center; justify-content:center;
}
.rrc-avatar-img { width:100%; height:100%; object-fit:cover; }
.rrc-initials   { font-size:14px; font-weight:700; color:var(--pr-teal); font-family:var(--font-display); }
.rrc-name { font-size:14px; font-weight:600; margin:0 0 2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.rrc-time { font-size:11px; color:var(--pr-muted); margin:0; }

.rrc-right { display:flex; flex-direction:column; align-items:flex-end; gap:4px; flex-shrink:0; }
.rrc-expiry { font-size:10px; color:var(--pr-yellow); margin:0; font-weight:600; }
.rrc-badge  { font-size:11px; font-weight:600; padding:4px 10px; border-radius:999px; }
.badge--bike    { color:var(--pr-orange); background:rgba(255,107,53,0.12); }
.badge--taxi    { color:var(--pr-teal);   background:rgba(0,212,184,0.12); }
.badge--special { color:var(--pr-yellow); background:rgba(240,192,64,0.12); }

.rrc-trip { padding:0 16px 10px; display:flex; flex-direction:column; }
.rrc-trip-row { display:flex; align-items:flex-start; gap:10px; padding:6px 0; }
.tdot { width:12px; height:12px; border-radius:50%; flex-shrink:0; margin-top:14px; }
.tdot--pickup { background:var(--pr-teal);   box-shadow:0 0 0 2px rgba(0,212,184,0.2); }
.tdot--dest   { background:var(--pr-orange); box-shadow:0 0 0 2px rgba(255,107,53,0.2); border-radius:3px; }
.tconnector { padding-left:5px; }
.tline { width:2px; height:12px; background:linear-gradient(to bottom,var(--pr-teal),var(--pr-orange)); opacity:0.4; border-radius:1px; }
.tlabel { font-size:10px; font-weight:700; color:var(--pr-muted); text-transform:uppercase; letter-spacing:0.05em; margin:0 0 2px; }
.ttext  { font-size:13px; color:var(--pr-text); margin:0; line-height:1.35; }

.rrc-meta { display:flex; align-items:center; gap:10px; padding:0 16px 10px; flex-wrap:wrap; }
.rrc-meta-item { font-size:12px; color:var(--pr-muted); }
.rrc-meta-item--special { color:var(--pr-yellow); }
.rrc-special-desc {
  margin:0 16px 10px; font-size:12px; color:var(--pr-muted); font-style:italic;
  background:var(--pr-surface2); padding:8px 12px; border-radius:8px;
}

/* Map toggle button */
.rrc-map-section { padding:0 14px 10px; }
.rrc-map-toggle {
  display:flex; align-items:center; gap:6px; width:100%;
  padding:9px 12px; border-radius:8px; cursor:pointer;
  background:var(--pr-surface2); border:1px solid var(--pr-border);
  color:var(--pr-text); font-size:13px; font-weight:600; font-family:var(--font-body);
  transition:background 0.15s, border-color 0.15s;
  margin-bottom:8px;
}
.rrc-map-toggle:hover { background:rgba(0,212,184,0.08); border-color:rgba(0,212,184,0.3); }
.rrc-map-toggle-arrow { margin-left:auto; font-size:11px; color:var(--pr-muted); }

.rrc-map-wrap { border-radius:10px; overflow:hidden; }

/* Map expand/collapse transition */
.map-expand-enter-active,.map-expand-leave-active { transition:all 0.25s ease; overflow:hidden; }
.map-expand-enter-from,.map-expand-leave-to { opacity:0; max-height:0; }
.map-expand-enter-to,.map-expand-leave-from { opacity:1; max-height:220px; }

.rrc-accept {
  width:100%; padding:13px; border:none; border-top:1px solid var(--pr-border);
  background:transparent; color:var(--pr-teal);
  font-size:14px; font-weight:600; font-family:var(--font-body);
  cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;
  transition:background 0.15s; border-radius:0 0 13px 13px;
}
.rrc-accept:hover  { background:rgba(0,212,184,0.08); }
.rrc-accept:active { background:rgba(0,212,184,0.15); }
</style>