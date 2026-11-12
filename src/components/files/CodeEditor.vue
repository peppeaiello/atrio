<script setup>
// Code editor of the file preview, on CodeMirror 6: line numbers, syntax colours, folding, search, bracket
// matching, and errors marked on their line for YAML and JSON. It is loaded only when a text file is opened.
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab, redo, redoDepth, undo, undoDepth } from '@codemirror/commands'
import { bracketMatching, foldGutter, foldKeymap, indentOnInput, indentUnit, syntaxHighlighting } from '@codemirror/language'
import { forEachDiagnostic, lintGutter, lintKeymap, linter, nextDiagnostic } from '@codemirror/lint'
import { highlightSelectionMatches, openSearchPanel, search, searchKeymap } from '@codemirror/search'
import { Compartment, EditorState } from '@codemirror/state'
import { oneDarkHighlightStyle } from '@codemirror/theme-one-dark'
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
} from '@codemirror/view'
import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { languageFor } from './codeLanguages.js'
import FilesIcon from './FilesIcon.vue'
import { searchPanel } from './searchPanel.js'

const props = defineProps({
  // The text as it is on the server, with \n line endings.
  value: { type: String, required: true },
  name: { type: String, required: true },
  editable: { type: Boolean, default: false },
})
const emit = defineEmits(['dirty'])

const host = ref(null)
const view = shallowRef(null)
const line = ref(1)
const column = ref(1)
const errors = ref([])
const canUndo = ref(false)
const canRedo = ref(false)
const wrap = ref(readWrap())
const language = languageFor(props.name)

const vm = getCurrentInstance().proxy
const translate = (key, values) => vm.$t(`files.${key}`, values)
const italian = computed(() => String(vm.$i18n?.locale || '').startsWith('it'))
// CodeMirror's own words (go to line, folding, error list) in Italian; English is built in.
const italianPhrases = {
  'Go to line': 'Vai alla riga',
  'go': 'vai',
  'Folded lines': 'Righe chiuse',
  'Unfolded lines': 'Righe aperte',
  'to': 'a',
  'folded code': 'codice chiuso',
  'unfold': 'apri',
  'Fold line': 'Chiudi blocco',
  'Unfold line': 'Apri blocco',
  'Diagnostics': 'Errori',
  'No diagnostics': 'Nessun errore',
}

const languageSlot = new Compartment()
const editableSlot = new Compartment()
const wrapSlot = new Compartment()

// The document as last loaded or saved: what "unsaved changes" is measured against.
let clean = null
let wasDirty = false

/* ------------------------------------------------------------------ checks */

// YAML (docker-compose files above all) and JSON are checked as you type; the parser stops at the first error.
async function yamlErrors(view) {
  const { loadAll } = await import('js-yaml')
  const text = view.state.doc.toString()
  try {
    loadAll(text, () => {})
    return []
  }
  catch (e) {
    const at = Math.min(e.mark?.position ?? 0, text.length)
    return [{ from: at, to: Math.min(at + 1, text.length), severity: 'error', message: e.reason || e.message }]
  }
}

async function jsonErrors(view) {
  const { jsonParseLinter } = await import('@codemirror/lang-json')
  return view.state.doc.length ? jsonParseLinter()(view) : []
}

const checker = language?.id === 'yaml' ? yamlErrors : language?.id === 'json' ? jsonErrors : null

/* ------------------------------------------------------------------ setup */

// Two spaces, four spaces or a tab, as the file already does; two spaces when it says nothing.
function detectIndent(text) {
  const lines = text.split('\n', 2000)
  if (lines.some(l => l.startsWith('\t')))
    return '\t'
  let smallest = 0
  for (const l of lines) {
    const spaces = l.match(/^ +(?=\S)/)?.[0].length
    if (spaces && (!smallest || spaces < smallest))
      smallest = spaces
  }
  return ' '.repeat(smallest === 4 || smallest === 8 ? 4 : 2)
}

function readWrap() {
  try {
    return localStorage.getItem('atrio-files-wrap') === '1'
  }
  catch {
    return false
  }
}

