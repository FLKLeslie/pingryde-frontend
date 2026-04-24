<!-- app.vue — Root component
  The simplest possible root.
  NuxtLayout picks default.vue or blank.vue based on definePageMeta.
  NuxtPage renders the current route's page component.
  The loading bar appears at the top during page transitions.
-->
<template>
  <div>
    <NuxtLoadingIndicator color="#00D4B8" :height="2" />
    <NuxtLayout>
      <NuxtPage :transition="{ name: 'page', mode: 'out-in' }" />
    </NuxtLayout>
  </div>
</template>

<style>
/* Page transition — gentle fade between routes */
.page-enter-active, .page-leave-active { transition: opacity 0.15s ease; }
.page-enter-from,   .page-leave-to     { opacity: 0; }
</style>