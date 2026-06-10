<!-- pages/index.vue — LANDING PAGE
  ─────────────────────────────────────────────────────────────────
  This is the FIRST page every visitor sees.
  It must:
    1. Immediately communicate what PingRyde is
    2. Show the key value proposition (why it's better)
    3. Let people get started (choose passenger or driver)
    4. Look great on phones, tablets AND desktops
    5. Load fast — no heavy images or libraries

  SECTIONS:
    A. Hero           — headline, sub-headline, CTA, animated illustration
    B. How it works   — 4 steps showing the ride flow
    C. Why PingRyde   — 3 feature highlights
    D. Get started    — role chooser + action button
    E. Footer         — simple copyright line

  ANIMATIONS:
    • Hero elements fade up on load (CSS, no JS needed)
    • The "ping" pulse animation on the logo (CSS only)
    • The live map simulation — 3 dots moving closer together
      (CSS keyframes, no libraries, ~2KB)
    • All animations respect prefers-reduced-motion
-->
<template>
  <div class="land">

    <!-- ══════════════════════════════════════════════════════════
         A.  HERO SECTION
    ════════════════════════════════════════════════════════════ -->
    <section class="hero">
      <div class="hero-inner">

        <!-- LEFT: Text content -->
        <div class="hero-text pr-animate-stagger">

          <!-- Brand badge -->
          <div class="hero-badge">
            <span class="hero-badge-dot"></span>
            Live in Cameroon · Real-time
          </div>

          <!-- Headline -->
          <h1 class="hero-h1">
            Rides that <span class="hero-highlight">find you</span><br>
            — not the other way around
          </h1>

          <!-- Sub-headline -->
          <p class="hero-sub">
            PingRyde connects passengers and drivers across Cameroon
            using live GPS tracking. No fixed addresses needed —
            both parties move toward each other in real time.
          </p>

          <!-- CTA buttons -->
          <div class="hero-ctas">
            <button @click="scrollToGetStarted" class="cta-primary">
              Get Started Free
              <span class="cta-arrow">→</span>
            </button>
            <button @click="scrollToHowItWorks" class="cta-secondary">
              See how it works
            </button>
          </div>

          <!-- Trust indicators -->
          <div class="hero-trust">
            <div class="trust-item">
              <span class="trust-icon">⚡</span>
              <span>Real-time GPS</span>
            </div>
            <div class="trust-item">
              <span class="trust-icon">🇨🇲</span>
              <span>All 10 regions</span>
            </div>
            <div class="trust-item">
              <span class="trust-icon">🔒</span>
              <span>Secure & private</span>
            </div>
          </div>
        </div>

        <!-- RIGHT: Live map animation -->
        <!--
          This is a CSS-only animated illustration showing the core concept:
          a passenger and driver moving toward each other on a map.
          No images, no canvas, no JS — pure CSS animation.
          The dots represent GPS markers moving on a grid.
        -->
        <div class="hero-visual">
          <div class="map-demo">

            <!-- Grid lines (like a real map) -->
            <div class="map-grid">
              <div class="grid-h" style="top:25%"></div>
              <div class="grid-h" style="top:50%"></div>
              <div class="grid-h" style="top:75%"></div>
              <div class="grid-v" style="left:25%"></div>
              <div class="grid-v" style="left:50%"></div>
              <div class="grid-v" style="left:75%"></div>
            </div>

            <!-- Road lines -->
            <div class="road road-h" style="top:50%; width:100%"></div>
            <div class="road road-v" style="left:38%"></div>

            <!-- PASSENGER marker — moves from left toward centre -->
            <div class="marker marker-passenger">
              <div class="marker-pulse"></div>
              <div class="marker-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="7" r="4" fill="#1E2A32"/>
                  <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" fill="#1E2A32"/>
                </svg>
              </div>
            </div>

            <!-- DRIVER marker — moves from right toward centre -->
            <div class="marker marker-driver">
              <div class="marker-icon marker-icon-orange">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="9" width="20" height="9" rx="2" fill="#1E2A32"/>
                  <rect x="5" y="5" width="14" height="6" rx="2" fill="#1E2A32"/>
                  <circle cx="6.5"  cy="18" r="2" fill="#1E2A32" opacity="0.6"/>
                  <circle cx="17.5" cy="18" r="2" fill="#1E2A32" opacity="0.6"/>
                </svg>
              </div>
            </div>

            <!-- Dashed connection line between the two -->
            <div class="connection-line"></div>

            <!-- Status overlay -->
            <div class="map-status">
              <div class="map-status-dot"></div>
              <span>2 drivers nearby</span>
            </div>

            <!-- ETA chip -->
            <div class="eta-chip">~4 min away</div>

          </div>

          <!-- Caption below animation -->
          <p class="visual-caption">
            Live simulation — passenger 🟢 and driver 🟠 moving toward each other
          </p>
        </div>

      </div>
    </section>

    <!-- ══════════════════════════════════════════════════════════
         B.  HOW IT WORKS
    ════════════════════════════════════════════════════════════ -->
    <section id="how-it-works" class="section section-alt">
      <div class="section-inner">

        <div class="section-header-text">
          <p class="section-eyebrow">Simple. Fast. Reliable.</p>
          <h2 class="section-h2">How PingRyde works</h2>
          <p class="section-desc">
            Four steps from "I need a ride" to "I'm on my way" —
            all happening in less than no time.
          </p>
        </div>

        <div class="steps-grid pr-animate-stagger">
          <div v-for="step in steps" :key="step.n" class="step-card">
            <div class="step-num" :style="`background: ${step.bg}; color: ${step.color}`">
              {{ step.n }}
            </div>
            <div class="step-icon">{{ step.icon }}</div>
            <h3 class="step-title">{{ step.title }}</h3>
            <p class="step-desc">{{ step.desc }}</p>
          </div>
        </div>

      </div>
    </section>

    <!-- ══════════════════════════════════════════════════════════
         C.  WHY PINGRYDE — Feature highlights
    ════════════════════════════════════════════════════════════ -->
    <section class="section">
      <div class="section-inner">

        <div class="section-header-text">
          <p class="section-eyebrow">Built for Cameroon</p>
          <h2 class="section-h2">Why choose PingRyde?</h2>
        </div>

        <div class="features-grid pr-animate-stagger">
          <div v-for="feat in features" :key="feat.title" class="feat-card">
            <div class="feat-icon-wrap" :style="`background: ${feat.bg}`">
              <span class="feat-icon">{{ feat.icon }}</span>
            </div>
            <h3 class="feat-title">{{ feat.title }}</h3>
            <p class="feat-desc">{{ feat.desc }}</p>
          </div>
        </div>

      </div>
    </section>

    <!-- ══════════════════════════════════════════════════════════
         D.  GET STARTED — Role chooser
    ════════════════════════════════════════════════════════════ -->
    <section id="get-started" class="section section-alt">
      <div class="section-inner section-narrow">

        <div class="section-header-text">
          <p class="section-eyebrow">Ready to go?</p>
          <h2 class="section-h2">Join PingRyde today</h2>
          <p class="section-desc">Choose how you want to use the app. It takes less than 2 minutes.</p>
        </div>

        <!-- Role selection cards -->
        <div class="role-grid">
          <button
            v-for="role in roles"
            :key="role.value"
            @click="selected = role.value"
            class="role-card"
            :class="{ 'role-card-active': selected === role.value }"
            :style="selected === role.value
              ? `border-color: ${role.color}; background: ${role.bg}`
              : ''"
          >
            <div class="role-icon-wrap" :style="`background: ${role.iconBg}`">
              <span class="role-icon">{{ role.icon }}</span>
            </div>
            <div class="role-text">
              <h3 class="role-title">{{ role.label }}</h3>
              <p class="role-sub">{{ role.sub }}</p>
            </div>
            <ul class="role-perks">
              <li v-for="p in role.perks" :key="p">
                <span class="perk-tick">✓</span> {{ p }}
              </li>
            </ul>
            <!-- Selection indicator -->
            <div v-if="selected === role.value"
                 class="role-selected-badge"
                 :style="`background: ${role.color}; color: #1E2A32`">
              Selected ✓
            </div>
          </button>
        </div>

        <!-- CTA button appears after role selection -->
        <Transition name="rise">
          <div v-if="selected" class="cta-wrapper">
            <button @click="proceed" class="cta-primary cta-full">
              Continue as {{ selected === 'passenger' ? 'Passenger' : 'Driver' }}
              <span class="cta-arrow">→</span>
            </button>
            <p class="cta-note">Free to join · No credit card needed</p>
          </div>
        </Transition>

      </div>
    </section>

    <!-- ══════════════════════════════════════════════════════════
         E.  LANDING FOOTER
    ════════════════════════════════════════════════════════════ -->
    <footer class="land-footer">
      <div class="land-footer-inner">
        <span>🚀 PingRyde — Made for Cameroon 🇨🇲</span>
        <span>© {{ year }} · All rights reserved</span>
      </div>
    </footer>

  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

// This page uses the "blank" layout (simple header + no auth nav)
definePageMeta({ layout: 'blank' })

const router   = useRouter()
const selected = ref('')         // 'passenger' | 'driver'
const year     = new Date().getFullYear()

// Scroll helpers — smooth scroll to sections
const scrollToGetStarted  = () => document.getElementById('get-started')?.scrollIntoView({ behavior:'smooth' })
const scrollToHowItWorks  = () => document.getElementById('how-it-works')?.scrollIntoView({ behavior:'smooth' })

// Navigate to the appropriate login page
const proceed = () => router.push(selected.value === 'passenger' ? '/passenger/login' : '/driver/login')

// ── Content data ──────────────────────────────────────────────────

const steps = [
  { n:1, icon:'📡', title:'Passenger pings a ride',    color:'#00D4B8', bg:'rgba(0,212,184,0.12)',
    desc:'Open the app, choose taxi or moto, and tap "Ping a Ride". Your GPS location is shared automatically — no address needed.' },
  { n:2, icon:'🔔', title:'Nearby drivers are alerted', color:'#FF6B35', bg:'rgba(255,107,53,0.12)',
    desc:'The 5 nearest online drivers receive an instant push notification through the app. First to accept wins.' },
  { n:3, icon:'🗺️', title:'Live tracking begins',        color:'#F0C040', bg:'rgba(240,192,64,0.12)',
    desc:'Once accepted, both parties see each other on a live map. GPS updates every 2 seconds. Both move toward each other.' },
  { n:4, icon:'✅', title:'Ride complete',               color:'#00D4B8', bg:'rgba(0,212,184,0.12)',
    desc:'Driver marks the ride complete in-app. Both return to their home screens, ready for the next ride.' },
]

const features = [
  { icon:'📍', title:'No fixed addresses',   bg:'rgba(0,212,184,0.08)',
    desc:'Works in any neighbourhood, market, or bush path in Cameroon. Share your live location instead of describing where you are.' },
  { icon:'⚡', title:'Instant matching',      bg:'rgba(255,107,53,0.08)',
    desc:'Socket.io powers real-time notifications. Drivers receive ride alerts the instant a passenger pings — no refreshing needed.' },
  { icon:'🗺️', title:'Live bidirectional GPS', bg:'rgba(240,192,64,0.08)',
    desc:'Both driver and passenger track each other simultaneously. Watch the markers move in real time — like a live radar.' },
  { icon:'🔕', title:'No more phone calls',   bg:'rgba(0,212,184,0.08)',
    desc:'Eliminate the back-and-forth calls of "where are you?". The map shows exactly where both parties are at all times.' },
  { icon:'🇨🇲', title:'Built for Cameroon',  bg:'rgba(255,107,53,0.08)',
    desc:'Covers all 10 regions. Region is auto-detected from GPS. Ride requests are filtered by proximity and region.' },
  { icon:'🔒', title:'Private ride sessions', bg:'rgba(240,192,64,0.08)',
    desc:'Each accepted ride gets a private Socket.io room. Only driver and passenger share location — nobody else can see.' },
]

const roles = [
  {
    value:   'passenger',
    label:   'I need a ride',
    sub:     'Passenger',
    icon:    '🧍',
    color:   '#00D4B8',
    bg:      'rgba(0,212,184,0.06)',
    iconBg:  'rgba(0,212,184,0.12)',
    perks:   ['Request taxi or moto', 'Live map tracking', 'See driver en route'],
  },
  {
    value:   'driver',
    label:   'I give rides',
    sub:     'Driver',
    icon:    '🚕',
    color:   '#FF6B35',
    bg:      'rgba(255,107,53,0.06)',
    iconBg:  'rgba(255,107,53,0.12)',
    perks:   ['Get instant ride alerts', 'Go online / offline freely', 'Earn on your schedule'],
  },
]
</script>

<style scoped>
/* ══════════════════════════════════════════════════════════════
   LANDING PAGE STYLES
   All scoped to this component — won't leak to other pages.
   Mobile-first: base styles = small screens, media queries = larger.
══════════════════════════════════════════════════════════════ */

.land {
  /* Full-width, removes any default padding from .pr-page */
  width:      100%;
  overflow-x: hidden;
}

/* ── HERO ──────────────────────────────────────────────────────── */
.hero {
  min-height:  90vh;
  display:     flex;
  align-items: center;
  padding:     60px 20px 40px;
  position:    relative;
  overflow:    hidden;
  /* Subtle radial glow background — pure CSS, no image */
  background:
    radial-gradient(ellipse 70% 50% at 30% 50%, rgba(0,212,184,0.07) 0%, transparent 60%),
    radial-gradient(ellipse 50% 50% at 80% 60%, rgba(255,107,53,0.05) 0%, transparent 60%);
}

.hero-inner {
  max-width:   1100px;
  margin:      0 auto;
  width:       100%;
  display:     flex;
  flex-direction: column;  /* stack on mobile */
  gap:         48px;
  align-items: center;
}

@media (min-width: 1024px) {
  /* Side-by-side on desktop */
  .hero-inner { flex-direction: row; align-items: center; gap: 64px; }
  .hero-text  { flex: 1; }
  .hero-visual{ flex: 1; }
}

/* ── Hero text ── */
.hero-badge {
  display:       inline-flex;
  align-items:   center;
  gap:           8px;
  padding:       6px 14px;
  border-radius: 999px;
  border:        1px solid rgba(0,212,184,0.3);
  background:    rgba(0,212,184,0.08);
  color:         var(--pr-teal);
  font-size:     12px;
  font-weight:   600;
  letter-spacing:0.05em;
  margin-bottom: 20px;
  text-transform:uppercase;
}
.hero-badge-dot {
  width:7px; height:7px; border-radius:50%;
  background: var(--pr-teal);
  /* Slow pulse — shows it's "live" */
  animation: livePulse 2.5s ease-in-out infinite;
}
@keyframes livePulse {
  0%,100% { opacity:1; transform:scale(1); }
  50%     { opacity:0.5; transform:scale(1.3); }
}

.hero-h1 {
  font-size:     36px;
  font-weight:   800;
  line-height:   1.15;
  color:         var(--pr-text);
  margin:        0 0 18px;
}
@media (min-width: 640px)  { .hero-h1 { font-size: 44px; } }
@media (min-width: 1024px) { .hero-h1 { font-size: 52px; } }

/* The highlighted word "find you" gets the teal colour */
.hero-highlight {
  color:     var(--pr-teal);
  position:  relative;
  /* Underline decoration */
  text-decoration:        underline;
  text-decoration-color:  rgba(0,212,184,0.4);
  text-underline-offset:  6px;
  text-decoration-thickness: 3px;
}

.hero-sub {
  font-size:   16px;
  color:       var(--pr-muted);
  line-height: 1.7;
  margin:      0 0 32px;
  max-width:   520px;
}

/* ── CTA buttons ── */
.hero-ctas {
  display:   flex;
  gap:       12px;
  flex-wrap: wrap;
  margin-bottom: 28px;
}

.cta-primary {
  display:         inline-flex;
  align-items:     center;
  gap:             8px;
  padding:         14px 28px;
  border-radius:   12px;
  background:      var(--pr-teal);
  color:           #1E2A32;
  font-size:       15px;
  font-weight:     700;
  border:          none;
  cursor:          pointer;
  transition:      transform 0.15s, filter 0.15s;
  font-family:     var(--font-body);
}
.cta-primary:hover  { filter: brightness(1.1); transform: translateY(-1px); }
.cta-primary:active { transform: scale(0.98); }

.cta-full { width:100%; justify-content:center; font-size:16px; padding:16px; }

.cta-arrow {
  display:     inline-block;
  transition:  transform 0.2s;
}
.cta-primary:hover .cta-arrow { transform: translateX(4px); }

.cta-secondary {
  display:     inline-flex;
  align-items: center;
  padding:     14px 24px;
  border-radius:12px;
  background:  transparent;
  color:       var(--pr-muted);
  font-size:   15px;
  font-weight: 500;
  border:      1px solid var(--pr-border);
  cursor:      pointer;
  transition:  border-color 0.15s, color 0.15s;
  font-family: var(--font-body);
}
.cta-secondary:hover { border-color: rgba(0,212,184,0.3); color: var(--pr-text); }

/* ── Trust indicators ── */
.hero-trust {
  display:   flex;
  gap:       20px;
  flex-wrap: wrap;
}
.trust-item {
  display:     flex;
  align-items: center;
  gap:         6px;
  font-size:   13px;
  color:       var(--pr-muted);
}
.trust-icon { font-size: 15px; }

/* ══════════════════════════════════════════════════════════════
   LIVE MAP ANIMATION
   CSS-only animated illustration.
   Simulates the core app concept: two markers meeting.
   Uses absolute positioning within a fixed-size box.
══════════════════════════════════════════════════════════════ */
.hero-visual {
  width:     100%;
  max-width: 480px;
  display:   flex;
  flex-direction: column;
  gap:       12px;
}

.map-demo {
  width:         100%;
  height:        280px;
  background:    var(--pr-surface);
  border-radius: 20px;
  border:        1px solid var(--pr-border);
  position:      relative;
  overflow:      hidden;
}
@media (min-width: 640px) { .map-demo { height: 320px; } }

/* Grid lines — mimic map street grid */
.map-grid { position:absolute; inset:0; }
.grid-h {
  position: absolute;
  left:0; right:0; height:1px;
  background: rgba(255,255,255,0.04);
}
.grid-v {
  position: absolute;
  top:0; bottom:0; width:1px;
  background: rgba(255,255,255,0.04);
}

/* Roads — slightly brighter than grid */
.road { position:absolute; background:rgba(255,255,255,0.08); }
.road-h { height:8px; transform:translateY(-50%); }
.road-v { width:8px; transform:translateX(-50%); top:0; bottom:0; }

/* ── PASSENGER MARKER ──
   Starts at 15% from left, animates to 45% (moves right / toward centre).
   The animation loops: move right → pause → reset → repeat.
   duration 4s, 2s moving, 2s pause at meeting point, then reset.
*/
.marker { position:absolute; top:50%; transform:translateY(-50%); }

.marker-passenger {
  left:      15%;
  animation: passengerMove 4s ease-in-out infinite;
  display:   flex;
  align-items: center;
  justify-content: center;
}
@keyframes passengerMove {
  0%         { left:15%; }
  45%,55%    { left:43%; }  /* meet in middle, pause */
  100%       { left:15%; }  /* reset */
}

/* Pulse ring around passenger marker */
.marker-pulse {
  position:  absolute;
  inset:     -8px;
  border-radius: 50%;
  border:    2px solid rgba(0,212,184,0.5);
  animation: markerPulse 2s ease-out infinite;
}
@keyframes markerPulse {
  0%   { transform:scale(0.8); opacity:1; }
  100% { transform:scale(2);   opacity:0; }
}

/* Passenger icon circle */
.marker-icon {
  width:  36px; height:36px;
  border-radius: 50%;
  background:    var(--pr-teal);
  border:        2px solid #1E2A32;
  display:       flex;
  align-items:   center;
  justify-content: center;
  box-shadow:    0 2px 12px rgba(0,212,184,0.4);
  position:      relative;
  z-index:       2;
}

/* ── DRIVER MARKER ──
   Starts at 75%, moves to 52% (moves left / toward centre).
*/
.marker-driver {
  right:     15%;
  left:      auto;
  animation: driverMove 4s ease-in-out infinite;
}
@keyframes driverMove {
  0%         { right:15%; }
  45%,55%    { right:48%; }
  100%       { right:15%; }
}

.marker-icon-orange {
  width:      38px; height:28px;
  border-radius: 8px;
  background:    var(--pr-orange);
  border:        2px solid #1E2A32;
  display:       flex;
  align-items:   center;
  justify-content: center;
  box-shadow:    0 2px 12px rgba(255,107,53,0.4);
}

/* Dashed line connecting them — opacity animates with them */
.connection-line {
  position:      absolute;
  top:           50%;
  left:          30%;
  right:         30%;
  height:        2px;
  background:    repeating-linear-gradient(
    90deg, rgba(255,255,255,0.2) 0px, rgba(255,255,255,0.2) 6px,
    transparent 6px, transparent 12px
  );
  transform:     translateY(-50%);
  animation:     lineAppear 4s ease-in-out infinite;
}
@keyframes lineAppear {
  0%,20%     { opacity:0; }
  40%,60%    { opacity:1; }
  80%,100%   { opacity:0; }
}

/* Status badge on map */
.map-status {
  position:      absolute;
  top:           14px; left:14px;
  display:       flex;
  align-items:   center;
  gap:           6px;
  padding:       6px 12px;
  border-radius: 999px;
  background:    rgba(30,42,50,0.85);
  border:        1px solid var(--pr-border);
  font-size:     12px;
  color:         var(--pr-text);
  backdrop-filter: blur(8px);
}
.map-status-dot {
  width:8px; height:8px; border-radius:50%;
  background: var(--pr-teal);
  animation: livePulse 1.5s ease-in-out infinite;
}

/* ETA chip */
.eta-chip {
  position:      absolute;
  bottom:        14px; right:14px;
  padding:       6px 12px;
  border-radius: 999px;
  background:    rgba(255,107,53,0.15);
  border:        1px solid rgba(255,107,53,0.3);
  color:         var(--pr-orange);
  font-size:     12px;
  font-weight:   600;
}

.visual-caption {
  font-size:  12px;
  color:      var(--pr-muted);
  text-align: center;
  margin:     0;
}

/* ══════════════════════════════════════════════════════════════
   SHARED SECTION STYLES
══════════════════════════════════════════════════════════════ */
.section {
  padding: 72px 20px;
}
.section-alt {
  background: var(--pr-surface);
}

.section-inner {
  max-width: 1100px;
  margin:    0 auto;
  width:     100%;
}
.section-narrow { max-width: 760px; }

.section-header-text {
  text-align: center;
  margin-bottom: 48px;
}
.section-eyebrow {
  font-size:     12px;
  font-weight:   700;
  text-transform:uppercase;
  letter-spacing:0.1em;
  color:         var(--pr-teal);
  margin:        0 0 10px;
}
.section-h2 {
  font-size:   28px;
  font-weight: 800;
  margin:      0 0 14px;
}
@media (min-width: 768px) { .section-h2 { font-size: 36px; } }
.section-desc {
  font-size:  16px;
  color:      var(--pr-muted);
  max-width:  560px;
  margin:     0 auto;
  line-height:1.7;
}

/* ── HOW IT WORKS steps grid ── */
.steps-grid {
  display: grid;
  grid-template-columns: 1fr;          /* 1 column on mobile */
  gap:     24px;
}
@media (min-width: 640px)  { .steps-grid { grid-template-columns: 1fr 1fr; } }
@media (min-width: 1024px) { .steps-grid { grid-template-columns: repeat(4,1fr); } }

.step-card {
  background:    var(--pr-bg);
  border:        1px solid var(--pr-border);
  border-radius: 16px;
  padding:       24px;
  transition:    border-color 0.2s, transform 0.2s;
  position:      relative;
}
.step-card:hover {
  border-color: rgba(0,212,184,0.3);
  transform:    translateY(-2px);
}

.step-num {
  width:       36px; height:36px;
  border-radius: 50%;
  font-size:   15px; font-weight:700;
  display:     flex; align-items:center; justify-content:center;
  margin-bottom:14px;
}
.step-icon  { font-size:28px; margin-bottom:10px; display:block; }
.step-title { font-size:16px; font-weight:700; margin:0 0 8px; }
.step-desc  { font-size:13px; color:var(--pr-muted); line-height:1.65; margin:0; }

/* ── FEATURES grid ── */
.features-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap:     20px;
}
@media (min-width: 640px)  { .features-grid { grid-template-columns: 1fr 1fr; } }
@media (min-width: 1024px) { .features-grid { grid-template-columns: repeat(3,1fr); } }

