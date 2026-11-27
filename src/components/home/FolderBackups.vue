<script>
// Folder backups: documents, photos and any other folder, by hand or every day or week, encrypted
// like the backups of apps and in the same backup folder. A backup goes back as a copy next to the
// folder, or in its place with the folder as it was kept aside. Opened with
// `$EventBus.$emit('atrio:open-folder-backups', path?)`, from the settings, the command palette and Files.
import { copyText } from '@/plugins/copyText'
import { renderSize } from '@/mixins/file_utils'
import { restoreFocus, trapTab } from '@/plugins/focusTrap'
import BackupFolderPicker from '@/components/home/BackupFolderPicker.vue'
import { addFolder, backupFolder, backupRun, backupsInstalled, deleteFolderBackup, escapeHtml, forgetBackupFolder, loadFolderIndex, removeFolder, restoreFolder, saveDestination, saveFolderPlan, scanFolders } from '@/plugins/appBackup'

const INSTALL = 'curl -fsSL https://raw.githubusercontent.com/peppeaiello/atrio/main/scripts/install.sh | sudo bash'
const STEPS = {
	scanning: 'Measuring the folders…',
	preparing: 'Getting ready…',
	checking: 'Checking…',
	archiving: 'Saving the files…',
	uploading: 'Sending the backup to its folder…',
	downloading: 'Getting the backup from its folder…',
	restoring: 'Putting the files back…',
	waiting: 'Waiting for an automatic backup to finish…',
}
const NEW_PLAN = { every: 'daily', time: '03:00', day: 1, keep: 7 }
const NO_PLAN = { every: 'off', time: '03:00', day: 1, keep: 7 }

