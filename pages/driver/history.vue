<!-- pages/driver/history.vue — DRIVER RIDE HISTORY
════════════════════════════════════════════════════════════════════
Shows the driver's full ride history and lifetime performance stats.

SECTIONS:
  1. Lifetime stats cards (received, accepted, completed, accuracy %)
     → These come from localStorage via useDriverStats composable.
     → They NEVER reset, even after clearing ride history from the DB.

  2. Ride history list (from MongoDB via API)
     → Filterable by status: all / completed / cancelled / accepted
     → Each card shows passenger, pickup, destination, timestamp, status
     → "Clear history" deletes completed/cancelled/expired from DB
       but does NOT touch the localStorage stat totals

IMPORTANT:
  The accuracy % is: (completed / accepted) × 100
  A driver who received 10 requests, accepted 8, and completed 6
  has an accuracy of 75% (6/8 × 100).
════════════════════════════════════════════════════════════════════ -->
<template>
  <div class="pr-page">

    <!-- Header -->
    <div class="hist-header pr-safe-top">
      <button @click="$router.back()" class="back-btn">←</button>
      <div>
        <h1 class="hist-title">Ride History</h1>
        <p class="hist-sub">Your performance and past rides</p>
      </div>
    </div>

    <!-- ── LIFETIME STATS ─────────────────────────────────────────
         Stored in localStorage — these survive DB history clears.
         Only ever increase; never reset.
    ─────────────────────────────────────────────────────────────── -->
    <div class="stats-section">
      <p class="section-label">Lifetime performance</p>

      <div class="stats-grid">

        <!-- Requests received -->
        <div class="stat-card">
          <p class="stat-value" style="color:var(--pr-muted)">{{ stats.received }}</p>
          <p class="stat-label">Requests<br>Received</p>
        </div>

        <!-- Rides accepted -->
        <div class="stat-card">
          <p class="stat-value" style="color:var(--pr-orange)">{{ stats.accepted }}</p>
          <p class="stat-label">Rides<br>Accepted</p>
        </div>

        <!-- Rides completed -->
        <div class="stat-card">
          <p class="stat-value" style="color:var(--pr-teal)">{{ stats.completed }}</p>
          <p class="stat-label">Rides<br>Completed</p>
        </div>

        <!-- Accuracy — how many accepted rides were also completed -->
        <div class="stat-card stat-card--wide">
          <div class="accuracy-row">
            <p class="stat-value" :style="`color:${accuracyColor}`">{{ accuracy }}%</p>
            <div class="accuracy-bar-wrap">
              <div class="accuracy-bar" :style="`width:${accuracy}%;background:${accuracyColor}`"></div>
            </div>
          </div>
          <p class="stat-label">Completion accuracy</p>
          <p class="stat-hint">{{ accuracyHint }}</p>
        </div>

      </div>
    </div>

    <!-- ── RIDE HISTORY LIST ───────────────────────────────────────
         Fetched from the backend. Can be filtered by status.
         Clearing history deletes DB records but keeps stat totals.
    ─────────────────────────────────────────────────────────────── -->
    <div class="rides-section">

      <!-- Filter tabs -->
      <div class="filter-tabs-wrap">
        <div class="filter-tabs">
          <button
            v-for="f in filters" :key="f.value"
            class="filter-tab"
            :class="{ 'filter-tab--active': activeFilter === f.value }"
            @click="setFilter(f.value)"
          >{{ f.label }}</button>
        </div>
      </div>

      <!-- Actions row -->
      <div class="rides-actions">
        <p class="section-label">
          {{ rides.length }} ride{{ rides.length !== 1 ? 's' : '' }}
        </p>
        <button
          v-if="canClear"
          @click="clearHistory"
          :disabled="clearing"
          class="clear-btn"
        >
          {{ clearing ? 'Clearing...' : '🗑️ Clear history' }}
        </button>
      </div>

      <!-- Loading skeleton -->
      <div v-if="loading" class="skeleton-list">
        <div v-for="i in 4" :key="i" class="skeleton-card"></div>
      </div>

      <!-- Empty state -->
      <div v-else-if="rides.length === 0" class="empty-state">
        <p class="empty-icon">📋</p>
        <p class="empty-title">No rides found</p>
        <p class="empty-sub">
          {{ activeFilter === 'all'
            ? "You haven't completed any rides yet."
            : `No ${activeFilter} rides to show.` }}
        </p>
      </div>

      <!-- Ride cards -->
      <div v-else class="rides-list">
        <div
          v-for="ride in rides"
          :key="ride._id"
          class="ride-card"
          :class="`ride-card--${statusClass(ride.status)}`"
        >
          <!-- Status badge + time -->
          <div class="ride-card-top">
            <span class="ride-status-badge" :class="`badge--${statusClass(ride.status)}`">
              {{ statusLabel(ride.status) }}
            </span>
            <span class="ride-time">{{ formatDate(ride.createdAt) }}</span>
          </div>

          <!-- Passenger info -->
          <div class="ride-passenger">
            <div class="ride-avatar">
              {{ passengerInitials(ride.passengerId) }}
            </div>
            <div>
              <p class="ride-passenger-name">
                {{ ride.passengerId?.name || 'Passenger' }}
              </p>
              <p class="ride-passenger-phone">
                {{ ride.passengerId?.phone || '' }}
              </p>
            </div>
            <span class="ride-type-badge">
              {{ ride.rideType === 'taxi' ? '🚕 Taxi' : '🏍️ Bike' }}
              <span v-if="ride.rideCategory === 'special'"> · 📦 Special</span>
            </span>
          </div>

          <!-- Trip details -->
          <div class="ride-trip">
            <div class="ride-trip-row">
              <span class="trip-dot trip-dot--pickup"></span>
              <p class="trip-text">{{ ride.pickup?.description || formatCoords(ride.pickup) }}</p>
            </div>
            <div class="trip-connector"><div class="trip-line"></div></div>
            <div class="ride-trip-row">
              <span class="trip-dot trip-dot--dest"></span>
              <p class="trip-text">{{ ride.destination?.description || '—' }}</p>
            </div>
          </div>

          <!-- Region -->
          <p class="ride-region">🗺️ {{ ride.region }}</p>

        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore }   from '~/store/user'
