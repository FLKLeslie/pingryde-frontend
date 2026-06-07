<!-- pages/driver/profile.vue — Driver profile with photo + verification -->
<template>
  <div class="pr-page">

    <!-- Hero -->
    <div class="profile-hero">
      <div class="photo-wrap">
        <div class="photo-circle photo-circle--orange">
          <img v-if="photoPreview || userStore.user?.profilePhoto"
               :src="photoPreview || photoUrl(userStore.user?.profilePhoto)"
               alt="Profile" class="photo-img" />
          <span v-else class="photo-initials photo-initials--orange">{{ userStore.initials }}</span>
        </div>
        <label class="photo-upload-btn photo-upload-btn--orange">
          📷
          <input type="file" accept="image/*" class="photo-input" @change="handlePhotoSelect" />
        </label>
      </div>

      <div class="profile-hero-text">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <h1 class="profile-name">{{ userStore.name }}</h1>
          <!-- Verified badge -->
          <span v-if="userStore.verificationStatus === 'verified'" class="verified-full-badge">
            ✓ Verified
          </span>
          <span v-else-if="userStore.verificationStatus === 'pending'" class="pending-badge">
            ⏳ Under review
          </span>
        </div>
        <p class="profile-sub">{{ userStore.phone }}</p>
        <span class="pr-badge" style="color:var(--pr-orange);background:rgba(255,107,53,0.12)">
          {{ userStore.vehicleType === 'bike' ? '🏍️ Motorbike' : '🚕 Taxi' }}
        </span>
      </div>
    </div>

    <!-- Upload progress/success -->
    <div v-if="uploading" class="upload-status">⟳ Uploading photo...</div>
    <div v-if="uploadSuccess" class="upload-success">✅ Photo updated!</div>

    <!-- Personal info -->
    <div class="pr-card" style="margin-bottom:14px">
      <div class="card-header-row">
        <p class="pr-section-label">Personal info</p>
        <button @click="editing = !editing" class="edit-btn"
                :style="editing ? 'color:var(--pr-red)' : 'color:var(--pr-orange)'">
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
          <label class="field-label">Phone</label>
          <input v-if="editing" v-model="form.phone" type="tel" class="pr-input" />
          <p v-else class="field-value">{{ userStore.phone || '—' }}</p>
        </div>
        <div class="field-group">
          <label class="field-label">Operating Region
            <span class="field-hint">— editable</span>
          </label>
          <select v-if="editing" v-model="form.region" class="pr-input pr-select">
            <option v-for="r in REGIONS" :key="r" :value="r">{{ r }}</option>
          </select>
          <div v-else class="field-value">📍 {{ userStore.region || 'Not set' }}</div>
        </div>
        <div class="field-group">
          <label class="field-label">Vehicle type</label>
          <div class="field-value">
            {{ userStore.vehicleType === 'bike' ? '🏍️ Motorbike' : '🚕 Taxi' }}
            <span class="field-fixed">Fixed at registration</span>
          </div>
        </div>
      </div>

      <Transition name="pr-fade-up">
        <button v-if="editing" @click="saveProfile" :disabled="saving"
                class="pr-btn" style="background:var(--pr-orange);color:#fff;margin-top:16px">
          <span v-if="saving" class="pr-spin">⟳</span>
          {{ saving ? 'Saving...' : 'Save Changes ✓' }}
        </button>
      </Transition>
      <Transition name="pr-fade-up">
        <p v-if="saved" style="text-align:center;color:var(--pr-teal);font-size:13px;margin-top:10px">✓ Saved</p>
      </Transition>
    </div>

    <!-- ── VERIFICATION SECTION ─────────────────────────────── -->
    <div class="pr-card" style="margin-bottom:14px">
      <p class="pr-section-label" style="margin-bottom:4px">Driver Verification</p>
      <p style="font-size:12px;color:var(--pr-muted);margin:0 0 16px;line-height:1.6">
        Upload your vehicle photo, driver's license, and plate number to get a
        <strong style="color:var(--pr-teal)">✓ Verified</strong> badge shown to passengers.
      </p>

      <!-- Verification status banner -->
      <div class="verify-status-banner" :class="`verify-status-banner--${userStore.verificationStatus || 'unverified'}`">
        <span class="verify-status-icon">
          {{ { unverified:'📋', pending:'⏳', verified:'✅', rejected:'❌' }[userStore.verificationStatus || 'unverified'] }}
        </span>
        <div>
          <p class="verify-status-title">
            {{ {
              unverified:'Not yet submitted',
              pending:'Under review — we\'ll notify you',
              verified:'Verified driver ✓',
              rejected:'Rejected — see note below'
            }[userStore.verificationStatus || 'unverified'] }}
          </p>
          <p v-if="userStore.verificationNote" class="verify-status-note">
            {{ userStore.verificationNote }}
          </p>
        </div>
      </div>

      <!-- Upload fields (shown only if not yet verified) -->
      <div v-if="userStore.verificationStatus !== 'verified'" class="verify-form">

        <!-- Plate number -->
        <div class="field-group">
          <label class="field-label">Plate Number</label>
          <input v-model="verifyForm.plateNumber" type="text"
                 placeholder="e.g. LT 1234 A" class="pr-input"
                 style="text-transform:uppercase" />
        </div>

        <!-- Vehicle photo -->
        <div class="field-group">
          <label class="field-label">Vehicle Photo</label>
          <label class="file-upload-area" :class="{ 'file-upload-area--has-file': verifyForm.vehiclePhotoFile }">
            <input type="file" accept="image/*" class="photo-input"
                   @change="e => verifyForm.vehiclePhotoFile = e.target.files[0]" />
            <span v-if="verifyForm.vehiclePhotoFile">
              ✅ {{ verifyForm.vehiclePhotoFile.name }}
            </span>
            <span v-else>📷 Tap to upload vehicle photo</span>
          </label>
        </div>

        <!-- Driver's license -->
        <div class="field-group">
          <label class="field-label">Driver's License</label>
          <label class="file-upload-area" :class="{ 'file-upload-area--has-file': verifyForm.licenseFile }">
            <input type="file" accept="image/*" class="photo-input"
                   @change="e => verifyForm.licenseFile = e.target.files[0]" />
            <span v-if="verifyForm.licenseFile">
              ✅ {{ verifyForm.licenseFile.name }}
            </span>
            <span v-else>📄 Tap to upload driver's license</span>
          </label>
        </div>

        <div v-if="verifyError" class="pr-error" style="margin-bottom:12px">⚠️ {{ verifyError }}</div>

        <button @click="submitVerification" :disabled="verifying"
                class="pr-btn" style="background:var(--pr-teal);color:#1E2A32;font-weight:600">
          <span v-if="verifying" class="pr-spin">⟳</span>
          {{ verifying ? 'Submitting...' : 'Submit for Verification' }}
        </button>

        <p style="font-size:11px;color:var(--pr-muted);text-align:center;margin-top:8px">
          Review typically takes 24-48 hours
        </p>
      </div>
    </div>

    <!-- Account -->
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
const photoPreview  = ref(null)
const verifying     = ref(false)
const verifyError   = ref('')

