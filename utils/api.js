// utils/api.js
// ─────────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH FOR BACKEND URLS
//
// This is the ONLY place you ever need to change the backend address.
// Every page, component, and composable imports from here.
//
// HOW TO DEPLOY:
//   • Development → leave as http://localhost:5000
//   • Production  → change to https://your-live-server.com
//
// Example:
//   import { API_BASE, SOCKET_URL, BACKEND_URL } from '~/utils/api'
//
// ─────────────────────────────────────────────────────────────────

// ── PRODUCTION DEPLOYMENT: Set via environment variable ─────────────
// When deploying to production, set the NUXT_PUBLIC_BACKEND_URL environment variable:
//   - Vercel:  Add to project settings → Environment Variables
//   - Docker:  docker run -e NUXT_PUBLIC_BACKEND_URL="https://api.example.com" ...
//   - Manual:  export NUXT_PUBLIC_BACKEND_URL="https://api.example.com"
//
// Format: Just the protocol + domain (no /api, no trailing slash)
//   ✅ https://api.pingryde.com
//   ✅ http://localhost:5000
//   ❌ https://api.pingryde.com/api (don't include /api)
// ─────────────────────────────────────────────────────────────────────
// const BACKEND_HOST = process.env.NUXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
// ── Change this ONE value when you host the backend somewhere else ──
// const BACKEND_HOST = 'https://pingryde-backend.onrender.com'
const BACKEND_HOST = 'http://localhost:5000'
// ───────────────────────────────────────────────────────────────────

// REST API base — all $fetch calls use this
// Example: $fetch(`${API_BASE}/rides`)  → http://localhost:5000/api/rides
export const API_BASE = `${BACKEND_HOST}/api`

// Socket.io URL — no /api, because socket.io attaches to the HTTP server root
// Example: io(SOCKET_URL)  → connects to http://localhost:5000
export const SOCKET_URL = BACKEND_HOST

// Raw backend host — used to build full image URLs from stored paths
// Example: `${BACKEND_URL}/uploads/profiles/photo.jpg`
export const BACKEND_URL = BACKEND_HOST