.feat-card {
  background:    var(--pr-surface2);
  border:        1px solid var(--pr-border);
  border-radius: 16px;
  padding:       24px;
  transition:    border-color 0.2s, transform 0.2s;
}
.feat-card:hover { border-color: rgba(0,212,184,0.25); transform: translateY(-2px); }

.feat-icon-wrap {
  width:         48px; height:48px;
  border-radius: 14px;
  display:       flex;
  align-items:   center;
  justify-content: center;
  margin-bottom: 16px;
}
.feat-icon   { font-size: 22px; }
.feat-title  { font-size:16px; font-weight:700; margin:0 0 8px; }
.feat-desc   { font-size:13px; color:var(--pr-muted); line-height:1.65; margin:0; }

/* ── ROLE CARDS (get started section) ── */
.role-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap:     20px;
  margin-bottom: 28px;
}
@media (min-width: 640px) {
  .role-grid { grid-template-columns: 1fr 1fr; }
}

.role-card {
  position:      relative;
  background:    var(--pr-bg);
  border:        1.5px solid var(--pr-border);
  border-radius: 18px;
  padding:       24px;
  text-align:    left;
  cursor:        pointer;
  transition:    border-color 0.2s, background 0.2s, transform 0.15s;
  font-family:   var(--font-body);
  color:         var(--pr-text);
}
.role-card:hover      { transform: translateY(-2px); }
.role-card-active     { border-width: 2px; }