const theme = EditorView.theme({
  '&': { height: '100%', color: '#E2E8F0', backgroundColor: 'transparent', fontSize: '13px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: '\'JetBrains Mono\', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', lineHeight: '1.6' },
  '.cm-content': { padding: '12px 0', caretColor: '#22D3EE' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#22D3EE', borderLeftWidth: '2px' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': { backgroundColor: 'rgba(103, 232, 249, 0.25)' },
  '.cm-gutters': { backgroundColor: 'rgba(2, 6, 23, 0.55)', color: '#64748B', border: 'none', borderRight: '1px solid rgba(255, 255, 255, 0.06)' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 12px' },
  '.cm-activeLine': { backgroundColor: 'rgba(255, 255, 255, 0.04)' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(255, 255, 255, 0.06)', color: '#E2E8F0' },
  '.cm-foldPlaceholder': { backgroundColor: 'rgba(255, 255, 255, 0.1)', border: 'none', color: '#CBD5E1' },
  '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': { backgroundColor: 'rgba(103, 232, 249, 0.2)', outline: '1px solid rgba(103, 232, 249, 0.5)' },
  '.cm-selectionMatch': { backgroundColor: 'rgba(250, 204, 21, 0.18)' },
  '.cm-searchMatch': { backgroundColor: 'rgba(250, 204, 21, 0.3)', outline: '1px solid rgba(250, 204, 21, 0.6)' },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'rgba(250, 204, 21, 0.55)' },
  '.cm-panels': { backgroundColor: 'rgba(15, 23, 42, 0.95)', color: '#E2E8F0' },
  '.cm-panels.cm-panels-top': { borderBottom: '1px solid rgba(255, 255, 255, 0.1)' },
  '.cm-panels.cm-panels-bottom': { borderTop: '1px solid rgba(255, 255, 255, 0.1)' },
  '.cm-tooltip': { backgroundColor: 'rgba(15, 23, 42, 0.97)', border: '1px solid rgba(255, 255, 255, 0.16)', borderRadius: '10px', color: '#E2E8F0', overflow: 'hidden' },
  '.cm-diagnostic': { padding: '6px 10px', fontSize: '13px' },
  '.cm-diagnostic-error': { borderLeftColor: '#FB7185' },
  '.cm-lintRange-error': { backgroundImage: 'none', textDecoration: 'underline wavy #FB7185', textUnderlineOffset: '3px' },
}, { dark: true })

function editableExtensions(on) {
  return [EditorView.editable.of(on), EditorState.readOnly.of(!on)]
}

function createState(text) {
  return EditorState.create({
    doc: text,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      foldGutter(),
      highlightSpecialChars(),
      history(),
      drawSelection(),
      dropCursor(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      highlightActiveLine(),
      highlightSelectionMatches({ minSelectionLength: 2 }),
      search({ top: true, createPanel: searchPanel(translate) }),
      syntaxHighlighting(oneDarkHighlightStyle),
      EditorState.tabSize.of(4),
      indentUnit.of(detectIndent(text)),
      italian.value ? EditorState.phrases.of(italianPhrases) : [],
      languageSlot.of([]),
      editableSlot.of(editableExtensions(props.editable)),
      wrapSlot.of(wrap.value ? EditorView.lineWrapping : []),
      checker ? [linter(checker, { delay: 400 }), lintGutter()] : [],
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...lintKeymap,
        indentWithTab,
      ]),
      EditorView.contentAttributes.of({ 'aria-label': props.name, 'autocapitalize': 'off', 'autocorrect': 'off', 'spellcheck': 'false' }),
      EditorView.updateListener.of(onUpdate),
      theme,
    ],
  })
}

function onUpdate(update) {
  const state = update.state
  if (update.selectionSet || update.docChanged) {
    const head = state.selection.main.head
    const at = state.doc.lineAt(head)
    line.value = at.number
    column.value = head - at.from + 1
  }
  if (update.docChanged) {
    canUndo.value = undoDepth(state) > 0
    canRedo.value = redoDepth(state) > 0
    const dirty = !state.doc.eq(clean)
    if (dirty !== wasDirty) {
      wasDirty = dirty
      emit('dirty', dirty)
    }
  }
  if (checker && update.transactions.some(tr => tr.effects.length)) {
    const found = []
    forEachDiagnostic(state, (d, from) => found.push({ line: state.doc.lineAt(from).number, message: d.message }))
    errors.value = found
  }
}

