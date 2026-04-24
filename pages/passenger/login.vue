<!-- pages/passenger/login.vue -->
<template>
  <div class="pr-page flex flex-col min-h-screen">

    <div class="px-5 pt-12 pr-safe-top">
      <button @click="$router.push('/')"
              class="flex items-center gap-1.5 text-sm mb-8"
              style="color: var(--pr-muted)">
        ← Back
      </button>

      <div class="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
           style="background: rgba(0,212,184,0.1); border: 1px solid rgba(0,212,184,0.2)">
        <span style="font-size: 26px">🧍</span>
      </div>
      <h1 class="text-2xl font-bold">{{ isLogin ? 'Welcome back' : 'Join PingRyde' }}</h1>
      <p class="text-sm mt-1" style="color: var(--pr-muted)">
        {{ isLogin ? 'Sign in to request a ride' : 'Create your passenger account' }}
      </p>
    </div>

    <div class="flex-1 px-5 mt-6 space-y-4 pb-10">

      <!-- Name — register only -->
      <div v-if="!isLogin">
        <label class="pr-section-label block mb-2">Full Name</label>
        <input v-model="form.name" type="text" placeholder="e.g. Agnes Tabi" class="pr-input" />
      </div>

      <!-- Phone -->
      <div>
        <label class="pr-section-label block mb-2">Phone Number</label>
        <div class="flex gap-2">
          <div class="px-4 flex items-center rounded-lg text-sm flex-shrink-0"
               style="background: var(--pr-surface2); border: 1px solid var(--pr-border)">
            🇨🇲 +237
          </div>
          <input v-model="form.phone" type="tel" placeholder="6XX XXX XXX" class="pr-input" />
        </div>
      </div>

      <!-- Email — register only -->
      <div v-if="!isLogin">
        <label class="pr-section-label block mb-2">Email (optional)</label>
        <input v-model="form.email" type="email" placeholder="you@example.com" class="pr-input" />
      </div>

      <!-- Password -->
      <div>
        <label class="pr-section-label block mb-2">Password</label>
        <div class="relative">
          <input v-model="form.password" :type="showPwd ? 'text' : 'password'"
                 placeholder="Enter your password" class="pr-input" style="padding-right: 50px" />
          <button @click="showPwd = !showPwd"
                  class="absolute right-4 top-1/2 -translate-y-1/2"
                  style="color:var(--pr-muted);font-size:16px;background:none;border:none;cursor:pointer">
            {{ showPwd ? '🙈' : '👁️' }}
          </button>
        </div>
      </div>

      <!-- GPS notice — register only -->
      <div v-if="!isLogin"
           class="flex items-start gap-3 p-3 rounded-xl"
           style="background: rgba(0,212,184,0.07); border: 1px solid rgba(0,212,184,0.15)">
        <span style="font-size:16px;flex-shrink:0">📍</span>
        <p class="text-xs leading-relaxed" style="color: var(--pr-muted)">
          We'll use your GPS to automatically detect your region in Cameroon.
          Please allow location access when the browser asks.
        </p>
      </div>

      <!-- Error -->
      <div v-if="errorMsg"
           class="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
           style="background:rgba(255,71,71,0.1);border:1px solid rgba(255,71,71,0.2);color:var(--pr-red)">
        ⚠️ {{ errorMsg }}
      </div>

      <!-- Submit -->
      <button @click="submit" :disabled="loading" class="pr-btn pr-btn-primary" style="margin-top:8px">
        <span v-if="loading" class="animate-spin inline-block">⟳</span>
        {{ loading ? (isLogin ? 'Signing in...' : 'Creating account...') : (isLogin ? 'Sign In →' : 'Create Account ✓') }}
      </button>

      <!-- Toggle -->
      <p class="text-center text-sm pt-1" style="color: var(--pr-muted)">
        {{ isLogin ? "Don't have an account?" : 'Already registered?' }}
        <button @click="toggleMode"
                class="font-semibold ml-1"
                style="color:var(--pr-teal);background:none;border:none;cursor:pointer">
          {{ isLogin ? 'Register' : 'Sign in' }}
        </button>
      </p>

    </div>
  </div>
</template>

<script setup>
import { ref, reactive }  from 'vue'
import { useRouter }       from 'vue-router'
import { useUserStore }    from '~/store/user'
import { useGeolocation }  from '~/composables/useGeolocation'

// ─────────────────────────────────────────────────────────────────
// KEY CHANGE: Import API_BASE directly from our utils/api.js file.
//
// This is a plain string "http://localhost:5000/api".
// It never returns undefined, never depends on Nuxt context,
// and works identically in every situation.
// ─────────────────────────────────────────────────────────────────
import { API_BASE } from '~/utils/api'

definePageMeta({ layout: 'blank' })

const router      = useRouter()
const userStore   = useUserStore()
const { getOnce } = useGeolocation()

const isLogin  = ref(true)
const showPwd  = ref(false)
const loading  = ref(false)
const errorMsg = ref('')

const form = reactive({ name: '', phone: '', email: '', password: '' })

const toggleMode = () => { isLogin.value = !isLogin.value; errorMsg.value = '' }

const submit = async () => {
  errorMsg.value = ''

  if (!form.phone || !form.password) {
    errorMsg.value = 'Phone number and password are required'
    return
  }
  if (!isLogin.value && !form.name) {
    errorMsg.value = 'Please enter your full name'
    return
  }

  loading.value = true

  try {

    if (!isLogin.value) {
      // ── REGISTER ────────────────────────────────────────────
      //
      // Step 1: Get GPS so backend can auto-detect region.
      // Your backend's userRoutes.js calls getRegionFromCoordinates(lat, lng)
      // and saves the result (e.g. "North West") to the user document.
      let coords = { lat: 5.9631, lng: 10.1591 }  // Bamenda fallback
      try {
        coords = await getOnce()
        console.log('GPS coords:', coords)
      } catch (gpsErr) {
        console.warn('GPS failed, using Bamenda fallback:', gpsErr)
      }

      // Step 2: Send registration data to Express backend.
      // API_BASE = "http://localhost:5000/api"
      // Full URL → "http://localhost:5000/api/users"
      // This matches router.post("/") in your backend's userRoutes.js
      console.log('Registering passenger at:', `${API_BASE}/users`)

      const result = await $fetch(`${API_BASE}/users`, {
        method: 'POST',
        body: {
          name:     form.name,
          phone:    form.phone,
          email:    form.email || undefined,
          password: form.password,
          lat:      coords.lat,
          lng:      coords.lng,
        },
      })

      // Step 3: Save returned user to Pinia store and localStorage
      // result.user = the MongoDB document (password excluded by backend)
      userStore.setUser(result.user, 'passenger')

      // Step 4: Go to the ride request page
      router.push('/passenger/request')

    } else {
      // ── LOGIN ────────────────────────────────────────────────
      //
      // POST to /api/users/login
      // Backend finds user by phone, checks bcrypt hash, returns user
      console.log('Logging in passenger at:', `${API_BASE}/users/login`)

      const result = await $fetch(`${API_BASE}/users/login`, {
        method: 'POST',
        body: { phone: form.phone, password: form.password },
      })

      userStore.setUser(result.user, 'passenger')
      router.push('/passenger/request')
    }

  } catch (err) {
    // If backend returned { error: "..." }, show that message
    // Otherwise show a generic message
    console.error('Auth error:', err)
    errorMsg.value = err?.data?.error || err?.message || 'Something went wrong. Check your backend is running on port 5000.'
  } finally {
    loading.value = false
  }
}
</script>