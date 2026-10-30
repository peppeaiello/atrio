<script setup>
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import './messages.js'
import ActivityPanel from './ActivityPanel.vue'
import FileItems from './FileItems.vue'
import FilePreview from './FilePreview.vue'
import FilesDialog from './FilesDialog.vue'
import FilesIcon from './FilesIcon.vue'
import FilesMenu from './FilesMenu.vue'
import FilesSidebar from './FilesSidebar.vue'
import FolderPicker from './FolderPicker.vue'
import {
  ROOT,
  activity,
  baseName,
  createFile,
  createFolder,
  download,
  enqueueUploads,
  errorMessage,
  extension,
  isInside,
  joinPath,
  kindOf,
  listFolder,
  listLocations,
  onUploaded,
  parentPath,
  previewMode,
  remove,
  rename,
  transfer,
  updateTasks,
} from './files.js'

const emit = defineEmits(['close'])

const vm = getCurrentInstance().proxy
const t = (key, values) => vm.$t(`files.${key}`, values)
const locale = computed(() => (vm.$i18n?.locale || 'en_us').replace('_', '-'))

/* ------------------------------------------------------------------ preferences */

const PREFS_KEY = 'atrio.files.prefs'
function readPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}
  }
  catch {
    return {}
  }
}
const prefs = readPrefs()
const view = ref(prefs.view || 'grid')
const sortKey = ref(prefs.sortKey || 'name')
const sortDir = ref(prefs.sortDir || 'asc')
const showHidden = ref(!!prefs.showHidden)
watch([view, sortKey, sortDir, showHidden], () => {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ view: view.value, sortKey: sortKey.value, sortDir: sortDir.value, showHidden: showHidden.value }))
  }
  catch {}
})

/* ------------------------------------------------------------------ folder state */

const path = ref(ROOT)
const backStack = ref([])
const forwardStack = ref([])
const entries = ref([])
const loading = ref(false)
const loadError = ref('')
const query = ref('')
const selected = ref([])
const anchor = ref(-1)
const focusIndex = ref(-1)
const locations = ref({ places: [], storage: [] })
const sidebarOpen = ref(false)
const editingPath = ref(false)

const collator = computed(() => new Intl.Collator(locale.value, { numeric: true, sensitivity: 'base' }))

const items = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = entries.value.filter(i => (showHidden.value || !i.name.startsWith('.')) && (!q || i.name.toLowerCase().includes(q)))
  const dir = sortDir.value === 'asc' ? 1 : -1
  const byName = (a, b) => collator.value.compare(a.name, b.name)
  const compare = {
    name: byName,
    date: (a, b) => new Date(a.date) - new Date(b.date) || byName(a, b),
    size: (a, b) => (a.size || 0) - (b.size || 0) || byName(a, b),
    type: (a, b) => collator.value.compare(a.is_dir ? '' : extension(a.name), b.is_dir ? '' : extension(b.name)) || byName(a, b),
  }[sortKey.value]
  return list.sort((a, b) => (b.is_dir - a.is_dir) || compare(a, b) * dir)
})

const selectedItems = computed(() => {
  const set = new Set(selected.value)
  return items.value.filter(i => set.has(i.path))
})

const crumbs = computed(() => {
  const parts = path.value.split('/').filter(Boolean)
  const list = parts.map((name, i) => ({ name, path: `/${parts.slice(0, i + 1).join('/')}` }))
  return [{ name: '/', path: '/' }, ...list]
})

let loadToken = 0
async function load(keepSelection = false) {
  const token = ++loadToken
  loading.value = !keepSelection
  loadError.value = ''
  try {
    const list = await listFolder(path.value)
    if (token !== loadToken)
      return
    entries.value = list
    if (keepSelection) {
      const paths = new Set(list.map(i => i.path))
      selected.value = selected.value.filter(p => paths.has(p))
      if (focusIndex.value >= items.value.length)
        focusIndex.value = items.value.length - 1
    }
  }
  catch (e) {
    if (token !== loadToken)
      return
    entries.value = []
    loadError.value = errorMessage(e)
  }
  finally {
    if (token === loadToken)
      loading.value = false
  }
}

function go(target, { record = true, focusName = '' } = {}) {
  const next = target.length > 1 ? target.replace(/\/+$/, '') : target
  if (record && next !== path.value) {
    backStack.value.push(path.value)
    forwardStack.value = []
  }
  path.value = next
  query.value = ''
  selected.value = []
  anchor.value = -1
  focusIndex.value = -1
  sidebarOpen.value = false
  editingPath.value = false
  load().then(() => {
    if (focusName) {
      const index = items.value.findIndex(i => i.name === focusName)
      if (index >= 0) {
        focusIndex.value = index
        anchor.value = index
        selected.value = [items.value[index].path]
      }
    }
  })
}

function goBack() {
  if (!backStack.value.length)
    return
  forwardStack.value.push(path.value)
  go(backStack.value.pop(), { record: false })
}

function goForward() {
  if (!forwardStack.value.length)
    return
  backStack.value.push(path.value)
  go(forwardStack.value.pop(), { record: false })
}

function goUp() {
  if (path.value === '/')
    return
  go(parentPath(path.value), { focusName: baseName(path.value) })
}

async function loadLocations() {
  try {
    locations.value = await listLocations()
  }
  catch {}
}

// Called by the home page each time the file manager is shown.
let initialized = false
function init(start) {
  initialized = true
  readWallpaper()
  focusRoot()
  loadLocations()
  go(start || ROOT, { record: path.value !== (start || ROOT) && !!entries.value.length })
}
defineExpose({ init })

/* ------------------------------------------------------------------ path editing */

const pathDraft = ref('')
const pathInput = ref(null)

async function editPath() {
  pathDraft.value = path.value
  editingPath.value = true
  await nextTick()
  pathInput.value?.focus()
  pathInput.value?.select()
}

function submitPath() {
  const target = pathDraft.value.trim()
  if (target.startsWith('/'))
    go(target)
  else editingPath.value = false
}

/* ------------------------------------------------------------------ selection */

const content = ref(null)
const itemsRef = ref(null)
const rootEl = ref(null)

function focusRoot() {
  nextTick(() => content.value?.focus({ preventScroll: true }))
}