async function loadLanguage() {
  if (!language)
    return
  try {
    const support = await language.load()
    view.value?.dispatch({ effects: languageSlot.reconfigure(support) })
  }
  catch {
    // Without colours the file still opens as plain text.
  }
}

// Shows `text` as the clean, saved state: no undo history, no unsaved changes.
function setText(text) {
  const state = createState(text)
  clean = state.doc
  wasDirty = false
  canUndo.value = false
  canRedo.value = false
  errors.value = []
  view.value.setState(state)
  emit('dirty', false)
  loadLanguage()
}

// The preview mounts a new editor for each file and after reloading one, so `value` is read here only.
onMounted(() => {
  view.value = new EditorView({ parent: host.value })
  setText(props.value)
})

onBeforeUnmount(() => view.value?.destroy())

watch(() => props.editable, (on) => {
  view.value?.dispatch({ effects: editableSlot.reconfigure(editableExtensions(on)) })
})

watch(wrap, (on) => {
  view.value?.dispatch({ effects: wrapSlot.reconfigure(on ? EditorView.lineWrapping : []) })
  try {
    localStorage.setItem('atrio-files-wrap', on ? '1' : '0')
  }
  catch {
    // Not remembered in a private window; it still applies now.
  }
})

/* ------------------------------------------------------------------ for the preview and the status bar */

function run(command) {
  if (!view.value)
    return
  command(view.value)
  view.value.focus()
}

// The search bar takes the focus itself, on its field.
function openSearch() {
  if (view.value)
    openSearchPanel(view.value)
}

defineExpose({
  getValue: () => view.value?.state.doc.toString() ?? props.value,
  reset: () => setText(props.value),
  // After a save: the text on screen is the saved one, keeping the cursor and the undo history.
  markClean: () => {
    clean = view.value.state.doc
    wasDirty = false
    emit('dirty', false)
  },
  focus: () => view.value?.focus(),
  hasErrors: () => errors.value.length > 0,
  firstError: () => errors.value[0] || null,
  showErrors: () => run(nextDiagnostic),
})
</script>

<template>
  <div :class="{ 'is-editable': editable }" class="code">
    <div ref="host" class="code__host" />
    <footer class="code__status">
      <span class="code__pos">{{ $t('files.lineColumn', { line, column }) }}</span>
      <span class="code__lang">{{ language ? language.label : $t('files.plainText') }}</span>
      <button v-if="errors.length" class="code__errors" type="button" @click="run(nextDiagnostic)">
        <FilesIcon :size="14" name="alert" />
        {{ errors.length === 1 ? $t('files.errorAtLine', { line: errors[0].line }) : $t('files.errorsCount', { n: errors.length }) }}
      </button>
      <span v-else-if="checker" class="code__ok">
        <FilesIcon :size="14" name="check" />{{ $t('files.noErrors') }}
      </span>
      <span class="code__spacer" />
      <template v-if="editable">
        <button :aria-label="$t('files.undo')" :disabled="!canUndo" :title="$t('files.undo')" class="code__tool" type="button" @click="run(undo)">
          <FilesIcon :size="16" name="undo" />
        </button>
        <button :aria-label="$t('files.redo')" :disabled="!canRedo" :title="$t('files.redo')" class="code__tool" type="button" @click="run(redo)">
          <FilesIcon :size="16" name="redo" />
        </button>
      </template>
      <button :aria-label="$t('files.find')" :title="`${$t('files.find')} (Ctrl+F)`" class="code__tool" type="button" @click="openSearch">
        <FilesIcon :size="16" name="search" />
      </button>
      <button
        :aria-label="$t('files.wrapLines')" :aria-pressed="wrap ? 'true' : 'false'" :class="{ 'is-on': wrap }" :title="$t('files.wrapLines')"
        class="code__tool" type="button" @click="wrap = !wrap"
      >
        <FilesIcon :size="16" name="wrap" />
      </button>
    </footer>
  </div>
</template>

<style scoped>
.code {
  width: min(1100px, 100%);
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 16px;
  background: rgba(2, 6, 23, 0.7);
  border: 1px solid var(--files-border);
}

.code.is-editable {
  border-color: var(--files-border-strong);
}

