<script>
// The Backup tab of the app panel: choose what to save, make a backup, go back to one.
// The work runs on the server, see plugins/appBackup.js.
import { renderSize } from '@/mixins/file_utils'
import FilesIcon from '@/components/files/FilesIcon.vue'
import { errorMessage, listFolder, listLocations, parentPath } from '@/components/files/files.js'
import '@/components/files/messages.js'
import { backupApp, backupKey, backupRun, backupsInstalled, deleteBackup, escapeHtml, forgetFolder, loadIndex, restoreApp, saveDestination, saveSchedule, scanApp } from '@/plugins/appBackup'

const INSTALL = 'curl -fsSL https://raw.githubusercontent.com/peppeaiello/atrio/main/scripts/install.sh | sudo bash'
const STEPS = {
	scanning: 'Measuring the folders…',
	preparing: 'Getting ready…',
	checking: 'Checking…',
	stopping: 'Stopping the app…',
	archiving: 'Saving the files…',
	uploading: 'Sending the backup to its folder…',
	downloading: 'Getting the backup from its folder…',
	restoring: 'Putting the files back…',
	starting: 'Starting the app…',
	waiting: 'Waiting for an automatic backup to finish…',
}
const NO_PLAN = { every: 'off', time: '03:00', day: 1, keep: 7 }