export default {
	name: 'FolderBackups',
	compatConfig: { MODE: 3 },
	components: { BackupFolderPicker },
	data() {
		return {
			open: false,
			installed: null,
			index: null,
			error: '',
			// The folder whose backups and schedule are shown
			expanded: '',
			// 'source' while choosing a folder to add, 'dest' while choosing the backup folder
			picking: '',
			adding: '',
			// The schedule of the folder being added, and of the one open below
			newPlan: { ...NEW_PLAN },
			plan: { ...NO_PLAN },
			// The backup whose restore choices are shown: "dest/id"
			restoring: '',
			run: backupRun,
			install: INSTALL,
		}
	},
	computed: {
		busy() {
			return Boolean(this.run.app)
		},
		mine() {
			return this.run.app === 'atrio' && /^(folder|folders|destination|forget)/.test(this.run.action)
		},
		stepText() {
			return this.mine ? this.$t(STEPS[this.run.step] || 'Getting ready…') : ''
		},
		folders() {
			return this.index?.folders || []
		},
		connected() {
			return this.index?.connected !== false
		},
		isDefaultDest() {
			return this.index?.dest === this.index?.default_dest
		},
		weekdays() {
			const locale = this.$i18n.locale?.replace('_', '-')
			return [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, name: new Date(2024, 0, day).toLocaleDateString(locale, { weekday: 'long' }) }))
		},
	},
	mounted() {
		this.$EventBus.$on('atrio:open-folder-backups', this.show)
		window.addEventListener('keydown', this.onKey)
	},
	beforeUnmount() {
		this.$EventBus.$off('atrio:open-folder-backups', this.show)
		window.removeEventListener('keydown', this.onKey)
	},
	methods: {
		renderSize,
		async show(path) {
			if (!this.open) {
				this.returnFocus = document.activeElement
				this.open = true
				this.$nextTick(() => this.$refs.sheet?.focus())
			}
			this.error = ''
			this.picking = ''
			this.adding = ''
			this.restoring = ''
			this.installed = await backupsInstalled()
			if (!this.installed) return
			// The last known list right away, measured again in the background
			this.index = await loadFolderIndex()
			if (typeof path === 'string' && path) this.choose(path)
			if (this.busy) return
			try {
				this.index = await scanFolders()
			}
			catch (e) {
				this.error = this.message(e)
			}
			if (typeof path === 'string' && path) this.choose(path)
		},
		close() {
			this.open = false
			this.$nextTick(() => restoreFocus(this.returnFocus))
		},
		onKey(event) {
			if (!this.open) return
			// Escape closes the dialogs on top first (Buefy handles those)
			if (event.key === 'Escape' && !document.querySelector('.dialog.modal.is-active')) this.close()
			else if (event.key === 'Tab') trapTab(event, this.$refs.sheet)
		},
		message(e) {
			// A service older than this version does not know these requests
			return e.message === 'Unknown request'
				? this.$t('This needs the latest version of the service on the server. Run the install command once more.')
				: this.$t(e.message)
		},
		async act(work) {
			this.error = ''
			try {
				const result = await work()
				this.index = await loadFolderIndex()
				return result ?? true
			}
			catch (e) {
				this.error = this.message(e)
				this.index = await loadFolderIndex()
				return false
			}
		},
		// A folder from the picker or from Files: the one already on the list opens, a new one asks when
		choose(path) {
			this.picking = ''
			const known = this.folders.find((folder) => folder.path === path && folder.added)
			if (known) {
				this.adding = ''
				this.toggle(known, true)
				return
			}
			this.adding = path
			this.expanded = ''
			this.newPlan = { ...NEW_PLAN }
		},
		async add() {
			const path = this.adding
			if (await this.act(() => addFolder(path, this.cleanPlan(this.newPlan)))) {
				this.adding = ''
				const added = this.folders.find((folder) => folder.path === path)
				if (added) this.toggle(added, true)
				this.$buefy.toast.open({ message: this.$t('{folder} added to the folder backups', { folder: escapeHtml(path) }), type: 'is-success' })
			}
		},
		cleanPlan(plan = this.plan) {
			return { ...plan, keep: Math.min(30, Math.max(1, Math.round(Number(plan.keep)) || 7)) }
		},
		savedPlan(folder) {
			const saved = folder.schedule
			return saved ? { every: saved.every, time: saved.time, day: saved.day, keep: saved.keep } : { ...NO_PLAN }
		},
		planChanged(folder) {
			return JSON.stringify(this.cleanPlan()) !== JSON.stringify(this.savedPlan(folder))
		},
		toggle(folder, force = false) {
			this.restoring = ''
			if (this.expanded === folder.job && !force) {
				this.expanded = ''
				return
			}
			this.expanded = folder.job
			this.plan = this.savedPlan(folder)
		},
		async savePlan(folder) {
			const plan = this.cleanPlan()
			if (await this.act(() => saveFolderPlan(folder.job, plan))) {
				this.$buefy.toast.open({ message: plan.every === 'off' ? this.$t('Automatic backups turned off') : this.$t('Automatic backups saved'), type: 'is-success' })
			}
		},
		async backUp(folder) {
			if (await this.act(() => backupFolder(folder.job))) {
				this.$buefy.toast.open({ message: this.$t('Backup of {title} saved', { title: escapeHtml(this.name(folder.path)) }), type: 'is-success' })
			}
		},
		remove(folder) {
			this.$buefy.dialog.confirm({
				title: this.$t('Stop backing up this folder?'),
				message: this.$t('{folder} is no longer backed up. Its backups are not deleted: they stay on this list until you delete them.', { folder: escapeHtml(folder.path) }),
				confirmText: this.$t('Stop'),
				cancelText: this.$t('Cancel'),
				onConfirm: () => this.act(() => removeFolder(folder.job)),
			})
		},
		key(backup) {
			return `${backup.dest}/${backup.id}`
		},
		async restore(folder, backup, mode) {
			const done = async () => {
				const target = await this.act(() => restoreFolder(folder.job, backup.id, mode, backup.dest))
				if (!target) return
				this.restoring = ''
				this.$buefy.toast.open({
					message: mode === 'copy'
						? this.$t('The backup of {time} is in {folder}', { time: escapeHtml(this.when(backup.time)), folder: escapeHtml(target) })
						: this.$t('{folder} is back to the backup of {time}', { folder: escapeHtml(folder.path), time: escapeHtml(this.when(backup.time)) }),
					type: 'is-success',
					duration: 8000,
				})
			}
			if (mode === 'copy') return done()
			this.$buefy.dialog.confirm({
				title: this.$t('Replace the folder?'),
				message: this.$t('{folder} goes back to {time}. The folder as it is now is not deleted: it is renamed, with "before restore" and the date, next to it. Apps that use this folder see the restored files once restarted.', { folder: escapeHtml(folder.path), time: escapeHtml(this.when(backup.time)) }),
				confirmText: this.$t('Replace'),
				cancelText: this.$t('Cancel'),
				type: 'is-danger',
				onConfirm: done,
			})
		},
		removeBackup(folder, backup) {
			this.$buefy.dialog.confirm({
				title: this.$t('Delete this backup?'),
				message: this.$t('The backup of {time} is deleted for good.', { time: this.when(backup.time) }),
				confirmText: this.$t('Delete'),
				cancelText: this.$t('Cancel'),
				type: 'is-danger',
				onConfirm: () => this.act(() => deleteFolderBackup(folder.job, backup.id, backup.dest)),
			})
		},
		forget(backup) {
			this.$buefy.dialog.confirm({
				title: this.$t('Take this folder off the list?'),
				message: this.$t('{folder} is not connected. Its backups leave this list, for every app. Nothing on it is deleted, and choosing the folder again brings them back.', { folder: escapeHtml(backup.dest) }),
				confirmText: this.$t('Remove from list'),
				cancelText: this.$t('Cancel'),
				onConfirm: () => this.act(() => forgetBackupFolder(backup.dest)),
			})
		},
		async setDest(path) {
			if (await this.act(() => saveDestination('atrio', path))) {
				this.picking = ''
				this.$buefy.toast.open({ message: this.$t('From now on, backups go to the new folder. The ones already saved stay where they are, and stay on this list.'), type: 'is-success', duration: 8000 })
			}
		},
		elsewhere(backup) {
			return Boolean(backup.dest) && backup.dest !== this.index?.dest
		},
		name(path) {
			return path.split('/').filter(Boolean).pop() || path
		},
		summary(folder) {
			const plan = folder.schedule
			if (!folder.added) return this.$t('No longer backed up')
			if (!plan) return this.$t('By hand only')
			const time = plan.time
			const text = plan.every === 'weekly'
				? this.$t('every {day} at {time}', { day: this.weekdays.find((d) => d.day === plan.day)?.name || '', time })
				: this.$t('every day at {time}', { time })
			return text.replace(/^./, (c) => c.toUpperCase())
		},
		when(time) {
			const date = new Date(time)
			return Number.isNaN(date.getTime()) ? time : date.toLocaleString(this.$i18n.locale?.replace('_', '-'), { dateStyle: 'medium', timeStyle: 'short' })
		},
		count(n) {
			return n === 1 ? this.$t('1 backup') : this.$t('{count} backups', { count: n })
		},
		reason(backup) {
			return { scheduled: this.$t('Automatic') }[backup.reason] || ''
		},
		copyInstall() {
			copyText(this, this.install)
		},
	},
}
</script>

