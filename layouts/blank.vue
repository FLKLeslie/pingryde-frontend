<!-- layouts/blank.vue
  Used by: index.vue, passenger/login.vue, driver/login.vue
  Shows a minimal header with logo only — user is not logged in.
-->
<template>
  <div style="display:flex;flex-direction:column;min-height:100dvh;">

    <!-- Minimal brand header -->
    <header style="
      position:sticky;top:0;z-index:100;
      background:rgba(30,42,50,0.96);
      backdrop-filter:blur(16px);
      -webkit-backdrop-filter:blur(16px);
      border-bottom:1px solid rgba(255,255,255,0.07);
    ">
      <div style="
        max-width:1100px;margin:0 auto;
        padding:0 20px;height:56px;
        display:flex;align-items:center;justify-content:space-between;
      ">
        <NuxtLink to="/" style="display:flex;align-items:center;gap:8px;text-decoration:none;">
          <div style="
            width:32px;height:32px;border-radius:9px;
            background:rgba(0,212,184,0.12);border:1px solid rgba(0,212,184,0.25);
            display:flex;align-items:center;justify-content:center;font-size:15px;
          ">🚀</div>
          <span style="font-family:var(--font-display);font-size:17px;font-weight:800;color:var(--pr-teal);">
            PingRyde
          </span>
        </NuxtLink>
        <span style="font-size:12px;color:var(--pr-muted);">Cameroon 🇨🇲</span>
      </div>
    </header>

    <!-- Page content -->
    <main style="flex:1;">
      <slot />
    </main>

  </div>
</template>