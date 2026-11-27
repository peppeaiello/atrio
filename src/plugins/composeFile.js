// The compose file of an app, edited as text: checks that point at the line of each problem, a
// converter from `docker run` commands, and what CasaOS needs before installing. Plain functions on
// text, with no Vue, so that tests/ui can run them in Node.
// Messages are English sentences with {values}, translated by the caller with $t.
import YAML from 'yaml'
import composerize from 'composerize'

const PLACEHOLDER = '<your project name>'
const RESTART = /^(no|always|unless-stopped|on-failure(:\d+)?)$/
// [ip:][host:]container[/protocol], each port a number or a range
const PORT = /^(?:(\[[0-9a-f:.]+\]|\d{1,3}(?:\.\d{1,3}){3}):)?(?:(\d+(?:-\d+)?)?:)?(\d+(?:-\d+)?)(?:\/(tcp|udp|sctp))?$/i
const MODES = /^(ro|rw|z|Z|consistent|cached|delegated|nocopy)(,(ro|rw|z|Z|consistent|cached|delegated|nocopy))*$/
const PROJECT = /^[a-z0-9][a-z0-9_-]*$/
const SERVICE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/

/** A name Docker Compose takes as a project name, from any text. */
export function projectName(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^[-_]+|-+$/g, '') || 'app'
}

function isMap(node) {
  return node?.type === 'MAP' || node?.type === 'FLOW_MAP'
}

function isSeq(node) {
  return node?.type === 'SEQ' || node?.type === 'FLOW_SEQ'
}

function isScalar(node) {
  return node != null && !isMap(node) && !isSeq(node) && 'value' in node
}

function pairs(node) {
  return isMap(node) ? node.items.filter(pair => pair?.key != null) : []
}

function keyOf(pair) {
  return String(pair.key?.value ?? pair.key)
}

function get(node, key) {
  return pairs(node).find(pair => keyOf(pair) === key)
}

// A port or a range, and whether its numbers are real ports
function portRange(text) {
  const [first, last = first] = String(text).split('-').map(Number)
  return first >= 1 && last <= 65535 && first <= last ? [first, last] : null
}

/**
 * Problems in a compose file, each { from, to, severity: 'error' | 'warning', message, values }: errors stop
 * the install, warnings only tell. A YAML syntax error is reported alone, as nothing else can be read.
 */