function isTouch(e) {
  return e?.pointerType === 'touch' || (!e?.pointerType && window.matchMedia?.('(hover: none)').matches)
}

function selectRange(from, to, add) {
  const [a, b] = from <= to ? [from, to] : [to, from]
  const range = items.value.slice(a, b + 1).map(i => i.path)
  selected.value = add ? [...new Set([...selected.value, ...range])] : range
}

function toggle(index) {
  const p = items.value[index].path
  selected.value = selected.value.includes(p) ? selected.value.filter(x => x !== p) : [...selected.value, p]
  anchor.value = index
  focusIndex.value = index
}

function pick(index, e) {
  focusRoot()
  if (e.shiftKey && anchor.value >= 0) {
    selectRange(anchor.value, index, e.ctrlKey || e.metaKey)
    focusIndex.value = index
    return
  }
  if (e.ctrlKey || e.metaKey) {
    toggle(index)
    return
  }
  if (isTouch(e)) {
    if (selected.value.length)
      toggle(index)
    else open(items.value[index])
    return
  }
  selected.value = [items.value[index].path]
  anchor.value = index
  focusIndex.value = index
}

function onContentClick(e) {
  if (e.target.closest('[data-index], button, input, a'))
    return
  selected.value = []
  anchor.value = -1
}

function selectAll() {
  selected.value = items.value.map(i => i.path)
}

function clearSelection() {
  selected.value = []
  anchor.value = -1
}

/* ------------------------------------------------------------------ open and preview */

const previewItem = ref(null)
const previewSiblings = computed(() => items.value.filter(i => !i.is_dir && previewMode(i)))

function open(item) {
  if (!item)
    return
  if (item.is_dir)
    go(item.path)
  else previewItem.value = item
}

function closePreview() {
  const index = items.value.findIndex(i => i.path === previewItem.value?.path)
  previewItem.value = null
  if (index >= 0) {
    focusIndex.value = index
    anchor.value = index
    selected.value = [items.value[index].path]
  }
  focusRoot()
}

/* ------------------------------------------------------------------ toasts */

const toast = ref(null)
let toastTimer = null
function notify(message, tone = 'info') {
  clearTimeout(toastTimer)
  toast.value = { message, tone }
  toastTimer = setTimeout(() => {
    toast.value = null
  }, tone === 'error' ? 6000 : 3000)
}

/* ------------------------------------------------------------------ dialogs: create, rename, delete */

const dialog = ref(null) // { type: 'folder' | 'file' | 'rename' | 'delete', item?, items?, name, error, busy }

function validateName(name, current = '') {
  const value = name.trim()
  if (!value || value === '.' || value === '..')
    return t('nameEmpty')
  if (value.includes('/'))
    return t('nameSlash')
  if (value !== current && entries.value.some(i => i.name === value))
    return t('nameExists')
  return ''
}

function startCreate(type) {
  dialog.value = { type, name: type === 'folder' ? t('newFolder') : `${t('newFile')}.txt`, error: '', busy: false }
}

function startRename(item = selectedItems.value[0]) {
  if (!item)
    return
  dialog.value = { type: 'rename', item, name: item.name, error: '', busy: false }
}

function startDelete(list = selectedItems.value) {
  if (!list.length)
    return
  dialog.value = { type: 'delete', items: list, busy: false, error: '' }
}

async function submitDialog() {
  const d = dialog.value
  if (!d || d.busy)
    return
  if (d.type === 'delete')
    return confirmDelete()
  const current = d.type === 'rename' ? d.item.name : ''
  d.error = validateName(d.name, current)
  if (d.error)
    return
  const name = d.name.trim()
  if (d.type === 'rename' && name === current) {
    dialog.value = null
    return focusRoot()
  }
  d.busy = true
  try {
    const target = joinPath(path.value, name)
    if (d.type === 'folder')
      await createFolder(target)
    else if (d.type === 'file')
      await createFile(target)
    else await rename(d.item, target)
    notify(t(d.type === 'rename' ? 'renamed' : 'created'))
    dialog.value = null
    await load()
    const index = items.value.findIndex(i => i.name === name)
    if (index >= 0) {
      selected.value = [items.value[index].path]
      focusIndex.value = index
      anchor.value = index
    }
    focusRoot()
  }
  catch (e) {
    d.busy = false
    d.error = errorMessage(e)
  }
}

async function confirmDelete() {
  const d = dialog.value
  d.busy = true
  const paths = d.items.map(i => i.path)
  try {
    await remove(paths)
    forgetShares(paths)
    notify(t('deleted'))
    dialog.value = null
    selected.value = []
    await load()
    focusIndex.value = Math.min(focusIndex.value, items.value.length - 1)
    focusRoot()
  }
  catch (e) {
    d.busy = false
    d.error = errorMessage(e)
  }
}

// A deleted folder may have been shared over Samba: drop the share like the classic file browser does.
function forgetShares(paths) {
  const store = vm.$store
  const shortcuts = store?.state?.shortcutData || []
  const gone = shortcuts.filter(s => paths.some(p => isInside(s.path, p)))
  if (!gone.length)
    return
  gone.forEach((s) => {
    const id = s.extensions?.share?.id
    if (id)
      vm.$api?.samba?.deleteShare(id).catch(() => {})
  })
  store.dispatch('SET_SHORTCUT_DATA', shortcuts.filter(s => !gone.includes(s))).catch(() => {})
}

function closeDialog() {
  dialog.value = null
  focusRoot()
}

/* ------------------------------------------------------------------ copy, move, clipboard */

const picker = ref(null) // { mode, sources }
const clipboard = ref(null) // { mode: 'copy' | 'cut', items }
const cutPaths = computed(() => (clipboard.value?.mode === 'cut' ? clipboard.value.items.map(i => i.path) : []))

function startTransfer(mode, sources = selectedItems.value) {
  if (sources.length)
    picker.value = { mode, sources }
}

async function runTransfer(mode, sources, to, style) {
  if (sources.some(s => s.is_dir && isInside(to, s.path))) {
    notify(t('intoItself'), 'error')
    return false
  }
  try {
    await transfer(mode, sources.map(s => s.path), to, style)
    notify(t('taskStarted'))
    scheduleReloads()
    return true
  }
  catch (e) {
    notify(errorMessage(e), 'error')
    return false
  }
}

