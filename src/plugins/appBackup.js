// App backups and safe updates, shared by the Backup tab of the app panel, the app menu and bulk actions.
// The work runs on the server: we write a request through the CasaOS file API and atrio-backup
// (installed by scripts/install.sh) reports its progress in a status file.
import { reactive } from 'vue'
import api from '@/service/api.js'
import { findDowngrade } from '@/plugins/appVersions'

const STATE = '/var/lib/casaos/atrio'
const REQUEST = `${STATE}/backup-request`
const STATUS = `${STATE}/backup-status.json`
const POLL_MS = 1500
// The service has to pick up a request by then; once running, a large app can take hours
const PICKUP_MS = 30 * 1000
// How long the app is watched after an update starts, and how long it must stay up to count as fine
const WATCH_MS = 10 * 60 * 1000
const WATCH_POLL_MS = 5000
const WATCH_STEADY_MS = 30 * 1000

// The operation in progress: { app, action, step }. One at a time on the server.
export const backupRun = reactive({ app: '', action: '', step: '' })

async function read(path) {
	try {
		const res = await api.file.getContent(path)
		return res.data.success === 200 ? String(res.data.data ?? '') : null
	}
	catch (e) {
		return null
	}
}

async function readJson(path) {
	try {
		return JSON.parse(await read(path))
	}
	catch (e) {
		return null
	}
}

/** Whether atrio-backup is installed: install.sh writes its first status. */
export async function backupsInstalled() {
	return (await read(STATUS)) !== null
}

export function loadIndex(app) {
	return readJson(`${STATE}/backups/${app}.json`)
}

/** Sends one request and resolves with the final status; rejects with a message to show. */
async function run(fields) {
	if (backupRun.app) throw new Error('Another backup is in progress')
	backupRun.app = fields.APP
	backupRun.action = fields.ACTION
	backupRun.step = ''
	try {
		const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
		const lines = Object.entries({ ...fields, TOKEN: token }).flatMap(([key, value]) =>
			(Array.isArray(value) ? value : [value]).map((item) => `${key}=${String(item).replace(/[\r\n]/g, '')}`))
		const temp = `${REQUEST}.tmp`
		await api.file.create(temp)
		const written = await api.file.update(temp, `${lines.join('\n')}\n`)
		const renamed = written.data.success === 200 && await api.file.rename(temp, REQUEST)
		if (!renamed || renamed.data.success !== 200) throw new Error('Could not reach the backup service on the server')

		let started = Date.now()
		for (;;) {
			await new Promise((resolve) => setTimeout(resolve, POLL_MS))
			const status = await readJson(STATUS)
			if (status?.token === token) {
				backupRun.step = status.step
				if (status.state === 'done') return status
				if (status.state === 'error') throw new Error(status.message)
			}
			else if (status?.state === 'running') {
				// An automatic backup is running: the service takes this request once it is done
				backupRun.step = 'waiting'
				started = Date.now()
			}
			else if (Date.now() - started > PICKUP_MS) {
				throw new Error('Could not reach the backup service on the server')
			}
		}
	}
	finally {
		backupRun.app = ''
		backupRun.action = ''
		backupRun.step = ''
	}
}

export const scanApp = (app) => run({ ACTION: 'scan', APP: app })
export const backupApp = (app, folders, reason = 'manual') => run({ ACTION: 'backup', APP: app, REASON: reason, FOLDER: folders || [] })
// `from`: the folder that holds the backup, when it is not the current one
export const restoreApp = (app, id, from) => run({ ACTION: 'restore', APP: app, ID: id, ...(from ? { FROM: from } : {}) })
export const deleteBackup = (app, id, from) => run({ ACTION: 'delete', APP: app, ID: id, ...(from ? { FROM: from } : {}) })
export const forgetFolder = (app, from) => run({ ACTION: 'forget', APP: app, FROM: from })
// Automatic backups: `every` is 'off', 'daily' or 'weekly'; `day` 1 (Monday) to 7; they save `folders`
export const saveSchedule = (app, { every, time, day, keep }, folders) =>
	run({ ACTION: 'schedule', APP: app, EVERY: every, TIME: time, DAY: day, KEEP: keep, FOLDER: folders || [] })

// --- Settings file: everything needed to set Atrio up again on a new machine ---------------------

