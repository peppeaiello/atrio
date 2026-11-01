<script setup>
import { getCurrentInstance, reactive, ref } from 'vue'
import FilesDialog from './FilesDialog.vue'
import { connectNetworkFolder, errorMessage, parseSmbHost } from './files.js'

const emit = defineEmits(['close', 'connected'])

const vm = getCurrentInstance().proxy
const t = key => vm.$t(`files.${key}`)

const form = reactive({ address: '', guest: false, username: '', password: '' })
const errors = reactive({ address: '', username: '', password: '' })
const failure = ref('')
const busy = ref(false)

function validate() {
  const host = parseSmbHost(form.address)
  errors.address = !form.address.trim() ? t('hostEmpty') : host ? '' : t('hostInvalid')
  errors.username = !form.guest && !form.username.trim() ? t('userEmpty') : ''
  errors.password = !form.guest && !form.password ? t('passwordEmpty') : ''
  return errors.address || errors.username || errors.password ? '' : host
}

async function submit() {
  if (busy.value)
    return
  failure.value = ''
  const host = validate()
  if (!host)
    return
  busy.value = true
  try {
    const result = await connectNetworkFolder({ host, username: form.username.trim(), password: form.password, guest: form.guest })
    emit('connected', result?.mount_point || '')
  }
  catch (e) {
    failure.value = errorMessage(e)
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <FilesDialog :title="$t('files.smbTitle')" @close="emit('close')">
    <form class="form" novalidate @submit.prevent="submit">
      <label class="field">
        <span>{{ $t('files.serverAddress') }}</span>
        <input
          v-model="form.address" :aria-invalid="errors.address ? 'true' : 'false'" aria-describedby="files-smb-hint" autocapitalize="off"
          autocomplete="off" placeholder="smb://192.168.1.10" spellcheck="false" @input="errors.address = ''"
        >
      </label>
      <p v-if="errors.address" class="field__error" role="alert">
        {{ errors.address }}
      </p>
      <p id="files-smb-hint" class="hint">
        {{ $t('files.serverHint') }}
      </p>

      <label class="switch">
        <input v-model="form.guest" type="checkbox">
        <span class="switch__track" aria-hidden="true"><span class="switch__thumb" /></span>
        <span>{{ $t('files.guest') }}</span>
      </label>

      <template v-if="!form.guest">
        <label class="field">
          <span>{{ $t('files.username') }}</span>
          <input
            v-model="form.username" :aria-invalid="errors.username ? 'true' : 'false'" autocapitalize="off" autocomplete="off"
            spellcheck="false" @input="errors.username = ''"
          >
        </label>
        <p v-if="errors.username" class="field__error" role="alert">
          {{ errors.username }}
        </p>
        <label class="field">
          <span>{{ $t('files.password') }}</span>
          <input
            v-model="form.password" :aria-invalid="errors.password ? 'true' : 'false'" autocomplete="new-password" type="password"
            @input="errors.password = ''"
          >
        </label>
        <p v-if="errors.password" class="field__error" role="alert">
          {{ errors.password }}
        </p>
      </template>

      <p v-if="failure" class="field__error" role="alert">
        {{ failure }}
      </p>
      <!-- Lets Enter submit from any field -->
      <button class="sr-only" tabindex="-1" type="submit" />
    </form>

    <template #actions>
      <button class="btn" type="button" @click="emit('close')">
        {{ $t('files.cancel') }}
      </button>
      <button :disabled="busy" class="btn btn--primary" type="button" @click="submit">
        {{ $t('files.connect') }}
      </button>
    </template>
  </FilesDialog>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--files-muted);
}

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

.field input:focus {
  border-color: var(--files-focus);
}

.field input[aria-invalid='true'] {
  border-color: #FDA4AF;
}

.field__error {
  margin: 0;
  color: #FDA4AF;
  font-size: 13px;
}

.hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--files-muted);
}

.switch {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  margin-top: 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--files-text);
  cursor: pointer;
}

.switch input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}

.switch__track {
  position: relative;
  flex-shrink: 0;
  width: 40px;
  height: 24px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  transition: background-color 0.15s ease;
}

.switch__thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #F8FAFC;
  transition: transform 0.15s ease;
}

.switch input:checked + .switch__track {
  background: #6366F1;
}

.switch input:checked + .switch__track .switch__thumb {
  transform: translateX(16px);
}

.switch input:focus-visible + .switch__track {
  outline: 2px solid var(--files-focus);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .switch__track,
  .switch__thumb {
    transition: none;
  }
}
</style>
