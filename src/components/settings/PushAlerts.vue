<script>
// Push alerts settings, in the settings panel. Atrio writes alerts.conf through the CasaOS file
// API; atrio-alerts (installed by scripts/install.sh) reads it every 5 minutes and sends the
// warnings to ntfy or Gotify. "Send a test" goes through the server, like the real alerts.
const STATE = '/var/lib/casaos/atrio'
const CONF = `${STATE}/alerts.conf`
const STATUS = `${STATE}/alerts-status.json`
const TEST = `${STATE}/alerts-test`
const INSTALL = 'curl -fsSL https://raw.githubusercontent.com/peppeaiello/atrio/main/scripts/install.sh | sudo bash'

const DEFAULTS = {
	ENABLED: '0',
	SERVICE: 'ntfy',
	URL: 'https://ntfy.sh',
	TOPIC: '',
	TOKEN: '',
	DISK: '1',
	HEALTH: '1',
	TEMP: '1',
	APPS: '1',
	UPDATES: '1',
}

function randomTopic() {
	const bytes = crypto.getRandomValues(new Uint8Array(9))
	return `atrio-${Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 14)}`
}

export default {
	name: 'PushAlerts',
	compatConfig: { MODE: 3 },
	data() {
		return {
			conf: { ...DEFAULTS },
			// null: still loading; false: atrio-alerts is not installed on this server
			installed: null,
			status: null,
			saving: false,
			testing: false,
			testResult: null,
			saved: false,
			install: INSTALL,
		}
	},
	computed: {
		enabled: {
			get() {
				return this.conf.ENABLED === '1'
			},
			set(value) {
				this.conf.ENABLED = value ? '1' : '0'
				this.save()
			},
		},
		isGotify() {
			return this.conf.SERVICE === 'gotify'
		},
		urlValid() {
			return /^https?:\/\/[A-Za-z0-9.:/_~%-]+$/.test(this.conf.URL)
		},
		topicValid() {
			return this.isGotify || /^[A-Za-z0-9_-]{1,64}$/.test(this.conf.TOPIC)
		},
		tokenValid() {
			return /^[A-Za-z0-9._-]{0,128}$/.test(this.conf.TOKEN) && (!this.isGotify || this.conf.TOKEN !== '')
		},
		ready() {
			return this.urlValid && this.topicValid && this.tokenValid
		},
		checks() {
			return [
				{ key: 'DISK', label: this.$t('Disk almost full') },
				{ key: 'HEALTH', label: this.$t('Disk health problems') },
				{ key: 'TEMP', label: this.$t('Processor running hot') },
				{ key: 'APPS', label: this.$t('Apps installed or removed') },
				{ key: 'UPDATES', label: this.$t('New Atrio versions') },
			]
		},
		statusText() {
			if (!this.status) return ''
			if (this.status.state === 'error') return this.$t('Last attempt failed: {message}', { message: this.status.message })
			if (this.status.state === 'ok' && this.status.last_sent) return this.$t('Last alert sent: {title}', { title: this.status.last_sent })
			if (this.status.state === 'ok') return this.$t('Checking every 5 minutes')
			return ''
		},
	},
	mounted() {
		this.load()
	},
	beforeUnmount() {
		clearTimeout(this.pollTimer)
	},
	methods: {
		async read(path) {
			try {
				const res = await this.$api.file.getContent(path)
				return res.data.success === 200 ? String(res.data.data ?? '') : null
			}
			catch (e) {
				return null
			}
		},
		async load() {
			const [conf, status] = await Promise.all([this.read(CONF), this.read(STATUS)])
			// The service writes its status on its first run, right after install.sh
			this.installed = status !== null
			try {
				this.status = status ? JSON.parse(status) : null
			}
			catch (e) {
				this.status = null
			}
			if (conf) {
				for (const line of conf.split('\n')) {
					const at = line.indexOf('=')
					const key = line.slice(0, at)
					if (at > 0 && key in DEFAULTS) this.conf[key] = line.slice(at + 1).trim()
				}
			}
		},
		setService(service) {
			if (this.conf.SERVICE === service) return
			this.conf.SERVICE = service
			// ntfy works out of the box with its public server; Gotify is always self-hosted
			if (service === 'ntfy' && !this.conf.URL) this.conf.URL = DEFAULTS.URL
			if (service === 'gotify' && this.conf.URL === DEFAULTS.URL) this.conf.URL = ''
		},
		newTopic() {
			this.conf.TOPIC = randomTopic()
		},
		text() {
			const language = (this.$i18n.locale || '').startsWith('it') ? 'it' : 'en'
			return `${Object.entries(this.conf).map(([key, value]) => `${key}=${String(value).replace(/[\r\n]/g, '')}`).join('\n')}\nLANGUAGE=${language}\n`
		},
		// Saves through the CasaOS file API; the file is created the first time
		async save() {
			if (this.conf.ENABLED === '1' && !this.ready) return false
			this.saving = true
			this.saved = false
			try {
				if ((await this.read(CONF)) === null) await this.$api.file.create(CONF)
				const res = await this.$api.file.update(CONF, this.text())
				if (res.data.success !== 200) throw new Error('save')
				this.saved = true
				return true
			}
			catch (e) {
				this.$buefy.toast.open({ message: this.$t('Could not save the push alert settings'), type: 'is-danger' })
				return false
			}
			finally {
				this.saving = false
			}
		},
		async test() {
			if (!this.ready || !(await this.save())) return
			this.testing = true
			this.testResult = null
			const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
			try {
				const temp = `${TEST}.tmp`
				await this.$api.file.create(temp)
				await this.$api.file.update(temp, token)
				const renamed = await this.$api.file.rename(temp, TEST)
				if (renamed.data.success !== 200) throw new Error('request')
			}
			catch (e) {
				this.testing = false
				this.testResult = { ok: false, message: this.$t('Could not reach the alert service on the server') }
				return
			}
			const started = Date.now()
			const poll = async () => {
				const raw = await this.read(STATUS)
				let status = null
				try {
					status = raw ? JSON.parse(raw) : null
				}
				catch (e) {
					status = null
				}
				if (status?.token === token) {
					this.status = status
					this.testing = false
					this.testResult = status.state === 'ok'
						? { ok: true, message: this.$t('Test sent: check your phone') }
						: { ok: false, message: status.message }
					return
				}
				if (Date.now() - started > 40000) {
					this.testing = false
					this.testResult = { ok: false, message: this.$t('The server did not answer') }
					return
				}
				this.pollTimer = setTimeout(poll, 1500)
			}
			this.pollTimer = setTimeout(poll, 1500)
		},
		copyInstall() {
			navigator.clipboard?.writeText(this.install)
			this.$buefy.toast.open({ message: this.$t('Copied'), type: 'is-success' })
		},
	},
}
</script>