<template>
	<Teleport to="body">
		<transition name="atrio-sheet">
			<div v-if="open" class="atrio-sheet-backdrop" @click.self="close">
				<aside ref="sheet" :aria-label="$t('Folder backups')" aria-modal="true" class="atrio-sheet atrio-folders atrio-backups" role="dialog" tabindex="-1">
					<header class="atrio-sheet-head">
						<span class="atrio-folders-icon"><b-icon icon="folder-sync-outline" pack="mdi" /></span>
						<div class="atrio-sheet-title">
							<h2>{{ $t('Folder backups') }}</h2>
							<p class="atrio-folders-sub">{{ $t('Documents, photos and other folders, by hand or on a schedule') }}</p>
						</div>
						<button :aria-label="$t('Close')" class="atrio-icon-button" type="button" @click="close">
							<b-icon icon="close-outline" pack="casa" />
						</button>
					</header>

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
						<p v-if="mine" aria-live="polite" class="atrio-backups-step">{{ stepText }}</p>
						<p v-else-if="busy" class="atrio-backups-step">{{ $t('Another backup is in progress') }}</p>

						<p v-if="!index" class="atrio-config-empty">{{ $t('Loading…') }}</p>
						<p v-else-if="!folders.length && !adding" class="atrio-config-empty">{{ $t('No folders yet. Add the folders you want to keep safe, such as documents or photos.') }}</p>

						<ul v-if="folders.length" class="atrio-folders-list">
							<li v-for="folder in folders" :key="folder.job" :class="{ 'is-open': expanded === folder.job }">
								<button :aria-expanded="expanded === folder.job" class="atrio-folders-row" type="button" @click="toggle(folder)">
									<b-icon :icon="folder.present ? 'folder-outline' : 'folder-alert-outline'" pack="mdi" size="is-20" />
									<span class="atrio-folders-name">
										<strong>{{ name(folder.path) }}</strong>
										<small class="is-mono">{{ folder.path }}</small>
										<small>
											{{ [summary(folder), folder.size >= 0 ? renderSize(folder.size) : '', count(folder.backups.length)].filter(Boolean).join(' · ') }}
										</small>
										<small v-if="!folder.present" class="atrio-backups-offline">{{ $t('Not there right now: plug in its disk or reconnect it') }}</small>
										<small v-else-if="folder.schedule?.last_error" class="atrio-backups-offline">{{ $t('The automatic backup of {time} failed: {reason}', { time: when(folder.schedule.last_time), reason: $t(folder.schedule.last_error) }) }}</small>
									</span>
									<b-icon :icon="expanded === folder.job ? 'chevron-up' : 'chevron-down'" pack="mdi" size="is-20" />
								</button>

								<div v-if="expanded === folder.job" class="atrio-folders-body">
									<div v-if="folder.added" class="atrio-backups-actions">
										<button :disabled="busy || !folder.present || !connected" class="atrio-button is-small is-primary" type="button" @click="backUp(folder)">{{ $t('Back up now') }}</button>
										<button :disabled="busy" class="atrio-button is-small" type="button" @click="remove(folder)">{{ $t('Stop backing up') }}</button>
									</div>

									<template v-if="folder.added">
										<h4>{{ $t('Automatic backups') }}</h4>
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
											<button :disabled="busy || !planChanged(folder) || (plan.every !== 'off' && !plan.time)" class="atrio-button is-small" type="button" @click="savePlan(folder)">{{ $t('Save') }}</button>
										</div>
										<p v-if="plan.every !== 'off'" class="atrio-backups-note">{{ $t('At the server\'s time. Every backup holds the whole folder, and the oldest automatic ones are deleted. A server that is off at that time makes the backup once it is back on.') }}</p>
									</template>
									<p v-else class="atrio-backups-note">{{ $t('This folder is no longer backed up. Its backups stay here until you delete them.') }}</p>

									<h4>{{ $t('Saved backups') }}</h4>
									<p v-if="!folder.backups.length" class="atrio-config-empty">{{ $t('No backups yet') }}</p>
									<ul v-else class="atrio-backups-list">
										<li v-for="backup in folder.backups" :key="key(backup)" :class="{ 'is-unavailable': !backup.available }">
											<div class="atrio-folders-backup">
												<div>
													<strong>{{ when(backup.time) }}</strong>
													<small>{{ [reason(backup), renderSize(backup.size)].filter(Boolean).join(' · ') }}</small>
													<small v-if="elsewhere(backup)" class="is-mono">{{ $t('In {folder}', { folder: backup.dest }) }}</small>
													<small v-if="!backup.available" class="atrio-backups-offline">{{ $t('Not connected: connect it to restore this backup') }}</small>
												</div>
												<div v-if="!backup.available" class="atrio-backups-actions">
													<button v-if="elsewhere(backup)" :disabled="busy" class="atrio-button is-small" type="button" @click="forget(backup)">{{ $t('Remove from list') }}</button>
												</div>
												<div v-else class="atrio-backups-actions">
													<button :disabled="busy" class="atrio-button is-small" type="button" @click="restoring = restoring === key(backup) ? '' : key(backup)">{{ $t('Restore') }}</button>
													<button :aria-label="$t('Delete')" :disabled="busy" class="atrio-button is-small" type="button" @click="removeBackup(folder, backup)">
														<b-icon icon="trash-outline" pack="casa" size="is-16" />
													</button>
												</div>
											</div>
											<div v-if="restoring === key(backup)" class="atrio-folders-restore">
												<p class="atrio-backups-note">{{ $t('As a copy, the files of then go to a new folder next to this one, and nothing is changed. In place, the folder goes back to then, and the folder as it is now is kept aside under another name.') }}</p>
												<div class="atrio-backups-actions">
													<button :disabled="busy" class="atrio-button is-small is-primary" type="button" @click="restore(folder, backup, 'copy')">{{ $t('Restore as a copy') }}</button>
													<button :disabled="busy" class="atrio-button is-small" type="button" @click="restore(folder, backup, 'replace')">{{ $t('Replace the folder') }}</button>
													<button :disabled="busy" class="atrio-button is-small" type="button" @click="restoring = ''">{{ $t('Cancel') }}</button>
												</div>
											</div>
										</li>
									</ul>
								</div>
							</li>
						</ul>

						<div v-if="adding" class="atrio-folders-add">
							<strong>{{ $t('Back up {folder}', { folder: adding }) }}</strong>
							<div class="atrio-backups-plan">
								<label>
									<span>{{ $t('When') }}</span>
									<select v-model="newPlan.every" :disabled="busy" class="atrio-backups-input">
										<option value="off">{{ $t('By hand only') }}</option>
										<option value="daily">{{ $t('Every day') }}</option>
										<option value="weekly">{{ $t('Every week') }}</option>
									</select>
								</label>
								<label v-if="newPlan.every === 'weekly'">
									<span>{{ $t('Day') }}</span>
									<select v-model.number="newPlan.day" :disabled="busy" class="atrio-backups-input">
										<option v-for="weekday in weekdays" :key="weekday.day" :value="weekday.day">{{ weekday.name }}</option>
									</select>
								</label>
								<label v-if="newPlan.every !== 'off'">
									<span>{{ $t('At') }}</span>
									<input v-model="newPlan.time" :disabled="busy" class="atrio-backups-input" required type="time">
								</label>
								<label v-if="newPlan.every !== 'off'">
									<span>{{ $t('Keep the last') }}</span>
									<input v-model.number="newPlan.keep" :disabled="busy" class="atrio-backups-input" max="30" min="1" type="number">
								</label>
							</div>
							<div class="atrio-backups-actions">
								<button :disabled="busy || (newPlan.every !== 'off' && !newPlan.time)" class="atrio-button is-small is-primary" type="button" @click="add">{{ $t('Add') }}</button>
								<button :disabled="busy" class="atrio-button is-small" type="button" @click="adding = ''">{{ $t('Cancel') }}</button>
							</div>
						</div>

						<BackupFolderPicker
							v-if="picking === 'source'" :busy="busy" :note="$t('Open the folder to back up, then choose it.')"
							action="Choose this folder" @cancel="picking = ''" @pick="choose"
						/>
						<button v-else-if="index && !adding" :disabled="busy" class="atrio-button atrio-folders-new" type="button" @click="picking = 'source'; error = ''">
							<b-icon icon="folder-plus-outline" pack="mdi" size="is-16" />{{ $t('Add a folder') }}
						</button>

						<template v-if="index">
							<h4>{{ $t('Backup folder') }}</h4>
							<p class="atrio-backups-note">{{ $t('The same folder as the backups of apps. Backups are encrypted with the backup key of this server.') }}</p>
							<div class="atrio-backups-dest">
								<span class="is-mono">{{ index.dest }}</span>
								<button v-if="picking !== 'dest'" :disabled="busy" class="atrio-button is-small" type="button" @click="picking = 'dest'; error = ''">{{ $t('Change') }}</button>
								<button v-if="picking !== 'dest' && !isDefaultDest" :disabled="busy" class="atrio-button is-small" type="button" @click="setDest('')">{{ $t('Use the default') }}</button>
							</div>
							<p v-if="!connected" class="atrio-backups-error" role="alert">{{ $t('This folder is not connected right now: plug in the disk or reconnect the folder, or choose another one.') }}</p>
							<BackupFolderPicker
								v-if="picking === 'dest'" :busy="busy" :note="$t('Atrio creates a folder called atrio-backups in here.')"
								:start="connected && !isDefaultDest ? index.dest : '/DATA'" @cancel="picking = ''" @pick="setDest"
							/>
							<p v-if="index.remote" class="atrio-backups-note">{{ $t('Network folder or cloud drive: each backup is made on this server first and sent afterwards, so it needs the same space free here for a while.') }}</p>
							<p v-if="connected" class="atrio-backups-note">{{ $t('Free space: {size}', { size: renderSize(index.free) }) }}</p>
						</template>
					</template>
				</aside>
			</div>
		</transition>
	</Teleport>
