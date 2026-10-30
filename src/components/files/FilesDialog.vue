<script setup>
import { nextTick, onMounted, ref } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  wide: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])

const panel = ref(null)

onMounted(async () => {
  await nextTick()
  const target = panel.value?.querySelector('[autofocus], input, select, textarea, .dialog__actions .btn--primary, button')
  target?.focus()
  if (target?.select)
    target.select()
})

function onKeydown(e) {
  e.stopPropagation()
  if (e.key === 'Escape')
    emit('close')
  if (e.key === 'Tab') {
    const focusable = [...panel.value.querySelectorAll('button:not([disabled]), input, select, textarea, [tabindex="0"]')]
    if (!focusable.length)
      return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      last.focus()
      e.preventDefault()
    }
    else if (!e.shiftKey && document.activeElement === last) {
      first.focus()
      e.preventDefault()
    }
  }
}
</script>

<template>
  <div class="scrim" @keydown="onKeydown" @mousedown.self="emit('close')">
    <section ref="panel" :aria-label="title" :class="{ 'dialog--wide': props.wide }" aria-modal="true" class="dialog" role="dialog">
      <h2 class="dialog__title">
        {{ title }}
      </h2>
      <div class="dialog__body">
        <slot />
      </div>
      <div class="dialog__actions">
        <slot name="actions" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.scrim {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(2, 6, 23, 0.5);
  backdrop-filter: blur(4px);
}

.dialog {
  width: min(440px, 100%);
  max-height: calc(100% - 32px);
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  border-radius: 24px;
  background: var(--files-panel-strong);
  backdrop-filter: blur(32px) saturate(150%);
  border: 1px solid var(--files-border-strong);
  box-shadow: 0 24px 64px rgba(2, 6, 23, 0.5);
}

.dialog--wide {
  width: min(620px, 100%);
}

.dialog__title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--files-text);
  overflow-wrap: anywhere;
}

.dialog__body {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: var(--files-text-soft);
  font-size: 14px;
  line-height: 1.5;
}

.dialog__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}
</style>
