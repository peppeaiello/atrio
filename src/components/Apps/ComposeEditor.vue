<script>
// The compose file of an app as text, next to the form in the install and settings screens: every
// setting Docker Compose knows, checked as you type with the problem marked on its line, and docker run
// commands turned into services. What is written here is what CasaOS gets, see plugins/composeFile.js.
import { defineAsyncComponent } from 'vue'
import { checkCompose, fromDockerRun } from '@/plugins/composeFile'
import '@/components/files/messages.js'

export default {
  name: 'ComposeEditor',
  compatConfig: { MODE: 3 },
  components: {
    // CodeMirror is loaded only when someone opens the compose file
    CodeEditor: defineAsyncComponent(() => import('@/components/files/CodeEditor.vue')),
  },
  props: {
    modelValue: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  data() {
    return {
      // The text the editor started with; later changes come from it
      initial: this.modelValue,
      converting: false,
      command: '',
      convertError: '',
    }
  },
  computed: {
    problems() {
      // An empty file is not an error yet: Install says so if it stays empty
      if (!this.modelValue.trim())
        return []
      return checkCompose(this.modelValue).map(problem => ({
        ...problem,
        line: this.modelValue.slice(0, problem.from).split('\n').length,
        text: this.$t(problem.message, problem.values),
      }))
    },
    errors() {
      return this.problems.filter(problem => problem.severity === 'error')
    },
    warnings() {
      return this.problems.filter(problem => problem.severity === 'warning')
    },
    hasServices() {
      return /^services:\s*\n\s+\S/m.test(this.modelValue)
    },
  },
  methods: {
    check(text) {
      return checkCompose(text).map(problem => ({ from: problem.from, to: problem.to, severity: problem.severity, message: this.$t(problem.message, problem.values) }))
    },
    openConverter() {
      this.converting = true
      this.convertError = ''
      this.$nextTick(() => this.$refs.command?.focus())
    },
    // A compose file from this computer replaces the text, and can be undone
    async load(event) {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file)
        return
      if (file.size > 1024 * 1024) {
        this.$buefy.toast.open({ message: this.$t('This file is too large for a compose file'), type: 'is-danger' })
        return
      }
      const text = await file.text()
      this.$refs.editor?.replace(text)
      this.$emit('update:modelValue', text)
    },
    convert(add) {
      this.convertError = ''
      try {
        const { text, added } = fromDockerRun(this.command, add ? this.modelValue : '')
        this.$refs.editor?.replace(text)
        this.$emit('update:modelValue', text)
        this.converting = false
        this.command = ''
        this.$buefy.toast.open({ message: this.$t('Added from docker run: {services}', { services: added.join(', ') }), type: 'is-success' })
      }
      catch (e) {
        this.convertError = this.$t(e.message, e.values)
      }
    },
  },
}
</script>

<template>
  <section class="atrio-compose-editor">
    <div class="atrio-compose-bar">
      <p>{{ $t('Every setting of Docker Compose, as text. It is checked as you type, and installed or saved exactly as written.') }}</p>
      <div class="atrio-compose-actions">
        <button v-if="!converting" class="atrio-button is-small" type="button" @click="openConverter">
          <b-icon icon="console-line" pack="mdi" size="is-16" />{{ $t('From docker run') }}
        </button>
        <button class="atrio-button is-small" type="button" @click="$refs.file.click()">
          <b-icon icon="file-upload-outline" pack="mdi" size="is-16" />{{ $t('Load a file') }}
        </button>
        <input ref="file" accept=".yml,.yaml,text/yaml" hidden type="file" @change="load">
      </div>
    </div>

    <div v-if="converting" class="atrio-compose-run">
      <label for="atrio-compose-command">{{ $t('Paste one or more docker run commands, for example from the page of an image on Docker Hub or GitHub.') }}</label>
      <textarea
        id="atrio-compose-command" ref="command" v-model="command" autocapitalize="off" autocomplete="off"
        class="atrio-compose-command" placeholder="docker run -d --name=app -p 8080:80 -v /DATA/AppData/app:/config image:tag" rows="5" spellcheck="false"
      />
      <p v-if="convertError" class="atrio-compose-error" role="alert">{{ convertError }}</p>
      <div class="atrio-compose-actions">
        <button :disabled="!command.trim()" class="atrio-button is-small is-primary" type="button" @click="convert(hasServices)">
          {{ hasServices ? $t('Add to the file') : $t('Convert') }}
        </button>
        <button v-if="hasServices" :disabled="!command.trim()" class="atrio-button is-small" type="button" @click="convert(false)">{{ $t('Replace the file') }}</button>
        <button class="atrio-button is-small" type="button" @click="converting = false">{{ $t('Cancel') }}</button>
      </div>
    </div>

    <div class="atrio-compose-code">
      <CodeEditor ref="editor" :check="check" :value="initial" editable name="docker-compose.yml" @change="$emit('update:modelValue', $event)" />
    </div>

    <ul v-if="problems.length" aria-live="polite" class="atrio-compose-problems">
      <li v-for="problem in [...errors, ...warnings]" :key="`${problem.from}-${problem.message}`" :class="`is-${problem.severity}`">
        <b-icon :icon="problem.severity === 'error' ? 'alert-circle-outline' : 'alert-outline'" pack="mdi" size="is-16" />
        <span>{{ $t('Line {line}', { line: problem.line }) }}: {{ problem.text }}</span>
      </li>
    </ul>
  </section>
</template>

<style lang="scss">
.atrio-compose-editor {
  --files-text: #F8FAFC;
  --files-text-soft: #CBD5E1;
  --files-muted: #94A3B8;
  --files-border: rgba(255, 255, 255, 0.08);
  --files-border-strong: rgba(255, 255, 255, 0.12);
  --files-field: rgba(255, 255, 255, 0.06);
  --files-hover-strong: rgba(255, 255, 255, 0.11);
  --files-focus: #67E8F9;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  height: calc(100vh - 15.5rem);
  padding: 1rem 1.5rem;
  overflow-y: auto;
  color: var(--atrio-text);

  .atrio-button {
    display: inline-flex;
    gap: 0.375rem;
    align-items: center;
  }
}

.atrio-compose-bar {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;

  p {
    color: var(--atrio-text-muted);
    font-size: 0.8125rem;
  }

  .atrio-compose-actions {
    flex: none;
  }
}

.atrio-compose-run {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 0.75rem;

  label {
    color: var(--atrio-text-soft);
    font-size: 0.8125rem;
  }
}

.atrio-compose-command {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 0.5rem;
  background: rgba(0, 0, 0, 0.3);
  color: var(--atrio-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.8125rem;
  resize: vertical;
  outline: none;

  &:focus {
    border-color: var(--atrio-accent);
  }
}

.atrio-compose-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.atrio-compose-error {
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  background: rgba(248, 113, 113, 0.15);
  color: #fecaca;
  font-size: 0.8125rem;
}

.atrio-compose-code {
  display: flex;
  flex: 1 0 18rem;
  min-height: 18rem;

  > .code {
    width: 100%;
  }
}

.atrio-compose-problems {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.8125rem;

  li {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
  }

  .is-error {
    color: #fecaca;
  }

  .is-warning {
    color: #fde68a;
  }
}
</style>
