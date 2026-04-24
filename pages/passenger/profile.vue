<!-- pages/passenger/profile.vue — with profile photo upload + region edit -->
<template>
  <div class="pr-page">

    <div class="profile-hero">

      <!-- Profile photo -->
      <div class="photo-wrap">
        <div class="photo-circle">
          <img v-if="photoPreview || userStore.user?.profilePhoto"
               :src="photoPreview || photoUrl(userStore.user?.profilePhoto)"
               alt="Profile" class="photo-img" />
          <span v-else class="photo-initials">{{ userStore.initials }}</span>
        </div>
        <!-- Upload overlay -->
        <label class="photo-upload-btn" title="Change photo">
          📷
          <input type="file" accept="image/*" class="photo-input" @change="handlePhotoSelect" />
        </label>
      </div>

      <div class="profile-hero-text">
        <h1 class="profile-name">{{ userStore.name }}</h1>
        <p class="profile-sub">{{ userStore.phone }}</p>
        <span class="pr-badge pr-badge-active">Passenger</span>
      </div>
    </div>

    <!-- Upload progress -->
    <div v-if="uploading" class="upload-progress">
      <div class="pr-spin" style="font-size:16px">⟳</div>
      Uploading photo...
    </div>
    <div v-if="uploadSuccess" class="upload-success">✅ Photo updated!</div>

    <!-- Edit form -->
    <div class="pr-card" style="margin-bottom:16px">
      <div class="card-header-row">
        <p class="pr-section-label">Personal info</p>
        <button @click="editing = !editing" class="edit-btn"
                :style="editing ? 'color:var(--pr-red)' : 'color:var(--pr-teal)'">
          {{ editing ? 'Cancel' : '✏️ Edit' }}
        </button>
      </div>

      <div class="form-fields">

        <div class="field-group">
          <label class="field-label">Full Name</label>
          <input v-if="editing" v-model="form.name" type="text" class="pr-input" />
          <p v-else class="field-value">{{ userStore.name || '—' }}</p>
        </div>

        <div class="field-group">
          <label class="field-label">Phone Number</label>
          <input v-if="editing" v-model="form.phone" type="tel" class="pr-input" />
          <p v-else class="field-value">{{ userStore.phone || '—' }}</p>
        </div>

        <div class="field-group">
          <label class="field-label">Email (optional)</label>
          <input v-if="editing" v-model="form.email" type="email" class="pr-input" />
          <p v-else class="field-value">{{ userStore.email || 'Not set' }}</p>
        </div>

        <div class="field-group">
          <label class="field-label">Region
            <span class="field-hint">— can be changed manually</span>
          </label>
          <select v-if="editing" v-model="form.region" class="pr-input pr-select">
            <option v-for="r in REGIONS" :key="r" :value="r">{{ r }}</option>
          </select>
          <div v-else class="field-value field-value--region">
            <span>📍</span> {{ userStore.region || 'Not set' }}
          </div>
        </div>

      </div>

      <Transition name="pr-fade-up">
        <button v-if="editing" @click="saveProfile" :disabled="saving"
                class="pr-btn pr-btn-primary" style="margin-top:16px">
          <span v-if="saving" class="pr-spin">⟳</span>
          {{ saving ? 'Saving...' : 'Save Changes ✓' }}
        </button>
      </Transition>

      <Transition name="pr-fade-up">
        <p v-if="saved" style="text-align:center;color:var(--pr-teal);font-size:13px;margin-top:10px">
          ✓ Profile updated
        </p>
      </Transition>
    </div>

    <!-- Quick links -->
    <div class="pr-card" style="margin-bottom:16px">
      <p class="pr-section-label" style="margin-bottom:12px">My rides</p>
      <button @click="$router.push('/passenger/rides')"
              class="quick-link">
        <span>🛣️ View ride history</span>
        <span style="color:var(--pr-muted)">→</span>
      </button>
    </div>

    <!-- Danger zone -->
    <div class="pr-card">
      <p class="pr-section-label" style="margin-bottom:12px">Account</p>
      <button @click="logout" class="pr-btn pr-btn-danger">Sign Out</button>
    </div>

  </div>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { useRouter }    from 'vue-router'
import { useUserStore } from '~/store/user'
import { API_BASE }     from '~/utils/api'

const BACKEND_URL = 'http://localhost:5000'
const router    = useRouter()
const userStore = useUserStore()

const REGIONS = ['North West','South West','Littoral','Centre','West','East','Far North','North','Adamawa','South']

const editing       = ref(false)
const saving        = ref(false)
const saved         = ref(false)
const uploading     = ref(false)
const uploadSuccess = ref(false)
const photoPreview  = ref(null)   // local blob preview before upload completes