import { useDriverStats } from '~/composables/useDriverStats'
import { API_BASE }       from '~/utils/api'

const userStore = useUserStore()
const { stats, accuracy } = useDriverStats(userStore._id)

// ── Filter state ───────────────────────────────────────────────────
const filters = [
  { label: 'All',       value: 'all'       },
  { label: '✅ Done',   value: 'completed' },
  { label: '🚗 Active', value: 'accepted'  },
  { label: '❌ Cancelled', value: 'cancelled' },
]
const activeFilter = ref('all')

// ── Ride list ──────────────────────────────────────────────────────
const rides   = ref([])
const loading = ref(false)
const clearing= ref(false)

// Show the clear button only when there are completed/cancelled rides
const canClear = computed(() =>
  rides.value.some(r => ['completed','cancelled','expired'].includes(r.status))
)

// ── Accuracy colour ────────────────────────────────────────────────
// Green ≥80%, yellow ≥50%, red <50%
const accuracyColor = computed(() => {
  if (accuracy.value >= 80) return 'var(--pr-teal)'
  if (accuracy.value >= 50) return 'var(--pr-yellow)'
  return 'var(--pr-red, #ff4747)'
})
const accuracyHint = computed(() => {
  if (!stats.accepted) return 'Accept and complete rides to build your score'
  if (accuracy.value >= 80) return 'Excellent — keep it up!'
  if (accuracy.value >= 50) return 'Good — try to complete more accepted rides'
  return 'Complete more rides after accepting to improve'
})

// ── Fetch rides ────────────────────────────────────────────────────
const fetchRides = async () => {
  loading.value = true
  try {
    const params = new URLSearchParams({ status: activeFilter.value })
    const res = await $fetch(
      `${API_BASE}/rides/driver/${userStore._id}?${params}`
    )
    rides.value = res.rides || []
  } catch (err) {
    console.error('[History] fetch failed:', err.message)
  } finally {
    loading.value = false
  }
}

const setFilter = (val) => {
  activeFilter.value = val
  fetchRides()
}

