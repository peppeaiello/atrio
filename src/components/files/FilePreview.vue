<script setup>
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import FilesDialog from './FilesDialog.vue'
import FilesIcon from './FilesIcon.vue'
import FileThumb from './FileThumb.vue'
import { download, errorMessage, fileInfo, fileUrl, formatSize, previewMode, readText, saveText } from './files.js'

const props = defineProps({
  item: { type: Object, required: true },
  // Sibling files that can be previewed, for previous / next.
  siblings: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'navigate', 'saved'])

// CodeMirror and its languages are loaded the first time a text file is opened, not with the dashboard.
const CodeEditor = defineAsyncComponent(() => import('./CodeEditor.vue'))

const TEXT_LIMIT = 1024 * 1024
// Above this a text file opens read only: editing gets slow, above all on a phone.
const EDIT_LIMIT = 512 * 1024

const root = ref(null)
const editor = ref(null)
const mode = computed(() => previewMode(props.item))
const text = ref('')
const loading = ref(false)
const error = ref('')

const index = computed(() => props.siblings.findIndex(s => s.path === props.item.path))
const prev = computed(() => (index.value > 0 ? props.siblings[index.value - 1] : null))
const next = computed(() => (index.value >= 0 && index.value < props.siblings.length - 1 ? props.siblings[index.value + 1] : null))

/* ------------------------------------------------------------------ editing */

// Size and date of the file when it was read, to notice a change made by something else before saving.
const baseline = ref(null)
// Why the file cannot be edited here ('' when it can): 'tooLarge' or 'notText'.
const lockReason = ref('')
const editing = ref(false)
// Set by the editor: the text differs from the saved one.
const changed = ref(false)
// Grows on every load, so the editor starts over with the file as it is now.
const version = ref(0)
const saving = ref(false)
const saveError = ref('')
// { kind: 'leave', then } asks about unsaved changes, { kind: 'errors', then } about saving a file that does not parse,
// { kind: 'conflict', then } says the file changed on the server. `then` is what to do once the text is saved or
// thrown away, such as closing the preview.
const confirm = ref(null)
// The editor turns \r\n into \n; files written with Windows line endings get them back when saved.
let crlf = false

const original = computed(() => text.value.replace(/\r\n/g, '\n'))
const dirty = computed(() => editing.value && changed.value)
const canEdit = computed(() => mode.value === 'text' && !loading.value && !error.value && !lockReason.value && baseline.value !== null)

async function load() {
  text.value = ''
  error.value = ''
  baseline.value = null
  lockReason.value = ''
  editing.value = false
  changed.value = false
  saveError.value = ''
  version.value++
  if (mode.value !== 'text')
    return
  if (props.item.size > TEXT_LIMIT) {
    error.value = 'tooLarge'
    return
  }
  loading.value = true
  const path = props.item.path
  try {
    // The size and date are read before the content: a change in between makes a later save ask, never lose it.
    const info = await fileInfo(path).catch(() => null)
    const content = await readText(path)
    if (path !== props.item.path)
      return
    if (typeof content === 'string') {
      text.value = content
      crlf = content.includes('\r\n')
      baseline.value = info
      if ((info?.size ?? props.item.size) > EDIT_LIMIT)
        lockReason.value = 'tooLarge'
      // A NUL or a character that could not be decoded means it is not plain UTF-8 text: saving would damage it.
      else if (/[\0\uFFFD]/.test(content))
        lockReason.value = 'notText'
    }
    else {
      text.value = JSON.stringify(content, null, 2)
      lockReason.value = 'notText'
    }
  }
  catch (e) {
    if (path === props.item.path)
      error.value = errorMessage(e)
  }
  finally {
    if (path === props.item.path)
      loading.value = false
  }
}
watch(() => props.item.path, load, { immediate: true })

function startEditing() {
  if (!canEdit.value)
    return
  saveError.value = ''
  editing.value = true
  nextTick(() => editor.value?.focus())
}

function stopEditing() {
  editor.value?.reset()
  editing.value = false
  saveError.value = ''
  nextTick(() => root.value?.focus())
}

// Runs `then` right away, or after asking when there are unsaved changes.
function leave(then) {
  if (dirty.value)
    confirm.value = { kind: 'leave', then }
  else then()
}

function discard() {
  const then = confirm.value?.then
  confirm.value = null
  editor.value?.reset()
  editing.value = false
  then?.()
}

function keepEditing() {
  confirm.value = null
  nextTick(() => editor.value?.focus())
}

const sameFile = (a, b) => !!a && !!b && a.size === b.size && a.date === b.date

