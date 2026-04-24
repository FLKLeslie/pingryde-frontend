<!-- pages/passenger/rides.vue — Passenger ride history page
  Shows all rides: pending, accepted, completed, cancelled, expired.
  User can cancel pending rides from this page.
-->
<template>
  <div class="pr-page">

    <div style="margin-bottom:24px">
      <h1 style="font-size:22px;font-weight:800;margin:0 0 4px">My Rides</h1>
      <p style="font-size:13px;color:var(--pr-muted);margin:0">Your ride history</p>
    </div>

    <!-- Status filter -->
    <div class="pr-chips" style="margin-bottom:20px">
      <button
        v-for="f in filters" :key="f.value"
        @click="activeFilter = f.value"
        class="pr-chip"
        :class="activeFilter === f.value ? 'pr-chip-active' : 'pr-chip-inactive'"
      >
        {{ f.label }}
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" style="text-align:center;padding:48px 0;color:var(--pr-muted)">
      <div class="pr-spin" style="font-size:24px">⟳</div>
      <p style="margin-top:8px;font-size:13px">Loading rides...</p>
    </div>

    <!-- Rides list -->
    <div v-else class="pr-animate-stagger" style="display:flex;flex-direction:column;gap:14px">

      <div v-if="filteredRides.length === 0" style="text-align:center;padding:48px 0">
        <p style="font-size:32px;margin-bottom:10px">🛣️</p>
        <p style="font-size:15px;font-weight:600;margin:0 0 6px">No rides yet</p>
        <p style="font-size:13px;color:var(--pr-muted);margin:0 0 20px">
          {{ activeFilter ? 'No rides with this status' : 'Request your first ride!' }}
        </p>
        <button @click="$router.push('/passenger/request')" class="pr-btn pr-btn-primary pr-btn-inline">
          Request a Ride
        </button>
      </div>

      <!-- Ride card -->
      <div
        v-for="ride in filteredRides"
        :key="ride._id"
        class="ride-history-card"
      >
        <!-- Card header -->
        <div class="rhc-header">
          <div class="rhc-left">
            <span class="rhc-icon">
              {{ ride.rideType === 'bike' ? '🏍️' : ride.rideType === 'taxi' ? '🚕' : '📦' }}
            </span>
            <div>
              <p class="rhc-type">
                {{ ride.rideCategory === 'special' ? 'Special Ride' :
                   ride.rideType === 'bike' ? 'Motorbike Ride' : 'Taxi Ride' }}
              </p>
              <p class="rhc-date">{{ formatDate(ride.createdAt) }}</p>
            </div>
          </div>
          <span :class="`pr-badge pr-badge-${statusColor(ride.status)}`">
            {{ statusLabel(ride.status) }}
          </span>
        </div>

        <!-- Driver info (if assigned) -->
        <div v-if="ride.driverId" class="rhc-driver">
          <div class="rhc-driver-avatar">
            <img v-if="ride.driverId.profilePhoto"
                 :src="photoUrl(ride.driverId.profilePhoto)"
                 class="rhc-avatar-img" />
            <span v-else class="rhc-avatar-text">
              {{ ride.driverId.name?.charAt(0) || 'D' }}
            </span>
          </div>
          <div>
            <p class="rhc-driver-name">
              {{ ride.driverId.name }}
              <span v-if="ride.driverId.isVerified" class="verified-badge">✓</span>
            </p>
            <p class="rhc-driver-sub">
              {{ ride.driverId.vehicleType === 'bike' ? '🏍️' : '🚕' }}
              {{ ride.driverId.plateNumber || '' }}
            </p>
          </div>
        </div>

        <!-- Region -->
        <p class="rhc-region">📍 {{ ride.region }}</p>

        <!-- Actions -->
        <div class="rhc-actions">
          <!-- Cancel pending rides -->
          <button
            v-if="ride.status === 'pending'"
            @click="cancelRide(ride._id)"
            :disabled="cancelling === ride._id"
            class="pr-btn pr-btn-danger pr-btn-inline"
            style="font-size:13px;padding:9px 16px"
          >
            {{ cancelling === ride._id ? 'Cancelling...' : 'Cancel Request' }}
          </button>

          <!-- Re-request if expired/cancelled -->
          <button
            v-if="['expired','cancelled'].includes(ride.status)"
            @click="$router.push('/passenger/request')"
            class="pr-btn pr-btn-outline pr-btn-inline"
            style="font-size:13px;padding:9px 16px"
          >
            Request Again
          </button>
        </div>

      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '~/store/user'
