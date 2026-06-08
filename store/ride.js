// store/ride.js — Global ride state (Pinia)
//
// PERSISTENCE:
//   The active ride is saved to localStorage whenever setRide() is called,
//   and cleared when clearRide() is called.
//   This ensures that if the driver or passenger refreshes the page while
//   a ride is active, they don't lose the active ride session.
//
// FIELDS:
//   ride              — the active Ride document
//   passengerLocation — { lat, lng } live GPS from passenger
//   driverLocation    — { lat, lng } live GPS from driver
//   assignedDriver    — populated Driver doc (passenger side)
//   pendingRequests   — incoming ride requests (driver side)
//   chatMessages      — in-ride chat messages
//   chatReady         — true when ride accepted → load chat history
//   feedbackPending   — driver marked complete, passenger must confirm
//   expiredNotification — set when ride expires (no driver found)
//   arrivedMessage    — set when server detects <2m proximity

import { defineStore } from 'pinia'

const RIDE_KEY = 'pr_active_ride'

// Attempt to restore a ride that was persisted before the last page refresh
const loadPersistedRide = () => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(RIDE_KEY) : null
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export const useRideStore = defineStore('ride', {
  state: () => ({
    // On first load, try to restore from localStorage
    ride:                loadPersistedRide(),
    passengerLocation:   null,
    driverLocation:      null,
    assignedDriver:      null,
    pendingRequests:     [],
    chatMessages:        [],
    chatReady:           false,
    feedbackPending:     false,
    expiredNotification: null,
    arrivedMessage:      null,
  }),

  actions: {

    // Save ride to memory AND localStorage
    setRide(ride) {
      this.ride = ride
      try { localStorage.setItem(RIDE_KEY, JSON.stringify(ride)) } catch {}
    },

    // Update status in memory AND in localStorage
    updateStatus(status) {
      if (this.ride) {
        this.ride.status = status
        try { localStorage.setItem(RIDE_KEY, JSON.stringify(this.ride)) } catch {}
      }
    },

    // ── Location updates ──────────────────────────────────────────
    updateDriverLocation(c)    { this.driverLocation    = c },
    updatePassengerLocation(c) { this.passengerLocation = c },

    // ── Driver info (passenger side) ──────────────────────────────
    setAssignedDriver(d) { this.assignedDriver = d },

    // ── Chat ──────────────────────────────────────────────────────
    // Deduplicates by sender + text within a 2-second window
    // so the sender doesn't see their own message appear twice
    addChatMessage(msg) {
      const msgTime = new Date(msg.sentAt).getTime()
      const exists  = this.chatMessages.some(m =>
        m.sender === msg.sender &&
        m.text   === msg.text   &&
        Math.abs(new Date(m.sentAt).getTime() - msgTime) < 2000
      )
      if (!exists) this.chatMessages.push({ ...msg, read: msg.read ?? false })
    },
    setChatMessages(msgs) {
      this.chatMessages = (msgs || []).map(m => ({ ...m, read: m.read ?? false }))
    },
    clearChat()       { this.chatMessages = [] },
    setChatReady(val) { this.chatReady    = val },

    // ── Feedback / expiry / arrival ───────────────────────────────
    setFeedbackPending(val)      { this.feedbackPending     = val },
    setExpiredNotification(data) { this.expiredNotification = data },
    setArrivedMessage(msg)       { this.arrivedMessage      = msg },

    // ── Pending requests (driver side) ────────────────────────────
    addPendingRequest(req) {
      const id = (req.rideId || req._id)?.toString()
      if (!this.pendingRequests.find(r => (r.rideId || r._id)?.toString() === id)) {
        this.pendingRequests.unshift(req)
      }
    },
    removeRequest(rideId) {
      this.pendingRequests = this.pendingRequests.filter(
        r => (r.rideId || r._id)?.toString() !== rideId?.toString()
      )
    },
    removeFirstPending()   { this.pendingRequests.shift() },
    clearPendingRequests() { this.pendingRequests = [] },

    // ── Clear everything ──────────────────────────────────────────
    // Also removes the localStorage backup so refresh starts clean
    clearRide() {
      this.ride                = null
      this.passengerLocation   = null
      this.driverLocation      = null
      this.assignedDriver      = null
      this.chatMessages        = []
      this.chatReady           = false
      this.feedbackPending     = false
      this.expiredNotification = null
      this.arrivedMessage      = null
      try { localStorage.removeItem(RIDE_KEY) } catch {}
    },
  },
})