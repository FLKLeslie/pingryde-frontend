<!-- layouts/default.vue — App shell with top navbar and compact footer -->
<template>
  <div style="display:flex;flex-direction:column;min-height:100dvh;">

    <!-- ═══════════════ TOP NAVBAR ═══════════════ -->
    <header class="site-header">
      <div class="header-inner">

        <NuxtLink :to="userStore.isDriver ? '/driver/dashboard' : '/passenger/request'"
                  class="brand">
          <!-- <div class="brand-icon">🚀</div> -->
          <div class="brand-icon"><img src="/logo2.png" alt=""></div>
          <span class="brand-name">PingRyde</span>
        </NuxtLink>

        <!-- Passenger nav -->
        <nav v-if="userStore.isPassenger" class="main-nav">
          <NuxtLink to="/passenger/request"  class="nav-item"><span class="nav-ico">🚕</span><span class="nav-txt">Request</span></NuxtLink>
          <NuxtLink to="/passenger/tracking" class="nav-item"><span class="nav-ico">📍</span><span class="nav-txt">Track</span></NuxtLink>
          <NuxtLink to="/passenger/rides"    class="nav-item"><span class="nav-ico">🛣️</span><span class="nav-txt">My Rides</span></NuxtLink>
        </nav>

        <!-- Driver nav -->
        <nav v-else-if="userStore.isDriver" class="main-nav">
          <NuxtLink to="/driver/dashboard"  class="nav-item"><span class="nav-ico">🏠</span><span class="nav-txt">Home</span></NuxtLink>
          <NuxtLink to="/driver/requests"   class="nav-item">
            <span class="nav-ico">🔔</span><span class="nav-txt">Requests</span>
            <span v-if="rideStore.pendingRequests.length > 0" class="notif-dot">
              {{ rideStore.pendingRequests.length }}
            </span>
          </NuxtLink>
          <NuxtLink to="/driver/map"        class="nav-item"><span class="nav-ico">🗺️</span><span class="nav-txt">Active</span></NuxtLink>
        </nav>

        <div class="header-right">
          <span v-if="userStore.region" class="region-pill">📍 {{ userStore.region }}</span>
          <NuxtLink :to="userStore.isDriver ? '/driver/profile' : '/passenger/profile'"
                    class="avatar-btn" :title="userStore.name + ' — Profile'">
            <img v-if="userStore.profilePhoto"
                 :src="`http://localhost:5000${userStore.profilePhoto}`"
                 class="avatar-photo" />
            <span v-else>{{ userStore.initials }}</span>
          </NuxtLink>
        </div>

      </div>
    </header>

    <!-- ═══════════════ CONTENT ═══════════════ -->
    <main style="flex:1;width:100%"><slot /></main>

    <!-- ═══════════════ FOOTER ═══════════════ -->
    <footer class="site-footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <!-- <span style="font-size:16px">🚀</span> -->
          <div class="brand-icon"><img src="/logo2.png" alt=""></div>

          <span class="footer-brand-name">PingRyde</span>
          <span style="color:var(--pr-muted)">—</span>
          <span class="footer-tagline">Real-time ride coordination · Cameroon 🇨🇲</span>
        </div>
        <div class="footer-bottom">
          <span class="footer-copy">© {{ year }} PingRyde. All rights reserved.</span>
          <div class="footer-links">
            <a href="#" class="footer-link">Privacy</a>
            <a href="#" class="footer-link">Terms</a>
            <a href="#" class="footer-link">Support</a>
          </div>
        </div>
      </div>
    </footer>

  </div>
</template>

<script setup>
import { useUserStore } from '~/store/user'
import { useRideStore } from '~/store/ride'
const userStore = useUserStore()
const rideStore = useRideStore()
const year      = new Date().getFullYear()
</script>

<style scoped>
.site-header {
  position:sticky;top:0;z-index:200;
  background:rgba(30,42,50,0.96);
  backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
  border-bottom:1px solid rgba(255,255,255,0.07);
}
.header-inner {
  max-width:1100px;margin:0 auto;padding:0 16px;height:58px;
  display:flex;align-items:center;gap:8px;
}

.brand { display:flex;align-items:center;gap:8px;text-decoration:none;flex-shrink:0;margin-right:8px; }
.brand-icon {
  width:32px;height:32px;border-radius:9px;
  background:rgba(0,212,184,0.12);border:1px solid rgba(0,212,184,0.25);
  display:flex;align-items:center;justify-content:center;font-size:15px;
}
.brand-name { font-family:var(--font-display);font-size:17px;font-weight:800;color:var(--pr-teal); }

.main-nav { display:flex;align-items:center;gap:2px;flex:1;justify-content:center; }

.nav-item {
  position:relative;display:flex;align-items:center;gap:6px;
  padding:7px 12px;border-radius:10px;text-decoration:none;
  color:var(--pr-muted);font-size:13px;font-weight:500;
  transition:background 0.15s,color 0.15s;white-space:nowrap;
}
.nav-item:hover { background:rgba(255,255,255,0.05);color:var(--pr-text); }
.nav-item.router-link-active { background:rgba(0,212,184,0.1);color:var(--pr-teal); }
.nav-ico { font-size:15px;line-height:1; }

/* Hide labels on very small screens */
@media (max-width:479px) { .nav-txt { display:none; } .nav-item { padding:8px 10px; } .brand-name { display:none; } }

.notif-dot {
  position:absolute;top:4px;right:4px;
  min-width:16px;height:16px;border-radius:999px;
  background:var(--pr-orange);color:white;
  font-size:10px;font-weight:700;
  display:flex;align-items:center;justify-content:center;padding:0 4px;
  animation:notifPulse 2s ease-in-out infinite;
}
@keyframes notifPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }

.header-right { display:flex;align-items:center;gap:8px;margin-left:auto;flex-shrink:0; }

.region-pill {
  font-size:11px;color:var(--pr-muted);padding:5px 10px;border-radius:999px;
  border:1px solid rgba(255,255,255,0.07);white-space:nowrap;background:rgba(255,255,255,0.03);
}
@media (max-width:639px) { .region-pill { display:none; } }

.avatar-btn {
  width:36px;height:36px;border-radius:50%;
  background:rgba(0,212,184,0.15);color:var(--pr-teal);
  display:flex;align-items:center;justify-content:center;
  font-weight:700;font-size:13px;font-family:var(--font-display);
  text-decoration:none;flex-shrink:0;overflow:hidden;
  transition:background 0.15s,transform 0.15s;
  border:1px solid rgba(0,212,184,0.2);
}
.avatar-btn:hover { background:rgba(0,212,184,0.25);transform:scale(1.05); }
.avatar-photo { width:100%;height:100%;object-fit:cover; }

.site-footer { background:var(--pr-surface);border-top:1px solid rgba(255,255,255,0.07);margin-top:auto; }
.footer-inner { max-width:1100px;margin:0 auto;padding:18px 16px; }
.footer-brand { display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px; }
.footer-brand-name { font-family:var(--font-display);font-size:14px;font-weight:700;color:var(--pr-teal); }
.footer-tagline { font-size:12px;color:var(--pr-muted); }
.footer-bottom { display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.05); }
.footer-copy  { font-size:12px;color:var(--pr-muted); }
.footer-links { display:flex;gap:16px; }
.footer-link  { font-size:12px;color:var(--pr-muted);text-decoration:none;transition:color 0.15s; }
.footer-link:hover { color:var(--pr-teal); }
</style>