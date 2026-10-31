<script>
// Collects notifications from the message bus and the update checks, and shows them in a side
// panel opened with `$EventBus.$emit('atrio:open-notifications')` (the bell in the header).
import { ice_i18n } from '@/mixins/base/common-i18n'
import { checkLatest, release, updateAvailable } from '@/plugins/atrioRelease'
import { restoreFocus, trapTab } from '@/plugins/focusTrap'
import { clearNotifications, hasNotification, markAllRead, notifications, notify, removeNotification } from '@/plugins/notifications'

const DISK_FULL = 90
const DISK_OK = 85
const HOT = 85
const COOL = 75
const ICONS = { info: 'information-outline', success: 'check-circle-outline', warning: 'alert-outline', error: 'alert-circle-outline' }

function appTitle(properties) {
	try {
		return ice_i18n(JSON.parse(properties['app:title'])) || properties['app:name']
	}
	catch (e) {
		return properties['app:name'] || properties.name || ''
	}
}

export default {
	name: 'NotificationCenter',
	compatConfig: { MODE: 3 },
	data() {
		return {
			open: false,
			notifications,
			// Unread when the panel opened: still highlighted while it stays open
			fresh: [],
			now: Date.now(),
			icons: ICONS,
		}
	},
	computed: {
		items() {
			return this.notifications.items
		},
		atrioUpdate() {
			return updateAvailable() ? release.latest : ''
		},
	},
	watch: {
		// A new Atrio version, announced once per version
		atrioUpdate: {
			immediate: true,
			handler(version) {
				if (!version || hasNotification(`atrio-${version}`)) return
				notify({
					key: `atrio-${version}`,
					level: 'info',
					title: this.$t('Atrio {version} is available', { version }),
					body: this.$t('Open the settings to update.'),
				})
			},
		},
	},
	mounted() {
		this.$EventBus.$on('atrio:open-notifications', this.show)
		window.addEventListener('keydown', this.onKey)
		checkLatest()
		this.checkCasaOS()
	},
	beforeUnmount() {
		this.$EventBus.$off('atrio:open-notifications', this.show)
		window.removeEventListener('keydown', this.onKey)
		clearInterval(this.clock)
	},
	sockets: {
		'app:install-end'(res) {
			const props = res.Properties
			notify({ level: 'success', title: this.$t('{name} is installed', { name: appTitle(props) }), icon: props['app:icon'] })
		},
		'app:install-error'(res) {
			const props = res.Properties
			notify({ level: 'error', title: this.$t('{name} could not be installed', { name: appTitle(props) }), body: props.message || '', icon: props['app:icon'] })
		},
		'app:uninstall-end'(res) {
			const props = res.Properties
			notify({ level: 'info', title: this.$t('{name} was removed', { name: appTitle(props) }), icon: props['app:icon'] })
		},
		'app:apply-changes-end'(res) {
			const props = res.Properties
			notify({ level: 'success', title: this.$t('Settings of {name} saved', { name: appTitle(props) }), icon: props['app:icon'] })
		},
		'app:apply-changes-error'(res) {
			const props = res.Properties
			notify({ level: 'error', title: this.$t('Settings of {name} could not be saved', { name: appTitle(props) }), body: props.message || '', icon: props['app:icon'] })
		},
		'app:update-end'(res) {
			const props = res.Properties
			if (props['docker:image:updated'] !== 'true') return
			notify({ level: 'success', title: this.$t('{name} was updated', { name: props.name || appTitle(props) }) })
		},
		'casaos:system:utilization'(res) {
			try {
				this.checkSystem(JSON.parse(res.Properties.sys_disk || '{}'), JSON.parse(res.Properties.sys_cpu || '{}'))
			}
			catch (e) {
				// A malformed sample is skipped
			}
		},
	},
	methods: {
		// Warnings are raised once while the condition lasts, and again only after it went away
		checkSystem(disk, cpu) {
			if (disk.size) {
				const used = Math.round((disk.used / disk.size) * 100)
				if (used >= DISK_FULL && !this.diskFull) {
					this.diskFull = true
					notify({ key: 'disk-space', level: 'warning', title: this.$t('The system disk is {percent}% full', { percent: used }), body: this.$t('Free some space to keep apps and CasaOS working.') })
				}
				else if (used < DISK_OK) this.diskFull = false
			}
			if (disk.health === false && !this.diskSick) {
				this.diskSick = true
				notify({ key: 'disk-health', level: 'error', title: this.$t('The system disk reports a health problem'), body: this.$t('Back up your data and check the disk in Storage.') })
			}
			if (typeof cpu.temperature === 'number') {
				if (cpu.temperature >= HOT && !this.hot) {
					this.hot = true
					notify({ key: 'cpu-hot', level: 'warning', title: this.$t('The processor is at {temp} °C', { temp: Math.round(cpu.temperature) }), body: this.$t('Check the cooling and what is running.') })
				}
				else if (cpu.temperature < COOL) this.hot = false
			}
		},
		async checkCasaOS() {
			try {
				const res = await this.$api.sys.getVersion()
				const info = res.data.data || {}
				const version = info.version?.version || ''
				if (!info.need_update || hasNotification(`casaos-${version}`)) return
				notify({ key: `casaos-${version}`, level: 'info', title: this.$t('CasaOS {version} is available', { version }), body: this.$t('Open the settings to update.') })
			}
			catch (e) {
				// Checked again on the next page load
			}
		},
		show() {
			if (this.open) return
			this.returnFocus = document.activeElement
			this.fresh = this.items.filter((item) => !item.read).map((item) => item.id)
			this.now = Date.now()
			this.clock = setInterval(() => (this.now = Date.now()), 30000)
			this.open = true
			markAllRead()
			this.$nextTick(() => this.$refs.sheet?.focus())
		},
		close() {
			this.open = false
			clearInterval(this.clock)
			this.$nextTick(() => restoreFocus(this.returnFocus))
		},
		onKey(event) {
			if (!this.open || document.querySelector('.modal.is-active')) return
			if (event.key === 'Escape') this.close()
			else trapTab(event, this.$refs.sheet)
		},
		remove: removeNotification,
		clear() {
			clearNotifications()
		},
		ago(time) {
			const seconds = Math.max(0, Math.round((this.now - time) / 1000))
			if (seconds < 60) return this.$t('just now')
			const minutes = Math.round(seconds / 60)
			if (minutes < 60) return this.$t('{n} min ago', { n: minutes })
			const hours = Math.round(minutes / 60)
			if (hours < 24) return this.$t('{n} h ago', { n: hours })
			return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(time)
		},
	},
}
</script>

