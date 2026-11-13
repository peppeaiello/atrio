<script>
// Settings file, in the settings panel: everything needed to set Atrio up again on a new machine,
// in one file encrypted with a password. The work runs on the server, see plugins/appBackup.js.
import { backupRun, backupsInstalled, escapeHtml, exportSettings, importSettings } from '@/plugins/appBackup'

const INSTALL = 'curl -fsSL https://raw.githubusercontent.com/peppeaiello/atrio/main/scripts/install.sh | sudo bash'
const MAX_FILE = 4 * 1024 * 1024
const OTHER_KEY = 'This server already has its own backup key'

export default {
	name: 'SettingsBackup',
	compatConfig: { MODE: 3 },
	data() {
		return {
			installed: null,
			mode: '',
			password: '',
			confirm: '',
			file: null,
			working: false,
			error: '',
			install: INSTALL,
			run: backupRun,
		}
	},
	computed: {
		canExport() {
			return this.password.length >= 8 && this.password === this.confirm && !this.working && !this.run.app
		},
		canImport() {
			return Boolean(this.file) && this.password.length > 0 && !this.working && !this.run.app
		},
	},
	async mounted() {
		this.installed = await backupsInstalled()
	},
	methods: {
		open(mode) {
			this.mode = this.mode === mode ? '' : mode
			this.password = ''
			this.confirm = ''
			this.file = null
			this.error = ''
		},
		message(e) {
			// A service older than 0.1.18 does not know these requests
			return e.message === 'Unknown request'
				? this.$t('This needs the latest version of the service on the server. Run the install command once more.')
				: this.$t(e.message)
		},
		async download() {
			this.working = true
			this.error = ''
			try {
				const text = await exportSettings(this.password)
				const url = URL.createObjectURL(new Blob([text], { type: 'application/octet-stream' }))
				const link = document.createElement('a')
				link.href = url
				link.download = `atrio-settings-${new Date().toISOString().slice(0, 10)}.atrio`
				document.body.appendChild(link)
				link.click()
				link.remove()
				setTimeout(() => URL.revokeObjectURL(url), 10000)
				this.$buefy.toast.open({ message: this.$t('Settings file downloaded. Keep it, and its password, somewhere other than this server.'), type: 'is-success', duration: 8000 })
				this.open('')
			}
			catch (e) {
				this.error = this.message(e)
			}
			finally {
				this.working = false
			}
		},
		pick(event) {
			this.file = event.target.files?.[0] || null
			this.error = ''
		},
		askLoad() {
			this.$buefy.dialog.confirm({
				title: this.$t('Load these settings?'),
				message: this.$t('The dashboard, push alerts, backup folder and automatic backups of this server are replaced by the ones in {name}. Apps and their data are not touched.', { name: escapeHtml(this.file.name) }),
				confirmText: this.$t('Load'),
				cancelText: this.$t('Cancel'),
				onConfirm: () => this.load(false),
			})
		},
		async load(replaceKey) {
			if (this.file.size > MAX_FILE) {
				this.error = this.$t('This is not an Atrio settings file')
				return
			}
			this.working = true
			this.error = ''
			try {
				await importSettings(await this.file.text(), this.password, replaceKey)
				this.$buefy.toast.open({ message: this.$t('Settings loaded. The page reloads…'), type: 'is-success' })
				setTimeout(() => window.location.reload(), 1500)
			}
			catch (e) {
				if (e.message === OTHER_KEY) {
					this.$buefy.dialog.confirm({
						title: this.$t('Replace the backup key?'),
						message: this.$t('This server already has a backup key, different from the one in the file. With the key from the file, the backups made on the old server can be restored here; backups made on this server until now need its current key, which is kept on the server in a file named backup.key.replaced.'),
						confirmText: this.$t('Replace the key'),
						cancelText: this.$t('Cancel'),
						type: 'is-danger',
						onConfirm: () => this.load(true),
					})
				}
				else {
					this.error = this.message(e)
				}
			}
			finally {
				this.working = false
			}
		},
		copyInstall() {
			navigator.clipboard?.writeText(this.install)
			this.$buefy.toast.open({ message: this.$t('Copied'), type: 'is-success' })
		},
	},
}
</script>