async function confirmPicker(to, style) {
  const { mode, sources } = picker.value
  picker.value = null
  focusRoot()
  if (await runTransfer(mode, sources, to, style))
    clearSelection()
}

function copyToClipboard(mode) {
  if (!selectedItems.value.length)
    return
  clipboard.value = { mode, items: selectedItems.value.slice() }
}

async function paste() {
  if (!clipboard.value)
    return
  const { mode, items: list } = clipboard.value
  const done = await runTransfer(mode === 'cut' ? 'move' : 'copy', list, path.value, 'skip')
  if (done && mode === 'cut')
    clipboard.value = null
}

// The message bus reports progress; if it is not connected, reload a few times as a fallback.
let reloadTimers = []
function scheduleReloads() {
  reloadTimers.forEach(clearTimeout)
  reloadTimers = [1000, 3000, 8000].map(ms => setTimeout(() => load(true), ms))
}

function onFileOperate(event) {
  const finishedBefore = new Set(activity.tasks.filter(task => task.finished).map(task => task.id))
  const tasks = updateTasks(event)
  if (tasks.some(task => task.finished && !finishedBefore.has(task.id)))
    load(true)
}

/* ------------------------------------------------------------------ upload */

const fileInput = ref(null)
const folderInput = ref(null)
const uploadMenu = ref(null)

function onPicked(e) {
  const files = [...e.target.files]
  enqueueUploads(files.map(file => ({ file, relativePath: file.webkitRelativePath || file.name })), path.value)
  e.target.value = ''
}

const dragDepth = ref(0)
const dragging = computed(() => dragDepth.value > 0)

function hasFiles(e) {
  return [...(e.dataTransfer?.types || [])].includes('Files')
}

function onDragEnter(e) {
  if (!hasFiles(e))
    return
  e.preventDefault()
  dragDepth.value++
}

function onDragOver(e) {
  if (!hasFiles(e))
    return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'copy'
}

function onDragLeave(e) {
  if (!hasFiles(e))
    return
  dragDepth.value = Math.max(0, dragDepth.value - 1)
}

async function onDrop(e) {
  if (!hasFiles(e))
    return
  e.preventDefault()
  dragDepth.value = 0
  const dir = path.value
  const dropped = []
  const roots = [...e.dataTransfer.items]
    .filter(i => i.kind === 'file')
    .map(i => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null))
  if (roots.length && roots.every(Boolean)) {
    await Promise.all(roots.map(entry => walkEntry(entry, '', dropped)))
  }
  else {
    [...e.dataTransfer.files].forEach(file => dropped.push({ file, relativePath: file.name }))
  }
  if (dropped.length)
    enqueueUploads(dropped, dir)
}

// Reads a dropped file or folder (recursively) into { file, relativePath } entries.
function walkEntry(entry, prefix, out) {
  return new Promise((resolve) => {
    if (entry.isFile) {
      entry.file((file) => {
        out.push({ file, relativePath: `${prefix}${file.name}` })
        resolve()
      }, () => resolve())
    }
    else if (entry.isDirectory) {
      const reader = entry.createReader()
      const children = []
      const readBatch = () => reader.readEntries(async (batch) => {
        if (batch.length) {
          children.push(...batch)
          readBatch()
        }
        else {
          await Promise.all(children.map(child => walkEntry(child, `${prefix}${entry.name}/`, out)))
          resolve()
        }
      }, () => resolve())
      readBatch()
    }
    else {
      resolve()
    }
  })
}

let uploadReload = null
const stopUploadListener = onUploaded((upload) => {
  if (!isInside(upload.dir, path.value) && !isInside(path.value, upload.dir))
    return
  clearTimeout(uploadReload)
  uploadReload = setTimeout(() => load(true), 400)
})

/* ------------------------------------------------------------------ menus */

const menu = ref(null) // { x, y, title, actions }

function itemActions(list) {
  const one = list.length === 1 ? list[0] : null
  const actions = []
  if (one) {
    actions.push({ id: 'open', label: t(one.is_dir ? 'open' : 'preview'), icon: one.is_dir ? 'folder' : 'eye', shortcut: one.is_dir ? 'Enter' : 'Space' })
  }
  actions.push({ id: 'download', label: t('download'), icon: 'download' })
  actions.push({ id: 'd1', divider: true })
  if (one)
    actions.push({ id: 'rename', label: t('rename'), icon: 'pencil', shortcut: 'F2' })
  actions.push({ id: 'copyTo', label: t('copyTo'), icon: 'copy' })
  actions.push({ id: 'moveTo', label: t('moveTo'), icon: 'move' })
  actions.push({ id: 'copy', label: t('copy'), icon: 'clipboard', shortcut: 'Ctrl C' })
  actions.push({ id: 'cut', label: t('cut'), icon: 'scissors', shortcut: 'Ctrl X' })
  if (one)
    actions.push({ id: 'copyPath', label: t('copyPath'), icon: 'link' })
  actions.push({ id: 'd2', divider: true })
  actions.push({ id: 'delete', label: t('delete'), icon: 'trash', danger: true, shortcut: 'Del' })
  return actions
}

function folderActions() {
  return [
    { id: 'upload', label: t('uploadFiles'), icon: 'upload' },
    { id: 'uploadFolder', label: t('uploadFolder'), icon: 'folder' },
    { id: 'newFolder', label: t('newFolder'), icon: 'folderPlus' },
    { id: 'newFile', label: t('newFile'), icon: 'filePlus' },
    { id: 'd1', divider: true },
    { id: 'paste', label: t('paste'), icon: 'clipboard', disabled: !clipboard.value, shortcut: 'Ctrl V' },
    { id: 'selectAll', label: t('selectAll'), icon: 'check', shortcut: 'Ctrl A' },
    { id: 'reload', label: t('reload'), icon: 'refresh' },
  ]
}

function openItemMenu(index, e) {
  const item = items.value[index]
  if (!selected.value.includes(item.path)) {
    selected.value = [item.path]
    anchor.value = index
  }
  focusIndex.value = index
  const list = selectedItems.value
  const rect = e.currentTarget?.getBoundingClientRect?.()
  const x = e.type === 'contextmenu' ? e.clientX : rect ? rect.left : e.clientX
  const y = e.type === 'contextmenu' ? e.clientY : rect ? rect.bottom + 4 : e.clientY
  menu.value = { x, y, title: list.length === 1 ? list[0].name : selectedLabel(list.length), actions: itemActions(list) }
}

