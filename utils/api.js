// utils/api.js
//
// ─────────────────────────────────────────────────────────────────
// WHAT THIS FILE IS
// ─────────────────────────────────────────────────────────────────
// One place that stores your backend server URLs.
// Every page imports from here — no useRuntimeConfig() needed.
//
// WHY THIS APPROACH:
// useRuntimeConfig() was returning undefined because Nuxt 3's
// runtimeConfig system requires a full Nuxt context to work.
// In some page/component situations (especially with ssr:false),
// the context is not available when the value is read.
//
// A plain JS export like this ALWAYS works — it's just a string.
//
// TO USE IN ANY PAGE:
//   import { API_BASE } from '~/utils/api'
//   const result = await $fetch(`${API_BASE}/users`, { ... })
//
// WHEN YOU DEPLOY TO PRODUCTION:
//   Change the values below to your live server address.
// ─────────────────────────────────────────────────────────────────

// Express backend URL — defined in your backend's server.js as PORT 5000
export const API_BASE = 'http://localhost:5000/api'

// Socket.io URL — root of the backend (no /api), because Socket.io
// is attached to the HTTP server directly, not to an Express route
export const SOCKET_URL = 'http://localhost:5000'