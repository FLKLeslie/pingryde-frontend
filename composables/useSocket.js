// composables/useSocket.js — Complete socket event handler
//
// EVENTS:
//  BROWSER → SERVER:
//    passengerOnline, driverOnline, joinRide,
//    driverLocationUpdate, acceptRide, completeRide
//
//  SERVER → BROWSER:
//    newRide, newRideBroadcast,
//    driverLocation,
//    rideAccepted, rideAcceptedPassenger,
//    rideAlreadyTaken, rideCompleted,
//    rideCancelled,    ← NEW: ride was cancelled
//    rideExpired,      ← NEW: ride expired (no driver accepted in time)
//    requestFeedback,  ← NEW: driver marked complete, ask passenger
//    chatMessage,      ← NEW: in-ride chat message

import { io }           from 'socket.io-client'
import { useRideStore } from '~/store/ride'
import { useUserStore } from '~/store/user'
import { SOCKET_URL }   from '~/utils/api'

let socket = null

export const useSocket = () => {
  const rideStore = useRideStore()
  const userStore = useUserStore()

  const connect = () => {
    if (socket?.connected) return

    socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
    })

    socket.on('connect', () => console.log('[Socket] ✅ Connected:', socket.id))
    socket.on('connect_error', (e) => console.error('[Socket] ❌ Failed:', e.message))
    socket.on('disconnect', (r) => console.warn('[Socket] Disconnected:', r))

    // ── Incoming ride (targeted) ─────────────────────────────────
    socket.on('newRide', (data) => {
      console.log('[Socket] 🚗 New ride (direct):', data.rideId)
      rideStore.addPendingRequest(data)
    })

    // ── Incoming ride (broadcast fallback) ──────────────────────
    // Every socket receives this; we self-filter by role + nearestDriverIds
    socket.on('newRideBroadcast', (data) => {
      if (userStore.role !== 'driver') return
      const myId = userStore._id?.toString()
      if (!myId || !data.nearestDriverIds?.includes(myId)) return
      console.log('[Socket] 📡 Broadcast ride (I match):', data.rideId)
      rideStore.addPendingRequest(data)
    })

    // ── Driver's live GPS (received by passenger) ────────────────
    socket.on('driverLocation', (coords) => {
      rideStore.updateDriverLocation(coords)
    })

    // ── Ride accepted — driver side ──────────────────────────────
    socket.on('rideAccepted', ({ ride, driver }) => {
      console.log('[Socket] ✅ Driver: accepted:', ride?._id)
      rideStore.setRide(ride)
      rideStore.updateStatus('accepted')
    })

    // ── Ride accepted — passenger side (KEY FIX) ─────────────────
    socket.on('rideAcceptedPassenger', ({ ride, driver }) => {
      console.log('[Socket] 🎉 Passenger: driver accepted:', driver?.name)
      rideStore.setRide(ride)
      rideStore.updateStatus('accepted')
      rideStore.setAssignedDriver(driver)
    })

    // ── Another driver was faster ────────────────────────────────
    socket.on('rideAlreadyTaken', () => {
      rideStore.removeFirstPending()
    })

    // ── Ride completed (both parties notified) ───────────────────
    socket.on('rideCompleted', ({ rideId }) => {
      if (rideStore.ride?._id?.toString() === rideId?.toString()) {
        rideStore.updateStatus('completed')
      }
    })

    // ── Ride cancelled ───────────────────────────────────────────
    // Fired when either party cancels. Both receive this.
    socket.on('rideCancelled', ({ rideId, cancelledBy }) => {
      console.log('[Socket] ❌ Ride cancelled by', cancelledBy)
      if (rideStore.ride?._id?.toString() === rideId?.toString()) {
        rideStore.updateStatus('cancelled')
      }
    })

    // ── Ride expired (passenger only) ────────────────────────────
    // Fired by server expiry cron when no driver accepted in time
    socket.on('rideExpired', ({ rideId, message }) => {
      console.log('[Socket] ⏰ Ride expired:', rideId)
      if (rideStore.ride?._id?.toString() === rideId?.toString()) {
        rideStore.updateStatus('expired')
        rideStore.setExpiredNotification({ message })
      }
    })

    // ── Feedback request (passenger only) ────────────────────────
    // Driver marked complete; server asks passenger to confirm
    socket.on('requestFeedback', ({ rideId, message }) => {
      console.log('[Socket] ❓ Feedback requested for ride:', rideId)
      if (rideStore.ride?._id?.toString() === rideId?.toString()) {
        rideStore.setFeedbackPending(true)
      }
    })

    // ── In-ride chat message ──────────────────────────────────────
    socket.on('chatMessage', (msg) => {
      console.log('[Socket] 💬 Chat from', msg.sender)
      rideStore.addChatMessage(msg)
    })
  }

  const registerPassenger = (userId)  => socket?.emit('passengerOnline', userId)
  const goOnline          = (driverId)=> socket?.emit('driverOnline', driverId)
  const joinRide          = (rideId)  => socket?.emit('joinRide', { rideId })
  const sendDriverLocation= (rideId, lat, lng) => socket?.emit('driverLocationUpdate', { rideId, lat, lng })
  const acceptRide        = (rideId, driverId)  => socket?.emit('acceptRide', { rideId, driverId })
  const completeRide      = (rideId)  => socket?.emit('completeRide', { rideId })

  const getSocketId = () => socket?.id ?? null
  const isConnected = () => socket?.connected ?? false
  const disconnect  = () => { socket?.disconnect(); socket = null }

  return {
    connect, disconnect,
    registerPassenger, goOnline,
    joinRide, sendDriverLocation,
    acceptRide, completeRide,
    getSocketId, isConnected,
  }
}