// Checks before writing: errors in the text (skipped with `anyway`), then a change on the server (skipped with `replace`).
async function save({ anyway = false, replace = false } = {}) {
  if (!editing.value || saving.value || !editor.value)
    return
  const path = props.item.path
  const then = confirm.value?.then ?? null
  confirm.value = null
  if (!anyway && editor.value.hasErrors()) {
    confirm.value = { kind: 'errors', then, error: editor.value.firstError() }
    return
  }
  saving.value = true
  saveError.value = ''
  try {
    if (!replace) {
      const now = await fileInfo(path)
      if (!sameFile(now, baseline.value)) {
        confirm.value = { kind: 'conflict', then }
        return
      }
    }
    const value = editor.value.getValue()
    const content = crlf ? value.replace(/\n/g, '\r\n') : value
    await saveText(path, content)
    text.value = content
    editor.value.markClean()
    baseline.value = await fileInfo(path).catch(() => null)
    editing.value = false
    emit('saved', props.item)
    if (then)
      then()
    else nextTick(() => root.value?.focus())
  }
  catch (e) {
    saveError.value = errorMessage(e)
  }
  finally {
    saving.value = false
  }
}

// From the errors dialog: back to the editor, on the first error.
function showError() {
  confirm.value = null
  nextTick(() => editor.value?.showErrors())
}

// Throws away the edits and shows the file as it is on the server now.
async function reloadFromServer() {
  confirm.value = null
  editing.value = false
  await load()
}

function cancelEditing() {
  leave(stopEditing)
}

function close() {
  leave(() => emit('close'))
}

function navigate(item) {
  leave(() => emit('navigate', item))
}

function onBeforeUnload(e) {
  if (!dirty.value)
    return
  e.preventDefault()
  e.returnValue = ''
}

onMounted(async () => {
  window.addEventListener('beforeunload', onBeforeUnload)
  await nextTick()
  root.value?.focus()
})

onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))

function onKeydown(e) {
  e.stopPropagation()
  // Keys the editor already used, such as Escape closing its search bar.
  if (e.defaultPrevented)
    return
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 's') {
    e.preventDefault()
    if (editing.value)
      save()
    return
  }
  // Typing in the editor's search bar.
  if (e.target.closest?.('.cm-panels'))
    return
  if (editing.value) {
    if (e.key === 'Escape') {
      e.preventDefault()
      cancelEditing()
    }
    return
  }
  // In the code, Space and the arrows scroll and move the cursor rather than closing or changing file.
  const inCode = !!e.target.closest?.('.cm-editor')
  if (inCode && [' ', 'ArrowLeft', 'ArrowRight'].includes(e.key))
    return
  if (e.key === 'Escape' || e.key === ' ') {
    if (e.key === ' ' && ['VIDEO', 'AUDIO', 'BUTTON'].includes(e.target.tagName))
      return
    e.preventDefault()
    close()
  }
  else if (e.key === 'ArrowLeft' && prev.value) {
    navigate(prev.value)
  }
  else if (e.key === 'ArrowRight' && next.value) {
    navigate(next.value)
  }
  else if ((e.key === 'e' || e.key === 'F2') && !e.ctrlKey && !e.metaKey && !e.altKey && canEdit.value) {
    e.preventDefault()
    startEditing()
  }
}

// Second line under the name: what can or cannot be done with the text.
const note = computed(() => {
  if (editing.value)
    return dirty.value ? 'files.unsaved' : 'files.editing'
  if (lockReason.value)
    return lockReason.value === 'tooLarge' ? 'files.editTooLarge' : 'files.editNotText'
  return ''
})
</script>

