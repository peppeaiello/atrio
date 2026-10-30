<script setup>
import { computed, ref, watch } from 'vue'
import FilesIcon from './FilesIcon.vue'
import { hasThumb, kindOf, thumbUrl } from './files.js'

const props = defineProps({
  item: { type: Object, required: true },
  size: { type: String, default: 'large' }, // 'large' (grid) or 'small' (list)
})

const kind = computed(() => kindOf(props.item))
const failed = ref(false)
watch(() => props.item.path, () => {
  failed.value = false
})
const showImage = computed(() => props.size === 'large' && hasThumb(props.item) && !failed.value)
</script>

<template>
  <span :class="[`thumb--${size}`, `kind--${kind}`]" class="thumb">
    <img v-if="showImage" :src="thumbUrl(item.path)" alt="" class="thumb__img" decoding="async" loading="lazy" @error="failed = true">
    <FilesIcon v-else :name="kind" :size="size === 'large' ? 34 : 18" :stroke-width="size === 'large' ? 1.6 : 2" />
  </span>
</template>

<style scoped>
.thumb {
  display: grid;
  place-items: center;
  overflow: hidden;
  color: var(--kind-fg, #CBD5E1);
  background: var(--kind-bg, rgba(255, 255, 255, 0.06));
}

.thumb--large {
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: 14px;
}

.thumb--small {
  width: 32px;
  height: 32px;
  border-radius: 10px;
}

.thumb__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.kind--folder { --kind-fg: #A5B4FC; --kind-bg: rgba(99, 102, 241, 0.18); }
.kind--image { --kind-fg: #F9A8D4; --kind-bg: rgba(236, 72, 153, 0.14); }
.kind--video { --kind-fg: #FCA5A5; --kind-bg: rgba(239, 68, 68, 0.14); }
.kind--audio { --kind-fg: #FDBA74; --kind-bg: rgba(249, 115, 22, 0.14); }
.kind--text { --kind-fg: #E2E8F0; --kind-bg: rgba(148, 163, 184, 0.14); }
.kind--code { --kind-fg: #67E8F9; --kind-bg: rgba(34, 211, 238, 0.13); }
.kind--pdf { --kind-fg: #FDA4AF; --kind-bg: rgba(244, 63, 94, 0.14); }
.kind--doc { --kind-fg: #93C5FD; --kind-bg: rgba(59, 130, 246, 0.15); }
.kind--sheet { --kind-fg: #86EFAC; --kind-bg: rgba(34, 197, 94, 0.13); }
.kind--archive { --kind-fg: #FDE68A; --kind-bg: rgba(234, 179, 8, 0.13); }
.kind--disc { --kind-fg: #D8B4FE; --kind-bg: rgba(168, 85, 247, 0.14); }
.kind--file { --kind-fg: #CBD5E1; --kind-bg: rgba(148, 163, 184, 0.12); }
</style>
