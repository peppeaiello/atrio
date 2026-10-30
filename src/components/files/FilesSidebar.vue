<script setup>
import { computed } from 'vue'
import FilesIcon from './FilesIcon.vue'
import { formatSize, isInside } from './files.js'

const props = defineProps({
  places: { type: Array, default: () => [] },
  storage: { type: Array, default: () => [] },
  current: { type: String, required: true },
})
const emit = defineEmits(['go'])

// The deepest location that holds the current folder is the active one.
const activePath = computed(() => {
  let best = ''
  ;[...props.places, ...props.storage].forEach((loc) => {
    if (isInside(props.current, loc.path) && loc.path.length > best.length)
      best = loc.path
  })
  return best
})

function usage(loc) {
  const size = Number(loc.size)
  const avail = Number(loc.avail)
  if (!size || Number.isNaN(avail))
    return null
  return { percent: Math.round(((size - avail) / size) * 100), text: `${formatSize(avail)} / ${formatSize(size)}` }
}

const groups = computed(() => [
  { id: 'places', items: props.places },
  { id: 'storage', items: props.storage },
])
</script>

<template>
  <nav :aria-label="$t('files.menu')" class="sidebar">
    <section v-for="group in groups" :key="group.id" class="group">
      <h3 class="group__title">
        {{ $t(`files.${group.id}`) }}
      </h3>
      <button
        v-for="loc in group.items" :key="loc.path" :aria-current="activePath === loc.path ? 'location' : null"
        :class="{ 'is-active': activePath === loc.path }" class="loc" type="button" @click="emit('go', loc.path)"
      >
        <FilesIcon :name="loc.icon" :size="18" />
        <span class="loc__main">
          <span class="loc__name">{{ loc.label || $t(`files.${loc.name}`) }}</span>
          <template v-if="usage(loc)">
            <span class="loc__bar"><span :style="{ width: `${usage(loc).percent}%` }" /></span>
            <span class="loc__meta">{{ usage(loc).text }}</span>
          </template>
          <span v-else-if="group.id === 'storage'" class="loc__meta">{{ loc.path }}</span>
        </span>
      </button>
    </section>
  </nav>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.group__title {
  margin: 0 0 6px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--files-muted);
}

.loc {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-height: 42px;
  padding: 11px 12px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--files-text-soft);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.loc:hover {
  background: var(--files-hover);
  color: var(--files-text);
}

.loc.is-active {
  background: var(--files-hover-strong);
  color: var(--files-text);
}

.loc.is-active .files-icon {
  color: #67E8F9;
}

.loc__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.loc__name {
  font-size: 14px;
  font-weight: 600;
  line-height: 18px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.loc__meta {
  font-size: 11px;
  color: var(--files-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.loc__bar {
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.loc__bar span {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #22D3EE, #6366F1);
}
</style>