// ── Clear history ──────────────────────────────────────────────────
// Deletes completed/cancelled/expired rides from MongoDB.
// The localStorage stat totals are NOT affected — they stay intact.
const clearHistory = async () => {
  if (!confirm('Clear completed and cancelled rides from history?\n\nYour total stats (accepted, completed, accuracy) will remain unchanged.')) return
  clearing.value = true
  try {
    await $fetch(`${API_BASE}/rides/driver/${userStore._id}/clear-history`, {
      method: 'DELETE',
    })
    // Remove cleared rides from local list without refetching
    rides.value = rides.value.filter(
      r => !['completed','cancelled','expired'].includes(r.status)
    )
  } catch (err) {
    console.error('[History] clear failed:', err.message)
  } finally {
    clearing.value = false
  }
}

// ── Formatters ─────────────────────────────────────────────────────

// Smart timestamp: "Just now" / "3h ago" / "Yesterday 14:30" / "12 May 14:30"
const formatDate = (d) => {
  if (!d) return ''
  const now  = new Date()
  const then = new Date(d)
  const mins = Math.floor((now - then) / 60_000)
  const hrs  = Math.floor((now - then) / 3_600_000)
  if (mins < 1)  return 'Just now'
  if (mins < 60) return `${mins}m ago`
  if (hrs  < 24) return `${hrs}h ago`
  const yd = new Date(now); yd.setDate(yd.getDate() - 1)
  const t  = then.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
  if (then.toDateString() === yd.toDateString()) return `Yesterday ${t}`
  return `${then.toLocaleDateString([], { day:'numeric', month:'short' })} ${t}`
}

const formatCoords = (loc) =>
  loc?.lat ? `${Number(loc.lat).toFixed(4)}, ${Number(loc.lng).toFixed(4)}` : 'Not specified'

const passengerInitials = (p) =>
  (p?.name || '??').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)

const statusClass = (s) => ({
  accepted:'active', ongoing:'active', completed:'done',
  cancelled:'cancelled', expired:'expired', pending:'pending',
}[s] || 'pending')

const statusLabel = (s) => ({
  accepted:'Accepted', ongoing:'Ongoing', completed:'Completed',
  cancelled:'Cancelled', expired:'Expired', pending:'Pending',
}[s] || s)

// ── Init ───────────────────────────────────────────────────────────
onMounted(fetchRides)
</script>

<style scoped>
/* Header */
.hist-header {
  display:flex; align-items:center; gap:14px;
  padding:20px 16px 12px;
}
.back-btn {
  width:36px; height:36px; border-radius:50%; flex-shrink:0;
  background:var(--pr-surface2); border:1px solid var(--pr-border);
  font-size:16px; cursor:pointer; display:flex; align-items:center; justify-content:center;
  color:var(--pr-text);
}
.hist-title { font-size:20px; font-weight:800; margin:0 0 2px; }
.hist-sub   { font-size:12px; color:var(--pr-muted); margin:0; }