function openFolderMenu(e) {
  if (e.target.closest('[data-index]'))
    return
  e.preventDefault()
  menu.value = { x: e.clientX, y: e.clientY, title: baseName(path.value), actions: folderActions() }
}

function openUploadMenu() {
  const rect = uploadMenu.value.getBoundingClientRect()
  menu.value = {
    x: rect.left,
    y: rect.bottom + 6,
    title: '',
    actions: [
      { id: 'upload', label: t('uploadFiles'), icon: 'upload' },
      { id: 'uploadFolder', label: t('uploadFolder'), icon: 'folder' },
    ],
  }
}

const sortButton = ref(null)
function openSortMenu() {
  const rect = sortButton.value.getBoundingClientRect()
  const mark = key => (sortKey.value === key ? 'check' : 'minimize')
  menu.value = {
    x: rect.left,
    y: rect.bottom + 6,
    title: t('sort'),
    actions: [
      { id: 'sort:name', label: t('sortName'), icon: mark('name') },
      { id: 'sort:date', label: t('sortDate'), icon: mark('date') },
      { id: 'sort:size', label: t('sortSize'), icon: mark('size') },
      { id: 'sort:type', label: t('sortType'), icon: mark('type') },
      { id: 'd1', divider: true },
      { id: 'dir:asc', label: t('ascending'), icon: sortDir.value === 'asc' ? 'check' : 'minimize' },
      { id: 'dir:desc', label: t('descending'), icon: sortDir.value === 'desc' ? 'check' : 'minimize' },
      { id: 'd2', divider: true },
      { id: 'hidden', label: t('showHidden'), icon: showHidden.value ? 'check' : 'minimize' },
    ],
  }
}

function setSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  }
  else {
    sortKey.value = key
    sortDir.value = key === 'name' || key === 'type' ? 'asc' : 'desc'
  }
}

function runAction(id) {
  menu.value = null
  const list = selectedItems.value
  if (id.startsWith('sort:')) {
    sortKey.value = id.slice(5)
    return focusRoot()
  }
  if (id.startsWith('dir:')) {
    sortDir.value = id.slice(4)
    return focusRoot()
  }
  const handlers = {
    hidden: () => { showHidden.value = !showHidden.value },
    open: () => open(list[0]),
    download: () => downloadItems(list),
    rename: () => startRename(list[0]),
    copyTo: () => startTransfer('copy', list),
    moveTo: () => startTransfer('move', list),
    copy: () => copyToClipboard('copy'),
    cut: () => copyToClipboard('cut'),
    copyPath: () => copyPath(list[0]),
    delete: () => startDelete(list),
    upload: () => fileInput.value.click(),
    uploadFolder: () => folderInput.value.click(),
    newFolder: () => startCreate('folder'),
    newFile: () => startCreate('file'),
    paste,
    selectAll,
    reload: () => load(true),
  }
  handlers[id]?.()
  if (!dialog.value && !picker.value && !previewItem.value)
    focusRoot()
}

function downloadItems(list = selectedItems.value) {
  if (!list.length)
    return
  download(list)
  notify(t('downloadPreparing'))
}

async function copyPath(item) {
  try {
    await navigator.clipboard.writeText(item.path)
    notify(t('pathCopied'))
  }
  catch {
    notify(item.path)
  }
}

function closeMenu() {
  menu.value = null
  focusRoot()
}

/* ------------------------------------------------------------------ keyboard */

const filterInput = ref(null)

function moveFocus(next, e) {
  const count = items.value.length
  if (!count)
    return
  const index = Math.max(0, Math.min(count - 1, next))
  if (e.shiftKey) {
    if (anchor.value < 0)
      anchor.value = Math.max(0, focusIndex.value)
    selectRange(anchor.value, index, false)
  }
  else if (!(e.ctrlKey || e.metaKey)) {
    selected.value = [items.value[index].path]
    anchor.value = index
  }
  focusIndex.value = index
}

function onKeydown(e) {
  if (dialog.value || picker.value || previewItem.value || menu.value)
    return
  const tag = e.target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    if (e.key === 'Escape' && e.target === filterInput.value) {
      query.value = ''
      focusRoot()
    }
    if (e.key === 'ArrowDown' && e.target === filterInput.value && items.value.length) {
      e.preventDefault()
      focusRoot()
      moveFocus(0, e)
    }
    return
  }
  const mod = e.ctrlKey || e.metaKey
  const cols = view.value === 'grid' ? itemsRef.value?.columns() || 1 : 1
  const current = focusIndex.value
  const focused = items.value[current]

  if (e.altKey && e.key === 'ArrowUp')
    return prevent(e, goUp)
  if (e.altKey && e.key === 'ArrowLeft')
    return prevent(e, goBack)
  if (e.altKey && e.key === 'ArrowRight')
    return prevent(e, goForward)

  switch (e.key) {
    case 'ArrowRight':
      if (view.value === 'grid')
        prevent(e, () => moveFocus(current < 0 ? 0 : current + 1, e))
      break
    case 'ArrowLeft':
      if (view.value === 'grid')
        prevent(e, () => moveFocus(current < 0 ? 0 : current - 1, e))
      break
    case 'ArrowDown':
      prevent(e, () => moveFocus(current < 0 ? 0 : current + cols, e))
      break
    case 'ArrowUp':
      prevent(e, () => moveFocus(current < 0 ? 0 : current - cols, e))
      break
    case 'Home':
      prevent(e, () => moveFocus(0, e))
      break
    case 'End':
      prevent(e, () => moveFocus(items.value.length - 1, e))
      break
    case 'Enter':
      if (selectedItems.value.length === 1 || focused)
        prevent(e, () => open(selectedItems.value.length === 1 ? selectedItems.value[0] : focused))
      break
    case ' ':
      if (focused && !focused.is_dir)
        prevent(e, () => { previewItem.value = focused })
      else if (focused && mod)
        prevent(e, () => toggle(current))
      break
    case 'Backspace':
      prevent(e, goUp)
      break
    case 'Delete':
      if (selected.value.length)
        prevent(e, () => startDelete())
      break
    case 'F2':
      if (selectedItems.value.length === 1)
        prevent(e, () => startRename())
      break
    case 'Escape':
      if (selected.value.length)
        prevent(e, clearSelection)
      else if (sidebarOpen.value)
        sidebarOpen.value = false
      break
    case '/':
      prevent(e, () => filterInput.value?.focus())
      break
    default:
      if (!mod)
        return
      ({
        a: () => prevent(e, selectAll),
        c: () => selected.value.length && prevent(e, () => copyToClipboard('copy')),
        x: () => selected.value.length && prevent(e, () => copyToClipboard('cut')),
        v: () => clipboard.value && prevent(e, paste),
        f: () => prevent(e, () => filterInput.value?.focus()),
      })[e.key.toLowerCase()]?.()
  }
}

