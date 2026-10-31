<script>
// Side panel with an app's health, resource usage and live logs, plus its main actions.
// Opened with `$EventBus.$emit('atrio:open-app', app)` for compose (v2) apps.
import { restoreFocus, trapTab } from '@/plugins/focusTrap'
import business_OpenThirdApp from '@/mixins/app/Business_OpenThirdApp'
import business_ShowNewAppTag from '@/mixins/app/Business_ShowNewAppTag'
import { ice_i18n } from '@/mixins/base/common-i18n'
import { mixin } from '@/mixins/mixin'
import Sparkline from '@/components/widgets/Sparkline.vue'
import AppTerminalPanel from '@/components/Apps/AppTerminalPanel.vue'

const POLL_MS = 3000
const HISTORY = 40
const LOG_LINES = 200
// Terminal colour codes in container logs
const ANSI = /\x1B\[[0-9;]*[A-Za-z]/g

// Same formulas as the system widget: https://docs.docker.com/engine/api/v1.41/#operation/ContainerStats
function cpuPercent(item) {
	if (!item.previous) return 0
	const cpuDelta = item.data.cpu_stats.cpu_usage.total_usage - item.previous.cpu_stats.cpu_usage.total_usage
	const systemDelta = item.data.cpu_stats.system_cpu_usage - item.previous.cpu_stats.system_cpu_usage + 1
	const usage = Math.floor((cpuDelta / systemDelta) * 1000) / 10
	return Number.isFinite(usage) && usage > 0 ? usage : 0
}

function memoryBytes(item) {
	const memory = item.data.memory_stats
	if (!memory || !memory.stats) return 0
	const cache = memory.stats.inactive_file ?? memory.stats.cache ?? memory.stats.total_inactive_file ?? 0
	return Math.max(memory.usage - cache, 0)
}

export default {
	name: 'AppDetailsPanel',
	compatConfig: { MODE: 3 },
	components: { Sparkline },
	mixins: [mixin, business_ShowNewAppTag, business_OpenThirdApp],
	data() {
		return {
			app: null,
			status: '',
			containers: [],
			mainService: '',
			logs: '',
			cpuHistory: [],
			memHistory: [],
			busy: '',
			historySize: HISTORY,
		}
	},
	computed: {
		open() {
			return this.app !== null
		},
		title() {
			return this.app ? ice_i18n(this.app.title) || this.app.name : ''
		},
		running() {
			return this.status.startsWith('running')
		},
		runningContainers() {
			return this.containers.filter((c) => c.State === 'running').length
		},
		mainContainer() {
			return this.containers.find((c) => c.Service === this.mainService) || this.containers[0]
		},
		image() {
			return this.mainContainer?.Image?.split('@')[0] || ''
		},
		health() {
			return this.mainContainer?.Health || ''
		},
		cpu() {
			return this.cpuHistory[this.cpuHistory.length - 1] ?? 0
		},
		memory() {
			return this.memHistory[this.memHistory.length - 1] ?? 0
		},
		statusLabel() {
			if (this.busy) return this.$t('Working…')
			if (this.running && this.health === 'unhealthy') return `${this.$t('Running')} · ${this.$t('unhealthy')}`
			if (this.running) return this.health === 'healthy' ? `${this.$t('Running')} · ${this.$t('healthy')}` : this.$t('Running')
			return this.$t('Stopped')
		},
	},
	mounted() {
		this.$EventBus.$on('atrio:open-app', this.show)
		window.addEventListener('keydown', this.onKey)
	},
	beforeUnmount() {
		this.$EventBus.$off('atrio:open-app', this.show)
		window.removeEventListener('keydown', this.onKey)
		this.stopPolling()
	},
	methods: {
		show(app) {
			if (!this.open) this.returnFocus = document.activeElement
			this.app = app
			this.$nextTick(() => this.$refs.sheet?.focus())
			this.status = app.status || ''
			this.containers = []
			this.logs = ''
			this.cpuHistory = []
			this.memHistory = []
			this.refresh()
			this.stopPolling()
			this.timer = setInterval(this.poll, POLL_MS)
		},
		close() {
			this.app = null
			this.stopPolling()
			this.$nextTick(() => restoreFocus(this.returnFocus))
		},
		stopPolling() {
			clearInterval(this.timer)
		},
		onKey(event) {
			// A modal opened from the panel (settings, uninstall) handles its own keys
			if (!this.open || document.querySelector('.modal.is-active')) return
			if (event.key === 'Escape') this.close()
			else trapTab(event, this.$refs.sheet)
		},
		async refresh() {
			// Usage needs the container names
			await Promise.all([this.loadContainers(), this.loadLogs()])
			this.loadUsage()
		},
		poll() {
			this.loadLogs()
			this.loadUsage()
		},
		async loadContainers() {
			const name = this.app?.name
			try {
				const [details, containers] = await Promise.all([
					this.$openAPI.appManagement.compose.myComposeApp(name),
					this.$openAPI.appManagement.compose.composeAppContainers(name),
				])
				if (name !== this.app?.name) return
				this.status = details.data.data.status || ''
				this.mainService = containers.data.data.main || ''
				this.containers = Object.values(containers.data.data.containers || {})
			} catch (e) {
				console.error(e)
			}
		},
		async loadLogs() {
			const name = this.app?.name
			try {
				const res = await this.$openAPI.appManagement.compose.composeAppLogs(name, LOG_LINES)
				if (name !== this.app?.name) return
				const box = this.$refs.logs
				const atBottom = !box || box.scrollHeight - box.scrollTop - box.clientHeight < 24
				this.logs = String(res.data.data || '').replace(ANSI, '')
				if (atBottom) this.$nextTick(() => box && (box.scrollTop = box.scrollHeight))
			} catch (e) {
				console.error(e)
			}
		},
		async loadUsage() {
			const app = this.app?.name
			const names = new Set(this.containers.map((c) => c.Name))
			if (!names.size) return
			try {
				const res = await this.$api.container.getHardwareUsage()
				if (app !== this.app?.name) return
				const mine = (res.data.data || []).filter((item) => names.has(item.title))
				this.push(this.cpuHistory, mine.reduce((sum, item) => sum + cpuPercent(item), 0))
				this.push(this.memHistory, mine.reduce((sum, item) => sum + memoryBytes(item), 0))
			} catch (e) {
				console.error(e)
			}
		},
		push(list, value) {
			list.push(Math.round(value * 10) / 10)
			if (list.length > HISTORY) list.shift()
		},
		openApp() {
			this.running ? this.openThirdApp(this.app, true) : this.firstOpenThirdApp(this.app)
		},
		async setStatus(status, done) {
			this.busy = status
			try {
				await this.$openAPI.appManagement.compose.setComposeAppStatus(this.app.name, status)
				this.$buefy.toast.open({ message: `${this.title}: ${done}`, type: 'is-success' })
			} catch (e) {
				this.$buefy.toast.open({ message: `${this.title}: ${this.$t('the action failed')}`, type: 'is-danger' })
			} finally {
				this.busy = ''
				await this.loadContainers()
				this.$EventBus.$emit('atrio:refresh-apps')
			}
		},
		async update() {
			this.busy = 'update'
			try {
				const res = await this.$openAPI.appManagement.compose.updateComposeApp(this.app.name)
				this.$buefy.toast.open({ message: res.data.message || this.$t('No updates are currently available for the application.'), type: 'is-success' })
			} catch (e) {
				this.$buefy.toast.open({ message: this.$t('Unable to update at the moment!'), type: 'is-danger' })
			} finally {
				this.busy = ''
			}
		},
		openTerminal() {
			if (!this.mainContainer) return
			this.$buefy.modal.open({
				component: AppTerminalPanel,
				hasModalCard: true,
				customClass: 'terminal-modal',
				trapFocus: true,
				canCancel: [],
				scroll: 'keep',
				animation: 'zoom-in',
				props: { appid: this.mainContainer.ID, appName: this.app.name, serviceName: this.mainContainer.Service },
			})
		},
		openSettings() {
			const app = this.app
			this.close()
			this.$EventBus.$emit('atrio:config-app', app)
		},
	},
}
</script>

<template>
	<Teleport to="body">
		<transition name="atrio-sheet">
			<div v-if="open" class="atrio-sheet-backdrop" @click.self="close">
				<aside ref="sheet" :aria-label="title" aria-modal="true" class="atrio-sheet" role="dialog" tabindex="-1">
					<header class="atrio-sheet-head">
						<img :src="app.icon" alt="" class="atrio-sheet-icon">
						<div class="atrio-sheet-title">
							<h2>{{ title }}</h2>
							<p :class="running ? 'is-running' : 'is-stopped'" class="atrio-app-status">
								<span class="atrio-app-dot" />
								{{ statusLabel }}
							</p>
						</div>
						<button :aria-label="$t('Close')" class="atrio-icon-button" type="button" @click="close">
							<b-icon icon="close-outline" pack="casa" />
						</button>
					</header>

					<div class="atrio-sheet-actions">
						<button class="atrio-button is-primary" type="button" @click="openApp">
							<b-icon icon="open-in-new" pack="mdi" size="is-16" />
							{{ running ? $t('Open') : $t('Start and open') }}
						</button>
						<button :disabled="!!busy || !running" class="atrio-button" type="button" @click="setStatus('restart', $t('restarted'))">
							<b-icon icon="restart-outline" pack="casa" size="is-16" />
							{{ $t('Restart') }}
						</button>
						<button v-if="running" :disabled="!!busy" class="atrio-button" type="button" @click="setStatus('stop', $t('stopped'))">
							<b-icon icon="shutdown-outline" pack="casa" size="is-16" />
							{{ $t('Stop') }}
						</button>
						<button v-else :disabled="!!busy" class="atrio-button" type="button" @click="setStatus('start', $t('started'))">
							<b-icon icon="play" pack="casa" size="is-16" />
							{{ $t('Start') }}
						</button>
						<button v-if="!app.is_uncontrolled" :disabled="!!busy" class="atrio-button" type="button" @click="update">
							<b-icon icon="update-outline" pack="casa" size="is-16" />
							{{ $t('Update') }}
						</button>
					</div>

					<div class="atrio-sheet-stats">
						<div class="atrio-sheet-stat">
							<span class="atrio-metric-label">CPU</span>
							<span class="atrio-metric-number">{{ cpu }}%</span>
							<Sparkline :capacity="historySize" :values="cpuHistory" color="#22D3EE" />
						</div>
						<div class="atrio-sheet-stat">
							<span class="atrio-metric-label">{{ $t('Memory') }}</span>
							<span class="atrio-metric-number">{{ renderSize(memory) }}</span>
							<Sparkline :capacity="historySize" :values="memHistory" color="#818CF8" />
						</div>
					</div>

					<dl class="atrio-sheet-info">
						<template v-if="app.port">
							<dt>{{ $t('Web port') }}</dt>
							<dd>{{ app.port }}</dd>
						</template>
						<dt>{{ $t('Containers') }}</dt>
						<dd>{{ $t('{running} of {total} running', { running: runningContainers, total: containers.length }) }}</dd>
						<template v-if="image">
							<dt>{{ $t('Image') }}</dt>
							<dd class="is-mono">{{ image }}</dd>
						</template>
					</dl>

					<section class="atrio-sheet-logs">
						<div class="atrio-sheet-logs-head">
							<h3>{{ $t('Live logs') }}</h3>
							<span class="atrio-live"><span class="atrio-live-dot" />{{ $t('listening') }}</span>
						</div>
						<pre ref="logs">{{ logs || $t('No logs yet') }}</pre>
					</section>

					<footer class="atrio-sheet-footer">
						<button :disabled="!running || !mainContainer" class="atrio-button" type="button" @click="openTerminal">
							<b-icon icon="terminal-outline" pack="casa" size="is-16" />
							{{ $t('Terminal') }}
						</button>
						<button class="atrio-button" type="button" @click="openSettings">
							<b-icon icon="settings-outline" pack="casa" size="is-16" />
							{{ $t('Setting') }}
						</button>
					</footer>
				</aside>
			</div>
		</transition>
	</Teleport>
</template>

<style lang="scss">
.atrio-sheet-backdrop {
	position: fixed;
	inset: 0;
	z-index: 90;
	background: rgba(2, 6, 23, 0.45);
	backdrop-filter: blur(6px);
}

.atrio-sheet {
	position: absolute;
	top: 1rem;
	right: 1rem;
	bottom: 1rem;
	display: flex;
	flex-direction: column;
	gap: 1.25rem;
	width: min(34rem, calc(100% - 2rem));
	padding: 1.5rem;
	// Scrolls on short screens so the footer stays reachable
	overflow-y: auto;
	border-radius: 28px;
	background: var(--atrio-glass-bg-strong);
	backdrop-filter: blur(32px) saturate(150%);
	box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1), 0 24px 64px rgba(0, 0, 0, 0.4);
	color: var(--atrio-text);
}

