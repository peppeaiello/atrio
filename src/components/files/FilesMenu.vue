<script setup>
import { nextTick, onMounted, ref } from 'vue'
import FilesIcon from './FilesIcon.vue'

const props = defineProps({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  title: { type: String, default: '' },
  // [{ id, label, icon, danger?, disabled?, divider? }]
  actions: { type: Array, required: true },
})
const emit = defineEmits(['pick', 'close'])

const menu = ref(null)
const pos = ref({ left: `${props.x}px`, top: `${props.y}px` })

onMounted(async () => {
  await nextTick()
  const el = menu.value
  if (!el)
    return
  const box = el.offsetParent?.getBoundingClientRect() || { left: 0, top: 0, width: innerWidth, height: innerHeight }
  const left = Math.max(8, Math.min(props.x - box.left, box.width - el.offsetWidth - 8))
  const top = Math.max(8, Math.min(props.y - box.top, box.height - el.offsetHeight - 8))
  pos.value = { left: `${left}px`, top: `${top}px` }
  el.querySelector('button:not([disabled])')?.focus()
})

function onKeydown(e) {
  e.stopPropagation()
  const buttons = [...menu.value.querySelectorAll('button:not([disabled])')]
  const i = buttons.indexOf(document.activeElement)
  if (e.key === 'Escape' || e.key === 'Tab') {
    e.preventDefault()
    emit('close')
  }
  else if (e.key === 'ArrowDown') {
    e.preventDefault()
    buttons[(i + 1) % buttons.length]?.focus()
  }
  else if (e.key === 'ArrowUp') {
    e.preventDefault()
    buttons[(i - 1 + buttons.length) % buttons.length]?.focus()
  }
}
</script>

<template>
  <div class="layer" @contextmenu.prevent="emit('close')" @keydown="onKeydown" @mousedown.self="emit('close')">
    <div ref="menu" :style="pos" class="menu" role="menu">
      <p v-if="title" class="menu__title">
        {{ title }}
      </p>
      <div v-for="action in actions" :key="action.id" class="menu__entry">
        <hr v-if="action.divider" class="menu__divider">
        <button
          v-else :class="{ 'is-danger': action.danger }" :disabled="action.disabled" class="menu__item" role="menuitem" type="button"
          @click="emit('pick', action.id)"
        >
          <FilesIcon :name="action.icon" :size="17" />
          <span>{{ action.label }}</span>
          <kbd v-if="action.shortcut">{{ action.shortcut }}</kbd>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layer {
  position: absolute;
  inset: 0;
  z-index: 28;
}

.menu {
  position: absolute;
  min-width: 220px;
  max-width: min(300px, calc(100% - 16px));
  max-height: calc(100% - 16px);
  overflow-y: auto;
  padding: 6px;
  border-radius: 16px;
  background: var(--files-panel-strong);
  backdrop-filter: blur(32px) saturate(150%);
  border: 1px solid var(--files-border-strong);
  box-shadow: 0 16px 48px rgba(2, 6, 23, 0.5);
}

.menu__title {
  margin: 0;
  padding: 8px 10px 6px;
  font-size: 12px;
  font-weight: 700;
  color: var(--files-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu__item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 38px;
  padding: 0 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--files-text);
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
}

.menu__item span {
  flex: 1;
}

.menu__item kbd {
  font: inherit;
  font-size: 11px;
  color: var(--files-muted);
}

.menu__item:hover:not(:disabled),
.menu__item:focus-visible {
  outline: none;
  background: var(--files-hover-strong);
}

.menu__item:disabled {
  opacity: 0.4;
  cursor: default;
}

.menu__item.is-danger {
  color: #FDA4AF;
}

.menu__divider {
  height: 1px;
  margin: 4px 6px;
  border: 0;
  background: var(--files-border-strong);
}

@media (max-width: 720px) {
  .layer {
    background: rgba(2, 6, 23, 0.45);
  }

  .menu {
    left: 8px !important;
    right: 8px;
    top: auto !important;
    bottom: 8px;
    max-width: none;
    border-radius: 22px;
  }

  .menu__item {
    min-height: 46px;
  }
}
</style>