<template>
  <div ref="root" :aria-label="item.name" aria-modal="true" class="preview" role="dialog" tabindex="-1" @keydown="onKeydown">
    <header :class="{ editing }" class="preview__bar">
      <FileThumb :item="item" class="preview__thumb" size="small" />
      <div class="preview__title">
        <strong :title="item.name">{{ item.name }}</strong>
        <span :class="{ 'is-dirty': dirty }">{{ formatSize(item.size) }}<template v-if="note"> · {{ $t(note) }}</template></span>
      </div>
      <template v-if="editing">
        <button :disabled="saving" class="btn" type="button" @click="cancelEditing">
          {{ $t('files.cancel') }}
        </button>
        <button :disabled="saving || !dirty" class="btn btn--primary" type="button" @click="save()">
          <FilesIcon :size="16" name="check" />{{ $t('files.save') }}
        </button>
      </template>
      <template v-else>
        <button
          v-if="canEdit" :aria-label="$t('files.edit')" :title="`${$t('files.edit')} (E)`" class="btn edit-btn" type="button"
          @click="startEditing"
        >
          <FilesIcon :size="16" name="pencil" /><span class="edit-btn__label">{{ $t('files.edit') }}</span>
        </button>
        <button :aria-label="$t('files.download')" :title="$t('files.download')" class="icon-btn" type="button" @click="download([item])">
          <FilesIcon name="download" />
        </button>
        <button :aria-label="$t('files.close')" :title="$t('files.close')" class="icon-btn" type="button" @click="close">
          <FilesIcon name="x" />
        </button>
      </template>
    </header>

    <div :class="{ 'is-editing': editing }" class="preview__stage" @click.self="editing || close()">
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
        <div v-else class="editor">
          <p v-if="saveError" class="editor__error" role="alert">
            <FilesIcon :size="16" name="alert" />{{ $t('files.saveFailed') }}: {{ saveError }}
          </p>
          <CodeEditor
            ref="editor" :key="`${item.path}#${version}`" :editable="editing && !saving" :name="item.name" :value="original"
            @dirty="value => changed = value"
          />
        </div>
      </template>
      <div v-else class="message">
        <FileThumb :item="item" />
        <p>{{ $t('files.noPreview') }}</p>
        <button class="btn btn--primary" type="button" @click="download([item])">
          <FilesIcon :size="16" name="download" />{{ $t('files.download') }}
        </button>
      </div>

      <template v-if="!editing">
        <button v-if="prev" :aria-label="$t('files.previous')" class="nav nav--prev" type="button" @click="navigate(prev)">
          <FilesIcon :size="22" name="chevronLeft" />
        </button>
        <button v-if="next" :aria-label="$t('files.next')" class="nav nav--next" type="button" @click="navigate(next)">
          <FilesIcon :size="22" name="chevronRight" />
        </button>
      </template>
    </div>

    <FilesDialog v-if="confirm?.kind === 'leave'" :title="$t('files.unsavedTitle', { name: item.name })" @close="keepEditing">
      <p>{{ $t('files.unsavedBody') }}</p>
      <template #actions>
        <button class="btn btn--danger" type="button" @click="discard">
          {{ $t('files.discard') }}
        </button>
        <button class="btn" type="button" @click="keepEditing">
          {{ $t('files.keepEditing') }}
        </button>
        <button autofocus class="btn btn--primary" type="button" @click="save()">
          {{ $t('files.save') }}
        </button>
      </template>
    </FilesDialog>

    <FilesDialog v-if="confirm?.kind === 'errors'" :title="$t('files.errorsTitle', { name: item.name })" @close="keepEditing">
      <p>{{ $t('files.errorsBody', { line: confirm.error?.line }) }}</p>
      <p class="dialog-error">
        {{ confirm.error?.message }}
      </p>
      <template #actions>
        <button class="btn btn--danger" type="button" @click="save({ anyway: true })">
          {{ $t('files.saveAnyway') }}
        </button>
        <button autofocus class="btn btn--primary" type="button" @click="showError">
          {{ $t('files.showError') }}
        </button>
      </template>
    </FilesDialog>

    <FilesDialog v-if="confirm?.kind === 'conflict'" :title="$t('files.conflictTitle', { name: item.name })" @close="keepEditing">
      <p>{{ $t('files.conflictBody') }}</p>
      <template #actions>
        <button class="btn btn--danger" type="button" @click="reloadFromServer">
          {{ $t('files.conflictReload') }}
        </button>
        <button autofocus class="btn" type="button" @click="keepEditing">
          {{ $t('files.keepEditing') }}
        </button>
        <button class="btn btn--danger-solid" type="button" @click="save({ anyway: true, replace: true })">
          {{ $t('files.conflictReplace') }}
        </button>
      </template>
    </FilesDialog>
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview__title span.is-dirty {
  color: #FCD34D;
}

.edit-btn {
  height: 44px;
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
  /* minmax(0, …): long lines of code scroll inside the editor instead of widening the page. */
  grid-template-columns: minmax(0, 1fr);
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

.preview__stage.is-editing {
  padding: 0 24px 24px;
}

.editor {
  width: min(1100px, 100%);
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.dialog-error {
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(225, 29, 72, 0.14);
  color: #FECDD3;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 160px;
  overflow: auto;
}

.editor__error {
  align-self: stretch;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(225, 29, 72, 0.18);
  border: 1px solid rgba(251, 113, 133, 0.45);
  color: #FECDD3;
  font-size: 13px;
  overflow-wrap: anywhere;
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
  .preview__bar {
    gap: 8px;
    padding: 10px 12px;
  }

  .preview__stage {
    padding: 0 12px 76px;
  }

  .preview__stage.is-editing {
    padding: 0 8px 8px;
  }

  .editing .preview__thumb,
  .edit-btn__label {
    display: none;
  }

  .edit-btn {
    width: 44px;
    padding: 0;
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