<template>
	<section class="atrio-settings-section atrio-settings-file">
		<h3>{{ $t('Settings file') }}</h3>

		<p v-if="installed === false" class="atrio-settings-file-note">
			{{ $t('This needs the backup service on the server. Run the install command on the server to add it:') }}
			<button class="atrio-settings-file-code" type="button" :title="$t('Copy')" @click="copyInstall">{{ install }}</button>
		</p>

		<template v-else-if="installed">
			<p class="atrio-settings-file-note">
				{{ $t('One file with the dashboard, the push alerts, the backup folder and automatic backups, and the backup key: on a new machine, install CasaOS and Atrio, load it here, then restore your apps from their backups. It is encrypted with a password you choose, and cannot be opened without it.') }}
			</p>

			<div class="atrio-setting-row">
				<b-icon icon="download-outline" pack="mdi" size="is-20" />
				<span class="atrio-setting-label">{{ $t('Save the settings to a file') }}</span>
				<button :disabled="working" class="atrio-button is-small" type="button" @click="open('export')">{{ $t('Save') }}</button>
			</div>
			<form v-if="mode === 'export'" class="atrio-settings-file-form" @submit.prevent="download">
				<label>
					<span>{{ $t('Password') }}</span>
					<input v-model="password" autocomplete="new-password" class="atrio-settings-file-input" minlength="8" type="password">
				</label>
				<label>
					<span>{{ $t('Password again') }}</span>
					<input v-model="confirm" autocomplete="new-password" class="atrio-settings-file-input" type="password">
				</label>
				<small v-if="password && password.length < 8" class="atrio-settings-file-note">{{ $t('At least 8 characters') }}</small>
				<small v-else-if="confirm && password !== confirm" class="atrio-settings-file-note">{{ $t('The two passwords are different') }}</small>
				<small class="atrio-settings-file-note">{{ $t('The file holds the backup key and the push service token: keep it somewhere other than this server, with its password.') }}</small>
				<div class="atrio-settings-file-actions">
					<button :disabled="!canExport" class="atrio-button is-small is-primary" type="submit">{{ working ? $t('Saving…') : $t('Download') }}</button>
					<button class="atrio-button is-small" type="button" @click="open('')">{{ $t('Cancel') }}</button>
				</div>
			</form>

			<div class="atrio-setting-row">
				<b-icon icon="upload-outline" pack="mdi" size="is-20" />
				<span class="atrio-setting-label">{{ $t('Load settings from a file') }}</span>
				<button :disabled="working" class="atrio-button is-small" type="button" @click="open('import')">{{ $t('Load') }}</button>
			</div>
			<form v-if="mode === 'import'" class="atrio-settings-file-form" @submit.prevent="askLoad">
				<label>
					<span>{{ $t('File') }}</span>
					<input accept=".atrio,.txt" class="atrio-settings-file-input" type="file" @change="pick">
				</label>
				<label>
					<span>{{ $t('Password') }}</span>
					<input v-model="password" autocomplete="current-password" class="atrio-settings-file-input" type="password">
				</label>
				<div class="atrio-settings-file-actions">
					<button :disabled="!canImport" class="atrio-button is-small is-primary" type="submit">{{ working ? $t('Loading…') : $t('Load') }}</button>
					<button class="atrio-button is-small" type="button" @click="open('')">{{ $t('Cancel') }}</button>
				</div>
			</form>

			<p v-if="run.app && !working" class="atrio-settings-file-note">{{ $t('Another backup is in progress') }}</p>
			<p v-if="error" class="atrio-settings-file-error" role="alert">{{ error }}</p>
		</template>
	</section>
</template>

<style lang="scss">
.atrio-settings-file {
	.atrio-settings-file-note {
		display: block;
		padding: 0 0.5rem 0.5rem;
		color: var(--atrio-text-muted);
		font-size: 0.75rem;
		line-height: 1.4;
	}

	.atrio-settings-file-code {
		display: block;
		width: 100%;
		margin-top: 0.5rem;
		padding: 0.5rem 0.75rem;
		border: 0;
		border-radius: 0.5rem;
		background: rgba(0, 0, 0, 0.35);
		color: inherit;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.75rem;
		text-align: left;
		word-break: break-all;
		cursor: pointer;
	}

	.atrio-settings-file-form {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		padding: 0.25rem 0.5rem 0.75rem 2.75rem;

		> label {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
			font-size: 0.75rem;

			> span {
				color: var(--atrio-text-muted);
			}
		}

		.atrio-settings-file-note {
			padding: 0;
		}
	}

	.atrio-settings-file-input {
		width: 100%;
		min-height: 2.25rem;
		padding: 0.375rem 0.75rem;
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

	.atrio-settings-file-actions {
		display: flex;
		gap: 0.5rem;
	}

	.atrio-settings-file-error {
		margin: 0.25rem 0.5rem 0.5rem;
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		background: rgba(248, 113, 113, 0.15);
		color: #fecaca;
		font-size: 0.8125rem;
	}
}
</style>
