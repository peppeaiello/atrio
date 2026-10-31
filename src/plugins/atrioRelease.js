// Atrio's own updates, shared by the settings row (AtrioUpdate), the dot on the settings icon
// (TopBar) and the full-page progress screen (AtrioUpdateScreen).
// The update itself runs on the server: we create the request file through the CasaOS file API and
// atrio-update (installed by scripts/install.sh) reports its progress in the status file.
import { reactive } from 'vue'
import api from '@/service/api.js'
import { reloadFresh } from '@/plugins/reloadFresh'

const REPO = 'peppeaiello/atrio'
const STATE = '/var/lib/casaos/atrio'
const POLL_MS = 2000
const TIMEOUT_MS = 5 * 60 * 1000
// The settings icon stays up to date on a page left open for days
const RECHECK_MS = 6 * 60 * 60 * 1000

/* global __ATRIO_VERSION__ */
export const CURRENT = __ATRIO_VERSION__

export const release = reactive({
	latest: '',
	checking: false,
	checkFailed: false,
	updaterInstalled: null,
	// Set while an update runs: { step, message, error, to }
	run: null,
})

// Semantic versions: 1.2.0 > 1.2.0-rc.2 > 1.2.0-rc.1
function parseVersion(version) {
	const [core, pre = ''] = version.replace(/^v/, '').split('-', 2)
	return { core: core.split('.').map((n) => Number(n) || 0), pre: pre ? pre.split('.') : [] }
}

export function isNewer(latest, current) {
	const a = parseVersion(latest)
	const b = parseVersion(current)
	for (let i = 0; i < 3; i++) {
		if ((a.core[i] || 0) !== (b.core[i] || 0)) return (a.core[i] || 0) > (b.core[i] || 0)
	}
	if (!a.pre.length || !b.pre.length) return !a.pre.length && b.pre.length > 0
	for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
		const x = a.pre[i]
		const y = b.pre[i]
		if (x === undefined || y === undefined) return y === undefined
		if (x === y) continue
		const nx = Number(x)
		const ny = Number(y)
		if (!Number.isNaN(nx) && !Number.isNaN(ny)) return nx > ny
		return x > y
	}
	return false
}

export function updateAvailable() {
	// In development checkLatest never runs, so latest stays empty
	return !!release.latest && isNewer(release.latest, CURRENT)
}

async function readStatus() {
	try {
		const res = await api.file.getContent(`${STATE}/update-status.json`)
		return res.data.success === 200 ? JSON.parse(res.data.data) : null
	}
	catch (e) {
		return null
	}
}

let lastCheck = 0
let checking = null

/** Asks GitHub for the latest release; repeated calls within RECHECK_MS reuse the last answer. */
export function checkLatest({ force = false } = {}) {
	if (import.meta.env.DEV) return Promise.resolve()
	if (checking) return checking
	if (!force && lastCheck && Date.now() - lastCheck < RECHECK_MS) return Promise.resolve()
	release.checking = true
	release.checkFailed = false
	checking = (async () => {
		try {
			const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } })
			if (res.status === 404) release.latest = ''
			else if (res.ok) release.latest = (await res.json()).tag_name
			else release.checkFailed = true
		}
		catch (e) {
			release.checkFailed = true
		}
		release.updaterInstalled = (await readStatus()) !== null
		lastCheck = Date.now()
		release.checking = false
		checking = null
	})()
	return checking
}

export function startRechecking() {
	checkLatest()
	return setInterval(checkLatest, RECHECK_MS)
}

// Steps of the progress screen, recognised from the messages atrio-update writes
export const STEPS = ['Preparing', 'Downloading', 'Installing', 'Restarting CasaOS', 'Reloading']
function stepOf(message, current) {
	if (/^Downloading/.test(message)) return 1
	if (/^Installing/.test(message)) return 2
	if (/^Restarting/.test(message)) return 3
	return current
}

let pollTimer

/** Starts the update on the server and follows it until the page reloads or it fails. */
export async function startUpdate() {
	if (release.run && !release.run.error) return
	release.run = { step: 0, message: '', error: '', to: release.latest }
	const started = Date.now()
	// The updater copies this token into its status, so we know the status is about this run
	const token = `${started.toString(36)}-${Math.random().toString(36).slice(2, 10)}`
	try {
		const request = `${STATE}/update-request.tmp`
		const created = await api.file.create(request)
		const written = await api.file.update(request, token)
		if (created.data.success !== 200 || written.data.success !== 200) throw new Error('request')
		// Renamed in place so the updater only ever sees a complete request
		const renamed = await api.file.rename(request, `${STATE}/update-request`)
		if (renamed.data.success !== 200) throw new Error('request')
	}
	catch (e) {
		release.run.error = 'Could not reach the updater on the server'
		return
	}
	const poll = async () => {
		// While the gateway restarts the status cannot be read: keep waiting
		const status = await readStatus()
		// Updaters installed before 0.1.3 write no token: fall back to the time of the status
		const fresh = status && ('token' in status ? status.token === token : Date.parse(status.time) >= started - 5000)
		if (fresh && status.state === 'done') {
			release.run.step = 4
			setTimeout(reloadFresh, 1500)
			return
		}
		if (fresh && status.state === 'error') {
			release.run.error = status.message || 'The update failed, Atrio was not changed'
			return
		}
		if (Date.now() - started > TIMEOUT_MS) {
			release.run.error = 'The update is taking too long'
			return
		}
		if (fresh && status.message) {
			release.run.message = status.message
			release.run.step = stepOf(status.message, release.run.step)
		}
		pollTimer = setTimeout(poll, POLL_MS)
	}
	pollTimer = setTimeout(poll, POLL_MS)
}

export function dismissUpdate() {
	clearTimeout(pollTimer)
	release.run = null
}