function prevent(e, fn) {
  e.preventDefault()
  fn()
}

/* ------------------------------------------------------------------ status line */

function selectedLabel(n) {
  return n === 1 ? t('selectedOne') : t('selected', { n })
}

const status = computed(() => {
  const count = items.value.length
  const parts = [count === 1 ? t('oneItem') : t('items', { n: count })]
  if (selected.value.length)
    parts.push(selectedLabel(selected.value.length))
  return parts.join(' · ')
})

/* ------------------------------------------------------------------ wallpaper */

// Reuse the image the home page already resolved for its wallpaper (#background), so built-in,
// uploaded and Files wallpapers all show here without repeating that logic.
const wallpaperImage = ref('')
function readWallpaper() {
  const background = document.getElementById('background')
  const image = background ? getComputedStyle(background).backgroundImage : ''
  if (image && image !== 'none')
    wallpaperImage.value = image
}
const wallpaper = computed(() => (wallpaperImage.value ? { '--files-wallpaper': wallpaperImage.value } : {}))

/* ------------------------------------------------------------------ lifecycle */

let socket = null
onMounted(() => {
  // vue-socket.io-extended (Vue 2) wraps the client in $socket.client; the Vue 3 plugin exposes it as $socket.
  socket = vm.$socket?.client || vm.$socket || null
  socket?.on?.('casaos:file:operate', onFileOperate)
  // The home page calls init() right after mounting; load the home folder if nothing does.
  setTimeout(() => {
    if (!initialized)
      init()
  })
})

onBeforeUnmount(() => {
  socket?.off?.('casaos:file:operate', onFileOperate)
  stopUploadListener()
  reloadTimers.forEach(clearTimeout)
  clearTimeout(toastTimer)
  clearTimeout(uploadReload)
})

function close() {
  menu.value = null
  previewItem.value = null
  emit('close')
}

const hasSelection = computed(() => selected.value.length > 0)
const singleSelected = computed(() => selectedItems.value.length === 1)
</script>

