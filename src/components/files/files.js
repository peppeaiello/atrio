// Data layer of the file manager: paths, file kinds, server calls, the upload queue and the
// copy/move tasks reported by the message bus. It has no UI and no Vue 2-only APIs.
import { reactive } from 'vue'
import qs from 'qs'
import api from '@/service/api.js'

export const ROOT = '/DATA'

/* ------------------------------------------------------------------ paths */

export function joinPath(dir, name) {
  return `${dir.replace(/\/+$/, '')}/${name}`
}

export function parentPath(path) {
  const parts = path.split('/').filter(Boolean)
  parts.pop()
  return `/${parts.join('/')}`
}

export function baseName(path) {
  return path.split('/').filter(Boolean).pop() || '/'
}

export function isInside(path, dir) {
  return path === dir || path.startsWith(`${dir.replace(/\/+$/, '')}/`)
}

/* ------------------------------------------------------------------ kinds */

const kindExtensions = {
  image: ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp', 'svg', 'avif', 'ico', 'tiff', 'heic'],
  video: ['mkv', 'mp4', '3gp', 'avi', 'm2ts', 'webm', 'flv', 'vob', 'ts', 'mts', 'mov', 'wmv', 'rm', 'rmvb', 'asf', 'mpg', 'm4v', 'mpeg', 'f4v'],
  audio: ['aac', 'aiff', 'alac', 'amr', 'ape', 'flac', 'm4a', 'mp3', 'ogg', 'opus', 'wma', 'wav'],
  text: ['txt', 'log', 'md', 'conf', 'config', 'list', 'ini', 'toml', 'cfg', 'rc', 'env', 'service', 'htaccess', 'gitignore', 'csv', 'tsv', 'srt', 'ass', 'nfo'],
  code: ['php', 'css', 'less', 'scss', 'sass', 'lua', 'vue', 'js', 'mjs', 'cjs', 'ts', 'go', 'bat', 'c', 'cpp', 'cs', 'h', 'json', 'py', 'pl', 'sh', 'bash', 'zsh', 'xml', 'yaml', 'yml', 'sql', 'swift', 'rs', 'rb', 'r', 'java', 'kt', 'html', 'htm', 'diff', 'patch', 'dockerfile', 'makefile', 'tex', 'jsonld'],
  pdf: ['pdf'],
  doc: ['doc', 'docx', 'odt', 'rtf', 'wps', 'pages'],
  sheet: ['xls', 'xlsx', 'ods', 'numbers'],
  archive: ['zip', 'rar', '7z', 'gz', 'tgz', 'bz2', 'xz', 'tar', 'zst', 'ace'],
  disc: ['iso', 'img', 'vmdk', 'raw', 'vhd', 'qcow2', 'dmg'],
}
const kindByExtension = {}
Object.entries(kindExtensions).forEach(([kind, exts]) => exts.forEach((ext) => {
  kindByExtension[ext] = kind
}))

export function extension(name) {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : name.toLowerCase()
}

export function kindOf(item) {
  if (item.is_dir)
    return 'folder'
  return kindByExtension[extension(item.name)] || 'file'
}

// What the quick preview can show for each kind.
export function previewMode(item) {
  const kind = kindOf(item)
  if (['image', 'video', 'audio', 'pdf'].includes(kind))
    return kind
  if (kind === 'text' || kind === 'code')
    return 'text'
  return null
}

const thumbExtensions = ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp', 'svg']
export function hasThumb(item) {
  return !item.is_dir && thumbExtensions.includes(extension(item.name))
}

/* ------------------------------------------------------------------ formatting */