const form = reactive({
  name:   userStore.name,
  phone:  userStore.phone,
  region: userStore.region,
})

const verifyForm = reactive({
  plateNumber:      userStore.plateNumber || '',
  vehiclePhotoFile: null,
  licenseFile:      null,
})

watch(editing, (v) => {
  if (!v) { form.name = userStore.name; form.phone = userStore.phone; form.region = userStore.region }
})

const photoUrl = (path) => {
  // Cloudinary URLs are already full URLs, so return as-is
  // Local paths start with "/" — prepend BACKEND_URL only for those
  if (!path) return null
  if (path.startsWith("http")) return path  // Already a full URL
  return `${BACKEND_URL}${path}`             // Local path
}

const handlePhotoSelect = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  photoPreview.value = URL.createObjectURL(file)
  uploading.value = true
  uploadSuccess.value = false
  try {
    const fd = new FormData()
    fd.append('photo', file)
    const res = await $fetch(`${API_BASE}/upload/profile/driver/${userStore._id}`, {
      method: 'POST', body: fd,
    })
    // Update store with Cloudinary URL
    userStore.updateProfile({ profilePhoto: res.photoUrl })
    uploadSuccess.value = true
    setTimeout(() => { uploadSuccess.value = false }, 3000)
  } catch (err) {
    console.error('Upload error:', err)
    photoPreview.value = null
  } finally {
    uploading.value = false
  }
}

const saveProfile = async () => {
  saving.value = true
  try {
    await $fetch(`${API_BASE}/drivers/${userStore._id}`, {
      method: 'PATCH',
      body:   { name: form.name, phone: form.phone, region: form.region },
    })
  } catch {}
  userStore.updateProfile({ name: form.name, phone: form.phone, region: form.region })
  editing.value = false; saving.value = false; saved.value = true
  setTimeout(() => { saved.value = false }, 3000)
}

