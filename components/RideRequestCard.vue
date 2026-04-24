<!-- components/RideRequestCard.vue — Professional card with animations -->
<template>
  <div class="rrc" :class="{ 'rrc--new': isNew, 'rrc--special': isSpecial }">

    <!-- NEW indicator strip at top -->
    <div v-if="isNew" class="rrc-new-strip">
      <span class="rrc-new-dot"></span>
      New request
    </div>

    <!-- Main content -->
    <div class="rrc-body">

      <!-- Left: passenger avatar + info -->
      <div class="rrc-passenger">
        <div class="rrc-avatar">
          <img v-if="passengerPhoto"
               :src="`http://localhost:5000${passengerPhoto}`"
               class="rrc-avatar-img" />
          <span v-else class="rrc-avatar-text">{{ passengerInitials }}</span>
        </div>
        <div class="rrc-passenger-info">
          <p class="rrc-name">{{ passengerName }}</p>
          <p class="rrc-time">{{ timeAgo }}</p>
        </div>
      </div>

      <!-- Right: ride type badge + expiry -->
      <div class="rrc-right">
        <span class="rrc-type-badge" :class="typeBadgeClass">
          {{ typeLabel }}
        </span>
        <p v-if="expiresIn" class="rrc-expiry">
          ⏰ {{ expiresIn }}
        </p>
      </div>

    </div>

    <!-- Details row -->
    <div class="rrc-details">
      <span class="rrc-detail">
        <span class="rrc-detail-icon">📍</span>
        {{ request.region || 'Unknown region' }}
      </span>
      <span v-if="isSpecial" class="rrc-detail rrc-detail--special">
        📦 Special
      </span>
    </div>

    <!-- Special request description -->
    <p v-if="isSpecial && request.specialRequest?.description"
       class="rrc-special-desc">
      "{{ request.specialRequest.description }}"
    </p>

    <!-- Accept button with animation -->
    <button @click="$emit('accept')" class="rrc-accept">
      <span class="rrc-accept-icon">✅</span>
      Accept Ride
    </button>

  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  request: { type: Object, required: true }
})
defineEmits(['accept'])

const passengerName = computed(() => {
  if (props.request.passengerId?.name) return props.request.passengerId.name
  if (props.request.passengerName)     return props.request.passengerName
  return 'Passenger'
})

const passengerPhoto = computed(() =>
  props.request.passengerId?.profilePhoto || null
)

const passengerInitials = computed(() =>
  passengerName.value.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)
)

const isNew = computed(() => {
  if (!props.request.createdAt) return true
  return (Date.now() - new Date(props.request.createdAt)) < 3 * 60 * 1000
})

const isSpecial = computed(() => props.request.rideCategory === 'special')

const typeLabel = computed(() => {
  if (isSpecial.value) return '📦 Special'
  return props.request.rideType === 'bike' ? '🏍️ Bike' : '🚕 Taxi'
})

const typeBadgeClass = computed(() => ({
  'badge--bike':    props.request.rideType === 'bike',
  'badge--taxi':    props.request.rideType === 'taxi',
  'badge--special': isSpecial.value,
}))

// Expiry countdown
const expiresIn = computed(() => {
  if (!props.request.expiresAt) return null
  const remaining = Math.floor((new Date(props.request.expiresAt) - Date.now()) / 1000)
  if (remaining <= 0) return 'Expiring...'
  const m = Math.floor(remaining / 60)
  const s = remaining % 60
  return m > 0 ? `${m}m ${s}s left` : `${s}s left`
})