export function formatSize(bytes) {
  if (bytes == null || Number.isNaN(bytes))
    return ''
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${unit === 0 ? value : value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`
}

export function formatDate(iso, locale) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime()))
    return ''
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/* ------------------------------------------------------------------ urls */

function token() {
  try {
    return localStorage.getItem('access_token') || ''
  }
  catch {
    return ''
  }
}

// Relative URLs: the page is served by the CasaOS gateway (or the dev proxy), so they reach the API.
export function fileUrl(path) {
  return `/v3/file?${qs.stringify({ path, token: token() })}`
}

export function zipUrl(paths) {
  return `/v1/batch?${qs.stringify({ files: paths.join(','), token: token() })}`
}

export function thumbUrl(path) {
  return `/v1/image?${qs.stringify({ path, token: token(), type: 'thumbnail' })}`
}

export function download(items) {
  const single = items.length === 1 && !items[0].is_dir
  const link = document.createElement('a')
  link.href = single ? fileUrl(items[0].path) : zipUrl(items.map(i => i.path))
  link.download = single ? items[0].name : ''
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

/* ------------------------------------------------------------------ server calls */

function unwrap(res) {
  if (res.data && res.data.success === 200)
    return res.data.data
  throw new Error(res.data?.message || 'Request failed')
}

function errorMessage(e) {
  return e?.response?.data?.message || e?.response?.data?.data || e?.message || String(e)
}
export { errorMessage }

export async function listFolder(path) {
  const data = unwrap(await api.folder.getList(path))
  return (data.content || []).map(item => ({
    name: item.name,
    path: item.path,
    is_dir: item.is_dir,
    size: item.size,
    date: item.modified || item.date,
    extensions: item.extensions,
  }))
}

export async function createFolder(path) {
  return unwrap(await api.folder.create(path))
}

export async function createFile(path) {
  return unwrap(await api.file.create(path))
}

export async function rename(item, newPath) {
  const service = item.is_dir ? api.folder : api.file
  return unwrap(await service.rename(item.path, newPath))
}

export async function remove(paths) {
  return unwrap(await api.batch.delete(JSON.stringify(paths)))
}

// type: 'copy' | 'move'; style: 'skip' | 'overwrite'
export async function transfer(type, paths, to, style) {
  return unwrap(await api.batch.task({
    type,
    item: paths.map(from => ({ from })),
    to,
    style,
  }))
}

export async function readText(path) {
  return unwrap(await api.file.getContent(path))
}

// Locations for the sidebar: the CasaOS home, its standard folders, disks, network and cloud mounts.
export async function listLocations() {
  const places = [{ name: 'home', label: null, path: ROOT, icon: 'home' }]
  const standard = { Documents: 'documents', Downloads: 'downloads', Gallery: 'gallery', Media: 'media', AppData: 'apps' }
  const storage = []
  const settle = p => p.then(v => v, () => null)

  const [rootList, disks, shares, clouds] = await Promise.all([
    settle(listFolder(ROOT)),
    settle(api.storage.list().then(unwrap)),
    settle(api.samba.getConnections().then(unwrap)),
    settle(api.cloud.list().then(unwrap)),
  ])

  ;(rootList || []).filter(i => i.is_dir && standard[i.name]).forEach((i) => {
    places.push({ name: i.name, label: i.name, path: i.path, icon: standard[i.name] })
  })

  ;(disks || []).forEach((disk) => {
    (disk.children || []).forEach((part) => {
      if (!part.mount_point)
        return
      storage.push({
        name: part.label || part.name || baseName(part.mount_point),
        label: part.label || part.name || baseName(part.mount_point),
        path: part.mount_point,
        icon: disk.type === 'usb' ? 'usb' : 'hdd',
        size: part.size,
        avail: part.avail,
      })
    })
  })
  ;(shares || []).forEach((share) => {
    storage.push({ name: share.host, label: share.host, path: share.mount_point, icon: 'network' })
  })
  ;(clouds || []).forEach((cloud) => {
    storage.push({ name: cloud.name, label: cloud.name, path: cloud.mount_point, icon: 'cloud' })
  })
  storage.push({ name: 'system', label: null, path: '/', icon: 'server' })

  return { places, storage }
}

/* ------------------------------------------------------------------ activity: uploads and tasks */

export const activity = reactive({
  uploads: [],
  tasks: [],
})

const CHUNK_SIZE = 1024 * 1024
const PARALLEL_UPLOADS = 3
let nextId = 1
let running = 0
const uploadListeners = new Set()

export function onUploaded(listener) {
  uploadListeners.add(listener)
  return () => uploadListeners.delete(listener)
}

// entries: [{ file: File, relativePath: 'a/b.txt' }], dir: absolute destination folder
export function enqueueUploads(entries, dir) {
  entries.forEach(({ file, relativePath }) => {
    activity.uploads.push({
      id: nextId++,
      file,
      name: file.name,
      relativePath: relativePath || file.name,
      dir,
      total: file.size,
      loaded: 0,
      status: 'waiting',
      error: '',
      xhr: null,
    })
  })
  pump()
}

export function cancelUpload(upload) {
  if (upload.status === 'waiting' || upload.status === 'uploading') {
    upload.status = 'canceled'
    upload.xhr?.abort()
  }
}

export function clearFinished() {
  activity.uploads = activity.uploads.filter(u => u.status === 'waiting' || u.status === 'uploading')
  activity.tasks = activity.tasks.filter(t => !t.finished)
}

function pump() {
  while (running < PARALLEL_UPLOADS) {
    const next = activity.uploads.find(u => u.status === 'waiting')
    if (!next)
      return
    running++
    next.status = 'uploading'
    uploadFile(next)
      .then(() => {
        if (next.status === 'uploading')
          next.status = 'done'
        uploadListeners.forEach(fn => fn(next))
      })
      .catch((e) => {
        if (next.status !== 'canceled') {
          next.status = 'failed'
          next.error = e.message
        }
      })
      .finally(() => {
        running--
        pump()
      })
  }
}

// Same protocol as simple-uploader.js, which the classic file browser uses: multipart chunks of 1 MB,
// the last one up to 2 MB, sent in order to /v2/casaos/file/upload.
async function uploadFile(upload) {
  const { file } = upload
  const totalChunks = Math.max(Math.floor(file.size / CHUNK_SIZE), 1)
  const identifier = `${file.size}-${upload.relativePath.replace(/[^\w-]/g, '')}`
  for (let index = 0; index < totalChunks; index++) {
    if (upload.status === 'canceled')
      return
    const start = index * CHUNK_SIZE
    const end = index === totalChunks - 1 ? file.size : start + CHUNK_SIZE
    const form = new FormData()
    form.append('chunkNumber', index + 1)
    form.append('chunkSize', CHUNK_SIZE)
    form.append('currentChunkSize', end - start)
    form.append('totalSize', file.size)
    form.append('identifier', identifier)
    form.append('filename', file.name)
    form.append('relativePath', upload.relativePath)
    form.append('totalChunks', totalChunks)
    form.append('path', upload.dir)
    form.append('file', file.slice(start, end), file.name)
    await sendChunk(upload, form, start, end - start)
    upload.loaded = end
  }
}

function sendChunk(upload, form, offset, length) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    upload.xhr = xhr
    xhr.open('POST', '/v2/casaos/file/upload')
    xhr.setRequestHeader('Authorization', token())
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        upload.loaded = offset + Math.min(length, e.loaded * (length / e.total))
    }
    xhr.onload = () => {
      if ([200, 201, 202].includes(xhr.status))
        resolve()
      else reject(new Error(parseError(xhr)))
    }
    xhr.onerror = () => reject(new Error('Network error'))
    xhr.onabort = () => reject(new Error('Canceled'))
    xhr.send(form)
  })
}

function parseError(xhr) {
  try {
    const body = JSON.parse(xhr.responseText)
    return body.message || `HTTP ${xhr.status}`
  }
  catch {
    return `HTTP ${xhr.status}`
  }
}

// Message bus event "casaos:file:operate" carries every copy/move task with its progress.
export function updateTasks(event) {
  let tasks
  try {
    tasks = JSON.parse(event.Properties.file_operate).data || []
  }
  catch {
    return []
  }
  tasks.forEach((task) => {
    const known = activity.tasks.find(t => t.id === task.id)
    if (known)
      Object.assign(known, task)
    else activity.tasks.push({ ...task })
  })
  return tasks
}