</template>

<style lang="scss">
.atrio-folders {
	width: min(38rem, calc(100% - 2rem));

	h4 {
		margin: 1rem 0 0.5rem;
	}
}

.atrio-folders-icon {
	display: grid;
	place-items: center;
	width: 3.75rem;
	height: 3.75rem;
	border-radius: 1.125rem;
	background: rgba(139, 92, 246, 0.18);
	color: #ddd6fe;

	.icon {
		width: 2rem;
		height: 2rem;
		font-size: 2rem;
	}
}

.atrio-folders-sub {
	color: var(--atrio-text-muted);
	font-size: 0.8125rem;
}

.atrio-folders-list > li {
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.atrio-folders-row {
	display: flex;
	gap: 0.75rem;
	align-items: center;
	width: 100%;
	padding: 0.75rem 0.25rem;
	border: 0;
	background: transparent;
	color: inherit;
	font: inherit;
	text-align: left;
	cursor: pointer;

	&:hover {
		background: rgba(255, 255, 255, 0.04);
	}
}

.atrio-folders-name {
	display: flex;
	flex: 1;
	flex-direction: column;
	gap: 0.125rem;
	min-width: 0;

	strong {
		color: inherit;
		font-size: 0.9375rem;
	}
}

.atrio-folders-body {
	padding: 0 0.25rem 1rem 2.25rem;
}

.atrio-folders-backup {
	display: flex;
	gap: 0.75rem;
	align-items: center;
	justify-content: space-between;
	width: 100%;
}

.atrio-folders .atrio-backups-list li {
	flex-direction: column;
	align-items: stretch;
}

.atrio-folders-restore {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	margin-top: 0.5rem;

	.atrio-backups-actions {
		flex-wrap: wrap;
	}
}

.atrio-folders-add {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
	margin-top: 0.75rem;
	padding: 0.75rem;
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.75rem;

	strong {
		color: inherit;
		word-break: break-all;
	}
}

.atrio-folders-new {
	display: inline-flex;
	gap: 0.375rem;
	align-items: center;
	align-self: flex-start;
	margin-top: 0.75rem;
}

@media (max-width: 640px) {
	.atrio-folders-body {
		padding-left: 0.25rem;
	}

	.atrio-folders-backup {
		flex-direction: column;
		align-items: flex-start;
	}
}
</style>