export function checkCompose(text) {
  const found = []
  const add = (node, severity, message, values = {}) => {
    const [from, to] = node?.range || [0, Math.min(1, text.length)]
    found.push({ from, to: Math.max(to, from + 1), severity, message, values })
  }
  if (!text.trim()) {
    add(null, 'error', 'The compose file is empty')
    return found
  }
  let doc
  try {
    doc = YAML.parseDocument(text, { prettyErrors: false })
  }
  catch (e) {
    add(null, 'error', e.message)
    return found
  }
  if (doc.errors.length) {
    const error = doc.errors[0]
    const range = error.source?.range
    found.push({ from: range?.start ?? 0, to: Math.max(range?.end ?? 1, (range?.start ?? 0) + 1), severity: 'error', message: 'This is not valid YAML: {reason}', values: { reason: error.message.split('\n')[0] } })
    return found
  }
  const root = doc.contents
  if (!isMap(root)) {
    add(root, 'error', 'A compose file is a list of settings, starting with services:')
    return found
  }

  const name = get(root, 'name')
  if (name) {
    const value = String(name.value?.value ?? '')
    if (!PROJECT.test(value))
      add(name.value || name.key, 'error', 'The name {name} cannot be used: only lowercase letters, numbers, - and _', { name: value })
  }

  const services = get(root, 'services')
  if (!services || !pairs(services.value).length) {
    add(services?.key || root, 'error', 'The file needs a services section with at least one service')
    return found
  }
  const declaredVolumes = new Set(pairs(get(root, 'volumes')?.value).map(keyOf))
  const hostPorts = new Map()

  for (const service of pairs(services.value)) {
    const serviceName = keyOf(service)
    const body = service.value
    if (!SERVICE.test(serviceName))
      add(service.key, 'error', 'The service name {name} cannot be used: only letters, numbers, ., - and _', { name: serviceName })
    if (!isMap(body)) {
      add(service.key, 'error', 'The service {name} has no settings', { name: serviceName })
      continue
    }
    const image = get(body, 'image')
    if (!image || !String(image.value?.value ?? '').trim()) {
      add(get(body, 'build')?.key || service.key, 'error', 'The service {name} has no image: CasaOS installs apps from images and cannot build one', { name: serviceName })
    }

    const restart = get(body, 'restart')
    if (restart && !RESTART.test(String(restart.value?.value ?? '')))
      add(restart.value, 'error', 'restart can be no, always, unless-stopped or on-failure')

    const ports = get(body, 'ports')
    if (ports && !isSeq(ports.value)) {
      add(ports.value || ports.key, 'error', 'ports is a list, one port per line starting with -')
    }
    for (const item of isSeq(ports?.value) ? ports.value.items : []) {
      let host = null
      let protocol = 'tcp'
      if (isMap(item)) {
        const target = get(item, 'target')
        if (!target || !portRange(target.value?.value))
          add(item, 'error', 'This port needs a target: the port inside the container')
        const published = get(item, 'published')
        host = published ? String(published.value?.value) : null
        protocol = String(get(item, 'protocol')?.value?.value || 'tcp')
        if (host && !portRange(host))
          add(published.value, 'error', '{port} is not a valid port mapping', { port: host })
      }
      else if (isScalar(item)) {
        const value = String(item.value)
        const match = value.match(PORT)
        if (!match || !portRange(match[3]) || (match[2] && !portRange(match[2]))) {
          add(item, 'error', '{port} is not a valid port mapping', { port: value })
          continue
        }
        host = match[2] || null
        protocol = (match[4] || 'tcp').toLowerCase()
      }
      if (!host)
        continue
      const range = portRange(host)
      if (!range)
        continue
      for (let port = range[0]; port <= Math.min(range[1], range[0] + 1000); port++) {
        const key = `${port}/${protocol}`
        if (hostPorts.has(key)) {
          add(item, 'error', 'Port {port} is used twice in this file', { port })
          break
        }
        hostPorts.set(key, serviceName)
      }
    }

    const volumes = get(body, 'volumes')
    if (volumes && !isSeq(volumes.value)) {
      add(volumes.value || volumes.key, 'error', 'volumes is a list, one folder per line starting with -')
    }
    for (const item of isSeq(volumes?.value) ? volumes.value.items : []) {
      if (isMap(item)) {
        if (!String(get(item, 'target')?.value?.value ?? '').startsWith('/'))
          add(item, 'error', 'This volume needs a target: a full path inside the container, starting with /')
        continue
      }
      if (!isScalar(item))
        continue
      const value = String(item.value)
      const parts = value.split(':')
      if (parts.length > 3 || (parts.length === 3 && !MODES.test(parts[2]))) {
        add(item, 'error', '{volume} is not a valid volume: use /folder/on/the/server:/path/in/the/container', { volume: value })
        continue
      }
      const [source, target] = parts.length === 1 ? ['', parts[0]] : parts
      if (!target.startsWith('/')) {
        add(item, 'error', '{volume} is not a valid volume: use /folder/on/the/server:/path/in/the/container', { volume: value })
        continue
      }
      if (/^(\.\.?\/|~)/.test(source)) {
        add(item, 'warning', '{folder} is not a full path: its files go into CasaOS\'s own folder for this app. A path such as /DATA/AppData/{app}/data is easier to find and back up.', { folder: source, app: serviceName })
      }
      else if (source && !source.startsWith('/') && !source.startsWith('$') && !declaredVolumes.has(source)) {
        add(item, 'error', 'The volume {volume} is not declared: add it under volumes: at the end of the file, or use a full path starting with /', { volume: source })
      }
    }

    const environment = get(body, 'environment')
    if (environment && isMap(environment.value)) {
      for (const pair of pairs(environment.value)) {
        if (pair.value && !isScalar(pair.value))
          add(pair.value, 'error', 'The value of {key} must be plain text, a number or true/false', { key: keyOf(pair) })
      }
    }
    else if (environment && environment.value && !isSeq(environment.value)) {
      add(environment.value, 'error', 'environment is a list of KEY=value lines, or KEY: value lines')
    }
  }

  const casaos = get(root, 'x-casaos')
  const main = casaos && get(casaos.value, 'main')
  if (main && !pairs(services.value).some(service => keyOf(service) === String(main.value?.value)))
    add(main.value, 'error', 'x-casaos main names a service that is not in this file')
  return found
}

