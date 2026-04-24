// store/user.js — Global user state
import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', {
  state: () => ({
    _id:                null,
    name:               '',
    phone:              '',
    email:              '',
    region:             '',
    role:               '',
    vehicleType:        '',
    capabilities:       [],
    status:             'offline',
    profilePhoto:       null,      // path like "/uploads/profiles/..."
    // Driver verification
    isVerified:         false,
    verificationStatus: 'unverified',
    verificationNote:   null,
    plateNumber:        null,
    isAuthenticated:    false,
  }),

  getters: {
    isPassenger: (s) => s.role === 'passenger',
    isDriver:    (s) => s.role === 'driver',
    initials:    (s) => s.name
      ? s.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)
      : '?',
  },

  actions: {
    setUser(userData, role) {
      this._id                = userData._id
      this.name               = userData.name              || ''
      this.phone              = userData.phone             || ''
      this.email              = userData.email             || ''
      this.region             = userData.region            || ''
      this.role               = role
      this.vehicleType        = userData.vehicleType       || ''
      this.capabilities       = userData.capabilities      || []
      this.status             = userData.status            || 'offline'
      this.profilePhoto       = userData.profilePhoto      || null
      this.isVerified         = userData.isVerified        || false
      this.verificationStatus = userData.verificationStatus|| 'unverified'
      this.verificationNote   = userData.verificationNote  || null
      this.plateNumber        = userData.plateNumber       || null
      this.isAuthenticated    = true

      localStorage.setItem('pr_user', JSON.stringify({ ...userData, role }))
      localStorage.setItem('pr_role', role)
    },

    updateProfile(data) {
      const fields = ['name','phone','email','region','profilePhoto',
                      'verificationStatus','plateNumber','isVerified','verificationNote']
      fields.forEach(f => { if (data[f] !== undefined) this[f] = data[f] })
      const stored = JSON.parse(localStorage.getItem('pr_user') || '{}')
      localStorage.setItem('pr_user', JSON.stringify({ ...stored, ...data }))
    },

    setStatus(status) {
      this.status = status
      const stored = JSON.parse(localStorage.getItem('pr_user') || '{}')
      localStorage.setItem('pr_user', JSON.stringify({ ...stored, status }))
    },

    restore() {
      try {
        const raw  = localStorage.getItem('pr_user')
        const role = localStorage.getItem('pr_role')
        if (raw && role) this.setUser(JSON.parse(raw), role)
      } catch {}
    },

    logout() {
      this.$reset()
      localStorage.removeItem('pr_user')
      localStorage.removeItem('pr_role')
      localStorage.removeItem('pr_driver_online')
    },
  },
})