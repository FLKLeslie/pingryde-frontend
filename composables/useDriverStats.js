// composables/useDriverStats.js
// ─────────────────────────────────────────────────────────────────
// Persistent lifetime stats for the driver.
//
// Stats are stored in localStorage so they survive page refreshes,
// log-outs, and even if the driver clears ride history from the DB.
// The numbers only ever increase — clearing history does NOT reset them.
//
// FIELDS:
//   received  — total ride requests this driver ever received
//   accepted  — total rides they accepted
//   completed — total rides they completed
//
// ACCURACY = (completed / accepted) × 100
//
// USAGE:
//   const { stats, increment, accuracy } = useDriverStats(driverId)
//   increment('accepted')   → stats.accepted++, saved to localStorage
// ─────────────────────────────────────────────────────────────────

import { reactive, computed } from 'vue'

export const useDriverStats = (driverId) => {
  const KEY = `pr_driver_stats_${driverId}`

  // Reactive stats object — shared across all composable instances
  // for the same driver (Vue's reactivity system keeps them in sync)
  const stats = reactive({ received: 0, accepted: 0, completed: 0 })

  // Load from localStorage into the reactive object
  const load = () => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) {
        const s = JSON.parse(raw)
        stats.received  = s.received  || 0
        stats.accepted  = s.accepted  || 0
        stats.completed = s.completed || 0
      }
    } catch {}
  }

  // Persist current stats back to localStorage
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        received:  stats.received,
        accepted:  stats.accepted,
        completed: stats.completed,
      }))
    } catch {}
  }

  // Increment one stat and immediately persist it
  const increment = (key) => {
    if (key in stats) {
      stats[key]++
      save()
    }
  }

  // Accuracy percentage — 0 if no rides accepted yet
  const accuracy = computed(() => {
    if (!stats.accepted) return 0
    return Math.round((stats.completed / stats.accepted) * 100)
  })

  // Load on first use
  load()

  return { stats, increment, accuracy, load }
}