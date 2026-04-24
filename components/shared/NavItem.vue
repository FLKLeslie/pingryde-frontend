<!-- components/shared/NavItem.vue -->
<template>
  <NuxtLink
    :to="to"
    class="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all duration-200 min-w-[56px]"
    :class="isActive ? 'text-[var(--pr-teal)]' : 'text-[var(--pr-muted)]'"
    style="-webkit-tap-highlight-color: transparent"
  >
    <span style="font-size: 20px; line-height: 1.3">{{ icon }}</span>
    <span class="text-[10px] font-medium leading-none">{{ label }}</span>
    <span
      class="w-1 h-1 rounded-full mt-0.5 transition-opacity duration-200"
      :class="isActive ? 'opacity-100 bg-[var(--pr-teal)]' : 'opacity-0'"
    />
  </NuxtLink>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
const props    = defineProps({ to: String, icon: String, label: String })
const route    = useRoute()
const isActive = computed(() => route.path.startsWith(props.to))
</script>