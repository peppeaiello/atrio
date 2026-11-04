<script>
// The Backup tab of the app panel: choose what to save, make a backup, go back to one.
// The work runs on the server, see plugins/appBackup.js.
import { renderSize } from '@/mixins/file_utils'
import { backupApp, backupRun, backupsInstalled, deleteBackup, escapeHtml, loadIndex, restoreApp, saveDestination, scanApp } from '@/plugins/appBackup'

const INSTALL = 'curl -fsSL https://raw.githubusercontent.com/peppeaiello/atrio/main/scripts/install.sh | sudo bash'
const STEPS = {
	scanning: 'Measuring the folders…',
	preparing: 'Getting ready…',
	checking: 'Checking…',
	stopping: 'Stopping the app…',
	archiving: 'Saving the files…',
	restoring: 'Putting the files back…',
	starting: 'Starting the app…',
}

export default {
	name: 'AppBackups',
	compatConfig: { MODE: 3 },
	props: {
		app: { type: String, required: true },
		title: { type: String, default: '' },
	},
	emits: ['changed'],
	data() {
		return {
			installed: null,
			index: null,
			selected: [],
			dest: '',
			error: '',
			install: INSTALL,
			run: backupRun,
		}
	},
	computed: {
		busy() {
			return Boolean(this.run.app)
		},
		mine() {
			return this.run.app === this.app
		},
		stepText() {
			return this.mine ? this.$t(STEPS[this.run.step] || 'Getting ready…') : ''
		},
		folders() {
			return this.index?.folders || []
		},
		backups() {
			return this.index?.backups || []
		},
		chosenSize() {
			return this.folders.filter((folder) => this.selected.includes(folder.path) && folder.size > 0).reduce((sum, folder) => sum + folder.size, 0)
		},
		destChanged() {
			return Boolean(this.index) && this.dest.trim() !== '' && this.dest.trim() !== this.index.dest
		},
	},
	watch: {
		app() {
			this.load()
		},
	},
	mounted() {
		this.load()
	},
	methods: {
		renderSize,
		applyIndex(index) {
			this.index = index
			if (!index) return
			this.selected = index.folders.filter((folder) => folder.selected).map((folder) => folder.path)
			this.dest = index.dest
		},
		async load() {
			const app = this.app
			this.error = ''
			this.index = null
			this.installed = await backupsInstalled()
			if (!this.installed) return
			// The last known list right away, measured again in the background
			this.applyIndex(await loadIndex(app))
			if (this.busy) return
			try {
				await scanApp(app)
				if (app === this.app) this.applyIndex(await loadIndex(app))
			}
			catch (e) {
				this.error = this.$t(e.message)
			}
		},
		async act(work) {
			this.error = ''
			try {
				await work()
				this.applyIndex(await loadIndex(this.app))
				this.$emit('changed')
				return true
			}
			catch (e) {
				this.error = this.$t(e.message)
				this.applyIndex(await loadIndex(this.app))
				return false
			}
		},
		async create() {
			if (await this.act(() => backupApp(this.app, this.selected))) {
				this.$buefy.toast.open({ message: this.$t('Backup of {title} saved', { title: this.title }), type: 'is-success' })
			}
		},
		restore(backup) {
			this.$buefy.dialog.confirm({
				title: this.$t('Go back to this backup?'),
				message: this.$t('{title} stops, and its settings and the folders in this backup return to {time}. Changes made since then are replaced. A copy of the current state is saved first, so you can undo this.', { title: escapeHtml(this.title), time: this.when(backup.time) }),
				confirmText: this.$t('Restore'),
				cancelText: this.$t('Cancel'),
				type: 'is-danger',
				onConfirm: async () => {
					if (await this.act(() => restoreApp(this.app, backup.id))) {
						this.$buefy.toast.open({ message: this.$t('{title} is back to the backup of {time}', { title: this.title, time: this.when(backup.time) }), type: 'is-success', duration: 6000 })
					}
				},
			})
		},
		remove(backup) {
			this.$buefy.dialog.confirm({
				title: this.$t('Delete this backup?'),
				message: this.$t('The backup of {time} is deleted for good.', { time: this.when(backup.time) }),
				confirmText: this.$t('Delete'),
				cancelText: this.$t('Cancel'),
				type: 'is-danger',
				onConfirm: () => this.act(() => deleteBackup(this.app, backup.id)),
			})
		},
		async changeDest() {
			await this.act(async () => {
				await saveDestination(this.dest.trim())
				await scanApp(this.app)
			})
		},
		when(time) {
			const date = new Date(time)
			return Number.isNaN(date.getTime()) ? time : date.toLocaleString(this.$i18n.locale?.replace('_', '-'), { dateStyle: 'medium', timeStyle: 'short' })
		},
		reason(backup) {
			return { 'before-update': this.$t('Before an update'), 'before-restore': this.$t('Before a restore') }[backup.reason] || ''
		},
		copyInstall() {
			navigator.clipboard?.writeText(this.install)
		},
	},
}
</script>