import { API_BASE }     from '~/utils/api'

const BACKEND_URL = 'http://localhost:5000'
const userStore   = useUserStore()

const allRides    = ref([])
const loading     = ref(true)
const cancelling  = ref(null)
const activeFilter= ref('')

const filters = [
  { value:'',          label:'All' },
  { value:'pending',   label:'⏳ Pending' },
  { value:'accepted',  label:'✅ Accepted' },
  { value:'completed', label:'🏁 Completed' },
  { value:'cancelled', label:'❌ Cancelled' },
  { value:'expired',   label:'⏰ Expired' },
]

const filteredRides = computed(() =>
  activeFilter.value ? allRides.value.filter(r => r.status === activeFilter.value) : allRides.value
)

const statusColor = (s) => ({
  pending:'pending', accepted:'active', ongoing:'active',
  completed:'active', cancelled:'inactive', expired:'inactive',
}[s] || 'pending')

const statusLabel = (s) => ({
  pending:'Pending', accepted:'Accepted', ongoing:'Ongoing',
  completed:'Completed', cancelled:'Cancelled', expired:'Expired',
}[s] || s)

const formatDate = (d) => new Date(d).toLocaleDateString('en-GB', {
  day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'
})

const photoUrl = (path) => path ? `${BACKEND_URL}${path}` : null

onMounted(async () => {
  if (!userStore._id) return
  try {
    const res = await $fetch(`${API_BASE}/rides/passenger/${userStore._id}`)
    allRides.value = res.rides || []
  } catch (err) {
    console.error('Load rides error:', err)
  } finally {
    loading.value = false
  }
})

const cancelRide = async (rideId) => {
  cancelling.value = rideId
  try {
    await $fetch(`${API_BASE}/rides/${rideId}/cancel`, {
      method: 'PATCH',
      body:   { cancelledBy: 'passenger' },
    })
    const ride = allRides.value.find(r => r._id === rideId)
    if (ride) ride.status = 'cancelled'
  } catch (err) {
    console.error('Cancel error:', err)
  } finally {
    cancelling.value = null
  }
}
</script>

<style scoped>
.ride-history-card {
  background:    var(--pr-surface);
  border:        1px solid var(--pr-border);
  border-radius: var(--pr-radius);
  padding:       16px;
  transition:    border-color 0.2s;
}
.ride-history-card:hover { border-color: rgba(0,212,184,0.2); }

.rhc-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
.rhc-left   { display:flex; align-items:center; gap:10px; }
.rhc-icon   { font-size:22px; }
.rhc-type   { font-size:14px; font-weight:600; margin:0 0 2px; }
.rhc-date   { font-size:11px; color:var(--pr-muted); margin:0; }

.rhc-driver {
  display:flex; align-items:center; gap:10px;
  margin-bottom:10px; padding:10px;
  background:var(--pr-surface2); border-radius:8px;
}
.rhc-driver-avatar {
  width:34px; height:34px; border-radius:50%; flex-shrink:0;
  background:rgba(255,107,53,0.15); overflow:hidden;
  display:flex; align-items:center; justify-content:center;
}
.rhc-avatar-img  { width:100%; height:100%; object-fit:cover; }
.rhc-avatar-text { font-size:13px; font-weight:700; color:var(--pr-orange); }
.rhc-driver-name { font-size:13px; font-weight:600; margin:0 0 1px; display:flex; align-items:center; gap:4px; }
.rhc-driver-sub  { font-size:11px; color:var(--pr-muted); margin:0; }

.verified-badge {
  font-size:9px; background:rgba(0,212,184,0.15); color:var(--pr-teal);
  padding:1px 5px; border-radius:999px; font-weight:700;
}

.rhc-region  { font-size:12px; color:var(--pr-muted); margin:0 0 12px; }
.rhc-actions { display:flex; gap:8px; flex-wrap:wrap; }
</style>