// Saved by the CasaOS user service for the account: dashboard, wallpaper, widgets, app order, links
const CUSTOM_KEYS = ['system', 'wallpaper', 'widgets_config', 'app_order', 'shortcut', 'link']
// Kept by this browser
const LOCAL_KEYS = ['lang', 'atrio:layout-width', 'atrio:console-view', 'atrio:greeting', 'atrio:app-filter',
	'atrio:app-density', 'atrio.files.prefs', 'atrio-files-wrap', 'temperatureFormat']

async function writeFile(path, content) {
	await api.file.create(path)
	const res = await api.file.update(path, content)
	if (res.data.success !== 200) throw new Error('Could not reach the backup service on the server')
}

async function removeFile(path) {
	try {
		await api.batch.delete(JSON.stringify([path]))
	}
	catch (e) {
		// Left behind: root-only, and replaced by the next export or import
	}
}

/** The encrypted settings file as text, ready to download. */
export async function exportSettings(password) {
	const custom = {}
	for (const key of CUSTOM_KEYS) {
		try {
			const res = await api.users.getCustomStorage(key)
			if (res.data.success === 200 && res.data.data) custom[key] = res.data.data
		}
		catch (e) {
			// Not set on this server
		}
	}
	const local = {}
	for (const key of LOCAL_KEYS) {
		const value = localStorage.getItem(key)
		if (value !== null) local[key] = value
	}
	await writeFile(`${STATE}/settings-ui.json`, JSON.stringify({ custom, local }))
	await run({ ACTION: 'export-settings', APP: 'atrio', PASSWORD: password })
	const text = await read(`${STATE}/settings-export.txt`)
	await removeFile(`${STATE}/settings-export.txt`)
	if (!text) throw new Error('The settings could not be saved')
	return text
}

/** Puts back the settings of a file made by exportSettings; the page reloads after it. */
export async function importSettings(text, password, replaceKey = false) {
	await writeFile(`${STATE}/settings-import.txt`, text)
	await run({ ACTION: 'import-settings', APP: 'atrio', PASSWORD: password, REPLACE_KEY: replaceKey ? 1 : 0 })
	const ui = await readJson(`${STATE}/settings-imported.json`)
	await removeFile(`${STATE}/settings-imported.json`)
	for (const [key, value] of Object.entries(ui?.custom || {})) {
		if (CUSTOM_KEYS.includes(key)) await api.users.setCustomStorage(key, value)
	}
	for (const [key, value] of Object.entries(ui?.local || {})) {
		if (LOCAL_KEYS.includes(key) && typeof value === 'string') localStorage.setItem(key, value)
	}
}

// --- Unused images: the ones CasaOS leaves behind after updates and uninstalls ---------------------

/** Lists them again on the server: { images: [{ id, size, created, tags }], total }. */
export async function scanImages() {
	await run({ ACTION: 'images', APP: 'atrio' })
	return readJson(`${STATE}/images.json`)
}

/** Removes the images with these ids, or every unused one with none; resolves with { removed, freed }. */
export async function removeImages(ids = []) {
	const status = await run({ ACTION: 'remove-images', APP: 'atrio', IMAGE: ids })
	const [removed, freed] = String(status.message || '').split(' ').map(Number)
	return { removed: removed || 0, freed: freed || 0 }
}

/** The key that encrypts and signs this server's backups, created with the first backup. */
export async function backupKey() {
	return ((await read(`${STATE}/backup.key`)) || '').trim()
}

// The service checks the folder and creates a subfolder in it; empty means back to the default
export const saveDestination = (app, path) => run({ ACTION: 'destination', APP: app, DEST: path })

// Dialog messages are HTML, and app names come from compose files
export function escapeHtml(text) {
	return String(text).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)
}

function askToGoBack(vm, name, title, id) {
	vm.$buefy.dialog.confirm({
		title: vm.$t('{title} did not start after the update', { title: escapeHtml(title) }),
		message: vm.$t('A backup from just before the update is ready. Go back to it? The app returns to the version and the data it had then.'),
		confirmText: vm.$t('Go back'),
		cancelText: vm.$t('Leave it'),
		type: 'is-danger',
		onConfirm: async () => {
			vm.$buefy.toast.open({ message: vm.$t('Restoring {title}…', { title }), type: 'is-info' })
			try {
				await restoreApp(name, id)
				vm.$buefy.toast.open({ message: vm.$t('{title} is back as it was before the update', { title }), type: 'is-success', duration: 6000 })
			}
			catch (e) {
				vm.$buefy.toast.open({ message: vm.$t(e.message), type: 'is-danger', duration: 10000 })
			}
		},
	})
}