const timeAgo = computed(() => {
  if (!props.request.createdAt) return 'Just now'
  const mins = Math.floor((Date.now() - new Date(props.request.createdAt)) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins/60)}h ago`
})
</script>

<style scoped>
/* ── Card base ──────────────────────────────────────────────── */
.rrc {
  background:    var(--pr-surface);
  border:        1px solid var(--pr-border);
  border-radius: 14px;
  overflow:      hidden;
  transition:    border-color 0.2s, transform 0.15s;
  /* Entry animation */
  animation:     rrcIn 0.3s ease both;
}
@keyframes rrcIn {
  from { opacity:0; transform:translateY(10px); }
  to   { opacity:1; transform:translateY(0); }
}

.rrc:hover { border-color: rgba(0,212,184,0.25); transform:translateY(-1px); }
.rrc--new     { border-color: rgba(255,107,53,0.4); }
.rrc--special { border-color: rgba(240,192,64,0.3); }

/* New indicator strip */
.rrc-new-strip {
  display:     flex;
  align-items: center;
  gap:         6px;
  padding:     6px 14px;
  background:  rgba(255,107,53,0.08);
  font-size:   11px;
  font-weight: 600;
  color:       var(--pr-orange);
  border-bottom:1px solid rgba(255,107,53,0.15);
}
.rrc-new-dot {
  width:7px; height:7px; border-radius:50%;
  background:var(--pr-orange);
  animation: livePulse 1.5s ease-in-out infinite;
  display:inline-block;
}
@keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

/* Body */
.rrc-body {
  display:     flex;
  align-items: center;
  justify-content:space-between;
  padding:     14px 16px 10px;
  gap:         10px;
}

.rrc-passenger { display:flex; align-items:center; gap:10px; min-width:0; }

.rrc-avatar {
  width:40px; height:40px; border-radius:50%; flex-shrink:0;
  background:rgba(0,212,184,0.12); overflow:hidden;
  display:flex; align-items:center; justify-content:center;
}
.rrc-avatar-img  { width:100%; height:100%; object-fit:cover; }
.rrc-avatar-text { font-size:13px; font-weight:700; color:var(--pr-teal); font-family:var(--font-display); }

.rrc-passenger-info { min-width:0; }
.rrc-name  { font-size:14px; font-weight:600; margin:0 0 2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.rrc-time  { font-size:11px; color:var(--pr-muted); margin:0; }

.rrc-right  { display:flex; flex-direction:column; align-items:flex-end; gap:4px; flex-shrink:0; }
.rrc-expiry { font-size:10px; color:var(--pr-yellow); margin:0; font-weight:600; }

.rrc-type-badge {
  font-size:11px; font-weight:600; padding:4px 10px; border-radius:999px;
}
.badge--bike    { color:var(--pr-orange); background:rgba(255,107,53,0.12); }
.badge--taxi    { color:var(--pr-teal);   background:rgba(0,212,184,0.12); }
.badge--special { color:var(--pr-yellow); background:rgba(240,192,64,0.12); }

/* Details */
.rrc-details { display:flex; align-items:center; gap:12px; padding:0 16px 10px; flex-wrap:wrap; }
.rrc-detail  { display:flex; align-items:center; gap:4px; font-size:12px; color:var(--pr-muted); }
.rrc-detail-icon { font-size:13px; }
.rrc-detail--special { color:var(--pr-yellow); }

.rrc-special-desc {
  margin:0 16px 10px;
  font-size:12px;
  color:var(--pr-muted);
  font-style:italic;
  background:var(--pr-surface2);
  padding:8px 12px; border-radius:8px;
}

/* Accept button */
.rrc-accept {
  width:      100%;
  padding:    12px;
  border:     none;
  border-top: 1px solid var(--pr-border);
  background: transparent;
  color:      var(--pr-teal);
  font-size:  14px;
  font-weight:600;
  font-family:var(--font-body);
  cursor:     pointer;
  display:    flex;
  align-items:center;
  justify-content: center;
  gap:        8px;
  transition: background 0.15s;
  border-radius: 0 0 13px 13px;
}
.rrc-accept:hover { background:rgba(0,212,184,0.08); }
.rrc-accept:active { background:rgba(0,212,184,0.15); }
.rrc-accept-icon { font-size:15px; }
</style>