.atrio-sheet-head {
	display: flex;
	align-items: center;
	gap: 1rem;

	.atrio-sheet-icon {
		width: 3.75rem;
		height: 3.75rem;
		border-radius: 1.125rem;
		object-fit: cover;
	}

	.atrio-sheet-title {
		flex: 1;
		min-width: 0;

		h2 {
			overflow: hidden;
			font-size: 1.5rem;
			font-weight: 700;
			letter-spacing: -0.02em;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.atrio-app-status {
			justify-content: flex-start;
			font-size: 0.8125rem;
		}
	}
}

.atrio-icon-button {
	display: grid;
	place-items: center;
	width: 2.75rem;
	height: 2.75rem;
	border: 0;
	border-radius: var(--atrio-radius-sm);
	background: rgba(255, 255, 255, 0.06);
	color: var(--atrio-text);
	cursor: pointer;

	&:hover {
		background: rgba(255, 255, 255, 0.12);
	}
}

.atrio-sheet-actions,
.atrio-sheet-footer {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem;
}

.atrio-button {
	display: inline-flex;
	align-items: center;
	gap: 0.5rem;
	height: 2.75rem;
	padding: 0 1rem;
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.875rem;
	background: rgba(255, 255, 255, 0.06);
	color: var(--atrio-text);
	font: inherit;
	font-size: 0.875rem;
	font-weight: 600;
	cursor: pointer;

	&:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.12);
	}

	&:disabled {
		opacity: 0.45;
		cursor: default;
	}

	&.is-primary {
		border-color: transparent;
		background: var(--atrio-text);
		color: #0b1120;
		font-weight: 700;

		&:hover:not(:disabled) {
			background: #e2e8f0;
		}
	}
}