export default {
	name: 'AppBackups',
	compatConfig: { MODE: 3 },
	components: { FilesIcon },
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
			error: '',
			key: '',
			picking: false,
			pickDir: '',
			pickFolders: [],
			pickLoading: false,
			pickError: '',
			places: [],
			install: INSTALL,
			run: backupRun,
			plan: { ...NO_PLAN },
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
		isDefaultDest() {
			return this.index?.dest === this.index?.default_dest
		},
		connected() {
			return this.index?.connected !== false
		},
		schedule() {
			return this.index?.schedule || null
		},
		savedPlan() {
			const saved = this.schedule
			return saved ? { every: saved.every, time: saved.time, day: saved.day, keep: saved.keep } : { ...NO_PLAN }
		},
		planChanged() {
			return JSON.stringify(this.plan) !== JSON.stringify(this.savedPlan)
		},
		// 1 (Monday) to 7, in the language of the page
		weekdays() {
			const locale = this.$i18n.locale?.replace('_', '-')
			return [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, name: new Date(2024, 0, day).toLocaleDateString(locale, { weekday: 'long' }) }))
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
			this.plan = { ...this.savedPlan }
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
		async savePlan() {
			const plan = { ...this.plan, keep: Math.min(30, Math.max(1, Math.round(Number(this.plan.keep)) || 7)) }
			if (await this.act(() => saveSchedule(this.app, plan, this.selected))) {
				this.$buefy.toast.open({ message: plan.every === 'off' ? this.$t('Automatic backups turned off') : this.$t('Automatic backups saved'), type: 'is-success' })
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
					if (await this.act(() => restoreApp(this.app, backup.id, backup.dest))) {
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
				onConfirm: () => this.act(() => deleteBackup(this.app, backup.id, backup.dest)),
			})
		},
		forget(backup) {
			this.$buefy.dialog.confirm({
				title: this.$t('Take this folder off the list?'),
				message: this.$t('{folder} is not connected. Its backups leave this list, for every app. Nothing on it is deleted, and choosing the folder again brings them back.', { folder: escapeHtml(backup.dest) }),
				confirmText: this.$t('Remove from list'),
				cancelText: this.$t('Cancel'),
				onConfirm: () => this.act(() => forgetFolder(this.app, backup.dest)),
			})
		},
		elsewhere(backup) {
			return Boolean(backup.dest) && backup.dest !== this.index?.dest
		},
		isAvailable(backup) {
			return backup.available !== false
		},
		cancelPicker() {
			this.picking = false
			this.error = ''
		},
		async openPicker() {
			this.picking = true
			this.error = ''
			this.pickError = ''
			this.goTo(this.connected && !this.isDefaultDest ? this.index.dest : '/DATA')
			const { places, storage } = await listLocations()
			this.places = [...places.slice(0, 1), ...storage.filter((place) => place.kind)]
		},
		async goTo(dir) {
			this.pickDir = dir
			this.pickLoading = true
			this.pickError = ''
			try {
				const items = await listFolder(dir)
				if (dir !== this.pickDir) return
				this.pickFolders = items.filter((item) => item.is_dir && !item.name.startsWith('.')).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
			}
			catch (e) {
				this.pickFolders = []
				this.pickError = errorMessage(e)
			}
			finally {
				this.pickLoading = false
			}
		},
		placeName(place) {
			return place.label || this.$t(`files.${place.name}`)
		},
		parentPath,
		async setDest(path) {
			if (await this.act(() => saveDestination(this.app, path))) {
				this.picking = false
				this.$buefy.toast.open({ message: this.$t('From now on, backups go to the new folder. The ones already saved stay where they are, and stay on this list.'), type: 'is-success', duration: 8000 })
			}
		},
		when(time) {
			const date = new Date(time)
			return Number.isNaN(date.getTime()) ? time : date.toLocaleString(this.$i18n.locale?.replace('_', '-'), { dateStyle: 'medium', timeStyle: 'short' })
		},
		reason(backup) {
			return { 'before-update': this.$t('Before an update'), 'before-restore': this.$t('Before a restore'), 'scheduled': this.$t('Automatic') }[backup.reason] || ''
		},
		async toggleKey() {
			if (this.key) {
				this.key = ''
				return
			}
			this.key = await backupKey() || ''
			if (!this.key) this.error = this.$t('The backup key could not be read')
		},
		copyKey() {
			navigator.clipboard?.writeText(this.key)
			this.$buefy.toast.open({ message: this.$t('Key copied'), type: 'is-success' })
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
				<button :disabled="busy || !index || !connected" class="atrio-button is-small" type="button" @click="create">{{ $t('Create backup') }}</button>
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

			<h4>{{ $t('Automatic backups') }}</h4>
			<template v-if="index && !index.scheduler">
				<p class="atrio-backups-note">{{ $t('Automatic backups need the latest version of the service on the server. Run the install command once more, then reload the page:') }}</p>
				<div class="atrio-backups-install">
					<code>{{ install }}</code>
					<button class="atrio-button is-small" type="button" @click="copyInstall">{{ $t('Copy') }}</button>
				</div>
			</template>
			<template v-else-if="index">
				<div class="atrio-backups-plan">
					<label>
						<span>{{ $t('When') }}</span>
						<select v-model="plan.every" :disabled="busy" class="atrio-backups-input">
							<option value="off">{{ $t('Never') }}</option>
							<option value="daily">{{ $t('Every day') }}</option>
							<option value="weekly">{{ $t('Every week') }}</option>
						</select>
					</label>
					<label v-if="plan.every === 'weekly'">
						<span>{{ $t('Day') }}</span>
						<select v-model.number="plan.day" :disabled="busy" class="atrio-backups-input">
							<option v-for="weekday in weekdays" :key="weekday.day" :value="weekday.day">{{ weekday.name }}</option>
						</select>
					</label>
					<label v-if="plan.every !== 'off'">
						<span>{{ $t('At') }}</span>
						<input v-model="plan.time" :disabled="busy" class="atrio-backups-input" required type="time">
					</label>
					<label v-if="plan.every !== 'off'">
						<span>{{ $t('Keep the last') }}</span>
						<input v-model.number="plan.keep" :disabled="busy" class="atrio-backups-input" max="30" min="1" type="number">
					</label>
					<button :disabled="busy || !planChanged || (plan.every !== 'off' && !plan.time)" class="atrio-button is-small" type="button" @click="savePlan">{{ $t('Save') }}</button>
				</div>
				<p v-if="plan.every !== 'off'" class="atrio-backups-note">{{ $t('At the server\'s time. They save the folders ticked above, stopping the app as a backup made by hand does, and the oldest automatic ones are deleted. A server that is off at that time makes the backup once it is back on.') }}</p>
				<p v-if="schedule?.last_error" class="atrio-backups-error" role="alert">{{ $t('The automatic backup of {time} failed: {reason}', { time: when(schedule.last_time), reason: $t(schedule.last_error) }) }}</p>
				<p v-else-if="schedule?.last_time" class="atrio-backups-note">{{ $t('Last automatic backup: {time}', { time: when(schedule.last_time) }) }}</p>
			</template>

			<h4>{{ $t('Saved backups') }}</h4>
			<p v-if="index && !backups.length" class="atrio-config-empty">{{ $t('No backups yet') }}</p>
			<ul v-else class="atrio-backups-list">
				<li v-for="backup in backups" :key="`${backup.dest}/${backup.id}`" :class="{ 'is-unavailable': !isAvailable(backup) }">
					<div>
						<strong>{{ when(backup.time) }}</strong>
						<small>{{ [reason(backup), renderSize(backup.size), backup.images].filter(Boolean).join(' · ') }}</small>
						<small v-if="elsewhere(backup)" class="is-mono">{{ $t('In {folder}', { folder: backup.dest }) }}</small>
						<small v-if="!isAvailable(backup)" class="atrio-backups-offline">{{ $t('Not connected: connect it to restore this backup') }}</small>
					</div>
					<div v-if="!isAvailable(backup)" class="atrio-backups-actions">
						<button v-if="elsewhere(backup)" :disabled="busy" class="atrio-button is-small" type="button" @click="forget(backup)">{{ $t('Remove from list') }}</button>
					</div>
					<div v-else class="atrio-backups-actions">
						<button :disabled="busy" class="atrio-button is-small" type="button" @click="restore(backup)">{{ $t('Restore') }}</button>
						<button :aria-label="$t('Delete')" :disabled="busy" class="atrio-button is-small" type="button" @click="remove(backup)">
							<b-icon icon="trash-outline" pack="casa" size="is-16" />
						</button>
					</div>
				</li>
			</ul>

			<h4>{{ $t('Backup folder') }}</h4>
			<div class="atrio-backups-dest">
				<span class="is-mono">{{ index?.dest }}</span>
				<button v-if="!picking" :disabled="busy || !index" class="atrio-button is-small" type="button" @click="openPicker">{{ $t('Change') }}</button>
				<button v-if="!picking && index && !isDefaultDest" :disabled="busy" class="atrio-button is-small" type="button" @click="setDest('')">{{ $t('Use the default') }}</button>
			</div>
			<p v-if="index && !connected" class="atrio-backups-error" role="alert">{{ $t('This folder is not connected right now: plug in the disk or reconnect the folder, or choose another one. Backups before updates cannot run until then.') }}</p>

			<div v-if="picking" class="atrio-backups-picker">
				<p class="atrio-backups-note">{{ $t('Disks, USB drives, network folders and cloud drives connected in Files appear here. To add one, connect it in Files first.') }}</p>
				<div class="atrio-backups-places">
					<button v-for="place in places" :key="place.path" :class="{ 'is-active': pickDir === place.path }" type="button" @click="goTo(place.path)">
						<FilesIcon :name="place.icon" :size="15" />{{ placeName(place) }}
					</button>
				</div>
				<strong class="is-mono">{{ pickDir }}</strong>
				<div class="atrio-backups-pick-list">
					<button v-if="pickDir !== '/'" type="button" @click="goTo(parentPath(pickDir))"><FilesIcon :size="16" name="arrowUp" />..</button>
					<p v-if="pickLoading" class="atrio-config-empty">{{ $t('Loading…') }}</p>
					<p v-else-if="pickError" class="atrio-backups-note" role="alert">{{ pickError }}</p>
					<button v-for="folder in pickFolders" v-else :key="folder.path" type="button" @click="goTo(folder.path)"><FilesIcon :size="16" name="folder" />{{ folder.name }}</button>
				</div>
				<p class="atrio-backups-note">{{ $t('Atrio creates a folder called atrio-backups in here.') }}</p>
				<div class="atrio-backups-actions">
					<button :disabled="busy || !!pickError" class="atrio-button is-small" type="button" @click="setDest(pickDir)">{{ $t('Use this folder') }}</button>
					<button :disabled="busy" class="atrio-button is-small" type="button" @click="cancelPicker">{{ $t('Cancel') }}</button>
				</div>
			</div>

			<p v-if="index?.same_disk" class="atrio-backups-note">{{ $t('This folder is on the same disk as your apps: backups protect from mistakes and bad updates, not from a broken disk. Use a folder on another disk to be safe.') }}</p>
			<p v-if="index?.remote" class="atrio-backups-note">{{ $t('Network folder or cloud drive: the app restarts first and the backup is sent afterwards, so it needs the same space free on this server for a while.') }}</p>
			<p v-if="index && connected" class="atrio-backups-note">{{ $t('Free space: {size}', { size: renderSize(index.free) }) }}</p>

			<h4>{{ $t('Backup key') }}</h4>
			<p class="atrio-backups-note">{{ $t('Backups are encrypted and signed with a key that stays on this server: whoever can open the backup folder cannot read them or change them. To restore them on a new machine you will need this key too, so keep a copy in a safe place, such as a password manager.') }}</p>
			<div class="atrio-backups-dest">
				<span v-if="key" class="is-mono">{{ key }}</span>
				<button class="atrio-button is-small" type="button" @click="toggleKey">{{ key ? $t('Hide') : $t('Show the key') }}</button>
				<button v-if="key" class="atrio-button is-small" type="button" @click="copyKey">{{ $t('Copy') }}</button>
			</div>
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

.atrio-backups-list li.is-unavailable strong {
	opacity: 0.6;
}

.atrio-backups .atrio-backups-offline {
	color: #fcd34d;
}

.atrio-backups-actions {
	display: flex;
	flex: none;
	gap: 0.375rem;
}

.atrio-backups-dest {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem;
	align-items: center;

	.is-mono {
		flex: 1 1 12rem;
		min-width: 0;
	}
}

.atrio-backups-picker {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	margin: 0.75rem 0;
	padding: 0.75rem;
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.75rem;

	strong {
		color: inherit;
	}

	button {
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
}

.atrio-backups-places {
	display: flex;
	flex-wrap: wrap;
	gap: 0.375rem;

	button {
		display: flex;
		gap: 0.375rem;
		align-items: center;
		min-height: 2rem;
		padding: 0 0.75rem;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.06);
		font-size: 0.8125rem;

		&.is-active {
			background: rgba(255, 255, 255, 0.18);
		}
	}
}

.atrio-backups-pick-list {
	display: flex;
	flex-direction: column;
	gap: 2px;
	height: 12rem;
	padding: 0.25rem;
	overflow-y: auto;
	border-radius: 0.5rem;
	background: rgba(0, 0, 0, 0.25);

	button {
		display: flex;
		flex: none;
		gap: 0.5rem;
		align-items: center;
		min-height: 2.25rem;
		padding: 0 0.5rem;
		border: 0;
		border-radius: 0.375rem;
		background: transparent;
		font-size: 0.875rem;
		text-align: left;

		&:hover {
			background: rgba(255, 255, 255, 0.1);
		}
	}
}

.atrio-backups-plan {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem 0.75rem;
	align-items: flex-end;

	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.75rem;

		span {
			color: var(--atrio-text-muted);
		}
	}

	input[type='number'] {
		width: 5rem;
	}
}

.atrio-backups-input {
	height: 2.25rem;
	padding: 0 0.625rem;
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.75rem;
	background: rgba(255, 255, 255, 0.06);
	color: var(--atrio-text);
	font: inherit;
	font-size: 0.875rem;
	color-scheme: dark;
	outline: none;

	&:focus {
		border-color: var(--atrio-accent);
	}

	option {
		background: #0f172a;
		color: #e2e8f0;
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