.role-icon-wrap {
  width:         52px; height:52px;
  border-radius: 15px;
  display:       flex;
  align-items:   center;
  justify-content: center;
  margin-bottom: 14px;
}
.role-icon   { font-size: 24px; }
.role-title  { font-size:18px; font-weight:700; margin:0 0 4px; }
.role-sub    { font-size:12px; color:var(--pr-muted); margin:0 0 16px; text-transform:uppercase; letter-spacing:0.05em; }

.role-perks  { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px; }
.role-perks li { font-size:13px; color:var(--pr-muted); display:flex; align-items:center; gap:7px; }
.perk-tick { color:var(--pr-teal); font-weight:700; font-size:12px; }

.role-selected-badge {
  position:      absolute;
  top:           14px; right:14px;
  padding:       4px 10px;
  border-radius: 999px;
  font-size:     11px;
  font-weight:   700;
}

/* ── CTA wrapper ── */
.cta-wrapper {
  display:        flex;
  flex-direction: column;
  gap:            10px;
  align-items:    center;
}
.cta-note { font-size:12px; color:var(--pr-muted); margin:0; }

/* Rise transition for the CTA button appearing */
.rise-enter-active { transition: all 0.35s cubic-bezier(0.34,1.56,0.64,1); }
.rise-enter-from   { opacity:0; transform:translateY(20px) scale(0.95); }

/* ── Landing footer ── */
.land-footer { border-top:1px solid var(--pr-border); background:var(--pr-surface); }
.land-footer-inner {
  max-width:       1100px;
  margin:          0 auto;
  padding:         20px;
  display:         flex;
  justify-content: space-between;
  flex-wrap:       wrap;
  gap:             8px;
  font-size:       12px;
  color:           var(--pr-muted);
}
</style>