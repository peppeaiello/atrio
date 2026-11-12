// Syntax support for the text editor, loaded on demand so a file only pulls in its own language.
import { StreamLanguage } from '@codemirror/language'
import { extension } from './files.js'

function legacy(load, label) {
  return {
    label,
    load: async () => StreamLanguage.define(await load()),
  }
}
const modern = (load, label) => ({ label, load })

const languages = {
  yaml: modern(() => import('@codemirror/lang-yaml').then(m => m.yaml()), 'YAML'),
  json: modern(() => import('@codemirror/lang-json').then(m => m.json()), 'JSON'),
  js: modern(() => import('@codemirror/lang-javascript').then(m => m.javascript()), 'JavaScript'),
  ts: modern(() => import('@codemirror/lang-javascript').then(m => m.javascript({ typescript: true })), 'TypeScript'),
  python: modern(() => import('@codemirror/lang-python').then(m => m.python()), 'Python'),
  html: modern(() => import('@codemirror/lang-html').then(m => m.html()), 'HTML'),
  vue: modern(() => import('@codemirror/lang-html').then(m => m.html()), 'Vue'),
  css: modern(() => import('@codemirror/lang-css').then(m => m.css()), 'CSS'),
  markdown: modern(() => import('@codemirror/lang-markdown').then(m => m.markdown()), 'Markdown'),
  xml: modern(() => import('@codemirror/lang-xml').then(m => m.xml()), 'XML'),
  sql: modern(() => import('@codemirror/lang-sql').then(m => m.sql()), 'SQL'),
  shell: legacy(() => import('@codemirror/legacy-modes/mode/shell').then(m => m.shell), 'Shell'),
  toml: legacy(() => import('@codemirror/legacy-modes/mode/toml').then(m => m.toml), 'TOML'),
  properties: legacy(() => import('@codemirror/legacy-modes/mode/properties').then(m => m.properties), 'INI'),
  nginx: legacy(() => import('@codemirror/legacy-modes/mode/nginx').then(m => m.nginx), 'Nginx'),
  dockerfile: legacy(() => import('@codemirror/legacy-modes/mode/dockerfile').then(m => m.dockerFile), 'Dockerfile'),
  go: legacy(() => import('@codemirror/legacy-modes/mode/go').then(m => m.go), 'Go'),
  rust: legacy(() => import('@codemirror/legacy-modes/mode/rust').then(m => m.rust), 'Rust'),
  lua: legacy(() => import('@codemirror/legacy-modes/mode/lua').then(m => m.lua), 'Lua'),
  ruby: legacy(() => import('@codemirror/legacy-modes/mode/ruby').then(m => m.ruby), 'Ruby'),
  perl: legacy(() => import('@codemirror/legacy-modes/mode/perl').then(m => m.perl), 'Perl'),
  r: legacy(() => import('@codemirror/legacy-modes/mode/r').then(m => m.r), 'R'),
  swift: legacy(() => import('@codemirror/legacy-modes/mode/swift').then(m => m.swift), 'Swift'),
  diff: legacy(() => import('@codemirror/legacy-modes/mode/diff').then(m => m.diff), 'Diff'),
  powershell: legacy(() => import('@codemirror/legacy-modes/mode/powershell').then(m => m.powerShell), 'PowerShell'),
  cmake: legacy(() => import('@codemirror/legacy-modes/mode/cmake').then(m => m.cmake), 'Makefile'),
  latex: legacy(() => import('@codemirror/legacy-modes/mode/stex').then(m => m.stex), 'LaTeX'),
  c: legacy(() => import('@codemirror/legacy-modes/mode/clike').then(m => m.c), 'C'),
  cpp: legacy(() => import('@codemirror/legacy-modes/mode/clike').then(m => m.cpp), 'C++'),
  csharp: legacy(() => import('@codemirror/legacy-modes/mode/clike').then(m => m.csharp), 'C#'),
  java: legacy(() => import('@codemirror/legacy-modes/mode/clike').then(m => m.java), 'Java'),
  kotlin: legacy(() => import('@codemirror/legacy-modes/mode/clike').then(m => m.kotlin), 'Kotlin'),
}

const byExtension = {
  yaml: 'yaml',
  yml: 'yaml',
  json: 'json',
  jsonld: 'json',
  js: 'js',
  mjs: 'js',
  cjs: 'js',
  ts: 'ts',
  py: 'python',
  html: 'html',
  htm: 'html',
  vue: 'vue',
  css: 'css',
  less: 'css',
  scss: 'css',
  sass: 'css',
  md: 'markdown',
  xml: 'xml',
  sql: 'sql',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  env: 'shell',
  rc: 'shell',
  toml: 'toml',
  ini: 'properties',
  cfg: 'properties',
  conf: 'properties',
  config: 'properties',
  service: 'properties',
  dockerfile: 'dockerfile',
  go: 'go',
  rs: 'rust',
  lua: 'lua',
  rb: 'ruby',
  pl: 'perl',
  r: 'r',
  swift: 'swift',
  diff: 'diff',
  patch: 'diff',
  bat: 'powershell',
  makefile: 'cmake',
  tex: 'latex',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cs: 'csharp',
  java: 'java',
  kt: 'kotlin',
}

// The language of a file name, as { id, label, load() }, or null for plain text.
export function languageFor(name) {
  const lower = name.toLowerCase()
  let id = byExtension[extension(name)]
  if (/^nginx.*\.conf$/.test(lower) || lower.includes('.nginx'))
    id = 'nginx'
  else if (lower.startsWith('dockerfile') || lower.endsWith('.dockerfile'))
    id = 'dockerfile'
  else if (lower === 'makefile')
    id = 'cmake'
  return id ? { id, ...languages[id] } : null
}
