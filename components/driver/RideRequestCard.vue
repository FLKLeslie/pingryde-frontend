<!-- components/driver/RideRequestCard.vue
  Shows one ride request notification.
  Data shape from server "newRide" event: { rideId, pickup, destination }
  Data shape from GET /api/rides/driver/:id: ride object with passengerId populated
-->
<template>
  <div class="pr-card transition-all duration-200" :style="isNew ? 'border-color: rgba(255,107,53,0.45)' : ''">

    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2.5">
        <div class="pr-avatar pr-avatar-teal w-9 h-9 text-xs">
          {{ passengerInitials }}
        </div>
        <div>
          <p class="text-sm font-semibold leading-tight">{{ passengerName }}</p>
          <p class="text-xs leading-tight mt-0.5" style="color: var(--pr-muted)">{{ timeAgo }}</p>
        </div>
      </div>
      <span class="pr-badge"
            :style="rideType === 'bike'
              ? 'color: var(--pr-orange); background: rgba(255,107,53,0.12)'
              : 'color: var(--pr-teal); background: rgba(0,212,184,0.12)'">
        {{ rideType === 'bike' ? '🏍️ Bike' : '🚕 Taxi' }}
      </span>
    </div>

    <div class="flex items-center gap-4 mb-4 flex-wrap">
      <span class="text-xs flex items-center gap-1" style="color: var(--pr-muted)">
        📍 {{ request.region || 'Unknown region' }}
      </span>
      <span v-if="request.rideCategory === 'special'"
            class="text-xs px-2 py-0.5 rounded-full"
            style="background: rgba(240,192,64,0.12); color: var(--pr-yellow)">
        Special
      </span>
      <span class="ml-auto pr-badge pr-badge-pending">Pending</span>
    </div>

    <button @click="$emit('accept')" class="pr-btn pr-btn-primary" style="padding: 12px; font-size: 14px">
      Accept Ride
    </button>

  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ request: { type: Object, required: true } })
defineEmits(['accept'])

// Ride data may come from socket event or from REST API (populated passengerId)
const passengerName = computed(() => {
  if (props.request.passengerId?.name) return props.request.passengerId.name
  return 'Passenger'
})

const passengerInitials = computed(() =>
  passengerName.value.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
)

const rideType = computed(() => props.request.rideType || '—')

const isNew = computed(() => {
  const t = props.request.createdAt ? new Date(props.request.createdAt) : new Date()
  return (Date.now() - t.getTime()) < 3 * 60 * 1000
})

const timeAgo = computed(() => {
  if (!props.request.createdAt) return 'Just now'
  const mins = Math.floor((Date.now() - new Date(props.request.createdAt)) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  return `${Math.floor(mins / 60)}h ago`
})
</script>