<template>
	<section id="atrio-tabpanel-backup" aria-labelledby="atrio-tab-backup" class="atrio-backups" role="tabpanel">
		<p v-if="installed === null" class="atrio-config-empty">{{ $t('Loading…') }}</p>

		<template v-else-if="!installed">
			<p>{{ $t('Backups need a small service on the server. Run this once on the machine with CasaOS, then reload the page:') }}</p>
			<div class="atrio-backups-install">
				<code>{{ install }}</code>
				<button class="atrio-button is-small" type="button" @click="copyInstall">{{ $t('Copy') }}</button>
			</div>
		</template>

		<template v-else>
			<p v-if="error" class="atrio-backups-error" role="alert">{{ error }}</p>

			<div class="atrio-config-head">
				<p>{{ $t('Saves the settings of this app and the folders chosen below. The app stops while it runs.') }}</p>
				<button :disabled="busy || !index" class="atrio-button is-small" type="button" @click="create">{{ $t('Create backup') }}</button>
			</div>
			<p v-if="mine" aria-live="polite" class="atrio-backups-step">{{ stepText }}</p>
			<p v-else-if="busy" class="atrio-backups-step">{{ $t('Another backup is in progress') }}</p>

			<h4>{{ $t('What to save') }}</h4>
			<p v-if="!index" class="atrio-config-empty">{{ $t('Loading…') }}</p>
			<p v-else-if="!folders.length" class="atrio-config-empty">{{ $t('This app uses no folders of its own: only its settings are saved.') }}</p>
			<ul v-else class="atrio-backups-folders">
				<li v-for="folder in folders" :key="folder.path">
					<label>
						<input v-model="selected" :disabled="busy" :value="folder.path" type="checkbox">
						<span class="is-mono">{{ folder.path }}</span>
						<small>{{ folder.size >= 0 ? renderSize(folder.size) : $t('Size unknown') }}</small>
					</label>
					<small v-if="!folder.own" class="atrio-backups-note">{{ $t('Outside the app\'s data, or used by other apps too: restoring replaces it for them as well.') }}</small>
				</li>
			</ul>
			<p v-if="folders.length" class="atrio-backups-total">{{ $t('Selected: {size}', { size: renderSize(chosenSize) }) }}</p>

			<h4>{{ $t('Saved backups') }}</h4>
			<p v-if="index && !backups.length" class="atrio-config-empty">{{ $t('No backups yet') }}</p>
			<ul v-else class="atrio-backups-list">
				<li v-for="backup in backups" :key="backup.id">
					<div>
						<strong>{{ when(backup.time) }}</strong>
						<small>{{ [reason(backup), renderSize(backup.size), backup.images].filter(Boolean).join(' · ') }}</small>
					</div>
					<div class="atrio-backups-actions">
						<button :disabled="busy" class="atrio-button is-small" type="button" @click="restore(backup)">{{ $t('Restore') }}</button>
						<button :aria-label="$t('Delete')" :disabled="busy" class="atrio-button is-small" type="button" @click="remove(backup)">
							<b-icon icon="trash-outline" pack="casa" size="is-16" />
						</button>
					</div>
				</li>
			</ul>

			<h4>{{ $t('Backup folder') }}</h4>
			<div class="atrio-backups-dest">
				<input v-model="dest" :aria-label="$t('Backup folder')" :disabled="busy" class="is-mono" spellcheck="false" type="text">
				<button :disabled="busy || !destChanged" class="atrio-button is-small" type="button" @click="changeDest">{{ $t('Save') }}</button>
			</div>
			<p v-if="index?.same_disk" class="atrio-backups-note">{{ $t('This folder is on the same disk as your apps: backups protect from mistakes and bad updates, not from a broken disk. Use a folder on another disk to be safe.') }}</p>
			<p v-if="index" class="atrio-backups-note">{{ $t('Free space: {size}', { size: renderSize(index.free) }) }}</p>
		</template>
	</section>
</template>

<style lang="scss">
.atrio-backups {
	h4 {
		margin: 1.25rem 0 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.is-mono {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.8125rem;
		word-break: break-all;
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	small {
		color: var(--atrio-text-muted);
		font-size: 0.75rem;
	}
}

.atrio-backups-step {
	margin-top: 0.5rem;
	color: var(--atrio-text-soft);
	font-size: 0.875rem;
}

.atrio-backups-error {
	margin-bottom: 0.75rem;
	padding: 0.5rem 0.75rem;
	border-radius: 0.5rem;
	background: rgba(248, 113, 113, 0.15);
	color: #fecaca;
	font-size: 0.875rem;
}

.atrio-backups-note {
	display: block;
	margin-top: 0.375rem;
	color: var(--atrio-text-muted);
	font-size: 0.75rem;
}

.atrio-backups-folders li {
	padding: 0.5rem 0;
	border-bottom: 1px solid rgba(255, 255, 255, 0.06);

	label {
		display: flex;
		gap: 0.5rem;
		align-items: baseline;
		cursor: pointer;
	}

	small:not(.atrio-backups-note) {
		flex: none;
		margin-left: auto;
	}
}

.atrio-backups-total {
	margin-top: 0.5rem;
	color: var(--atrio-text-soft);
	font-size: 0.8125rem;
}

.atrio-backups-list li {
	display: flex;
	gap: 0.75rem;
	align-items: center;
	justify-content: space-between;
	padding: 0.625rem 0;
	border-bottom: 1px solid rgba(255, 255, 255, 0.06);

	> div:first-child {
		min-width: 0;
	}

	strong {
		display: block;
		color: inherit;
		font-size: 0.875rem;
	}

	small {
		display: block;
		word-break: break-word;
	}
}

.atrio-backups-actions {
	display: flex;
	flex: none;
	gap: 0.375rem;
}

.atrio-backups-dest {
	display: flex;
	gap: 0.5rem;

	input {
		flex: 1;
		min-width: 0;
		padding: 0.375rem 0.625rem;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 0.5rem;
		background: rgba(255, 255, 255, 0.06);
		color: inherit;
	}
}

.atrio-backups-install {
	display: flex;
	gap: 0.5rem;
	align-items: center;
	margin-top: 0.75rem;

	code {
		flex: 1;
		min-width: 0;
		padding: 0.5rem;
		border-radius: 0.5rem;
		background: rgba(0, 0, 0, 0.3);
		color: inherit;
		font-size: 0.75rem;
		word-break: break-all;
	}
}
</style>