// An update runs in the background: the app counts as fine once it stays up, and a crash after
// a backup offers the way back. Only while this page is open.
function watchUpdate(vm, name, title, backupId) {
	const started = Date.now()
	let upSince = 0
	let badLooks = 0
	let image = ''
	let imageChanged = false
	const check = async () => {
		if (Date.now() - started > WATCH_MS) return
		let status = ''
		let changed = false
		try {
			const res = await vm.$openAPI.appManagement.compose.myComposeApp(name)
			status = res.data.data.status || ''
			const now = JSON.stringify(Object.values(res.data.data.compose?.services || {}).map((service) => service.image))
			changed = image !== '' && now !== image
			image = now
		}
		catch (e) {
			// The app is being recreated, or the server is busy: look again
		}
		if (status.startsWith('restarting') || status.startsWith('exited') || status.startsWith('dead')) {
			// A crashing app alternates between restarting and running, so only staying up clears this.
			// Two looks, so that a normal restart is not taken for a crash.
			upSince = 0
			if (++badLooks >= 2) {
				askToGoBack(vm, name, title, backupId)
				return
			}
		}
		else if (status.startsWith('running')) {
			if (!upSince || changed) upSince = Date.now()
			else if (Date.now() - upSince > WATCH_STEADY_MS) badLooks = 0
			// The old version keeps running until the new image is downloaded: fine only some time after a change
			imageChanged = imageChanged || changed
			if (imageChanged && Date.now() - upSince > WATCH_STEADY_MS) return
		}
		setTimeout(check, WATCH_POLL_MS)
	}
	setTimeout(check, WATCH_POLL_MS)
}

/**
 * Updates one app, safely: not when it would go back to an older version, and with a backup first.
 * `vm` is the calling component. Resolves with 'kept' (would go back), 'current' (nothing newer), 'failed' or 'started'.
 * With `quiet`, nothing is asked or shown, for bulk actions.
 */
export async function updateApp(vm, name, title, { quiet = false } = {}) {
	const compose = vm.$openAPI.appManagement.compose
	const older = await findDowngrade(vm.$openAPI, name)
	if (older) {
		if (!quiet) {
			vm.$buefy.toast.open({
				message: vm.$t('{title} stays on {installed}: the App Store only offers {store}, which could stop it from working. To change version, edit the tag in its settings.', { title, ...older }),
				type: 'is-warning',
				duration: 10000,
			})
		}
		return 'kept'
	}

	let backupId = ''
	let hasUpdate = false
	try {
		hasUpdate = Boolean((await compose.myComposeAppList()).data.data?.[name]?.update_available)
	}
	catch (e) {
		// Asked again by CasaOS itself when updating
	}
	if (hasUpdate && await backupsInstalled()) {
		if (!quiet) vm.$buefy.toast.open({ message: vm.$t('Saving a backup of {title} before updating…', { title }), type: 'is-info', duration: 5000 })
		try {
			backupId = (await backupApp(name, null, 'before-update')).id
		}
		catch (e) {
			if (!quiet) {
				vm.$buefy.toast.open({
					message: vm.$t('{title} was not updated, because the backup failed: {reason}', { title, reason: vm.$t(e.message) }),
					type: 'is-danger',
					duration: 10000,
				})
			}
			return 'failed'
		}
	}

	try {
		const res = await compose.updateComposeApp(name)
		if (/up to date/i.test(res.data.message || '')) {
			// CasaOS does nothing here: the App Store has no newer version yet, even if the app itself announces one
			if (!quiet) vm.$buefy.toast.open({ message: vm.$t('{title} is already on the version the App Store offers. The app may announce a newer one before the App Store has it.', { title }), type: 'is-info', duration: 8000 })
			return 'current'
		}
		if (!quiet) vm.$buefy.toast.open({ message: res.data.message || vm.$t('No updates are currently available for the application.'), type: 'is-success' })
	}
	catch (e) {
		if (!quiet) vm.$buefy.toast.open({ message: vm.$t('Unable to update at the moment!'), type: 'is-danger' })
		return 'failed'
	}
	if (backupId) watchUpdate(vm, name, title, backupId)
	return 'started'
}