<template>
	<section class="atrio-settings-section atrio-push">
		<h3>{{ $t('Push notifications') }}</h3>

		<p v-if="installed === false" class="atrio-push-note">
			{{ $t('The alert service is not installed on this server yet. Run the install command again on the server to add it:') }}
			<button class="atrio-push-code" type="button" :title="$t('Copy')" @click="copyInstall">{{ install }}</button>
		</p>

		<template v-else-if="installed">
			<div class="atrio-setting-row">
				<b-icon icon="bell-ring-outline" pack="mdi" size="is-20" />
				<span class="atrio-setting-label">
					{{ $t('Send alerts to my phone') }}
					<small class="atrio-setting-note">{{ $t('Even when Atrio is closed, through ntfy or Gotify') }}</small>
				</span>
				<b-switch v-model="enabled" :disabled="!ready && !enabled" class="mr-0" />
			</div>

			<div class="atrio-push-form">
				<div class="atrio-segmented" role="radiogroup" :aria-label="$t('Service')">
					<button :aria-checked="!isGotify" :class="{ 'is-active': !isGotify }" role="radio" type="button" @click="setService('ntfy')">ntfy</button>
					<button :aria-checked="isGotify" :class="{ 'is-active': isGotify }" role="radio" type="button" @click="setService('gotify')">Gotify</button>
				</div>

				<label>
					<span>{{ $t('Server') }}</span>
					<input v-model.trim="conf.URL" :placeholder="isGotify ? 'https://gotify.example.home' : 'https://ntfy.sh'" class="atrio-push-input" type="url">
					<small v-if="conf.URL && !urlValid" class="atrio-push-error">{{ $t('Enter an address that starts with http:// or https://') }}</small>
				</label>

				<label v-if="!isGotify">
					<span>{{ $t('Topic') }}</span>
					<span class="atrio-push-inline">
						<input v-model.trim="conf.TOPIC" class="atrio-push-input" placeholder="atrio-…" type="text">
						<button class="atrio-button is-small" type="button" @click="newTopic">{{ $t('Generate') }}</button>
					</span>
					<small class="atrio-push-hint">{{ $t('Anyone who knows a topic on a public server can read it: use a name that is hard to guess, or your own server. Subscribe to the same topic in the ntfy app.') }}</small>
					<small v-if="conf.TOPIC && !topicValid" class="atrio-push-error">{{ $t('Use letters, numbers, - and _ (up to 64 characters).') }}</small>
				</label>

				<label>
					<span>{{ isGotify ? $t('Application token') : $t('Access token (optional)') }}</span>
					<input v-model.trim="conf.TOKEN" autocomplete="off" class="atrio-push-input" type="password">
					<small v-if="isGotify" class="atrio-push-hint">{{ $t('Create an application in Gotify and paste its token here.') }}</small>
				</label>

				<fieldset class="atrio-push-checks">
					<legend>{{ $t('What to send') }}</legend>
					<label v-for="check in checks" :key="check.key">
						<input :checked="conf[check.key] === '1'" type="checkbox" @change="conf[check.key] = $event.target.checked ? '1' : '0'">
						{{ check.label }}
					</label>
				</fieldset>

				<div class="atrio-push-actions">
					<button :disabled="!ready || saving" class="atrio-button is-small" type="button" @click="save">
						{{ saved ? $t('Saved') : $t('Save') }}
					</button>
					<button :disabled="!ready || testing" class="atrio-button is-small is-primary" type="button" @click="test">
						{{ testing ? $t('Sending…') : $t('Send a test') }}
					</button>
				</div>
				<p v-if="testResult" :class="testResult.ok ? 'is-ok' : 'is-error'" class="atrio-push-result" role="status">{{ testResult.message }}</p>
				<p v-else-if="statusText && enabled" class="atrio-push-hint">{{ statusText }}</p>
			</div>
		</template>
	</section>