<template>
	<Teleport to="body">
		<transition name="atrio-sheet">
			<div v-if="open" class="atrio-sheet-backdrop" @click.self="close">
				<aside ref="sheet" :aria-label="$t('Notifications')" aria-modal="true" class="atrio-sheet atrio-settings atrio-notifications" role="dialog" tabindex="-1">
					<header class="atrio-sheet-head">
						<span class="atrio-settings-icon"><b-icon icon="bell-outline" pack="mdi" /></span>
						<div class="atrio-sheet-title">
							<h2>{{ $t('Notifications') }}</h2>
						</div>
						<button :aria-label="$t('Close')" class="atrio-icon-button" type="button" @click="close">
							<b-icon icon="close-outline" pack="casa" />
						</button>
					</header>

					<div v-if="items.length" class="atrio-notifications-tools">
						<span>{{ $t('{count} notifications', { count: items.length }) }}</span>
						<button class="atrio-button is-small" type="button" @click="clear">{{ $t('Clear all') }}</button>
					</div>

					<ul v-if="items.length" class="atrio-notifications-list">
						<li v-for="item in items" :key="item.id" :class="[`is-${item.level}`, { 'is-fresh': fresh.includes(item.id) }]">
							<span class="atrio-notification-icon">
								<img v-if="item.icon" :src="item.icon" alt="" @error="item.icon = ''">
								<b-icon v-else :icon="icons[item.level] || icons.info" pack="mdi" size="is-20" />
							</span>
							<div class="atrio-notification-text">
								<p class="atrio-notification-title">{{ item.title }}</p>
								<p v-if="item.body" class="atrio-notification-body">{{ item.body }}</p>
								<time :datetime="new Date(item.time).toISOString()">{{ ago(item.time) }}</time>
							</div>
							<button :aria-label="$t('Remove')" :title="$t('Remove')" class="atrio-notification-remove" type="button" @click="remove(item.id)">
								<b-icon icon="close-outline" pack="casa" size="is-16" />
							</button>
						</li>
					</ul>

					<div v-else class="atrio-notifications-empty">
						<b-icon icon="bell-check-outline" pack="mdi" size="is-large" />
						<p>{{ $t('Nothing new') }}</p>
						<small>{{ $t('Installs, updates and warnings about disks and temperature appear here.') }}</small>
					</div>
				</aside>
			</div>
		</transition>
	</Teleport>