<template>
  <div ref="rootEl" :style="wallpaper" class="atrio-files" @keydown="onKeydown">
    <div class="shell">
      <!-- Top bar: navigation, breadcrumbs, filter, close -->
      <header class="topbar glass">
        <button :aria-label="$t('files.menu')" class="icon-btn only-narrow" type="button" @click="sidebarOpen = true">
          <FilesIcon name="menu" />
        </button>
        <div class="nav-btns">
          <button :aria-label="$t('files.back')" :disabled="!backStack.length" :title="$t('files.back')" class="icon-btn only-wide" type="button" @click="goBack">
            <FilesIcon name="chevronLeft" />
          </button>
          <button :aria-label="$t('files.forward')" :disabled="!forwardStack.length" :title="$t('files.forward')" class="icon-btn only-wide" type="button" @click="goForward">
            <FilesIcon name="chevronRight" />
          </button>
          <button :aria-label="$t('files.up')" :disabled="path === '/'" :title="$t('files.up')" class="icon-btn" type="button" @click="goUp">
            <FilesIcon name="arrowUp" />
          </button>
        </div>

        <form v-if="editingPath" class="pathbar" @submit.prevent="submitPath">
          <input
            ref="pathInput" v-model="pathDraft" :aria-label="$t('files.editPath')" autocomplete="off" class="pathbar__input" spellcheck="false"
            @blur="editingPath = false" @keydown.esc.stop.prevent="editingPath = false; focusRoot()"
          >
        </form>
        <nav v-else :aria-label="$t('files.title')" class="crumbs" @dblclick.self="editPath">
          <span v-for="(c, i) in crumbs" :key="c.path" :class="{ 'is-early': i < crumbs.length - 2 }" class="crumbs__step">
            <FilesIcon v-if="i > 1" :size="14" class="crumbs__sep" name="chevronRight" />
            <button
              :aria-current="i === crumbs.length - 1 ? 'page' : null" :class="{ 'is-current': i === crumbs.length - 1 }" class="crumbs__item"
              type="button" @click="go(c.path)"
            >
              {{ c.name }}
            </button>
          </span>
          <button :aria-label="$t('files.editPath')" :title="$t('files.editPath')" class="icon-btn icon-btn--ghost crumbs__edit" type="button" @click="editPath">
            <FilesIcon :size="16" name="pencil" />
          </button>
        </nav>

        <label class="filter">
          <FilesIcon :size="16" name="search" />
          <input ref="filterInput" v-model="query" :aria-label="$t('files.filter')" :placeholder="$t('files.filter')" autocomplete="off" type="search">
          <kbd class="only-wide">/</kbd>
        </label>

        <button :aria-label="$t('files.close')" :title="$t('files.close')" class="icon-btn" type="button" @click="close">
          <FilesIcon name="x" />
        </button>
      </header>

      <div class="body">
        <!-- Locations -->
        <div v-if="sidebarOpen" class="side-scrim only-narrow" @click="sidebarOpen = false" />
        <aside :class="{ 'is-open': sidebarOpen }" class="side glass">
          <div class="side__head only-narrow">
            <strong>{{ $t('files.title') }}</strong>
            <button :aria-label="$t('files.close')" class="icon-btn" type="button" @click="sidebarOpen = false">
              <FilesIcon name="x" />
            </button>
          </div>
          <FilesSidebar :current="path" :places="locations.places" :storage="locations.storage" @go="go" />
        </aside>

        <!-- Folder -->
        <main
          class="main glass" @dragenter="onDragEnter" @dragleave="onDragLeave" @dragover="onDragOver" @drop="onDrop"
        >
          <div class="toolbar">
            <template v-if="hasSelection">
              <button :aria-label="$t('files.clearSelection')" :title="$t('files.clearSelection')" class="icon-btn" type="button" @click="clearSelection(); focusRoot()">
                <FilesIcon name="x" />
              </button>
              <strong class="toolbar__count" aria-live="polite">{{ selectedLabel(selected.length) }}</strong>
              <div class="toolbar__actions">
                <button class="btn btn--soft" type="button" @click="downloadItems()">
                  <FilesIcon :size="16" name="download" /><span class="btn__label">{{ $t('files.download') }}</span>
                </button>
                <button v-if="singleSelected" class="btn btn--soft" type="button" @click="startRename()">
                  <FilesIcon :size="16" name="pencil" /><span class="btn__label">{{ $t('files.rename') }}</span>
                </button>
                <button class="btn btn--soft" type="button" @click="startTransfer('copy')">
                  <FilesIcon :size="16" name="copy" /><span class="btn__label">{{ $t('files.copyTo') }}</span>
                </button>
                <button class="btn btn--soft" type="button" @click="startTransfer('move')">
                  <FilesIcon :size="16" name="move" /><span class="btn__label">{{ $t('files.moveTo') }}</span>
                </button>
                <button class="btn btn--soft btn--danger" type="button" @click="startDelete()">
                  <FilesIcon :size="16" name="trash" /><span class="btn__label">{{ $t('files.delete') }}</span>
                </button>
              </div>
            </template>
            <template v-else>
              <div class="toolbar__actions">
                <button ref="uploadMenu" aria-haspopup="menu" class="btn btn--primary" type="button" @click="openUploadMenu">
                  <FilesIcon :size="16" name="upload" />{{ $t('files.upload') }}
                </button>
                <button class="btn btn--soft" type="button" @click="startCreate('folder')">
                  <FilesIcon :size="16" name="folderPlus" /><span class="btn__label">{{ $t('files.newFolder') }}</span>
                </button>
                <button v-if="clipboard" class="btn btn--soft" type="button" @click="paste">
                  <FilesIcon :size="16" name="clipboard" /><span class="btn__label">{{ $t('files.paste') }} ({{ clipboard.items.length }})</span>
                </button>
              </div>
            </template>
            <div class="toolbar__spacer" />
            <button :aria-label="$t('files.reload')" :title="$t('files.reload')" class="icon-btn" type="button" @click="load(true)">
              <FilesIcon name="refresh" />
            </button>
            <button ref="sortButton" :aria-label="$t('files.sort')" :title="$t('files.sort')" aria-haspopup="menu" class="icon-btn" type="button" @click="openSortMenu">
              <FilesIcon name="sort" />
            </button>
            <div :aria-label="$t('files.gridView')" class="segmented" role="group">
              <button :aria-pressed="view === 'grid' ? 'true' : 'false'" :title="$t('files.gridView')" type="button" @click="view = 'grid'">
                <FilesIcon :size="17" name="grid" /><span class="sr-only">{{ $t('files.gridView') }}</span>
              </button>
              <button :aria-pressed="view === 'list' ? 'true' : 'false'" :title="$t('files.listView')" type="button" @click="view = 'list'">
                <FilesIcon :size="17" name="list" /><span class="sr-only">{{ $t('files.listView') }}</span>
              </button>
            </div>
          </div>

          <div
            ref="content" :aria-activedescendant="focusIndex >= 0 ? `files-item-${focusIndex}` : null" :aria-busy="loading ? 'true' : 'false'"
            :aria-label="path" aria-multiselectable="true" class="content" role="listbox" tabindex="0"
            @click="onContentClick" @contextmenu="openFolderMenu"
          >
            <div v-if="loading" class="skeleton" aria-hidden="true">
              <span v-for="n in 12" :key="n" />
            </div>
            <div v-else-if="loadError" class="empty">
              <FilesIcon :size="40" :stroke-width="1.5" name="alert" />
              <strong>{{ $t('files.loadError') }}</strong>
              <span>{{ loadError }}</span>
              <button class="btn btn--soft" type="button" @click="load()">
                {{ $t('files.retry') }}
              </button>
            </div>
            <div v-else-if="!items.length" class="empty">
              <FilesIcon :size="40" :stroke-width="1.5" :name="query ? 'search' : 'folder'" />
              <strong>{{ query ? $t('files.noMatches', { q: query }) : $t('files.emptyFolder') }}</strong>
              <span v-if="!query">{{ $t('files.emptyHint') }}</span>
            </div>
            <FileItems
              v-else ref="itemsRef" :cut-paths="cutPaths" :focus-index="focusIndex" :items="items" :locale="locale" :selected="selected"
              :sort-dir="sortDir" :sort-key="sortKey" :view="view"
              @menu="openItemMenu" @open="i => open(items[i])" @pick="pick" @sort="setSort" @toggle="toggle"
            />
          </div>

          <footer class="statusbar">
            <span>{{ status }}</span>
            <span v-if="clipboard" class="statusbar__clip">
              <FilesIcon :name="clipboard.mode === 'cut' ? 'scissors' : 'clipboard'" :size="14" />
              {{ clipboard.items.length === 1 ? clipboard.items[0].name : $t('files.items', { n: clipboard.items.length }) }}
            </span>
          </footer>

          <div v-if="dragging" class="dropzone" aria-hidden="true">
            <FilesIcon :size="40" :stroke-width="1.6" name="upload" />
            <strong>{{ $t('files.dropHere', { name: baseName(path) }) }}</strong>
          </div>
        </main>
      </div>
    </div>

    <input ref="fileInput" class="sr-only" multiple tabindex="-1" type="file" @change="onPicked">
    <input ref="folderInput" class="sr-only" multiple tabindex="-1" type="file" webkitdirectory @change="onPicked">

    <ActivityPanel />

    <FilesDialog
      v-if="dialog && dialog.type !== 'delete'"
      :title="dialog.type === 'rename' ? $t('files.rename') : dialog.type === 'folder' ? $t('files.newFolder') : $t('files.newFile')"
      @close="closeDialog"
    >
      <form class="form" @submit.prevent="submitDialog">
        <label class="field">
          <span>{{ dialog.type === 'rename' ? $t('files.newName') : dialog.type === 'folder' ? $t('files.folderName') : $t('files.fileName') }}</span>
          <input v-model="dialog.name" :aria-invalid="dialog.error ? 'true' : 'false'" autocomplete="off" spellcheck="false" @input="dialog.error = ''">
        </label>
        <p v-if="dialog.error" class="field__error" role="alert">
          {{ dialog.error }}
        </p>
      </form>
      <template #actions>
        <button class="btn" type="button" @click="closeDialog">
          {{ $t('files.cancel') }}
        </button>
        <button :disabled="dialog.busy" class="btn btn--primary" type="button" @click="submitDialog">
          {{ dialog.type === 'rename' ? $t('files.save') : $t('files.create') }}
        </button>
      </template>
    </FilesDialog>

    <FilesDialog
      v-if="dialog && dialog.type === 'delete'"
      :title="dialog.items.length === 1 ? $t('files.deleteTitleOne', { name: dialog.items[0].name }) : $t('files.deleteTitleMany', { n: dialog.items.length })"
      @close="closeDialog"
    >
      <p>{{ $t('files.deleteBody') }}</p>
      <ul v-if="dialog.items.length > 1" class="delete-list">
        <li v-for="item in dialog.items.slice(0, 6)" :key="item.path">
          <FilesIcon :name="kindOf(item)" :size="15" />{{ item.name }}
        </li>
        <li v-if="dialog.items.length > 6">
          …
        </li>
      </ul>
      <p v-if="dialog.error" class="field__error" role="alert">
        {{ dialog.error }}
      </p>
      <template #actions>
        <button class="btn" type="button" @click="closeDialog">
          {{ $t('files.cancel') }}
        </button>
        <button :disabled="dialog.busy" class="btn btn--danger-solid" type="button" @click="submitDialog">
          <FilesIcon :size="16" name="trash" />{{ $t('files.delete') }}
        </button>
      </template>
    </FilesDialog>

    <FolderPicker
      v-if="picker" :locations="[...locations.places.slice(0, 1), ...locations.storage]" :mode="picker.mode" :sources="picker.sources"
      :start="path" @close="picker = null; focusRoot()" @confirm="confirmPicker"
    />

    <FilePreview
      v-if="previewItem" :item="previewItem" :siblings="previewSiblings" @close="closePreview" @navigate="item => previewItem = item"
    />

    <FilesMenu v-if="menu" :actions="menu.actions" :title="menu.title" :x="menu.x" :y="menu.y" @close="closeMenu" @pick="runAction" />

    <div v-if="toast" :class="`toast--${toast.tone}`" class="toast" role="status">
      <FilesIcon :name="toast.tone === 'error' ? 'alert' : 'checkCircle'" :size="18" />{{ toast.message }}
    </div>
  </div>