</template>

<style lang="scss">
.atrio-push {
	.atrio-push-form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.25rem 0.5rem 0.5rem;

		> label,
		.atrio-push-checks {
			display: flex;
			flex-direction: column;
			gap: 0.375rem;

			> span:first-child,
			legend {
				color: var(--atrio-text-soft);
				font-size: 0.8125rem;
				font-weight: 600;
			}
		}

		.atrio-segmented {
			align-self: flex-start;
		}
	}

	.atrio-push-input {
		width: 100%;
		height: 2.25rem;
		padding: 0 0.75rem;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 0.75rem;
		background: rgba(255, 255, 255, 0.06);
		color: var(--atrio-text);
		font: inherit;
		font-size: 0.875rem;
		outline: none;

		&:focus {
			border-color: var(--atrio-accent);
		}
	}

	.atrio-push-inline {
		display: flex;
		gap: 0.5rem;
		align-items: center;

		.atrio-button {
			flex-shrink: 0;
		}
	}

	.atrio-push-checks {
		margin: 0;
		padding: 0;
		border: 0;

		label {
			display: flex;
			gap: 0.5rem;
			align-items: center;
			color: var(--atrio-text);
			font-size: 0.875rem;
			cursor: pointer;

			input {
				accent-color: var(--atrio-accent);
			}
		}
	}

	.atrio-push-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}

	.atrio-push-hint,
	.atrio-push-note {
		color: var(--atrio-text-muted);
		font-size: 0.75rem;
		line-height: 1.4;
	}

	.atrio-push-note {
		padding: 0.25rem 0.5rem 0.5rem;
		font-size: 0.8125rem;
	}

	.atrio-push-code {
		display: block;
		width: 100%;
		margin-top: 0.5rem;
		padding: 0.5rem 0.75rem;
		border: 0;
		border-radius: 0.5rem;
		background: rgba(0, 0, 0, 0.35);
		color: var(--atrio-text);
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.75rem;
		text-align: left;
		word-break: break-all;
		cursor: copy;
	}

	.atrio-push-error {
		color: #fca5a5;
		font-size: 0.75rem;
	}

	.atrio-push-result {
		font-size: 0.8125rem;
		font-weight: 600;

		&.is-ok {
			color: #86efac;
		}

		&.is-error {
			color: #fca5a5;
		}
	}
}
</style>
