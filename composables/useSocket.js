// composables/useSocket.js
// ─────────────────────────────────────────────────────────────────
// SOCKET.IO CLIENT — single shared connection for the whole app
// Compatible with the current store/ride.js (single-ride store).
// ─────────────────────────────────────────────────────────────────

import { io }           from 'socket.io-client'
import { useRideStore } from '~/store/ride'
import { useUserStore } from '~/store/user'
import { SOCKET_URL }   from '~/utils/api'

let socket = null
let listenersRegistered = false

export const useSocket = () => {
  const rideStore = useRideStore()
  const userStore = useUserStore()

  const connect = () => {
    if (socket?.connected) return

    socket = io(SOCKET_URL, {
      transports: ['websocket'], reconnection: true, reconnectionDelay: 1000,
    })

    socket.on('connect',       () => console.log('[Socket] ✅ Connected:', socket.id))
    socket.on('connect_error', (e) => console.error('[Socket] ❌', e.message))
    socket.on('disconnect',    (r) => console.warn('[Socket] 🔌', r))

    if (listenersRegistered) return
    listenersRegistered = true

    // New ride — sent to the 5 nearest drivers via their socketId
    socket.on('newRide', (data) => {
      if (userStore.role !== 'driver') return
      rideStore.addPendingRequest(data)
      // Track received stat in localStorage (using the driver's own composable)
      try {
        const key = `pr_driver_stats_${userStore._id}`
        const raw = localStorage.getItem(key)
        const s   = raw ? JSON.parse(raw) : { received:0, accepted:0, completed:0 }
        s.received++
        localStorage.setItem(key, JSON.stringify(s))
      } catch {}
    })

    // Driver GPS → update driver location in store (passenger sees this)
    socket.on('driverLocation', ({ lat, lng }) => {
      rideStore.updateDriverLocation({ lat, lng })
    })

    // Passenger GPS → update passenger location in store (driver sees this)
    socket.on('passengerLocation', ({ lat, lng }) => {
      rideStore.updatePassengerLocation({ lat, lng })
    })

    // Driver: their acceptance was confirmed by the server
    socket.on('rideAccepted', ({ ride, driver }) => {
      rideStore.setRide(ride)
      rideStore.updateStatus('accepted')
      // Join ride room immediately so location + chat events arrive
      if (ride?._id) socket.emit('joinRide', { rideId: ride._id })
    })

    // Passenger: a driver accepted their ride
    socket.on('rideAcceptedPassenger', ({ ride, driver }) => {
      rideStore.setRide(ride)
      rideStore.updateStatus('accepted')
      rideStore.setAssignedDriver(driver)
      if (ride?._id) socket.emit('joinRide', { rideId: ride._id })
      // Signal tracking page to load chat history
      rideStore.setChatReady(true)
    })

    socket.on('rideAlreadyTaken', () => rideStore.removeFirstPending())

    socket.on('rideCompleted', ({ rideId }) => {
      if (rideStore.ride?._id?.toString() === rideId?.toString()) {
        rideStore.updateStatus('completed')
      }
    })

    socket.on('rideCancelled', ({ rideId }) => {
      if (rideStore.ride?._id?.toString() === rideId?.toString()) {
        rideStore.updateStatus('cancelled')
      }
    })

    socket.on('rideExpired', ({ rideId, message }) => {
      if (rideStore.ride?._id?.toString() === rideId?.toString()) {
        rideStore.updateStatus('expired')
        rideStore.setExpiredNotification({ message })
      }
    })

    socket.on('requestFeedback', ({ rideId }) => {
      if (rideStore.ride?._id?.toString() === rideId?.toString()) {
        rideStore.setFeedbackPending(true)
      }
    })

    // Chat message — arrives for both passenger and driver
    socket.on('chatMessage', (msg) => {
      rideStore.addChatMessage(msg)
    })

    // ── Proximity events ─────────────────────────────────────────
    // partyArrived: server detected driver + passenger are within 2m
    // → ride status → "ongoing", both parties notified
    socket.on('partyArrived', ({ rideId, message }) => {
      if (rideStore.ride?._id?.toString() === rideId?.toString()) {
        rideStore.updateStatus('ongoing')
        // Store the message so tracking page can show the notification card
        rideStore.setArrivedMessage(message)
      }
    })

    // ridePendingFeedback: ride was ongoing for 30min with no completion
    // → both parties asked to confirm
    socket.on('ridePendingFeedback', ({ rideId, message }) => {
      if (rideStore.ride?._id?.toString() === rideId?.toString()) {
        rideStore.updateStatus('pendingFeedback')
      }
    })
  }

  const registerPassenger      = (userId)          => socket?.emit('passengerOnline', userId)
  const goOnline               = (driverId)        => socket?.emit('driverOnline', driverId)
  const joinRide               = (rideId)          => socket?.emit('joinRide', { rideId })
  const sendDriverLocation     = (rideId, lat, lng)=> socket?.emit('driverLocationUpdate', { rideId, lat, lng })
  const sendPassengerLocation  = (rideId, lat, lng)=> socket?.emit('passengerLocationUpdate', { rideId, lat, lng })
  const acceptRide             = (rideId, driverId)=> socket?.emit('acceptRide', { rideId, driverId })
  const completeRide           = (rideId)          => socket?.emit('completeRide', { rideId })
  const broadcastDriverLocation = (driverId, lat, lng) => socket?.emit('driverLocationBroadcast', { driverId, lat, lng })

  // Emit GPS coords of both parties so server can do the 2-metre proximity check
  const emitProximityCheck = ({ rideId, driverLat, driverLng, passengerLat, passengerLng }) =>
    socket?.emit('checkProximity', { rideId, driverLat, driverLng, passengerLat, passengerLng })

  const getSocketId = () => socket?.id ?? null
  const isConnected = () => socket?.connected ?? false
  const disconnect  = () => {
    listenersRegistered = false
    socket?.disconnect()
    socket = null
  }

  return {
    connect, disconnect,
    registerPassenger, goOnline, joinRide,
    sendDriverLocation, sendPassengerLocation,
    acceptRide, completeRide,
    broadcastDriverLocation,
    emitProximityCheck,
    getSocketId, isConnected,
  }
}