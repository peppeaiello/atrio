<script>
// What happened on the server: installs, updates, backups, restores and the rest, newest first.
// The services on the server write activity.log (see scripts/). The Activity tab of the
// notification centre, opened with `$EventBus.$emit('atrio:open-activity')`.
import api from '@/service/api.js'
import { ice_i18n } from '@/mixins/base/common-i18n'

const LOG = '/var/lib/casaos/atrio/activity.log'
const PAGE = 100
const REASONS = { 'manual': 'by hand', 'before-update': 'before an update', 'before-restore': 'before a restore', 'scheduled': 'automatic' }

// icon, and what happened (ok, error) as a sentence with {app} and {detail}
const ACTIONS = {
	'app-installed': ['download-outline', '{app} was installed'],
	'app-removed': ['trash-can-outline', '{app} was removed'],
	'app-updated': ['arrow-up-circle-outline', '{app} was updated'],
	'app-down': ['alert-circle-outline', '{app} is not working: {detail}', '{app} is not working: {detail}'],
	'app-up': ['check-circle-outline', '{app} is working again'],
	'disk-health': ['harddisk', '{detail}', '{detail}'],
	'disk-test': ['harddisk', '{detail}', '{detail}'],
	'update-app': ['arrow-up-circle-outline', '{app} was updated to a newer image of the same version, after a backup', '{app} was not updated: {detail}'],
	'backup': ['archive-outline', 'Backup of {app} ({detail})', 'Backup of {app} failed: {detail}'],
	'restore': ['backup-restore', '{app} went back to a backup', 'Restore of {app} failed: {detail}'],
	'delete': ['archive-remove-outline', 'A backup of {app} was deleted', 'A backup of {app} could not be deleted: {detail}'],
	'destination': ['folder-outline', 'New backup folder: {detail}', 'The backup folder was not changed: {detail}'],
	'schedule': ['calendar-clock', 'Automatic backups of {app}: {detail}', 'Automatic backups of {app} were not changed: {detail}'],
	// Folder backups: {app} is the folder
	'folder-backup': ['archive-outline', 'Backup of {app} ({detail})', 'Backup of {app} failed: {detail}'],
	'folder-restore': ['backup-restore', '{detail}', 'Restore of {app} failed: {detail}'],
	'folder-delete': ['archive-remove-outline', 'A backup of {app} was deleted', 'A backup of {app} could not be deleted: {detail}'],
	'folder-save': ['calendar-clock', 'Automatic backups of {app}: {detail}', 'Automatic backups of {app} were not changed: {detail}'],
	'folder-remove': ['folder-remove-outline', '{app} is no longer backed up', '{app} is still backed up: {detail}'],
	'ignore-updates': ['bell-off-outline', '{detail}'],
	'auto-updates': ['update', '{detail}'],
	'auto-update': ['arrow-up-circle-outline', '{app} was updated automatically to a newer image of the same version, after a backup', '{app} was not updated automatically: {detail}'],
	'remove-images': ['layers-remove', '{detail}', 'Unused images were not all removed: {detail}'],
	'export-settings': ['download-outline', 'Settings saved to a file', 'Settings could not be saved: {detail}'],
	'import-settings': ['upload-outline', 'Settings loaded from a file', 'Settings could not be loaded: {detail}'],
	'atrio-update': ['update', 'Atrio {detail} installed'],
	'tailscale': ['vpn', '{detail}', '{detail}'],
}