const form = reactive({
  name:   userStore.name,
  phone:  userStore.phone,
  email:  userStore.email,
  region: userStore.region,
})

watch(editing, (v) => {
  if (!v) {
    form.name   = userStore.name
    form.phone  = userStore.phone
    form.email  = userStore.email
    form.region = userStore.region
  }
})

const photoUrl = (path) => path ? `${BACKEND_URL}${path}` : null

// Handle photo file selection — show preview immediately, then upload
const handlePhotoSelect = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  // Show preview immediately (good UX — user sees change right away)
  photoPreview.value = URL.createObjectURL(file)

  // Upload to backend
  uploading.value = true
  uploadSuccess.value = false
  try {
    const formData = new FormData()
    formData.append('photo', file)

    const res = await $fetch(`${API_BASE}/upload/profile/user/${userStore._id}`, {
      method: 'POST',
      body:   formData,
    })

    // Update store with the new path
    userStore.updateProfile({ profilePhoto: res.photoPath })

    uploadSuccess.value = true
    setTimeout(() => { uploadSuccess.value = false }, 3000)
  } catch (err) {
    console.error('Photo upload failed:', err)
    photoPreview.value = null  // revert preview on failure
  } finally {
    uploading.value = false
  }
}

const saveProfile = async () => {
  saving.value = true
  try {
    await $fetch(`${API_BASE}/users/${userStore._id}`, {
      method: 'PATCH',
      body:   { name: form.name, phone: form.phone, email: form.email, region: form.region },
    })
  } catch {}
  userStore.updateProfile({ name: form.name, phone: form.phone, email: form.email, region: form.region })
  editing.value = false
  saving.value  = false
  saved.value   = true
  setTimeout(() => { saved.value = false }, 3000)
}

const logout = () => {
  localStorage.removeItem('pr_driver_online')
  userStore.logout()
  router.push('/')
}
</script>

<style scoped>
.profile-hero { display:flex; align-items:center; gap:20px; margin-bottom:24px; flex-wrap:wrap; }

.photo-wrap { position:relative; flex-shrink:0; }
.photo-circle {
  width:72px; height:72px; border-radius:50%;
  background:rgba(0,212,184,0.12); border:2px solid rgba(0,212,184,0.25);
  display:flex; align-items:center; justify-content:center; overflow:hidden;
}
.photo-img     { width:100%; height:100%; object-fit:cover; }
.photo-initials{ font-size:22px; font-weight:700; color:var(--pr-teal); font-family:var(--font-display); }

.photo-upload-btn {
  position:absolute; bottom:-2px; right:-2px;
  width:26px; height:26px; border-radius:50%;
  background:var(--pr-teal); display:flex; align-items:center; justify-content:center;
  font-size:12px; cursor:pointer; border:2px solid var(--pr-bg);
}
.photo-input { display:none; }

.profile-hero-text { flex:1; min-width:0; }
.profile-name { font-size:20px; font-weight:800; margin:0 0 4px; }
.profile-sub  { font-size:13px; color:var(--pr-muted); margin:0 0 8px; }

.upload-progress {
  display:flex; align-items:center; gap:8px; font-size:13px;
  color:var(--pr-muted); margin-bottom:12px; padding:10px 14px;
  background:var(--pr-surface2); border-radius:8px;
}
.upload-success {
  font-size:13px; color:var(--pr-teal);
  margin-bottom:12px; padding:10px 14px;
  background:rgba(0,212,184,0.08); border-radius:8px;
}

.card-header-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
.edit-btn { font-size:12px; font-weight:600; background:none; border:none; cursor:pointer; font-family:var(--font-body); }

.form-fields { display:flex; flex-direction:column; gap:14px; }

.field-group { display:flex; flex-direction:column; gap:6px; }
.field-label { font-size:11px; font-weight:600; color:var(--pr-muted); text-transform:uppercase; letter-spacing:0.06em; }
.field-hint  { font-weight:400; text-transform:none; letter-spacing:0; }
.field-value { font-size:14px; padding:12px 14px; border-radius:8px; background:var(--pr-surface2); margin:0; }
.field-value--region { display:flex; align-items:center; gap:6px; }

.quick-link {
  width:100%; display:flex; align-items:center; justify-content:space-between;
  padding:12px 0; background:none; border:none; cursor:pointer; font-family:var(--font-body);
  font-size:14px; color:var(--pr-text); border-bottom:1px solid var(--pr-border);
}

/* Transitions */
.pr-fade-up-enter-active { transition:all 0.25s ease; }
.pr-fade-up-enter-from   { opacity:0; transform:translateY(8px); }
</style>