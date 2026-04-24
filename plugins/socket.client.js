// plugins/socket.client.js
//
// Runs once when the browser loads the app.
// Restores session from localStorage and opens the socket connection.
// Also registers the user's socketId with the backend immediately.

import { defineNuxtPlugin } from '#app'
import { useUserStore }     from '~/store/user'
import { useSocket }        from '~/composables/useSocket'

export default defineNuxtPlugin(() => {
  const userStore = useUserStore()
  const { connect, registerPassenger, goOnline } = useSocket()

  // Step 1: restore session from localStorage
  userStore.restore()

  // Step 2: if user is logged in, connect socket
  if (userStore.isAuthenticated) {
    connect()

    // Step 3: register the user's socket with the backend
    // This saves socket.id to the User or Driver document in MongoDB
    if (userStore.isPassenger && userStore._id) {
      // Passenger registration — server needs this to send "rideAcceptedPassenger"
      registerPassenger(userStore._id)
    }

    if (userStore.isDriver && userStore._id) {
      // Restore driver online status from localStorage
      const wasOnline = localStorage.getItem('pr_driver_online') === 'true'
      if (wasOnline) {
        goOnline(userStore._id)
      }
    }
  }
})