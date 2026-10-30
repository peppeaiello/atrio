<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import FilesIcon from './FilesIcon.vue'
import FileThumb from './FileThumb.vue'
import { download, errorMessage, fileUrl, formatSize, previewMode, readText } from './files.js'

const props = defineProps({
  item: { type: Object, required: true },
  // Sibling files that can be previewed, for previous / next.
  siblings: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'navigate'])

const TEXT_LIMIT = 1024 * 1024

const root = ref(null)
const mode = computed(() => previewMode(props.item))
const text = ref('')
const loading = ref(false)
const error = ref('')

const index = computed(() => props.siblings.findIndex(s => s.path === props.item.path))
const prev = computed(() => (index.value > 0 ? props.siblings[index.value - 1] : null))
const next = computed(() => (index.value >= 0 && index.value < props.siblings.length - 1 ? props.siblings[index.value + 1] : null))

async function load() {
  text.value = ''
  error.value = ''
  if (mode.value !== 'text')
    return
  if (props.item.size > TEXT_LIMIT) {
    error.value = 'tooLarge'
    return
  }
  loading.value = true
  try {
    const content = await readText(props.item.path)
    text.value = typeof content === 'string' ? content : JSON.stringify(content, null, 2)
  }
  catch (e) {
    error.value = errorMessage(e)
  }
  finally {
    loading.value = false
  }
}
watch(() => props.item.path, load, { immediate: true })

onMounted(async () => {
  await nextTick()
  root.value?.focus()
})

function onKeydown(e) {
  e.stopPropagation()
  if (e.key === 'Escape' || e.key === ' ') {
    if (e.key === ' ' && ['VIDEO', 'AUDIO'].includes(e.target.tagName))
      return
    e.preventDefault()
    emit('close')
  }
  else if (e.key === 'ArrowLeft' && prev.value) {
    emit('navigate', prev.value)
  }
  else if (e.key === 'ArrowRight' && next.value) {
    emit('navigate', next.value)
  }
}
</script>

<template>
  <div ref="root" :aria-label="item.name" aria-modal="true" class="preview" role="dialog" tabindex="-1" @keydown="onKeydown">
    <header class="preview__bar">
      <FileThumb :item="item" size="small" />
      <div class="preview__title">
        <strong :title="item.name">{{ item.name }}</strong>
        <span>{{ formatSize(item.size) }}</span>
      </div>
      <button :aria-label="$t('files.download')" :title="$t('files.download')" class="icon-btn" type="button" @click="download([item])">
        <FilesIcon name="download" />
      </button>
      <button :aria-label="$t('files.close')" :title="$t('files.close')" class="icon-btn" type="button" @click="emit('close')">
        <FilesIcon name="x" />
      </button>
    </header>

    <div class="preview__stage" @click.self="emit('close')">
      <img v-if="mode === 'image'" :key="item.path" :alt="item.name" :src="fileUrl(item.path)" class="media">
      <video v-else-if="mode === 'video'" :key="item.path" :src="fileUrl(item.path)" autoplay class="media" controls playsinline />
      <div v-else-if="mode === 'audio'" class="audio">
        <FileThumb :item="item" />
        <audio :key="item.path" :src="fileUrl(item.path)" autoplay controls />
      </div>
      <iframe v-else-if="mode === 'pdf'" :key="item.path" :src="fileUrl(item.path)" :title="item.name" class="doc" />
      <template v-else-if="mode === 'text'">
        <p v-if="loading" class="message">
          …
        </p>
        <div v-else-if="error" class="message">
          <p>{{ error === 'tooLarge' ? $t('files.tooLarge') : error }}</p>
          <button class="btn btn--primary" type="button" @click="download([item])">
            <FilesIcon :size="16" name="download" />{{ $t('files.download') }}
          </button>
        </div>
        <pre v-else class="text">{{ text }}</pre>
      </template>
      <div v-else class="message">
        <FileThumb :item="item" />
        <p>{{ $t('files.noPreview') }}</p>
        <button class="btn btn--primary" type="button" @click="download([item])">
          <FilesIcon :size="16" name="download" />{{ $t('files.download') }}
        </button>
      </div>

      <button v-if="prev" :aria-label="$t('files.previous')" class="nav nav--prev" type="button" @click="emit('navigate', prev)">
        <FilesIcon :size="22" name="chevronLeft" />
      </button>
      <button v-if="next" :aria-label="$t('files.next')" class="nav nav--next" type="button" @click="emit('navigate', next)">
        <FilesIcon :size="22" name="chevronRight" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.preview {
  position: absolute;
  inset: 0;
  z-index: 25;
  display: flex;
  flex-direction: column;
  background: rgba(2, 6, 23, 0.82);
  backdrop-filter: blur(20px);
  outline: none;
}

.preview__bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  color: var(--files-text);
}

.preview__title {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.preview__title strong {
  font-size: 15px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview__title span {
  font-size: 12px;
  color: var(--files-muted);
}

.icon-btn {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--files-text);
  cursor: pointer;
}

.icon-btn:hover {
  background: var(--files-hover-strong);
}

.preview__stage {
  position: relative;
  flex: 1;
  min-height: 0;
  display: grid;
  place-items: center;
  padding: 0 72px 24px;
}

.media {
  max-width: 100%;
  max-height: 100%;
  border-radius: 12px;
  object-fit: contain;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
}

.doc {
  width: 100%;
  height: 100%;
  border: 0;
  border-radius: 12px;
  background: #fff;
}

.audio {
  width: min(360px, 100%);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.audio audio {
  width: 100%;
}

.text {
  width: min(960px, 100%);
  height: 100%;
  margin: 0;
  padding: 20px;
  overflow: auto;
  border-radius: 16px;
  background: rgba(2, 6, 23, 0.7);
  border: 1px solid var(--files-border);
  color: #E2E8F0;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  tab-size: 4;
}

.message {
  width: min(320px, 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
  color: var(--files-text-soft);
}

.message p {
  margin: 0;
}

.nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  padding: 0;
  border: 1px solid var(--files-border-strong);
  border-radius: 50%;
  background: var(--files-panel-strong);
  color: var(--files-text);
  cursor: pointer;
}

.nav--prev {
  left: 12px;
}

.nav--next {
  right: 12px;
}

@media (max-width: 720px) {
  .preview__stage {
    padding: 0 12px 76px;
  }

  .nav {
    top: auto;
    bottom: 16px;
    transform: none;
  }

  .nav--prev {
    left: calc(50% - 60px);
  }

  .nav--next {
    right: calc(50% - 60px);
  }
}
</style>
