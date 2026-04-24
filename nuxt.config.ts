// nuxt.config.ts
export default defineNuxtConfig({
  devtools: { enabled: true },
  ssr:   false,
  pages: true,

  // ── COMPONENTS CONFIGURATION ────────────────────────────────────
  // Tell Nuxt exactly where our components are.
  // By default Nuxt scans components/ recursively and names them
  // using the folder path. We set pathPrefix: false so that ALL
  // components in ANY subfolder get their simple filename as the
  // component name — no prefix.
  //
  // components/MapView.vue       → <MapView>      ✅
  // components/RideRequestCard.vue → <RideRequestCard> ✅
  // components/NavItem.vue       → <NavItem>      ✅
  //
  // With pathPrefix:true (default):
  // components/shared/MapView.vue → <SharedMapView> (was causing the error)
  components: [
    {
      path:       '~/components',
      pathPrefix: false,   // Don't prefix with folder name — use file name only
    }
  ],

  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],

  pinia: { storesDirs: ['./store/**'] },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    public: {
      apiBase:   process.env.API_BASE   || 'http://localhost:5000/api',
      socketUrl: process.env.SOCKET_URL || 'http://localhost:5000',
    },
  },

  app: {
    baseURL: '/',
    head: {
      title: 'PingRyde',
      meta: [
        { name: 'viewport',                content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description',             content: 'Real-time ride coordination for Cameroon' },
        { name: 'theme-color',             content: '#1E2A32' },
        { name: 'mobile-web-app-capable',  content: 'yes' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        {
          rel:  'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500&display=swap',
        },
        {
          rel:  'stylesheet',
          href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
        },
      ],
    },
  },
})