</template>

<style>
/* Glass tokens and the few controls shared by every part of the file manager. Namespaced, not global. */
.atrio-files {
  --files-text: #F8FAFC;
  --files-text-soft: #CBD5E1;
  --files-muted: #94A3B8;
  --files-panel: rgba(15, 23, 42, 0.45);
  --files-panel-strong: rgba(15, 23, 42, 0.78);
  --files-border: rgba(255, 255, 255, 0.08);
  --files-border-strong: rgba(255, 255, 255, 0.12);
  --files-field: rgba(255, 255, 255, 0.06);
  --files-hover: rgba(255, 255, 255, 0.06);
  --files-hover-strong: rgba(255, 255, 255, 0.11);
  --files-selected: rgba(99, 102, 241, 0.24);
  --files-selected-border: rgba(129, 140, 248, 0.55);
  --files-focus: #67E8F9;
  --files-accent: #22D3EE;
  --files-blur: blur(24px) saturate(140%);
}

.atrio-files .btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 40px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid var(--files-border-strong);
  background: var(--files-field);
  color: var(--files-text);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.12s ease;
}

.atrio-files .btn:hover:not(:disabled) {
  background: var(--files-hover-strong);
}

.atrio-files .btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.atrio-files .btn--primary {
  border-color: transparent;
  background: #F8FAFC;
  color: #0B1120;
  font-weight: 700;
}

.atrio-files .btn--primary:hover:not(:disabled) {
  background: #E2E8F0;
}

.atrio-files .btn--soft {
  border-color: transparent;
}

.atrio-files .btn--danger {
  color: #FDA4AF;
}

.atrio-files .btn--danger-solid {
  border-color: transparent;
  background: #E11D48;
  color: #fff;
  font-weight: 700;
}

.atrio-files .btn--danger-solid:hover:not(:disabled) {
  background: #BE123C;
}

.atrio-files .btn:focus-visible,
.atrio-files .icon-btn:focus-visible,
.atrio-files button:focus-visible {
  outline: 2px solid var(--files-focus);
  outline-offset: 2px;
}

.atrio-files strong {
  color: inherit;
}

.atrio-files * {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.18) transparent;
}

.atrio-files .sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
</style>

<style scoped>
.atrio-files {
  position: fixed;
  inset: 0;
  z-index: 41;
  font-family: Manrope, system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: var(--files-text);
  background-color: #0B1120;
  background-image: linear-gradient(180deg, rgba(11, 17, 32, 0.4) 0%, rgba(11, 17, 32, 0.6) 100%), var(--files-wallpaper, none);
  background-size: cover;
  background-position: center;
  -webkit-font-smoothing: antialiased;
  text-align: left;
}

.shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 20px 20px;
  box-sizing: border-box;
}

.glass {
  background: var(--files-panel);
  backdrop-filter: var(--files-blur);
  -webkit-backdrop-filter: var(--files-blur);
  border: 1px solid var(--files-border);
}

/* ---------- top bar */
.topbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 20px;
}

.nav-btns {
  display: flex;
  gap: 2px;
}

.icon-btn {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  padding: 0;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--files-text-soft);
  cursor: pointer;
}

.icon-btn:hover:not(:disabled) {
  background: var(--files-hover-strong);
  color: var(--files-text);
}

