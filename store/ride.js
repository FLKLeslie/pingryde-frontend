// store/ride.js — Global ride state
//
// NEW FIELDS:
//   chatMessages — in-ride chat between passenger and driver
//   feedbackPending — passenger needs to confirm ride completion
//   expiredNotification — ride expired message to show passenger

import { defineStore } from 'pinia'

export const useRideStore = defineStore('ride', {
  state: () => ({
    ride:              null,
    passengerLocation: null,
    driverLocation:    null,
    assignedDriver:    null,
    pendingRequests:   [],
    chatMessages:      [],
    chatReady:         false,
    feedbackPending:   false,
    expiredNotification: null,
    // arrivedMessage: set when server confirms driver + passenger are within 2m.
    // Shown as a notification card on the tracking page.
    arrivedMessage:    null,
  }),

  getters: {
    hasActiveRide: (s) => s.ride && ['accepted','ongoing'].includes(s.ride.status),
    isPending:     (s) => s.ride?.status === 'pending',
    isCancelled:   (s) => s.ride?.status === 'cancelled',
    isExpired:     (s) => s.ride?.status === 'expired',
  },

  actions: {
    setRide(ride)              { this.ride = ride },
    updateStatus(status)       { if (this.ride) this.ride.status = status },
    updateDriverLocation(c)    { this.driverLocation = c },
    updatePassengerLocation(c) { this.passengerLocation = c },
    setAssignedDriver(d)       { this.assignedDriver = d },

    // Chat
    addChatMessage(msg) {
      // Avoid duplicates
      const exists = this.chatMessages.find(m => m.sentAt === msg.sentAt && m.text === msg.text)
      if (!exists) this.chatMessages.push(msg)
    },
    setChatMessages(msgs) { this.chatMessages = msgs || [] },
    clearChat()           { this.chatMessages = [] },
    setChatReady(val)     { this.chatReady = val },

    // Feedback / expiry notifications
    setFeedbackPending(val)       { this.feedbackPending = val },
    setExpiredNotification(data)  { this.expiredNotification = data },
    setArrivedMessage(msg)        { this.arrivedMessage = msg },

    addPendingRequest(req) {
      const id = req.rideId || req._id
      if (!this.pendingRequests.find(r => (r.rideId || r._id) === id)) {
        this.pendingRequests.unshift(req)
      }
    },
    removeRequest(rideId) {
      this.pendingRequests = this.pendingRequests.filter(r => (r.rideId || r._id) !== rideId)
    },
    removeFirstPending() { this.pendingRequests.shift() },

    clearRide() {
      this.ride              = null
      this.passengerLocation = null
      this.driverLocation    = null
      this.assignedDriver    = null
      this.chatMessages      = []
      this.chatReady         = false
      this.feedbackPending   = false
      this.expiredNotification = null
      this.arrivedMessage    = null
    },
  },
})