export default {
	name: 'ActivityList',
	compatConfig: { MODE: 3 },
	data() {
		return {
			loading: false,
			events: null,
			titles: {},
			shown: PAGE,
		}
	},
	computed: {
		// Newest first, by day
		days() {
			const days = []
			for (const event of (this.events || []).slice(0, this.shown)) {
				const day = this.dayOf(event.time)
				if (days[days.length - 1]?.day !== day) days.push({ day, events: [] })
				days[days.length - 1].events.push(event)
			}
			return days
		},
	},
	mounted() {
		this.load()
	},
	methods: {
		async load() {
			this.loading = true
			try {
				const [text, grid] = await Promise.all([
					api.file.getContent(LOG).then((res) => (res.data.success === 200 ? String(res.data.data ?? '') : ''), () => ''),
					this.$openAPI.appGrid.getAppGrid().then((res) => res.data.data || [], () => []),
				])
				this.titles = Object.fromEntries(grid.map((item) => [item.name, typeof item.title === 'object' ? ice_i18n(item.title) : item.title || item.name]))
				this.events = text.split('\n').filter(Boolean).map((line) => {
					const [time, action, result, app, detail] = line.split('\t')
					return { time, action, result, app, detail: detail || '' }
				}).filter((event) => ACTIONS[event.action]).reverse()
			}
			finally {
				this.loading = false
			}
		},
		dayOf(time) {
			const date = new Date(time)
			if (Number.isNaN(date.getTime())) return ''
			const today = new Date()
			const yesterday = new Date(Date.now() - 86400000)
			if (date.toDateString() === today.toDateString()) return this.$t('Today')
			if (date.toDateString() === yesterday.toDateString()) return this.$t('Yesterday')
			return date.toLocaleDateString(this.$i18n.locale?.replace('_', '-'), { weekday: 'long', day: 'numeric', month: 'long' })
		},
		hour(time) {
			const date = new Date(time)
			return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString(this.$i18n.locale?.replace('_', '-'), { hour: '2-digit', minute: '2-digit' })
		},
		icon(event) {
			return event.result === 'error' ? 'alert-circle-outline' : ACTIONS[event.action][0]
		},
		detail(event) {
			const words = event.detail.split(' ')
			switch (event.action) {
				case 'backup':
				case 'folder-backup': return event.result === 'ok' ? this.$t(REASONS[words[0]] || 'by hand') : this.$t(event.detail)
				case 'folder-restore':
					// "copy <where it went>" or "replace <the folder>"
					if (event.result === 'error') return this.$t(event.detail)
					return words[0] === 'copy'
						? this.$t('A backup of {app} was restored to {folder}', { app: this.title(event), folder: event.detail.slice(5) })
						: this.$t('{app} went back to a backup', { app: this.title(event) })
				case 'schedule':
				case 'folder-save':
					if (event.result === 'error') return this.$t(event.detail)
					if (words[0] === 'off') return this.$t('turned off')
					return words[0] === 'weekly'
						? this.$t('every {day} at {time}', { day: new Date(2024, 0, Number(words[2]) || 1).toLocaleDateString(this.$i18n.locale?.replace('_', '-'), { weekday: 'long' }), time: words[1] })
						: this.$t('every day at {time}', { time: words[1] })
				case 'ignore-updates': return event.result === 'error' ? this.$t(event.detail) : words[0] === '1'
					? this.$t('Updates of {app} are no longer shown', { app: this.title(event) })
					: this.$t('Updates of {app} are shown again', { app: this.title(event) })
				case 'auto-updates': return event.result === 'error' ? this.$t(event.detail) : words[0] === '1'
					? this.$t('{app} is now updated automatically', { app: this.title(event) })
					: this.$t('{app} is no longer updated automatically', { app: this.title(event) })
				case 'remove-images': {
					const [count, freed] = words.map(Number)
					return event.result === 'ok' ? this.$t('{count} unused images removed', { count: count || 0 }) + (freed > 0 ? ` (${this.size(freed)})` : '') : this.$t(event.detail)
				}
				case 'disk-health': return words[0] === 'replace'
					? this.$t('Disk {device} may fail soon: back up its data and plan to replace it', { device: words[1] })
					: this.$t('Disk {device} shows the first signs of trouble', { device: words[1] })
				case 'disk-test': {
					// "short started /dev/sda", "long failed /dev/sda"
					const kind = words[0] === 'long' ? 'Long' : 'Short'
					const text = {
						'started': '{kind} self-test started on {device}',
						'not-started': '{device} did not start a {kind} self-test',
						'passed': '{kind} self-test of {device} passed',
						'failed': '{kind} self-test of {device} failed',
						'aborted': '{kind} self-test of {device} stopped before the end',
					}[words[1]]
					return text ? this.$t(text, { kind: this.$t(kind).toLowerCase(), device: words[2] }).replace(/^./, (c) => c.toUpperCase()) : event.detail
				}
				case 'tailscale': {
					// "install", "up", or on an error "down: the reason"
					const op = words[0].replace(/:$/, '')
					if (event.result === 'error') {
						const failed = { install: 'Tailscale was not installed', up: 'Tailscale was not turned on', down: 'Tailscale was not turned off', login: 'The Tailscale sign-in did not start', logout: 'Tailscale did not sign out' }[op]
						const reason = event.detail.includes(':') ? event.detail.slice(event.detail.indexOf(':') + 1).trim() : ''
						return failed ? [this.$t(failed), reason && this.$t(reason)].filter(Boolean).join(': ') : event.detail
					}
					const done = { install: 'Tailscale was installed', up: 'Tailscale was turned on', down: 'Tailscale was turned off', login: 'A Tailscale sign-in was started', logout: 'Signed out of Tailscale' }[op]
					return done ? this.$t(done) : event.detail
				}
				case 'app-down': {
					const what = { 'restarting': 'Keeps restarting', 'crashed': 'Stopped on its own', 'unhealthy': 'Not healthy', 'no-answer': 'Not answering' }[words[0]]
					return what ? this.$t(what).toLowerCase() + (words[0] === 'crashed' && words[1] ? ` (${words[1]})` : '') : event.detail
				}
				default: return event.result === 'error' ? this.$t(event.detail) : event.detail
			}
		},
		title(event) {
			return this.titles[event.app] || event.app
		},
		text(event) {
			// The updater logs the services on the server as "services <version>", also when they failed
			if (event.action === 'atrio-update' && event.detail.startsWith('services ')) {
				const version = event.detail.slice('services '.length)
				return event.result === 'error'
					? this.$t('The services on the server were not brought up to date to Atrio {version}', { version })
					: this.$t('The services on the server were brought up to date to Atrio {version}', { version })
			}
			const [, ok, failed] = ACTIONS[event.action]
			return this.$t(event.result === 'error' && failed ? failed : ok, { app: this.title(event), detail: this.detail(event) })
		},
		size(bytes) {
			const units = ['B', 'KB', 'MB', 'GB', 'TB']
			let value = bytes
			let unit = 0
			while (value >= 1000 && unit < units.length - 1) {
				value /= 1000
				unit++
			}
			return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`
		},
	},
}
</script>

<template>
	<div class="atrio-activity">
		<p class="atrio-activity-sub">{{ $t('What happened on this server: installs, updates, backups and restores, also while Atrio was closed.') }}</p>
		<p v-if="loading && !events" class="atrio-config-empty">{{ $t('Loading…') }}</p>
		<div v-else-if="!events?.length" class="atrio-notifications-empty">
			<b-icon icon="history" pack="mdi" size="is-large" />
			<p>{{ $t('Nothing yet') }}</p>
			<small>{{ $t('Installs, updates, backups and restores appear here as they happen.') }}</small>
		</div>
		<template v-else>
			<section v-for="group in days" :key="group.day" class="atrio-activity-day">
				<h3>{{ group.day }}</h3>
				<ul class="atrio-activity-list">
					<li v-for="(event, index) in group.events" :key="`${event.time}-${index}`" :class="{ 'is-error': event.result === 'error' }">
						<b-icon :icon="icon(event)" pack="mdi" size="is-20" />
						<span class="atrio-activity-text">{{ text(event) }}</span>
						<time :datetime="event.time">{{ hour(event.time) }}</time>
					</li>
				</ul>
			</section>
			<button v-if="events.length > shown" class="atrio-button is-small" type="button" @click="shown += 100">{{ $t('Show older') }}</button>
		</template>
	</div>
</template>

<style lang="scss">
.atrio-activity {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.atrio-activity-sub {
	color: var(--atrio-text-muted);
	font-size: 0.8125rem;
}

.atrio-activity-day h3 {
	margin-bottom: 0.25rem;
	color: var(--atrio-text-muted);
	font-size: 0.75rem;
	font-weight: 700;
	letter-spacing: 0.06em;
	text-transform: uppercase;
}
.atrio-activity-list {
	margin: 0;
	padding: 0;
	list-style: none;

	li {
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
		padding: 0.5rem 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		font-size: 0.875rem;

		> .icon {
			flex: none;
			margin-top: 0.0625rem;
			color: var(--atrio-text-soft);
		}

		&.is-error > .icon {
			color: #fca5a5;
		}
	}

	time {
		flex: none;
		margin-left: auto;
		color: var(--atrio-text-muted);
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
	}
}

.atrio-activity-text {
	min-width: 0;
	word-break: break-word;
}
</style>