/* Stats section */
.stats-section  { padding:0 16px 20px; }
.section-label  { font-size:11px; font-weight:700; color:var(--pr-muted); text-transform:uppercase; letter-spacing:0.06em; margin:0 0 12px; }
.stats-grid     { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.stat-card {
  background:var(--pr-surface); border:1px solid var(--pr-border);
  border-radius:12px; padding:14px 12px; display:flex; flex-direction:column; gap:4px;
}
.stat-card--wide { grid-column:1/-1; }
.stat-value     { font-size:26px; font-weight:800; margin:0; line-height:1; }
.stat-label     { font-size:11px; color:var(--pr-muted); margin:0; line-height:1.4; }

/* Accuracy bar */
.accuracy-row   { display:flex; align-items:center; gap:12px; margin-bottom:4px; }
.accuracy-bar-wrap {
  flex:1; height:6px; border-radius:3px; background:var(--pr-surface2); overflow:hidden;
}
.accuracy-bar   { height:100%; border-radius:3px; transition:width 0.6s ease; }
.stat-hint      { font-size:10px; color:var(--pr-muted); margin:2px 0 0; font-style:italic; }

/* Rides section */
.rides-section  { padding:0 16px 40px; }
.filter-tabs-wrap { overflow-x:auto; -webkit-overflow-scrolling:touch; margin-bottom:16px; }
.filter-tabs    { display:flex; gap:8px; padding-bottom:2px; }
.filter-tab {
  padding:7px 16px; border-radius:999px; flex-shrink:0;
  background:var(--pr-surface2); border:1px solid var(--pr-border);
  color:var(--pr-muted); font-size:12px; font-weight:600; cursor:pointer;
  transition:all 0.15s;
}
.filter-tab--active {
  background:rgba(0,212,184,0.15); border-color:rgba(0,212,184,0.4); color:var(--pr-teal);
}

/* Actions */
.rides-actions  { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
.clear-btn {
  padding:6px 12px; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer;
  background:rgba(255,71,71,0.08); border:1px solid rgba(255,71,71,0.25);
  color:var(--pr-red,#ff4747); transition:all 0.15s;
}
.clear-btn:hover    { background:rgba(255,71,71,0.15); }
.clear-btn:disabled { opacity:0.5; cursor:not-allowed; }

/* Skeleton loading */
.skeleton-list  { display:flex; flex-direction:column; gap:10px; }
.skeleton-card  {
  height:140px; border-radius:12px; background:var(--pr-surface2);
  animation:shimmer 1.4s ease-in-out infinite;
}
@keyframes shimmer { 0%,100%{opacity:0.6} 50%{opacity:1} }

/* Empty state */
.empty-state    { text-align:center; padding:60px 20px; }
.empty-icon     { font-size:36px; margin-bottom:10px; }
.empty-title    { font-size:15px; font-weight:600; margin-bottom:6px; }
.empty-sub      { font-size:13px; color:var(--pr-muted); line-height:1.5; }

/* Ride cards */
.rides-list     { display:flex; flex-direction:column; gap:10px; }
.ride-card {
  background:var(--pr-surface); border:1px solid var(--pr-border);
  border-radius:12px; padding:14px 14px 10px; overflow:hidden;
}
.ride-card--done      { border-left:3px solid var(--pr-teal); }
.ride-card--cancelled { border-left:3px solid rgba(255,71,71,0.5); }
.ride-card--active    { border-left:3px solid var(--pr-orange); }

/* Card top row */
.ride-card-top  { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
.ride-status-badge { font-size:11px; font-weight:700; padding:3px 9px; border-radius:999px; }
.badge--done      { background:rgba(0,212,184,0.12); color:var(--pr-teal); }
.badge--cancelled { background:rgba(255,71,71,0.1);  color:var(--pr-red,#ff4747); }
.badge--active    { background:rgba(255,107,53,0.12); color:var(--pr-orange); }
.badge--pending   { background:rgba(240,192,64,0.12); color:var(--pr-yellow); }
.ride-time        { font-size:11px; color:var(--pr-muted); }

/* Passenger row */
.ride-passenger { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
.ride-avatar {
  width:34px; height:34px; border-radius:50%; flex-shrink:0;
  background:rgba(0,212,184,0.12); border:1.5px solid rgba(0,212,184,0.2);
  display:flex; align-items:center; justify-content:center;
  font-size:12px; font-weight:700; color:var(--pr-teal);
}
.ride-passenger-name  { font-size:13px; font-weight:600; margin:0 0 1px; }
.ride-passenger-phone { font-size:11px; color:var(--pr-muted); margin:0; }
.ride-type-badge      { margin-left:auto; font-size:11px; color:var(--pr-muted); white-space:nowrap; }

/* Trip rows */
.ride-trip      { margin-bottom:8px; display:flex; flex-direction:column; }
.ride-trip-row  { display:flex; align-items:flex-start; gap:8px; padding:4px 0; }
.trip-dot       { width:10px; height:10px; border-radius:50%; flex-shrink:0; margin-top:3px; }
.trip-dot--pickup { background:var(--pr-teal); }
.trip-dot--dest   { background:var(--pr-orange); border-radius:3px; }
.trip-connector { padding-left:4px; }
.trip-line      { width:2px; height:10px; background:linear-gradient(to bottom,var(--pr-teal),var(--pr-orange)); opacity:0.4; border-radius:1px; }
.trip-text      { font-size:12px; color:var(--pr-muted); margin:0; line-height:1.3; }
.ride-region    { font-size:11px; color:var(--pr-muted); margin:0; }
</style>