.icon-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.icon-btn--ghost {
  width: 32px;
  height: 32px;
}

.crumbs {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 2px;
  overflow: hidden;
  padding: 0 4px;
}

.crumbs__step {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  flex-shrink: 1;
}

.crumbs__item {
  max-width: 220px;
  height: 34px;
  padding: 0 8px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--files-text-soft);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.crumbs__item:hover {
  background: var(--files-hover);
  color: var(--files-text);
}

.crumbs__item.is-current {
  color: var(--files-text);
  font-weight: 700;
}

.crumbs__sep {
  color: var(--files-muted);
}

.crumbs__edit {
  opacity: 0;
  margin-left: 2px;
}

.crumbs:hover .crumbs__edit,
.crumbs__edit:focus-visible {
  opacity: 1;
}

.pathbar {
  flex: 1;
  min-width: 0;
}

.pathbar__input,
.filter input,
.field input {
  width: 100%;
  height: 40px;
  box-sizing: border-box;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid var(--files-border-strong);
  background: rgba(2, 6, 23, 0.35);
  color: var(--files-text);
  font: inherit;
  font-size: 14px;
  outline: none;
}

.pathbar__input:focus,
.field input:focus {
  border-color: var(--files-focus);
}

.filter {
  flex: 0 1 260px;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 10px 0 12px;
  border-radius: 12px;
  border: 1px solid var(--files-border-strong);
  background: var(--files-field);
  color: var(--files-muted);
}

.filter:focus-within {
  border-color: var(--files-focus);
}

.filter input {
  height: 38px;
  padding: 0;
  border: 0;
  background: transparent;
}

.filter kbd {
  padding: 2px 7px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--files-text-soft);
  font: inherit;
  font-size: 11px;
}

/* ---------- body */
.body {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 16px;
}

.side {
  width: 240px;
  flex-shrink: 0;
  overflow-y: auto;
  padding: 16px 10px;
  border-radius: 24px;
  box-sizing: border-box;
}

.side__head {
  align-items: center;
  justify-content: space-between;
  padding: 0 4px 12px 12px;
  font-size: 18px;
}

.main {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border-radius: 24px;
  overflow: hidden;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--files-border);
}

.toolbar__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.toolbar__count {
  font-size: 14px;
  margin-right: 6px;
}

.toolbar__spacer {
  flex: 1;
}

.segmented {
  display: flex;
  gap: 2px;
  padding: 3px;
  border-radius: 12px;
  background: var(--files-field);
  border: 1px solid var(--files-border);
}

.segmented button {
  display: grid;
  place-items: center;
  width: 34px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--files-muted);
  cursor: pointer;
}

.segmented button[aria-pressed='true'] {
  background: rgba(255, 255, 255, 0.14);
  color: var(--files-text);
}

.content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px;
  outline: none;
}

.statusbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 18px;
  border-top: 1px solid var(--files-border);
  font-size: 12px;
  color: var(--files-muted);
}

.statusbar__clip {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty {
  height: 100%;
  min-height: 240px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  text-align: center;
  color: var(--files-muted);
}

.empty strong {
  font-size: 16px;
  color: var(--files-text);
}

.empty span {
  font-size: 14px;
  max-width: 420px;
  overflow-wrap: anywhere;
}

.skeleton {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}

.skeleton span {
  aspect-ratio: 1;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.05);
  animation: files-pulse 1.4s ease-in-out infinite;
}

@keyframes files-pulse {
  50% { opacity: 0.45; }
}

.dropzone {
  position: absolute;
  inset: 8px;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border-radius: 20px;
  border: 2px dashed rgba(103, 232, 249, 0.7);
  background: rgba(8, 47, 73, 0.55);
  backdrop-filter: blur(6px);
  color: var(--files-text);
  font-size: 16px;
  pointer-events: none;
}

/* ---------- dialogs content */
.form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--files-muted);
}

.field__error {
  margin: 0;
  color: #FDA4AF;
  font-size: 13px;
}

.delete-list {
  margin: 0;
  padding: 10px 12px;
  list-style: none;
  border-radius: 12px;
  background: rgba(2, 6, 23, 0.35);
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--files-text);
}

.delete-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---------- toast */
.toast {
  position: absolute;
  left: 50%;
  bottom: 28px;
  z-index: 40;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: calc(100% - 32px);
  padding: 12px 18px;
  border-radius: 14px;
  background: var(--files-panel-strong);
  backdrop-filter: blur(32px);
  border: 1px solid var(--files-border-strong);
  box-shadow: 0 12px 32px rgba(2, 6, 23, 0.45);
  font-size: 14px;
  font-weight: 600;
}

.toast--info .files-icon {
  color: #6EE7B7;
}

.toast--error {
  color: #FECDD3;
}

/* ---------- responsive */
.only-narrow {
  display: none;
}

@media (max-width: 900px) {
  .side {
    width: 200px;
  }
}

@media (max-width: 720px) {
  .only-narrow {
    display: flex;
  }

  .only-wide {
    display: none;
  }

  .shell {
    gap: 10px;
    padding: 10px 10px 12px;
  }

  .topbar {
    flex-wrap: wrap;
    border-radius: 18px;
  }

  .crumbs {
    order: 3;
    flex-basis: 100%;
  }

  .crumbs__step.is-early {
    display: none;
  }

  .crumbs__edit {
    opacity: 1;
  }

  .filter {
    flex: 1 1 120px;
  }

  .side {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    z-index: 26;
    width: min(300px, 85vw);
    border-radius: 0 24px 24px 0;
    background: var(--files-panel-strong);
    transform: translateX(-105%);
    transition: transform 0.2s ease;
  }

  .side.is-open {
    transform: none;
  }

  .side-scrim {
    position: fixed;
    inset: 0;
    z-index: 25;
    background: rgba(2, 6, 23, 0.5);
  }

  .main {
    border-radius: 20px;
  }

  .toolbar {
    padding: 10px;
  }

  .btn__label {
    display: none;
  }

  .content {
    padding: 10px;
  }

  .skeleton {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }
}

@media (prefers-reduced-motion: reduce) {
  .side,
  .skeleton span {
    transition: none;
    animation: none;
  }
}
</style>
