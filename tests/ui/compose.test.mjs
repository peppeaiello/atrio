// The compose file checks and the docker run converter (src/plugins/composeFile.js), run with Node:
//   pnpm test:ui        or        node --test tests/ui
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkCompose, composeIsValid, fromDockerRun, prepareCompose } from '../../src/plugins/composeFile.js'

const messages = text => checkCompose(text).map(p => p.message)
const lineOf = (text, problem) => text.slice(0, problem.from).split('\n').length

const GOOD = `name: jelly
services:
  jelly:
    image: jellyfin/jellyfin:10.10
    restart: unless-stopped
    ports:
      - "8096:8096"
      - 127.0.0.1:7359:7359/udp
      - target: 1900
        published: 1900
        protocol: udp
    volumes:
      - /DATA/AppData/jelly/config:/config
      - /DATA/Media:/media:ro
      - cache:/cache
    environment:
      - TZ=Europe/Rome
volumes:
  cache: {}
`

test('a good file has no problems', () => {
  assert.deepEqual(checkCompose(GOOD), [])
  assert.ok(composeIsValid(GOOD))
})

test('broken YAML is reported on its line', () => {
  const text = 'services:\n  web:\n    image: [nginx\n'
  const [problem, ...rest] = checkCompose(text)
  assert.equal(rest.length, 0)
  assert.equal(problem.message, 'This is not valid YAML: {reason}')
})

test('an empty file and a file without services', () => {
  assert.deepEqual(messages(''), ['The compose file is empty'])
  assert.deepEqual(messages('name: x\n'), ['The file needs a services section with at least one service'])
  assert.deepEqual(messages('- a\n- b\n'), ['A compose file is a list of settings, starting with services:'])
})

test('a service needs an image', () => {
  const text = 'services:\n  web:\n    build: .\n'
  const [problem] = checkCompose(text)
  assert.equal(problem.message, 'The service {name} has no image: CasaOS installs apps from images and cannot build one')
  assert.equal(lineOf(text, problem), 3)
})

test('bad ports, and a host port used twice', () => {
  const text = 'services:\n  a:\n    image: x\n    ports:\n      - "99999:80"\n      - "8080:80"\n  b:\n    image: y\n    ports:\n      - 8080:81\n'
  const found = checkCompose(text)
  assert.deepEqual(found.map(p => p.message), ['{port} is not a valid port mapping', 'Port {port} is used twice in this file'])
  assert.equal(lineOf(text, found[1]), 10)
  assert.deepEqual(messages('services:\n  a:\n    image: x\n    ports:\n      - "53:53/udp"\n      - "53:53/tcp"\n'), [])
  assert.deepEqual(messages('services:\n  a:\n    image: x\n    ports: 80\n'), ['ports is a list, one port per line starting with -'])
})

test('volumes: relative paths warn, undeclared names and bad targets are errors', () => {
  const found = checkCompose('services:\n  a:\n    image: x\n    volumes:\n      - ./data:/data\n      - stuff:/stuff\n      - /DATA/x:data\n      - /DATA/y:/y:bad\n')
  assert.deepEqual(found.map(p => [p.severity, p.message.slice(0, 20)]), [
    ['warning', '{folder} is not a fu'],
    ['error', 'The volume {volume} '],
    ['error', '{volume} is not a va'],
    ['error', '{volume} is not a va'],
  ])
  assert.ok(composeIsValid('services:\n  a:\n    image: x\n    volumes:\n      - ./data:/data\n'))
})

test('restart, environment, names and x-casaos main', () => {
  assert.deepEqual(messages('services:\n  a:\n    image: x\n    restart: sometimes\n'), ['restart can be no, always, unless-stopped or on-failure'])
  assert.deepEqual(messages('services:\n  a:\n    image: x\n    restart: on-failure:3\n'), [])
  assert.deepEqual(messages('services:\n  a:\n    image: x\n    environment:\n      A:\n        b: c\n'), ['The value of {key} must be plain text, a number or true/false'])
  assert.deepEqual(messages('name: My App\nservices:\n  a:\n    image: x\n'), ['The name {name} cannot be used: only lowercase letters, numbers, - and _'])
  assert.deepEqual(messages('services:\n  a:\n    image: x\nx-casaos:\n  main: b\n'), ['x-casaos main names a service that is not in this file'])
})

test('docker run becomes a service, with continued lines and sudo', () => {
  const { text, added } = fromDockerRun('sudo docker run -d \\\n  --name=jelly \\\n  -p 8096:8096 \\\n  -v /DATA/Media:/media:ro \\\n  --restart unless-stopped \\\n  jellyfin/jellyfin:latest')
  assert.deepEqual(added, ['jellyfin'])
  assert.match(text, /^name: jellyfin$/m)
  assert.match(text, /image: jellyfin\/jellyfin:latest/)
  assert.match(text, /\/DATA\/Media:\/media:ro/)
  assert.doesNotMatch(text, /your project name/)
  assert.ok(composeIsValid(text))
})

test('several commands, added to a file and keeping its comments', () => {
  const current = '# my stack\nname: stack\nservices:\n  redis:\n    image: redis:7 # pinned\n'
  const { text, added } = fromDockerRun('docker run -d redis:8\ndocker run -d -p 80:80 nginx', current)
  assert.deepEqual(added, ['redis-2', 'nginx'])
  assert.match(text, /# my stack/)
  assert.match(text, /# pinned/)
  assert.match(text, /^name: stack$/m)
  assert.ok(composeIsValid(text))
})

test('what is not docker run is refused', () => {
  assert.throws(() => fromDockerRun('ls -la'), /start with docker run/)
  assert.throws(() => fromDockerRun('docker run -d nginx', 'services: ['), /Fix the errors/)
})

test('prepareCompose adds what CasaOS needs and keeps the rest', () => {
  const text = prepareCompose('# keep me\nservices:\n  web:\n    image: nginx\n')
  assert.match(text, /# keep me/)
  assert.match(text, /^name: web$/m)
  assert.match(text, /main: web/)
  assert.match(text, /en_us: web/)
  assert.match(text, /icon: https:\/\/icon.casaos.io\/main\/all\/web.png/)
  const kept = prepareCompose('name: shop\nservices:\n  db:\n    image: x\n  shop:\n    image: y\nx-casaos:\n  title:\n    en_us: My Shop\n')
  assert.match(kept, /main: shop/)
  assert.match(kept, /en_us: My Shop/)
})

test('a new file from docker run starts with its name', () => {
  const { text } = fromDockerRun('docker run -d nginx')
  assert.match(text, /^name: nginx\nservices:/)
})