.atrio-sheet-stats {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 0.625rem;
}

.atrio-sheet-stat {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	padding: 0.875rem;
	border-radius: var(--atrio-radius-md);
	background: rgba(255, 255, 255, 0.05);
	box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
}

.atrio-sheet-info {
	display: grid;
	grid-template-columns: 7.5rem minmax(0, 1fr);
	gap: 0.625rem 1rem;
	font-size: 0.875rem;

	dt {
		color: var(--atrio-text-muted);
	}

	dd {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.is-mono {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.8125rem;
	}
}

.atrio-sheet-logs {
	display: flex;
	flex: 1;
	flex-direction: column;
	gap: 0.625rem;
	min-height: 8rem;

	pre {
		flex: 1;
		margin: 0;
		padding: 0.875rem 1rem;
		overflow: auto;
		border-radius: var(--atrio-radius-md);
		background: rgba(2, 6, 23, 0.65);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
		color: var(--atrio-text-soft);
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.75rem;
		line-height: 1.6;
		white-space: pre-wrap;
		word-break: break-word;
	}
}

.atrio-sheet-logs-head {
	display: flex;
	align-items: center;
	justify-content: space-between;

	h3 {
		font-size: 0.875rem;
		font-weight: 700;
	}
}

.atrio-live {
	display: inline-flex;
	align-items: center;
	gap: 0.375rem;
	color: #a5f3fc;
	font-size: 0.75rem;
	font-weight: 600;

	.atrio-live-dot {
		width: 0.375rem;
		height: 0.375rem;
		border-radius: 50%;
		background: var(--atrio-accent);
	}
}

.atrio-sheet-enter-active,
.atrio-sheet-leave-active {
	transition: opacity 0.2s ease;

	.atrio-sheet {
		transition: transform 0.25s ease;
	}
}

.atrio-sheet-enter-from,
.atrio-sheet-leave-to {
	opacity: 0;

	.atrio-sheet {
		transform: translateX(2rem);
	}
}
</style>
