<!-- pages/passenger/status.vue — Ride summary + timeline -->
<template>
  <div class="pr-page">

    <div class="px-5 pt-6 pb-4 pr-safe-top">
      <h2 class="text-xl font-bold">Ride Status</h2>
      <p class="text-xs mt-0.5" style="color: var(--pr-muted)">Your current ride summary</p>
    </div>

    <!-- No active ride -->
    <div v-if="!rideStore.ride" class="flex flex-col items-center justify-center py-20 px-6 text-center">
      <p style="font-size: 48px" class="mb-4">🚫</p>
      <p class="font-bold text-lg">No active ride</p>
      <p class="text-sm mt-2 mb-6" style="color: var(--pr-muted)">Request a ride to get started.</p>
      <button @click="$router.push('/passenger/request')" class="pr-btn pr-btn-primary" style="width: auto; padding: 14px 32px">
        Request a Ride
      </button>
    </div>

    <div v-else class="px-4 space-y-4 pb-28">

      <!-- Progress timeline -->
      <div class="pr-card">
        <p class="pr-section-label mb-4">Ride progress</p>
        <div class="relative pl-10">
          <!-- Connecting line -->
          <div class="absolute left-4 top-3 bottom-3 w-px" style="background: var(--pr-border)" />

          <div class="space-y-6">
            <div v-for="(step, i) in steps" :key="i" class="flex items-start gap-3 relative">
              <!-- Step indicator -->
              <div class="absolute -left-6 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10"
                   :style="step.done
                     ? 'background: var(--pr-teal)'
                     : step.active
                       ? 'background: transparent; border: 2px solid var(--pr-teal)'
                       : 'background: var(--pr-surface2); border: 1px solid var(--pr-border)'">
                <span v-if="step.done" class="text-xs font-bold text-[#1E2A32]">✓</span>
                <div v-else-if="step.active" class="w-2 h-2 rounded-full animate-pulse" style="background: var(--pr-teal)" />
              </div>
              <div>
                <p class="text-sm font-medium" :style="!step.done && !step.active ? 'color: var(--pr-muted)' : ''">
                  {{ step.label }}
                </p>
                <p class="text-xs mt-0.5" style="color: var(--pr-muted)">{{ step.description }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Ride details -->
      <div class="pr-card">
        <p class="pr-section-label mb-3">Ride details</p>
        <div class="space-y-0">
          <div v-for="d in details" :key="d.label"
               class="flex items-center justify-between py-3"
               style="border-bottom: 1px solid var(--pr-border)">
            <span class="text-sm" style="color: var(--pr-muted)">{{ d.label }}</span>
            <span class="text-sm font-medium">{{ d.value }}</span>
          </div>
        </div>
      </div>

      <!-- Driver card (after acceptance) -->
      <div v-if="rideStore.assignedDriver" class="pr-card">
        <p class="pr-section-label mb-3">Your driver</p>
        <div class="flex items-center gap-3">
          <div class="pr-avatar pr-avatar-orange w-12 h-12 text-sm">{{ driverInitials }}</div>
          <div class="flex-1 min-w-0">
            <p class="font-semibold truncate">{{ rideStore.assignedDriver.name }}</p>
            <p class="text-xs mt-0.5" style="color: var(--pr-muted)">
              {{ rideStore.assignedDriver.vehicleType === 'bike' ? '🏍️ Motorbike' : '🚕 Taxi' }}
            </p>
          </div>
          <div class="flex gap-2">
            <a :href="`tel:${rideStore.assignedDriver.phone}`"
               class="w-9 h-9 rounded-full flex items-center justify-center"
               style="background: rgba(0,212,184,0.12); border: 1px solid rgba(0,212,184,0.3); font-size: 14px">
              📞
            </a>
            <button @click="$router.push('/passenger/tracking')"
                    class="w-9 h-9 rounded-full flex items-center justify-center"
                    style="background: rgba(0,212,184,0.12); border: 1px solid rgba(0,212,184,0.3); font-size: 14px">
              🗺️
            </button>
          </div>
        </div>
      </div>

      <!-- Completed CTA -->
      <div v-if="rideStore.ride.status === 'completed'" class="pr-card text-center py-6">
        <p style="font-size: 40px" class="mb-3">🎉</p>
        <p class="font-bold text-lg">Ride Complete!</p>
        <p class="text-xs mt-2 mb-4" style="color: var(--pr-muted)">Thanks for using PingRyde</p>
        <button @click="newRide" class="pr-btn pr-btn-primary">Request Another Ride</button>
      </div>

      <!-- Cancel (pending only) -->
      <button v-if="rideStore.ride.status === 'pending'" @click="cancelRide"
              class="pr-btn pr-btn-danger" style="font-size: 14px; padding: 12px">
        Cancel Ride
      </button>

    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useRideStore } from '~/store/ride'

const router    = useRouter()
const rideStore = useRideStore()

const driverInitials = computed(() =>
  rideStore.assignedDriver?.name?.split(' ').map((n) => n[0]).join('').toUpperCase() || 'DR'
)

const steps = computed(() => {
  const s = rideStore.ride?.status
  return [
    { label: 'Ride Requested',   description: 'Request sent to nearby drivers',           done: ['accepted','ongoing','completed'].includes(s), active: s==='pending' },
    { label: 'Driver Found',     description: 'A driver accepted your request',            done: ['ongoing','completed'].includes(s),            active: s==='accepted' },
    { label: 'En Route',         description: 'Moving toward each other on the map',       done: s==='completed',                               active: s==='ongoing' },
    { label: 'Ride Complete',    description: 'You have reached your destination',         done: false,                                         active: s==='completed' },
  ]
})

const details = computed(() => {
  const r = rideStore.ride
  if (!r) return []
  return [
    { label: 'Type',     value: r.rideType === 'bike' ? '🏍️ Motorbike' : r.rideType === 'taxi' ? '🚕 Taxi' : '—' },
    { label: 'Category', value: r.rideCategory === 'special' ? '📦 Special' : '🚗 Normal' },
    { label: 'Region',   value: r.region || '—' },
    { label: 'Status',   value: r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : '—' },
  ]
})

const cancelRide = () => { rideStore.clearRide(); router.push('/passenger/request') }
const newRide    = () => { rideStore.clearRide(); router.push('/passenger/request') }
</script>