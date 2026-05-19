// store/ride.js — PingRyde ride state (Pinia)
// ─────────────────────────────────────────────────────────────────
// MULTI-RIDE ARCHITECTURE
//
// A driver can have multiple active rides (e.g. a normal ride with
// passenger A and a special ride with passenger B).
// A passenger can also have multiple active rides simultaneously.
//
// STATE STRUCTURE:
//   activeRides   — Map<rideId, RideSession>
//   pendingRequests — incoming ride requests (driver side)
//
// RideSession shape:
//   {
//     ride:              Ride document
//     passengerLocation: { lat, lng } | null
//     driverLocation:    { lat, lng } | null
//     assignedDriver:    Driver document | null   (passenger side)
//     messages:          ChatMessage[]            (per-ride chat history)
//     unread:            number                   (unread count for badge)
//     feedbackPending:   boolean
//     expiredMsg:        string | null
//     chatReady:         boolean
//   }
//
// HOW TO USE:
//   const rideStore = useRideStore()
//
//   // Get a specific ride session
//   const session = rideStore.getSession(rideId)
//
//   // Get all active sessions as an array (for the rides list UI)
//   const sessions = rideStore.sessions
//
//   // Backwards-compatible helpers (single-ride mode)
//   rideStore.ride              → first active ride (or null)
//   rideStore.passengerLocation → location for the first active ride
//   rideStore.chatMessages      → messages for the first active ride
// ─────────────────────────────────────────────────────────────────

import { defineStore } from 'pinia'

// Default shape for a ride session
const emptySession = (ride) => ({
  ride,
  passengerLocation: null,
  driverLocation:    null,
  assignedDriver:    null,
  messages:          [],
  unread:            0,
  feedbackPending:   false,
  expiredMsg:        null,
  chatReady:         false,
})

