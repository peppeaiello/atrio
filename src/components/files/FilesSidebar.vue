<script setup>
import { computed } from 'vue'
import FilesIcon from './FilesIcon.vue'
import { canDisconnect, formatSize, isInside } from './files.js'

const props = defineProps({
  places: { type: Array, default: () => [] },
  storage: { type: Array, default: () => [] },
  current: { type: String, required: true },
})
const emit = defineEmits(['go', 'add', 'disconnect'])

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
      <div class="group__head">
        <h3 class="group__title">
          {{ $t(`files.${group.id}`) }}
        </h3>
        <button
          v-if="group.id === 'storage'" :aria-label="$t('files.addStorage')" :title="$t('files.addStorage')" aria-haspopup="menu"
          class="group__add" type="button" @click="emit('add', $event)"
        >
          <FilesIcon :size="16" name="plus" />
        </button>
      </div>
      <div v-for="loc in group.items" :key="loc.path" :class="{ 'is-active': activePath === loc.path }" class="loc-row">
        <button
          :aria-current="activePath === loc.path ? 'location' : null" class="loc" type="button" @click="emit('go', loc.path)"
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
        <button
          v-if="canDisconnect(loc)"
          :aria-label="`${$t(loc.kind === 'usb' ? 'files.eject' : 'files.disconnect')} ${loc.label || loc.name}`"
          :title="$t(loc.kind === 'usb' ? 'files.eject' : 'files.disconnect')" class="loc__eject" type="button" @click="emit('disconnect', loc)"
        >
          <FilesIcon :size="16" name="eject" />
        </button>
      </div>
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

.group__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0 0 6px;
  padding: 0 4px 0 12px;
}

.group__title {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--files-muted);
}

.group__add,
.loc__eject {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--files-muted);
  cursor: pointer;
}

.group__add:hover,
.loc__eject:hover {
  background: var(--files-hover-strong);
  color: var(--files-text);
}

.loc-row {
  display: flex;
  align-items: center;
  gap: 2px;
  border-radius: 12px;
}

.loc-row:hover {
  background: var(--files-hover);
}

.loc-row.is-active {
  background: var(--files-hover-strong);
}

.loc-row.is-active .loc {
  color: var(--files-text);
}

.loc-row.is-active .loc .files-icon {
  color: #67E8F9;
}

.loc__eject {
  margin-right: 4px;
}

.loc {
  flex: 1;
  min-width: 0;
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
  color: var(--files-text);
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
