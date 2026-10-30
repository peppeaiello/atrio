<script setup>
import { computed } from 'vue'
import { icons } from './icons.js'

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 18 },
  strokeWidth: { type: [Number, String], default: 2 },
})

const markup = computed(() => icons[props.name] || icons.file)
</script>

<template>
  <svg
    :width="size" :height="size" :stroke-width="strokeWidth" aria-hidden="true" class="files-icon" fill="none"
    focusable="false" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"
    v-html="markup"
  />
</template>

<style scoped>
.files-icon {
  flex-shrink: 0;
  display: block;
}
</style>