/** Whether the file can be installed or saved: no errors (warnings are fine). */
export function composeIsValid(text) {
  return !checkCompose(text).some(problem => problem.severity === 'error')
}

/**
 * One or more `docker run` commands (lines ending in \ are joined) as compose services, added to the
 * compose file `current` when there is one, keeping its comments. Resolves with { text, added }, the names
 * of the services added; throws an Error with a message to translate.
 */
export function fromDockerRun(input, current = '') {
  const commands = String(input)
    .replace(/\\\r?\n/g, ' ')
    .replace(/`#[^`]*`/g, '')
    .split(/\r?\n|&&|;/)
    .map(line => line.replace(/#.*$/, '').trim())
    .map(line => line.replace(/^sudo\s+/, '').replace(/^docker\s+container\s+run\b/, 'docker run'))
    .filter(line => /^docker\s+run\b/.test(line))
  if (!commands.length)
    throw new Error('Paste one or more commands that start with docker run')

  let doc
  if (current.trim()) {
    doc = YAML.parseDocument(current)
    if (doc.errors.length || !isMap(doc.contents))
      throw new Error('Fix the errors in the compose file first')
  }
  else {
    // The name first, as compose files usually start
    doc = new YAML.Document()
    doc.contents = YAML.createNode({ name: PLACEHOLDER, services: {} })
  }
  if (!doc.hasIn(['services']) || !isMap(doc.getIn(['services'])))
    doc.setIn(['services'], YAML.createNode({}))

  const added = []
  for (const command of commands) {
    let converted
    try {
      converted = YAML.parse(composerize(command))
    }
    catch (e) {
      throw Object.assign(new Error('This docker run command could not be read: {reason}'), { values: { reason: e.message } })
    }
    for (const [name, service] of Object.entries(converted?.services || {})) {
      let unique = name
      for (let n = 2; doc.hasIn(['services', unique]); n++)
        unique = `${name}-${n}`
      doc.setIn(['services', unique], YAML.createNode(service))
      added.push(unique)
    }
  }
  if (!added.length)
    throw Object.assign(new Error('This docker run command could not be read: {reason}'), { values: { reason: 'no service' } })
  const name = doc.getIn(['name'])
  if (!name || name === PLACEHOLDER)
    doc.setIn(['name'], projectName(added[0]))
  return { text: String(doc), added }
}

/**
 * The file as CasaOS installs it: a project name, and the x-casaos part with the main service, a title and
 * an icon when they are missing. Comments and everything else stay as written.
 */
export function prepareCompose(text) {
  const doc = YAML.parseDocument(text)
  const services = Object.keys(doc.getIn(['services'])?.toJSON?.() || {})
  const first = services[0] || 'app'
  if (!doc.getIn(['name']))
    doc.setIn(['name'], projectName(first))
  const name = String(doc.getIn(['name']))
  const main = doc.getIn(['x-casaos', 'main'])
  if (!doc.hasIn(['x-casaos']))
    doc.setIn(['x-casaos'], YAML.createNode({}))
  if (!main)
    doc.setIn(['x-casaos', 'main'], services.includes(name) ? name : first)
  if (!doc.hasIn(['x-casaos', 'title']))
    doc.setIn(['x-casaos', 'title'], YAML.createNode({ en_us: name }))
  if (!doc.hasIn(['x-casaos', 'icon']))
    doc.setIn(['x-casaos', 'icon'], `https://icon.casaos.io/main/all/${doc.getIn(['x-casaos', 'main'])}.png`)
  return String(doc)
}