</template>

<style lang="scss">
.atrio-notifications-tools {
	display: flex;
	align-items: center;
	justify-content: space-between;
	color: var(--atrio-text-muted);
	font-size: 0.8125rem;
}

.atrio-notifications-list {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;

	li {
		position: relative;
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
		padding: 0.875rem 2.5rem 0.875rem 0.875rem;
		border-radius: var(--atrio-radius-md, 20px);
		background: rgba(255, 255, 255, 0.04);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);

		&.is-fresh {
			background: rgba(34, 211, 238, 0.08);
			box-shadow: inset 0 0 0 1px rgba(34, 211, 238, 0.25);
		}
	}
}

.atrio-notification-icon {
	display: grid;
	flex-shrink: 0;
	place-items: center;
	width: 2.25rem;
	height: 2.25rem;
	overflow: hidden;
	border-radius: 0.75rem;
	background: rgba(255, 255, 255, 0.08);
	color: var(--atrio-text-soft);

	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.is-success & {
		color: #86efac;
	}

	.is-warning & {
		color: #fcd34d;
	}

	.is-error & {
		color: #fca5a5;
	}
}

.atrio-notification-text {
	display: flex;
	flex: 1;
	flex-direction: column;
	gap: 0.125rem;
	min-width: 0;

	time {
		margin-top: 0.125rem;
		color: var(--atrio-text-muted);
		font-size: 0.75rem;
	}
}

.atrio-notification-title {
	color: var(--atrio-text);
	font-size: 0.9375rem;
	font-weight: 600;
}

.atrio-notification-body {
	color: var(--atrio-text-soft);
	font-size: 0.8125rem;
	word-break: break-word;
}

.atrio-notification-remove {
	position: absolute;
	top: 0.625rem;
	right: 0.625rem;
	display: grid;
	place-items: center;
	width: 1.75rem;
	height: 1.75rem;
	border: 0;
	border-radius: 0.5rem;
	background: transparent;
	color: var(--atrio-text-muted);
	cursor: pointer;

	&:hover {
		background: rgba(255, 255, 255, 0.1);
		color: var(--atrio-text);
	}
}

.atrio-notifications-empty {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	align-items: center;
	padding: 3rem 1rem;
	color: var(--atrio-text-soft);
	text-align: center;

	.icon {
		color: var(--atrio-text-muted);
	}

	p {
		color: var(--atrio-text);
		font-size: 1rem;
		font-weight: 600;
	}

	small {
		max-width: 20rem;
		color: var(--atrio-text-muted);
		font-size: 0.8125rem;
	}
}
</style>
