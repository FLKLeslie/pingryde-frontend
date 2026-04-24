<!-- pages/driver/login.vue -->
<template>
  <div class="pr-page flex flex-col min-h-screen">

    <div class="px-5 pt-12 pr-safe-top">
      <button @click="$router.push('/')"
              class="flex items-center gap-1.5 text-sm mb-8"
              style="color: var(--pr-muted)">
        ← Back
      </button>
      <div class="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
           style="background: rgba(255,107,53,0.1); border: 1px solid rgba(255,107,53,0.2)">
        <span style="font-size: 26px">🚕</span>
      </div>
      <h1 class="text-2xl font-bold">{{ isLogin ? 'Driver sign in' : 'Register as driver' }}</h1>
      <p class="text-sm mt-1" style="color: var(--pr-muted)">
        {{ isLogin ? 'Continue to your dashboard' : 'Start earning with PingRyde' }}
      </p>
    </div>

    <div class="flex-1 px-5 mt-6 space-y-4 pb-10">

      <!-- Name — register only -->
      <div v-if="!isLogin">
        <label class="pr-section-label block mb-2">Full Name</label>
        <input v-model="form.name" type="text" placeholder="e.g. Jean Nkeng" class="pr-input" />
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

      <!-- Vehicle type — register only -->
      <div v-if="!isLogin">
        <label class="pr-section-label block mb-3">Vehicle Type</label>
        <div class="grid grid-cols-2 gap-3">
          <button v-for="v in vehicles" :key="v.value"
                  @click="form.vehicleType = v.value"
                  class="flex flex-col items-center gap-2 py-4 rounded-xl transition-all active:scale-95"
                  :style="form.vehicleType === v.value
                    ? `background:${v.bg};border:1.5px solid ${v.color}`
                    : 'background:var(--pr-surface2);border:1px solid var(--pr-border)'">
            <span style="font-size: 28px">{{ v.icon }}</span>
            <span class="text-sm font-medium">{{ v.label }}</span>
            <span class="text-xs" style="color: var(--pr-muted)">{{ v.sub }}</span>
          </button>
        </div>
      </div>

      <!-- Capabilities — register only -->
      <div v-if="!isLogin">
        <label class="pr-section-label block mb-2">What can you carry?</label>
        <div class="flex gap-3 flex-wrap">
          <button v-for="cap in ['passengers', 'cargo']" :key="cap"
                  @click="toggleCap(cap)"
                  class="px-4 py-2 rounded-full text-sm transition-all capitalize"
                  :class="form.capabilities.includes(cap) ? 'pr-chip-active' : 'pr-chip-inactive'">
            {{ cap === 'passengers' ? '👥 Passengers' : '📦 Cargo' }}
          </button>
        </div>
      </div>

      <!-- GPS notice — register only -->
      <div v-if="!isLogin"
           class="flex items-start gap-3 p-3 rounded-xl"
           style="background:rgba(255,107,53,0.07);border:1px solid rgba(255,107,53,0.15)">
        <span style="font-size:16px;flex-shrink:0">📍</span>
        <p class="text-xs leading-relaxed" style="color: var(--pr-muted)">
          We'll use your GPS to set your starting location and detect your region automatically.
        </p>
      </div>

      <!-- Error -->
      <div v-if="errorMsg"
           class="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
           style="background:rgba(255,71,71,0.1);border:1px solid rgba(255,71,71,0.2);color:var(--pr-red)">
        ⚠️ {{ errorMsg }}
      </div>

      <!-- Submit -->
      <button @click="submit" :disabled="loading"
              class="pr-btn" style="background:var(--pr-orange);color:#fff;margin-top:8px">
        <span v-if="loading" class="animate-spin inline-block">⟳</span>
        {{ loading ? (isLogin ? 'Signing in...' : 'Registering...') : (isLogin ? 'Sign In →' : 'Register ✓') }}
      </button>

      <!-- Toggle -->
      <p class="text-center text-sm pt-1" style="color: var(--pr-muted)">
        {{ isLogin ? 'New driver?' : 'Already registered?' }}
        <button @click="toggleMode"
                class="font-semibold ml-1"
                style="color:var(--pr-orange);background:none;border:none;cursor:pointer">
          {{ isLogin ? 'Register here' : 'Sign in' }}
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

// Import the backend URL directly — no useRuntimeConfig() needed
import { API_BASE } from '~/utils/api'

definePageMeta({ layout: 'blank' })

const router      = useRouter()
const userStore   = useUserStore()
const { getOnce } = useGeolocation()

const isLogin  = ref(true)
const showPwd  = ref(false)
const loading  = ref(false)
const errorMsg = ref('')

const form = reactive({
  name:         '',
  phone:        '',
  password:     '',
  vehicleType:  'bike',
  capabilities: ['passengers'],
})

const vehicles = [
  { value: 'bike', label: 'Motorbike', sub: 'Exact pickup', icon: '🏍️', color: 'var(--pr-orange)', bg: 'rgba(255,107,53,0.1)' },
  { value: 'taxi', label: 'Taxi',      sub: 'Checkpoint',   icon: '🚕', color: 'var(--pr-teal)',   bg: 'rgba(0,212,184,0.1)' },
]

const toggleCap = (cap) => {
  const idx = form.capabilities.indexOf(cap)
  if (idx >= 0) form.capabilities.splice(idx, 1)
  else form.capabilities.push(cap)
}

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
      // ── REGISTER DRIVER ──────────────────────────────────────
      //
      // Get GPS coords for region auto-detection.
      // Sent as currentLocation: { lat, lng } to match the Driver model.
      let coords = { lat: 5.9631, lng: 10.1591 }
      try {
        coords = await getOnce()
        console.log('GPS coords:', coords)
      } catch (gpsErr) {
        console.warn('GPS failed, using Bamenda fallback:', gpsErr)
      }

      // POST to http://localhost:5000/api/drivers
      // Matches router.post("/") in your backend's driverRoutes.js
      console.log('Registering driver at:', `${API_BASE}/drivers`)

      const result = await $fetch(`${API_BASE}/drivers`, {
        method: 'POST',
        body: {
          name:            form.name,
          phone:           form.phone,
          password:        form.password,
          vehicleType:     form.vehicleType,
          capabilities:    form.capabilities,
          currentLocation: { lat: coords.lat, lng: coords.lng },
          // region is NOT sent — backend detects it from currentLocation
        },
      })

      // result.driver = MongoDB document (password excluded)
      userStore.setUser(result.driver, 'driver')
      router.push('/driver/dashboard')

    } else {
      // ── LOGIN DRIVER ─────────────────────────────────────────
      //
      // POST to http://localhost:5000/api/drivers/login
      // Matches router.post("/login") in your backend's driverRoutes.js
      console.log('Logging in driver at:', `${API_BASE}/drivers/login`)

      const result = await $fetch(`${API_BASE}/drivers/login`, {
        method: 'POST',
        body: { phone: form.phone, password: form.password },
      })

      userStore.setUser(result.driver, 'driver')
      router.push('/driver/dashboard')
    }

  } catch (err) {
    console.error('Driver auth error:', err)
    errorMsg.value = err?.data?.error || err?.message || 'Something went wrong. Check your backend is running on port 5000.'
  } finally {
    loading.value = false
  }
}
</script>