.code.is-editable:focus-within {
  border-color: var(--files-focus);
}

.code__host {
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.code__status {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 40px;
  padding: 2px 6px 2px 14px;
  border-top: 1px solid var(--files-border);
  font-size: 12px;
  color: var(--files-muted);
  white-space: nowrap;
}

.code__spacer {
  flex: 1;
}

.code__errors,
.code__ok {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
}

.code__errors {
  height: 28px;
  padding: 0 10px;
  border: 0;
  border-radius: 8px;
  background: rgba(225, 29, 72, 0.2);
  color: #FDA4AF;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.code__ok {
  color: #86EFAC;
}

.code__tool {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--files-text-soft);
  cursor: pointer;
}

.code__tool:hover:not(:disabled) {
  background: var(--files-hover-strong);
}

.code__tool:disabled {
  opacity: 0.35;
  cursor: default;
}

.code__tool.is-on {
  background: rgba(103, 232, 249, 0.18);
  color: #67E8F9;
}

.code__host :deep(.cm-editor) {
  height: 100%;
}

/* ---------- search bar (searchPanel.js) */
.code__host :deep(.files-find) {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  font-family: inherit;
}

.code__host :deep(.files-find__row) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.code__host :deep(.files-find__row[hidden]) {
  display: none;
}

.code__host :deep(.files-find__field) {
  flex: 1 1 220px;
  min-width: 0;
  position: relative;
  display: flex;
  align-items: center;
}

.code__host :deep(.files-find__input) {
  width: 100%;
  height: 40px;
  padding: 0 96px 0 12px;
  border: 1px solid var(--files-border-strong);
  border-radius: 10px;
  background: var(--files-field, rgba(255, 255, 255, 0.06));
  color: var(--files-text);
  font: inherit;
  font-size: 14px;
  outline: none;
}

.code__host :deep(.files-find__input:focus) {
  border-color: var(--files-focus);
}

.code__host :deep(.files-find__input::-webkit-search-cancel-button) {
  display: none;
}

.code__host :deep(.is-invalid .files-find__input[main-field]) {
  border-color: #FB7185;
}

.code__host :deep(.files-find__count) {
  position: absolute;
  right: 12px;
  font-size: 12px;
  color: var(--files-muted);
  pointer-events: none;
  white-space: nowrap;
}

.code__host :deep(.is-empty .files-find__count) {
  color: #FDA4AF;
}

.code__host :deep(.files-find__group) {
  display: flex;
  align-items: center;
  gap: 4px;
}

.code__host :deep(.files-find__icon),
.code__host :deep(.files-find__toggle) {
  display: grid;
  place-items: center;
  min-width: 36px;
  height: 36px;
  padding: 0 6px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--files-text-soft);
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.code__host :deep(.files-find__icon:hover),
.code__host :deep(.files-find__toggle:hover) {
  background: var(--files-hover-strong);
}

.code__host :deep(.files-find__toggle[aria-pressed='true']) {
  border-color: rgba(103, 232, 249, 0.5);
  background: rgba(103, 232, 249, 0.18);
  color: #67E8F9;
}

.code__host :deep(.files-find__button) {
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--files-border-strong);
  border-radius: 10px;
  background: var(--files-field, rgba(255, 255, 255, 0.06));
  color: var(--files-text);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.code__host :deep(.files-find__button:hover) {
  background: var(--files-hover-strong);
}

@media (max-width: 720px) {
  .code {
    border-radius: 12px;
  }

  .code__status {
    gap: 8px;
    padding-left: 10px;
  }

  .code__lang {
    display: none;
  }

  /* 16px keeps iOS from zooming the page when the editor gets the focus. */
  .code__host :deep(.cm-editor) {
    font-size: 16px;
  }

  .code__host :deep(.files-find) {
    padding: 8px;
  }

  /* On a phone the field takes the whole first line, the buttons the line below. */
  .code__host :deep(.files-find__field) {
    flex-basis: 100%;
  }

  .code__host :deep(.files-find__input) {
    font-size: 16px;
  }

  .code__host :deep(.files-find__group:last-child) {
    margin-left: auto;
  }

  .code__host :deep(.cm-lineNumbers .cm-gutterElement) {
    padding: 0 6px 0 8px;
  }
}
</style>
