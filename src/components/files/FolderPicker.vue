<script setup>
import { computed, ref, watch } from 'vue'
import FilesDialog from './FilesDialog.vue'
import FilesIcon from './FilesIcon.vue'
import { baseName, errorMessage, isInside, listFolder, parentPath } from './files.js'

const props = defineProps({
  mode: { type: String, required: true }, // 'copy' | 'move'
  sources: { type: Array, required: true }, // items being copied or moved
  start: { type: String, required: true },
  locations: { type: Array, default: () => [] },
})
const emit = defineEmits(['confirm', 'close'])

const dir = ref(props.start)
const folders = ref([])
const loading = ref(false)
const error = ref('')
const style = ref('skip')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const items = await listFolder(dir.value)
    folders.value = items
      .filter(i => i.is_dir && !i.name.startsWith('.'))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
  }
  catch (e) {
    folders.value = []
    error.value = errorMessage(e)
  }
  finally {
    loading.value = false
  }
}
watch(dir, load, { immediate: true })

const crumbs = computed(() => {
  const parts = dir.value.split('/').filter(Boolean)
  return [{ name: '/', path: '/' }, ...parts.map((name, i) => ({ name, path: `/${parts.slice(0, i + 1).join('/')}` }))]
})

const blocked = computed(() => props.sources.some(s => s.is_dir && isInside(dir.value, s.path)))
const sameFolder = computed(() => props.sources.every(s => parentPath(s.path) === dir.value))
const disabled = computed(() => blocked.value || (props.mode === 'move' && sameFolder.value) || !!error.value)
</script>

<template>
  <FilesDialog :title="$t('files.chooseDestination')" wide @close="emit('close')">
    <p class="lead">
      {{ $t(`files.${mode === 'copy' ? 'copying' : 'moving'}${sources.length === 1 ? 'OneTo' : 'To'}`, { n: sources.length }) }}
      <strong>{{ dir }}</strong>
    </p>

    <div class="chips">
      <button v-for="loc in locations" :key="loc.path" :class="{ 'is-active': dir === loc.path }" class="chip" type="button" @click="dir = loc.path">
        <FilesIcon :name="loc.icon" :size="15" />{{ loc.label || $t(`files.${loc.name}`) }}
      </button>
    </div>

    <nav :aria-label="$t('files.chooseDestination')" class="crumbs">
      <span v-for="(c, i) in crumbs" :key="c.path" class="crumbs__step">
        <FilesIcon v-if="i > 1" :size="14" class="crumbs__sep" name="chevronRight" />
        <button class="crumbs__item" type="button" @click="dir = c.path">
          {{ c.name }}
        </button>
      </span>
    </nav>

    <div class="folders">
      <button v-if="dir !== '/'" class="folder" type="button" @click="dir = parentPath(dir)">
        <FilesIcon :size="18" name="arrowUp" />..
      </button>
      <p v-if="loading" class="note">
        …
      </p>
      <p v-else-if="error" class="note note--error">
        {{ error }}
      </p>
      <button
        v-for="f in folders" :key="f.path" :disabled="sources.some(s => s.path === f.path)" class="folder" type="button"
        @click="dir = f.path"
      >
        <FilesIcon :size="18" name="folder" />{{ baseName(f.path) }}
      </button>
    </div>

    <fieldset class="style">
      <legend>{{ $t('files.ifExists') }}</legend>
      <label><input v-model="style" name="files-style" type="radio" value="skip"> {{ $t('files.skip') }}</label>
      <label><input v-model="style" name="files-style" type="radio" value="overwrite"> {{ $t('files.overwrite') }}</label>
    </fieldset>

    <p v-if="blocked" class="note note--error">
      {{ $t('files.intoItself') }}
    </p>

    <template #actions>
      <button class="btn" type="button" @click="emit('close')">
        {{ $t('files.cancel') }}
      </button>
      <button :disabled="disabled" class="btn btn--primary" type="button" @click="emit('confirm', dir, style)">
        {{ $t(mode === 'copy' ? 'files.copyHere' : 'files.moveHere') }}
      </button>
    </template>
  </FilesDialog>
</template>

<style scoped>
.lead {
  margin: 0;
  overflow-wrap: anywhere;
}

.lead strong {
  color: var(--files-text);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--files-border);
  background: var(--files-field);
  color: var(--files-text-soft);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.chip.is-active {
  color: var(--files-text);
  border-color: var(--files-selected-border);
  background: var(--files-selected);
}

.crumbs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
}

.crumbs__step {
  display: flex;
  align-items: center;
  gap: 2px;
}

.crumbs__item {
  height: 28px;
  padding: 0 6px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--files-text-soft);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.crumbs__item:hover {
  background: var(--files-hover);
  color: var(--files-text);
}

.crumbs__sep {
  color: var(--files-muted);
}

.folders {
  height: 260px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px;
  border-radius: 16px;
  background: rgba(2, 6, 23, 0.35);
  border: 1px solid var(--files-border);
}

.folder {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding: 0 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--files-text);
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}

.folder:hover:not(:disabled) {
  background: var(--files-hover);
}

.folder:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.folder .files-icon {
  color: #A5B4FC;
}

.style {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin: 0;
  padding: 0;
  border: 0;
}

.style legend {
  width: 100%;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--files-muted);
}

.style label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.note {
  margin: 0;
  padding: 8px 10px;
  color: var(--files-muted);
}

.note--error {
  color: #FDA4AF;
}
</style>
