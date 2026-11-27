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
// A running operation that has not moved for this long: the service stopped (killed, server restarted)
const STALL_MS = 6 * 60 * 60 * 1000
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
		let seen = ''
		let moved = Date.now()
		for (;;) {
			await new Promise((resolve) => setTimeout(resolve, POLL_MS))
			const status = await readJson(STATUS)
			if (status?.token === token) {
				backupRun.step = status.step
				if (status.state === 'done') return status
				if (status.state === 'error') throw Object.assign(new Error(status.message), { status })
				if (`${status.step} ${status.time}` !== seen) {
					seen = `${status.step} ${status.time}`
					moved = Date.now()
				}
				else if (Date.now() - moved > STALL_MS) {
					throw new Error('The backup service stopped answering. Check Activity to see what was done.')
				}
			}
			else if (status?.state === 'running') {
				// An automatic backup is running: the service takes this request once it is done
				backupRun.step = 'waiting'
				started = Date.now()
			}
			else if (Date.now() - started > PICKUP_MS) {
				// Not taken: removed, so it does not run later, after the page said it failed
				await api.batch.delete(JSON.stringify([REQUEST])).catch(() => {})
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

// --- Folder backups: documents, photos and any other folder, by hand or on a schedule -------------

/** The folders and their backups, as the server listed them last time (null before the first time). */
export function loadFolderIndex() {
	return readJson(`${STATE}/folder-backups.json`)
}

/** Lists them again, measuring the folders and reading every backup folder. */
export async function scanFolders() {
	await run({ ACTION: 'folders', APP: 'atrio' })
	return loadFolderIndex()
}

const PLAN = ({ every, time, day, keep }) => (every === 'off' ? { EVERY: 'off' } : { EVERY: every, TIME: time, DAY: day, KEEP: keep })
/** Adds a folder by its path, with a schedule (`every` 'off' for backups by hand only). */
export const addFolder = (path, plan) => run({ ACTION: 'folder-save', APP: 'atrio', FOLDER: path, ...PLAN(plan) })
export const saveFolderPlan = (job, plan) => run({ ACTION: 'folder-save', APP: 'atrio', JOB: job, ...PLAN(plan) })
export const removeFolder = (job) => run({ ACTION: 'folder-remove', APP: 'atrio', JOB: job })
export const backupFolder = (job) => run({ ACTION: 'folder-backup', APP: 'atrio', JOB: job })
/** `mode`: 'copy' next to the folder, or 'replace'; resolves with the folder the files went to. */
export async function restoreFolder(job, id, mode, from) {
	const status = await run({ ACTION: 'folder-restore', APP: 'atrio', JOB: job, ID: id, MODE: mode, ...(from ? { FROM: from } : {}) })
	return status.message
}
export const deleteFolderBackup = (job, id, from) => run({ ACTION: 'folder-delete', APP: 'atrio', JOB: job, ID: id, ...(from ? { FROM: from } : {}) })
export const forgetBackupFolder = (from) => run({ ACTION: 'forget', APP: 'atrio', FROM: from })

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

// --- Tailscale ----------------------------------------------------------------------------------

/**
 * Asks the server for one Tailscale operation (status, install, up, login, down, logout) and resolves with
 * what it left for the page: { time, installed, version, daemon, status: `tailscale status --json` | null }.
 */
export async function tailscale(op = 'status') {
	await run({ ACTION: 'tailscale', APP: 'atrio', OP: op })
	return readJson(`${STATE}/tailscale.json`)
}

/** What the server found last time, without asking again (null before the first time). */
export function lastTailscale() {
	return readJson(`${STATE}/tailscale.json`)
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

/** A SMART self-test now, short or long, on a disk smartctl lists; the disk runs it on its own. */
export const startDiskTest = (device, kind) => run({ ACTION: 'disk-test', APP: 'atrio', DEVICE: device, KIND: kind })

/** The network now, measured on the server over a few seconds: { time, server: { down, up }, apps: [{ app, down, up } | { app, host }] } */
export async function measureNetwork() {
	await run({ ACTION: 'network', APP: 'atrio' })
	return readJson(`${STATE}/network.json`)
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
		title: vm.$t('{title} did not start after the update', { title }),
		message: vm.$t('A backup from just before the update is ready. Go back to it? The app returns to the version and the data it had then.'),
		confirmText: vm.$t('Go back'),
		cancelText: vm.$t('Leave it'),
		type: 'is-danger',
		onConfirm: async () => {
			vm.$buefy.toast.open({ message: vm.$t('Restoring {title}…', { title: escapeHtml(title) }), type: 'is-info' })
			try {
				await restoreApp(name, id)
				vm.$buefy.toast.open({ message: vm.$t('{title} is back as it was before the update', { title: escapeHtml(title) }), type: 'is-success', duration: 6000 })
			}
			catch (e) {
				vm.$buefy.toast.open({ message: escapeHtml(vm.$t(e.message)), type: 'is-danger', duration: 10000 })
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

// --- New versions by digest: apps on "latest", which the App Store never offers an update for ------

/** What the server found last time: { [app]: { state: 'update' | 'current' | 'unknown', checked, services } }. */
export async function loadDigestUpdates() {
	return (await readJson(`${STATE}/updates.json`))?.apps || {}
}

/** How each app is doing, from atrio-alerts every 5 minutes: { [app]: { state, since, detail } }. */
export async function loadHealth() {
	return (await readJson(`${STATE}/health.json`))?.apps || {}
}

/** The apps whose updates are not shown: they can still be updated by hand. */
export async function loadIgnoredUpdates() {
	return (await readJson(`${STATE}/updates.json`))?.ignored || []
}

export const setIgnoreUpdates = (name, ignore) => run({ ACTION: 'ignore-updates', APP: name, IGNORE: ignore ? 1 : 0 })

/** The apps the server updates on its own each night, to the newer image of the tag they use. */
export async function loadAutoUpdates() {
	return (await readJson(`${STATE}/updates.json`))?.auto || []
}

export const setAutoUpdates = (name, auto) => run({ ACTION: 'auto-updates', APP: name, AUTO: auto ? 1 : 0 })

/** Asks the registries again for one app; resolves with its state, or '' when the service cannot. */
// Whether the registry has a newer image of the tag the app uses: { state: 'update' | 'current' |
// 'unknown' | '' } and, when the check itself failed, its `error`
async function checkDigest(name) {
	try {
		await run({ ACTION: 'check-updates', APP: name })
		return { state: (await loadDigestUpdates())[name]?.state || '' }
	}
	catch (e) {
		return { state: '', error: e.message || 'Unknown error' }
	}
}

function digestFailed(vm, title, error, quiet) {
	if (!quiet) {
		vm.$buefy.toast.open({
			message: vm.$t('Atrio could not look for a newer image of {title}: {reason}', { title: escapeHtml(title), reason: escapeHtml(vm.$t(error)) }),
			type: 'is-danger',
			duration: 12000,
		})
	}
	return 'failed'
}

const ROLLED_BACK = 'The new version did not start, so the app went back to how it was before the update'

// The server makes a backup, writes the App Store's images (`images`, "service=image") if any, downloads
// them, recreates the app and checks it; if it does not come up, it goes back to the backup on its own.
// Rejects with 'Unknown request' when the service on the server is older than this.
async function updateOnServer(vm, name, title, quiet, images = []) {
	if (!quiet) vm.$buefy.toast.open({ message: vm.$t('Saving a backup of {title}, then updating it…', { title: escapeHtml(title) }), type: 'is-info', duration: 5000 })
	try {
		await run({ ACTION: 'update-app', APP: name, SET_IMAGE: images })
		if (!quiet) vm.$buefy.toast.open({ message: vm.$t('{title} is updated', { title: escapeHtml(title) }), type: 'is-success' })
		return 'updated'
	}
	catch (e) {
		if (e.message === 'Unknown request') throw e
		if (!quiet) {
			vm.$buefy.toast.open({
				message: e.message === ROLLED_BACK
					? vm.$t('{title} did not start with the new version, so Atrio put it back as it was before the update.', { title: escapeHtml(title) })
					: vm.$t('{title} was not updated: {reason}', { title: escapeHtml(title), reason: escapeHtml(vm.$t(e.message)) }),
				type: e.message === ROLLED_BACK ? 'is-warning' : 'is-danger',
				duration: 12000,
			})
		}
		return 'failed'
	}
}

// The App Store's image for each service whose image it changes, as "service=image". Like CasaOS, a
// service on "latest" keeps its image. Null when the App Store's version cannot be read.
async function storeImages(openAPI, name) {
	try {
		const { appStore, compose } = openAPI.appManagement
		const mine = (await compose.myComposeApp(name)).data.data
		const storeId = mine.store_info?.store_app_id || name
		const store = (await appStore.composeApp(storeId)).data.data?.compose?.services || {}
		const images = []
		for (const [service, { image }] of Object.entries(mine.compose?.services || {})) {
			const next = store[service]?.image
			if (!next || !image || next === image || /:latest(@|$)/.test(image) || !/:/.test(image.split('/').pop())) continue
			images.push(`${service}=${next}`)
		}
		return images
	}
	catch (e) {
		return null
	}
}

/**
 * Updates one app, safely: not when it would go back to an older version, and with a backup first.
 * `vm` is the calling component. Resolves with 'kept' (would go back), 'current' (nothing newer), 'failed', 'started'
 * (CasaOS updates it in the background) or 'updated' (a newer image of the same tag, already done on the server).
 * With `quiet`, nothing is asked or shown, for bulk actions.
 */
// Updates an app to a newer image of the tag it has now, on the server; nothing else is changed
async function updateOwnTag(vm, name, title, quiet) {
	const toast = (message, type, duration = 8000) => {
		if (!quiet) vm.$buefy.toast.open({ message, type, duration })
	}
	if (!await backupsInstalled()) {
		toast(vm.$t('{title} runs an image chosen in its settings: Atrio updates it on the server, where its services are not installed yet.', { title: escapeHtml(title) }), 'is-warning', 10000)
		return 'failed'
	}
	const digest = await checkDigest(name)
	if (digest.error) return digestFailed(vm, title, digest.error, quiet)
	if (digest.state === 'update') {
		try {
			return await updateOnServer(vm, name, title, quiet)
		}
		catch (e) {
			return 'failed'
		}
	}
	if (digest.state === 'current') {
		toast(vm.$t('{title} is up to date', { title: escapeHtml(title) }), 'is-info', 3000)
		return 'current'
	}
	toast(vm.$t('No newer image of {title} was found: the registry of its image did not answer.', { title: escapeHtml(title) }), 'is-info')
	return 'current'
}

export async function updateApp(vm, name, title, { quiet = false } = {}) {
	const compose = vm.$openAPI.appManagement.compose
	let listed = null
	try {
		listed = (await compose.myComposeAppList()).data.data?.[name] || null
	}
	catch (e) {
		// Asked again below
	}
	// An app whose image was chosen by hand (CasaOS calls it "uncontrolled", #13) keeps that image:
	// only a newer image of the same tag, never the App Store's version, which would replace it
	if (listed?.is_uncontrolled) return updateOwnTag(vm, name, title, quiet)
	const older = await findDowngrade(vm.$openAPI, name)
	if (older) {
		// The App Store's tag is not taken, but a newer image of the tag the app has now is fine
		if (await backupsInstalled()) {
			const digest = await checkDigest(name)
			if (digest.state === 'update') {
				try {
					return await updateOnServer(vm, name, title, quiet)
				}
				catch (e) {
					return 'failed'
				}
			}
			// Its own tag has nothing newer: the App Store's older version does not matter then
			if (digest.state === 'current') {
				if (!quiet) vm.$buefy.toast.open({ message: vm.$t('{title} is up to date', { title: escapeHtml(title) }), type: 'is-info' })
				return 'current'
			}
			// Said as it is, not as an App Store version (an app installed from elsewhere may share its name)
			if (digest.error) return digestFailed(vm, title, digest.error, quiet)
		}
		if (!quiet) {
			vm.$buefy.toast.open({
				message: vm.$t('{title} stays on {installed}: the App Store only offers {store}, which could stop it from working. To change version, edit the tag in its settings.', { title: escapeHtml(title), installed: escapeHtml(older.installed), store: escapeHtml(older.store) }),
				type: 'is-warning',
				duration: 10000,
			})
		}
		return 'kept'
	}

	let backupId = ''
	// When the list did not answer, CasaOS asks again itself when updating
	const hasUpdate = Boolean(listed?.update_available)
	// Nothing newer in the App Store: an app on "latest" may still have a newer image of the same tag
	let digestState = ''
	if (!hasUpdate && await backupsInstalled()) {
		const digest = await checkDigest(name)
		const state = digest.state
		digestState = state
		if (digest.error) return digestFailed(vm, title, digest.error, quiet)
		if (state === 'update') {
			try {
				return await updateOnServer(vm, name, title, quiet)
			}
			catch (e) {
				return 'failed'
			}
		}
		if (state === 'current') {
			if (!quiet) vm.$buefy.toast.open({ message: vm.$t('{title} is up to date', { title: escapeHtml(title) }), type: 'is-info' })
			return 'current'
		}
	}

	// The App Store's version, on the server: backup, new version, and back on its own if it does not start
	if (hasUpdate && await backupsInstalled()) {
		const images = await storeImages(vm.$openAPI, name)
		if (images?.length) {
			try {
				return await updateOnServer(vm, name, title, quiet, images)
			}
			catch (e) {
				// A service older than 0.1.18: CasaOS updates it, with the backup and the watch below
			}
		}
	}

	if (hasUpdate && await backupsInstalled()) {
		if (!quiet) vm.$buefy.toast.open({ message: vm.$t('Saving a backup of {title} before updating…', { title: escapeHtml(title) }), type: 'is-info', duration: 5000 })
		try {
			backupId = (await backupApp(name, null, 'before-update')).id
		}
		catch (e) {
			if (!quiet) {
				vm.$buefy.toast.open({
					message: vm.$t('{title} was not updated, because the backup failed: {reason}', { title: escapeHtml(title), reason: escapeHtml(vm.$t(e.message)) }),
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
			// CasaOS does nothing here: the App Store has no newer version yet, even if the app itself announces one.
			// With the registry silent too (an app installed from elsewhere, say), both are said.
			if (!quiet) {
				vm.$buefy.toast.open({
					message: digestState === 'unknown'
						? vm.$t('No newer version of {title} was found: the App Store has none, and the registry of its image did not answer.', { title: escapeHtml(title) })
						: vm.$t('{title} is already on the version the App Store offers. The app may announce a newer one before the App Store has it.', { title: escapeHtml(title) }),
					type: 'is-info',
					duration: 8000,
				})
			}
			return 'current'
		}
		if (!quiet) vm.$buefy.toast.open({ message: res.data.message ? escapeHtml(res.data.message) : vm.$t('No updates are currently available for the application.'), type: 'is-success' })
	}
	catch (e) {
		if (!quiet) vm.$buefy.toast.open({ message: vm.$t('Unable to update at the moment!'), type: 'is-danger' })
		return 'failed'
	}
	if (backupId) watchUpdate(vm, name, title, backupId)
	return 'started'
}