export const useRideStore = defineStore('ride', {

  state: () => ({
    // activeRides: object acting as Map<rideId string, RideSession>
    // We use a plain object (not Map) so Pinia can track it reactively.
    activeRides:     {},
    pendingRequests: [],
  }),

  getters: {

    // All active sessions as an array — use for the rides list UI
    sessions: (s) => Object.values(s.activeRides),

    // ── Backwards-compatible single-ride helpers ───────────────────
    // These return data for the FIRST active session.
    // Pages that only ever deal with one ride at a time can keep using these.

    ride: (s) => {
      const sessions = Object.values(s.activeRides)
      return sessions.length ? sessions[0].ride : null
    },
    passengerLocation: (s) => {
      const sessions = Object.values(s.activeRides)
      return sessions.length ? sessions[0].passengerLocation : null
    },
    driverLocation: (s) => {
      const sessions = Object.values(s.activeRides)
      return sessions.length ? sessions[0].driverLocation : null
    },
    assignedDriver: (s) => {
      const sessions = Object.values(s.activeRides)
      return sessions.length ? sessions[0].assignedDriver : null
    },
    chatMessages: (s) => {
      const sessions = Object.values(s.activeRides)
      return sessions.length ? sessions[0].messages : []
    },
    feedbackPending: (s) => {
      const sessions = Object.values(s.activeRides)
      return sessions.some(sess => sess.feedbackPending)
    },

    // Total unread across all rides — for the nav badge
    totalUnread: (s) => Object.values(s.activeRides).reduce((n, sess) => n + (sess.unread || 0), 0),

    hasActiveRide: (s) => Object.values(s.activeRides).some(
      sess => ['accepted','ongoing'].includes(sess.ride?.status)
    ),
  },

  actions: {

    // ── Internal: get or create a session for a ride ───────────────
    _session(rideId) {
      const key = rideId?.toString()
      if (!key) return null
      if (!this.activeRides[key]) this.activeRides[key] = emptySession(null)
      return this.activeRides[key]
    },

    // ── Get a session by rideId (for components) ───────────────────
    getSession(rideId) {
      return this.activeRides[rideId?.toString()] || null
    },

    // ── Add / update a ride ────────────────────────────────────────
    setRide(ride) {
      if (!ride?._id) return
      const key  = ride._id.toString()
      const sess = this.activeRides[key] || emptySession(ride)
      sess.ride  = ride
      this.activeRides[key] = sess
    },

    updateStatus(rideId, status) {
      const key  = rideId?.toString() || Object.keys(this.activeRides)[0]
      const sess = this.activeRides[key]
      if (sess?.ride) sess.ride.status = status
    },

    // ── Location updates ───────────────────────────────────────────
    updateDriverLocation(rideId, coords) {
      // rideId optional for backwards compatibility — falls back to first session
      const key  = rideId?.toString() || Object.keys(this.activeRides)[0]
      const sess = this._session(key)
      if (sess) sess.driverLocation = coords
    },

    updatePassengerLocation(rideId, coords) {
      const key  = rideId?.toString() || Object.keys(this.activeRides)[0]
      const sess = this._session(key)
      if (sess) sess.passengerLocation = coords
    },

    // Backwards-compat: update without rideId uses first session
    updateDriverLocationCompat(coords)    { this.updateDriverLocation(null, coords) },
    updatePassengerLocationCompat(coords) { this.updatePassengerLocation(null, coords) },

    // ── Driver info ────────────────────────────────────────────────
    setAssignedDriver(rideId, driver) {
      const key  = rideId?.toString() || Object.keys(this.activeRides)[0]
      const sess = this._session(key)
      if (sess) sess.assignedDriver = driver
    },

    // ── Chat (per-ride) ────────────────────────────────────────────
    addChatMessage(msg) {
      // msg must contain rideId to route to the right session
      const key  = msg.rideId?.toString() || Object.keys(this.activeRides)[0]
      const sess = this._session(key)
      if (!sess) return

      // Deduplicate: same sender + text within 2 seconds
      const msgTime = new Date(msg.sentAt).getTime()
      const exists  = sess.messages.some(m =>
        m.sender === msg.sender &&
        m.text   === msg.text   &&
        Math.abs(new Date(m.sentAt).getTime() - msgTime) < 2000
      )
      if (!exists) {
        sess.messages.push({ ...msg, read: msg.read ?? false })
        // Increment unread if the message is from the other party
        if (!msg.read) sess.unread = (sess.unread || 0) + 1
      }
    },

    setChatMessages(rideId, msgs) {
      const key  = rideId?.toString() || Object.keys(this.activeRides)[0]
      const sess = this._session(key)
      if (sess) {
        sess.messages = (msgs || []).map(m => ({ ...m, read: m.read ?? false }))
        sess.unread   = sess.messages.filter(m => !m.read).length
      }
    },

    markMessagesRead(rideId) {
      const key  = rideId?.toString() || Object.keys(this.activeRides)[0]
      const sess = this.activeRides[key]
      if (!sess) return
      sess.messages.forEach(m => { m.read = true })
      sess.unread = 0
    },

    setChatReady(rideId, val) {
      const key  = rideId?.toString() || Object.keys(this.activeRides)[0]
      const sess = this._session(key)
      if (sess) sess.chatReady = val
    },

    // ── Feedback / expiry ──────────────────────────────────────────
    setFeedbackPending(rideId, val) {
      const key  = rideId?.toString() || Object.keys(this.activeRides)[0]
      const sess = this._session(key)
      if (sess) sess.feedbackPending = val
    },

    setExpiredMsg(rideId, msg) {
      const key  = rideId?.toString() || Object.keys(this.activeRides)[0]
      const sess = this._session(key)
      if (sess) sess.expiredMsg = msg
    },

    // ── Pending requests (driver side) ─────────────────────────────
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
    removeFirstPending() { this.pendingRequests.shift() },
    clearPendingRequests() { this.pendingRequests = [] },

    // ── Clear a single ride session ────────────────────────────────
    clearRide(rideId) {
      const key = rideId?.toString() || Object.keys(this.activeRides)[0]
      if (key) delete this.activeRides[key]
    },

    // ── Clear ALL sessions (logout) ────────────────────────────────
    clearAll() {
      this.activeRides     = {}
      this.pendingRequests = []
    },
  },
})