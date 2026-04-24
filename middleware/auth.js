// middleware/auth.js
//
// WHAT THIS FILE DOES
// ───────────────────
// A Nuxt MIDDLEWARE runs before a page loads.
// This one is a ROUTE GUARD — it checks "is this person allowed to see this page?"
//
// If they're not logged in → send them to the landing page (/)
// If a driver tries to open a passenger page → redirect to driver dashboard
// If a passenger tries to open a driver page → redirect to passenger request page
//
// HOW TO USE IT ON A PAGE
// ────────────────────────
// Add this inside the <script setup> of any page you want to protect:
//
//   definePageMeta({ middleware: 'auth' })
//
// Pages that DON'T need it: index.vue, passenger/login.vue, driver/login.vue

export default defineNuxtRouteMiddleware((to) => {
  const raw  = localStorage.getItem('pr_user')
  const role = localStorage.getItem('pr_role')

  // Not logged in at all → go to landing page
  if (!raw || !role) {
    return navigateTo('/')
  }

  // Driver trying to open a passenger-only page
  if (role === 'driver' && to.path.startsWith('/passenger')) {
    return navigateTo('/driver/dashboard')
  }

  // Passenger trying to open a driver-only page
  if (role === 'passenger' && to.path.startsWith('/driver')) {
    return navigateTo('/passenger/request')
  }

  // All good — let the page load normally
})