<script>
// What happened on the server: installs, updates, backups, restores and the rest, newest first.
// The services on the server write activity.log (see scripts/); opened with
// `$EventBus.$emit('atrio:open-activity')`. Shares the sheet styles of AppDetailsPanel.
import api from '@/service/api.js'
import { ice_i18n } from '@/mixins/base/common-i18n'
import { restoreFocus, trapTab } from '@/plugins/focusTrap'

const LOG = '/var/lib/casaos/atrio/activity.log'
const PAGE = 100
const REASONS = { 'manual': 'by hand', 'before-update': 'before an update', 'before-restore': 'before a restore', 'scheduled': 'automatic' }

// icon, and what happened (ok, error) as a sentence with {app} and {detail}
const ACTIONS = {
	'app-installed': ['download-outline', '{app} was installed'],
	'app-removed': ['trash-can-outline', '{app} was removed'],
	'app-updated': ['arrow-up-circle-outline', '{app} was updated'],
	'update-app': ['arrow-up-circle-outline', '{app} was updated to a newer image of the same version, after a backup', '{app} was not updated: {detail}'],
	'backup': ['archive-outline', 'Backup of {app} ({detail})', 'Backup of {app} failed: {detail}'],
	'restore': ['backup-restore', '{app} went back to a backup', 'Restore of {app} failed: {detail}'],
	'delete': ['archive-remove-outline', 'A backup of {app} was deleted', 'A backup of {app} could not be deleted: {detail}'],
	'destination': ['folder-outline', 'New backup folder: {detail}', 'The backup folder was not changed: {detail}'],
	'schedule': ['calendar-clock', 'Automatic backups of {app}: {detail}', 'Automatic backups of {app} were not changed: {detail}'],
	'ignore-updates': ['bell-off-outline', '{detail}'],
	'remove-images': ['layers-remove', '{detail}', 'Unused images were not all removed: {detail}'],
	'export-settings': ['download-outline', 'Settings saved to a file', 'Settings could not be saved: {detail}'],
	'import-settings': ['upload-outline', 'Settings loaded from a file', 'Settings could not be loaded: {detail}'],
	'atrio-update': ['update', 'Atrio {detail} installed'],
}

export default {
	name: 'ActivityPanel',
	compatConfig: { MODE: 3 },
	data() {
		return {
			open: false,
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
		this.$EventBus.$on('atrio:open-activity', this.show)
		window.addEventListener('keydown', this.onKey)
	},
	beforeUnmount() {
		this.$EventBus.$off('atrio:open-activity', this.show)
		window.removeEventListener('keydown', this.onKey)
	},
	methods: {
		async show() {
			if (this.open) return
			this.returnFocus = document.activeElement
			this.open = true
			this.shown = PAGE
			this.$nextTick(() => this.$refs.sheet?.focus())
			await this.load()
		},
		close() {
			this.open = false
			this.$nextTick(() => restoreFocus(this.returnFocus))
		},
		onKey(event) {
			if (!this.open) return
			if (event.key === 'Escape') this.close()
			else trapTab(event, this.$refs.sheet)
		},
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
				case 'backup': return event.result === 'ok' ? this.$t(REASONS[words[0]] || 'by hand') : this.$t(event.detail)
				case 'schedule':
					if (words[0] === 'off') return this.$t('turned off')
					return words[0] === 'weekly'
						? this.$t('every {day} at {time}', { day: new Date(2024, 0, Number(words[2]) || 1).toLocaleDateString(this.$i18n.locale?.replace('_', '-'), { weekday: 'long' }), time: words[1] })
						: this.$t('every day at {time}', { time: words[1] })
				case 'ignore-updates': return words[0] === '1'
					? this.$t('Updates of {app} are no longer shown', { app: this.title(event) })
					: this.$t('Updates of {app} are shown again', { app: this.title(event) })
				case 'remove-images': {
					const [count, freed] = words.map(Number)
					return event.result === 'ok' ? this.$t('{count} unused images removed', { count: count || 0 }) + (freed > 0 ? ` (${this.size(freed)})` : '') : this.$t(event.detail)
				}
				default: return event.result === 'error' ? this.$t(event.detail) : event.detail
			}
		},
		title(event) {
			return this.titles[event.app] || event.app
		},
		text(event) {
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
	<Teleport to="body">
		<transition name="atrio-sheet">
			<div v-if="open" class="atrio-sheet-backdrop" @click.self="close">
				<aside ref="sheet" :aria-label="$t('Activity')" aria-modal="true" class="atrio-sheet atrio-activity" role="dialog" tabindex="-1">
					<header class="atrio-sheet-head">
						<span class="atrio-activity-icon">
							<b-icon icon="history" pack="mdi" />
						</span>
						<div class="atrio-sheet-title">
							<h2>{{ $t('Activity') }}</h2>
							<p class="atrio-activity-sub">{{ $t('What happened on this server: installs, updates, backups and restores') }}</p>
						</div>
						<button :aria-label="$t('Close')" class="atrio-icon-button" type="button" @click="close">
							<b-icon icon="close-outline" pack="casa" />
						</button>
					</header>

					<p v-if="loading && !events" class="atrio-config-empty">{{ $t('Loading…') }}</p>
					<p v-else-if="!events?.length" class="atrio-config-empty">{{ $t('Nothing yet: installs, updates, backups and restores appear here as they happen.') }}</p>

					<div v-else class="atrio-sheet-config">
						<section v-for="group in days" :key="group.day">
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
					</div>
				</aside>
			</div>
		</transition>
	</Teleport>
</template>

<style lang="scss">
.atrio-activity {
	width: min(36rem, calc(100% - 2rem));
}

.atrio-activity-icon {
	display: grid;
	place-items: center;
	width: 3.75rem;
	height: 3.75rem;
	border-radius: 1.125rem;
	background: rgba(167, 139, 250, 0.16);
	color: #ddd6fe;

	.icon {
		width: 2rem;
		height: 2rem;
		font-size: 2rem;
	}
}

.atrio-activity-sub {
	color: var(--atrio-text-muted);
	font-size: 0.8125rem;
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