const submitVerification = async () => {
  verifyError.value = ''
  if (!verifyForm.plateNumber) { verifyError.value = 'Please enter your plate number'; return }
  if (!verifyForm.vehiclePhotoFile) { verifyError.value = 'Please upload a vehicle photo'; return }
  if (!verifyForm.licenseFile)      { verifyError.value = "Please upload your driver's license"; return }

  verifying.value = true
  try {
    const fd = new FormData()
    fd.append('vehiclePhoto',   verifyForm.vehiclePhotoFile)
    fd.append('driversLicense', verifyForm.licenseFile)
    fd.append('plateNumber',    verifyForm.plateNumber)

    const res = await $fetch(`${API_BASE}/upload/verify/driver/${userStore._id}`, {
      method: 'POST', body: fd,
    })

    // Update store to show pending status
    // The backend returns updates with Cloudinary URLs
    userStore.updateProfile({
      verificationStatus: res.updates.verificationStatus || 'pending',
      plateNumber:        verifyForm.plateNumber,
    })

    // Reset form
    verifyForm.vehiclePhotoFile = null
    verifyForm.licenseFile = null
  } catch (err) {
    verifyError.value = err?.data?.error || 'Submission failed. Please try again.'
  } finally {
    verifying.value = false
  }
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
.photo-circle--orange { background:rgba(255,107,53,0.12); border-color:rgba(255,107,53,0.25); }
.photo-img      { width:100%; height:100%; object-fit:cover; }
.photo-initials { font-size:22px; font-weight:700; color:var(--pr-teal); font-family:var(--font-display); }
.photo-initials--orange { color:var(--pr-orange); }

.photo-upload-btn {
  position:absolute; bottom:-2px; right:-2px;
  width:26px; height:26px; border-radius:50%;
  background:var(--pr-teal); display:flex; align-items:center; justify-content:center;
  font-size:12px; cursor:pointer; border:2px solid var(--pr-bg);
}
.photo-upload-btn--orange { background:var(--pr-orange); }
.photo-input { display:none; }

.profile-name  { font-size:20px; font-weight:800; margin:0 0 4px; }
.profile-sub   { font-size:13px; color:var(--pr-muted); margin:0 0 8px; }

.verified-full-badge {
  font-size:11px; font-weight:700; padding:3px 10px; border-radius:999px;
  background:rgba(0,212,184,0.15); color:var(--pr-teal); border:1px solid rgba(0,212,184,0.3);
}
.pending-badge {
  font-size:11px; font-weight:700; padding:3px 10px; border-radius:999px;
  background:rgba(240,192,64,0.12); color:var(--pr-yellow);
}

.upload-status  { font-size:13px; color:var(--pr-muted); margin-bottom:12px; padding:10px 14px; background:var(--pr-surface2); border-radius:8px; }
.upload-success { font-size:13px; color:var(--pr-teal); margin-bottom:12px; padding:10px 14px; background:rgba(0,212,184,0.08); border-radius:8px; }

.card-header-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
.edit-btn   { font-size:12px; font-weight:600; background:none; border:none; cursor:pointer; font-family:var(--font-body); }

.form-fields { display:flex; flex-direction:column; gap:14px; }
.field-group { display:flex; flex-direction:column; gap:6px; }
.field-label { font-size:11px; font-weight:600; color:var(--pr-muted); text-transform:uppercase; letter-spacing:0.06em; }
.field-hint  { font-weight:400; text-transform:none; letter-spacing:0; }
.field-value { font-size:14px; padding:12px 14px; border-radius:8px; background:var(--pr-surface2); margin:0; display:flex; align-items:center; gap:6px; }
.field-fixed { font-size:10px; color:var(--pr-muted); margin-left:auto; }

/* Verification section */
.verify-status-banner {
  display:flex; align-items:flex-start; gap:12px;
  padding:14px; border-radius:10px; margin-bottom:16px;
  border:1px solid var(--pr-border);
}
.verify-status-banner--unverified { background:rgba(255,255,255,0.02); }
.verify-status-banner--pending    { background:rgba(240,192,64,0.06); border-color:rgba(240,192,64,0.2); }
.verify-status-banner--verified   { background:rgba(0,212,184,0.06); border-color:rgba(0,212,184,0.25); }
.verify-status-banner--rejected   { background:rgba(255,71,71,0.06); border-color:rgba(255,71,71,0.2); }
.verify-status-icon  { font-size:20px; flex-shrink:0; }
.verify-status-title { font-size:13px; font-weight:600; margin:0 0 4px; }
.verify-status-note  { font-size:12px; color:var(--pr-muted); margin:0; }

.verify-form { display:flex; flex-direction:column; gap:14px; }

.file-upload-area {
  display:flex; align-items:center; justify-content:center;
  padding:14px; border-radius:10px;
  border:1px dashed var(--pr-border);
  background:var(--pr-surface2); cursor:pointer;
  font-size:13px; color:var(--pr-muted);
  transition:border-color 0.2s;
}
.file-upload-area--has-file { border-color:rgba(0,212,184,0.4); color:var(--pr-teal); }
.file-upload-area:hover     { border-color:rgba(0,212,184,0.3); }

.pr-fade-up-enter-active { transition:all 0.25s ease; }
.pr-fade-up-enter-from   { opacity:0; transform:translateY(8px); }
</style>