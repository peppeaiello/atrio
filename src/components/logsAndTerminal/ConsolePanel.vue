<script>
// One console for the server and every app: pick a source on the left, then its logs (filter,
// follow, download) or its terminal. Opened from the terminal icon in the header.
import { ice_i18n } from '@/mixins/base/common-i18n'
import { trapTab } from '@/plugins/focusTrap'
import TerminalCard from './TerminalCard.vue'

const SERVER = 'casaos'
const POLL_MS = 3000
const LOG_LINES = 1000
const ANSI = /\x1B\[[0-9;]*[A-Za-z]/g

export default {
	name: 'ConsolePanel',
	compatConfig: { MODE: 3 },
	components: { TerminalCard },
	emits: ['close'],
	data() {
		return {
			server: SERVER,
			apps: [],
			appFilter: '',
			current: SERVER,
			view: 'logs',
			logs: '',
			logFilter: '',
			follow: true,
			loadingLogs: false,
			// Main container of the selected app, for its terminal
			container: null,
			fallbackIcon: this.$asset('@/assets/img/app/default.svg'),
		}
	},
	computed: {
		currentApp() {
			return this.apps.find((app) => app.name === this.current) || null
		},
		currentTitle() {
			return this.current === SERVER ? 'CasaOS' : this.currentApp?.title || this.current
		},
		shownApps() {
			const filter = this.appFilter.trim().toLowerCase()
			return filter ? this.apps.filter((app) => `${app.title} ${app.name}`.toLowerCase().includes(filter)) : this.apps
		},
		shownLogs() {
			const filter = this.logFilter.trim().toLowerCase()
			if (!filter) return this.logs
			return this.logs.split('\n').filter((line) => line.toLowerCase().includes(filter)).join('\n')
		},
		lineCount() {
			return this.shownLogs ? this.shownLogs.split('\n').length : 0
		},
		terminalAvailable() {
			return this.current === SERVER || (this.currentApp?.status === 'running' && !!this.container)
		},
		terminalUrl() {
			if (this.current === SERVER || !this.container) return ''
			return `${this.$wsProtocol}//${this.$baseURL}/v1/container/${this.container.ID}/terminal?token=${this.$store.state.access_token}`
		},
	},
	mounted() {
		this.loadApps()
		this.loadLogs()
		this.timer = setInterval(() => {
			if (this.view === 'logs') this.loadLogs()
		}, POLL_MS)
		window.addEventListener('keydown', this.onKey)
		this.$nextTick(() => this.$refs.panel?.focus())
	},
	beforeUnmount() {
		clearInterval(this.timer)
		window.removeEventListener('keydown', this.onKey)
	},
	methods: {
		async loadApps() {
			try {
				const res = await this.$openAPI.appGrid.getAppGrid()
				this.apps = (res.data.data || [])
					.filter((app) => app.app_type === 'v2app')
					.map((app) => ({ name: app.name, title: ice_i18n(app.title) || app.name, icon: app.icon, status: app.status }))
					.sort((a, b) => a.title.localeCompare(b.title))
			} catch (e) {
				this.apps = []
			}
		},
		async select(name) {
			if (name === this.current) return
			this.current = name
			this.logs = ''
			this.logFilter = ''
			this.container = null
			if (this.view === 'terminal' && name !== SERVER) this.view = 'logs'
			this.loadLogs()
			if (name !== SERVER) this.loadContainer(name)
		},
		async loadContainer(name) {
			try {
				const res = await this.$openAPI.appManagement.compose.composeAppContainers(name)
				if (name !== this.current) return
				const data = res.data.data || {}
				const containers = Object.values(data.containers || {})
				this.container = containers.find((c) => c.Service === data.main) || containers[0] || null
			} catch (e) {
				this.container = null
			}
		},
		async loadLogs() {
			if (this.loadingLogs) return
			const source = this.current
			this.loadingLogs = true
			try {
				let text
				if (source === SERVER) {
					const res = await this.$api.sys.getLogs()
					// Each line of the CasaOS log starts with an 8 character prefix
					text = String(res.data.data || '').replace(/\n(.{8})/gu, '\n').slice(8)
				} else {
					const res = await this.$openAPI.appManagement.compose.composeAppLogs(source, LOG_LINES)
					text = String(res.data.data || '')
				}
				if (source !== this.current) return
				this.logs = text.replace(ANSI, '').replace(/\s+$/, '')
				if (this.follow) this.scrollToEnd()
			} catch (e) {
				// Kept as it was: the next poll tries again
			} finally {
				this.loadingLogs = false
			}
		},
		scrollToEnd() {
			this.$nextTick(() => {
				const box = this.$refs.logs
				if (box) box.scrollTop = box.scrollHeight
			})
		},
		setView(view) {
			if (view === 'terminal' && !this.terminalAvailable) return
			this.view = view
			if (view === 'logs') this.loadLogs()
		},
		downloadLogs() {
			const blob = new Blob([this.shownLogs], { type: 'text/plain' })
			const link = document.createElement('a')
			link.href = URL.createObjectURL(blob)
			link.download = `${this.current}-logs.txt`
			link.click()
			setTimeout(() => URL.revokeObjectURL(link.href), 1000)
		},
		onKey(event) {
			// Esc and Tab belong to the shell while typing in the terminal
			if (event.target?.closest?.('.xterm')) return
			if (event.key === 'Escape') this.$emit('close')
			else trapTab(event, this.$refs.panel)
		},
	},
}
</script>

<template>
	<div ref="panel" :aria-label="$t('Terminal & Logs')" aria-modal="true" class="atrio-console" role="dialog" tabindex="-1">
		<aside class="atrio-console-sources">
			<h2>{{ $t('Terminal & Logs') }}</h2>
			<button :class="{ 'is-active': current === server }" class="atrio-console-source" type="button" @click="select(server)">
				<span class="atrio-console-server"><b-icon icon="server" pack="mdi" size="is-16" /></span>
				<span class="atrio-console-source-name">CasaOS</span>
				<span class="atrio-console-source-note">{{ $t('Server') }}</span>
			</button>
			<p class="atrio-console-group">{{ $t('Apps') }}</p>
			<input v-if="apps.length > 8" v-model="appFilter" :aria-label="$t('Filter apps')" :placeholder="$t('Filter apps')" class="atrio-console-input" type="search">
			<div class="atrio-console-list">
				<button
					v-for="app in shownApps" :key="app.name" :class="{ 'is-active': current === app.name }" class="atrio-console-source"
					type="button" @click="select(app.name)"
				>
					<img :src="app.icon || fallbackIcon" alt="" @error="$event.target.src = fallbackIcon">
					<span class="atrio-console-source-name">{{ app.title }}</span>
					<span :class="app.status === 'running' ? 'is-running' : 'is-stopped'" class="atrio-console-dot" :title="app.status === 'running' ? $t('Running') : $t('Stopped')" />
				</button>
			</div>
		</aside>

		<section class="atrio-console-main">
			<header class="atrio-console-head">
				<h3>{{ currentTitle }}</h3>
				<div :aria-label="$t('Sections')" class="atrio-segmented" role="tablist">
					<button :aria-selected="view === 'logs'" :class="{ 'is-active': view === 'logs' }" role="tab" type="button" @click="setView('logs')">
						{{ $t('Logs') }}
					</button>
					<button
						:aria-selected="view === 'terminal'" :class="{ 'is-active': view === 'terminal' }" :disabled="!terminalAvailable"
						:title="terminalAvailable ? '' : $t('Start the app to open its terminal')" role="tab" type="button" @click="setView('terminal')"
					>
						{{ $t('Terminal') }}
					</button>
				</div>
				<button :aria-label="$t('Close')" class="atrio-icon-button" type="button" @click="$emit('close')">
					<b-icon icon="close-outline" pack="casa" />
				</button>
			</header>

			<template v-if="view === 'logs'">
				<div class="atrio-console-tools">
					<input v-model="logFilter" :aria-label="$t('Filter logs')" :placeholder="$t('Filter logs')" class="atrio-console-input" type="search">
					<label class="atrio-console-follow">
						<input v-model="follow" type="checkbox" @change="follow && scrollToEnd()">
						{{ $t('Follow') }}
					</label>
					<span class="atrio-console-count">{{ $t('{count} lines', { count: lineCount }) }}</span>
					<button :disabled="!shownLogs" class="atrio-button is-small" type="button" @click="downloadLogs">
						<b-icon icon="download" pack="mdi" size="is-16" />
						{{ $t('Download') }}
					</button>
				</div>
				<pre ref="logs" class="atrio-console-logs">{{ shownLogs || (logFilter ? $t('No lines match the filter') : $t('Loading…')) }}</pre>
			</template>

			<div v-else class="atrio-console-terminal">
				<p v-if="current === server" class="atrio-console-hint">{{ $t('Sign in with an account of the server (SSH) to open its shell.') }}</p>
				<TerminalCard :key="current + terminalUrl" :init-ws-url="terminalUrl" />
			</div>
		</section>
	</div>
</template>

<style lang="scss">
.terminal-modal.atrio-console-modal .animation-content {
	width: min(72rem, calc(100vw - 2rem)) !important;
	max-width: none !important;
}

.atrio-console {
	// Above the modal background, like Buefy's own cards
	position: relative;
	z-index: 1;
	display: grid;
	grid-template-columns: 15rem minmax(0, 1fr);
	height: min(46rem, calc(100vh - 3rem));
	overflow: hidden;
	border-radius: 28px;
	background: linear-gradient(var(--atrio-glass-bg-strong), var(--atrio-glass-bg-strong)), #0b1222;
	box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1), 0 24px 64px rgba(0, 0, 0, 0.45);
	color: var(--atrio-text);

	&:focus {
		outline: none;
	}

	@include mobile {
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: auto minmax(0, 1fr);
		height: calc(100vh - 2rem);
	}
}

.atrio-console-sources {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	min-height: 0;
	padding: 1.25rem 0.75rem;
	border-right: 1px solid rgba(255, 255, 255, 0.08);

	h2 {
		margin: 0 0.5rem 0.75rem;
		font-size: 1.125rem;
		font-weight: 700;
	}

	// Phones: the server and the apps become one row of chips that scrolls sideways
	@include mobile {
		flex-direction: row;
		align-items: center;
		gap: 0.375rem;
		padding: 0.75rem;
		overflow-x: auto;
		border-right: 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		scrollbar-width: none;

		h2,
		.atrio-console-group,
		> .atrio-console-input,
		.atrio-console-source-note {
			display: none;
		}

		.atrio-console-list {
			flex-direction: row;
			gap: 0.375rem;
			overflow: visible;
		}

		.atrio-console-source {
			flex-shrink: 0;
			width: auto;
			max-width: 12rem;
			background: rgba(255, 255, 255, 0.05);
		}
	}
}

.atrio-console-group {
	margin: 0.75rem 0.5rem 0.25rem;
	color: var(--atrio-text-muted);
	font-size: 0.75rem;
	font-weight: 700;
	letter-spacing: 0.06em;
	text-transform: uppercase;
}

.atrio-console-list {
	display: flex;
	flex-direction: column;
	gap: 0.125rem;
	min-height: 0;
	overflow-y: auto;
	scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
	scrollbar-width: thin;
}

.atrio-console-source {
	display: flex;
	gap: 0.625rem;
	align-items: center;
	width: 100%;
	min-height: 2.5rem;
	padding: 0.375rem 0.5rem;
	border: 0;
	border-radius: 0.75rem;
	background: transparent;
	color: var(--atrio-text-soft);
	font: inherit;
	font-size: 0.875rem;
	font-weight: 600;
	text-align: left;
	cursor: pointer;

	&:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--atrio-text);
	}

	&.is-active {
		background: rgba(255, 255, 255, 0.12);
		color: var(--atrio-text);
	}

	img {
		flex-shrink: 0;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 0.4375rem;
		object-fit: cover;
	}
}

.atrio-console-server {
	display: grid;
	flex-shrink: 0;
	place-items: center;
	width: 1.5rem;
	height: 1.5rem;
	border-radius: 0.4375rem;
	background: rgba(34, 211, 238, 0.16);
	color: #a5f3fc;
}

.atrio-console-source-name {
	flex: 1;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.atrio-console-source-note {
	color: var(--atrio-text-muted);
	font-size: 0.75rem;
	font-weight: 500;
}

.atrio-console-dot {
	flex-shrink: 0;
	width: 0.4375rem;
	height: 0.4375rem;
	border-radius: 50%;

	&.is-running {
		background: var(--atrio-ok);
	}

	&.is-stopped {
		border-radius: 2px;
		background: var(--atrio-warn);
	}
}

.atrio-console-main {
	display: flex;
	flex-direction: column;
	gap: 0.875rem;
	min-width: 0;
	min-height: 0;
	padding: 1.25rem 1.25rem 1.25rem 1.5rem;
}

.atrio-console-head {
	display: flex;
	gap: 1rem;
	align-items: center;

	h3 {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		font-size: 1.25rem;
		font-weight: 700;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.atrio-segmented button:disabled {
		opacity: 0.4;
		cursor: default;
	}
}

.atrio-console-tools {
	display: flex;
	flex-wrap: wrap;
	gap: 0.75rem;
	align-items: center;

	.atrio-console-input {
		flex: 1;
		min-width: 12rem;
	}
}

.atrio-console-input {
	height: 2.25rem;
	padding: 0 0.75rem;
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.75rem;
	background: rgba(255, 255, 255, 0.06);
	color: var(--atrio-text);
	font: inherit;
	font-size: 0.875rem;
	outline: none;

	&::placeholder {
		color: var(--atrio-text-muted);
	}

	&:focus {
		border-color: var(--atrio-accent);
	}
}

.atrio-console-sources .atrio-console-input {
	margin: 0 0 0.375rem;
}

.atrio-console-follow {
	display: inline-flex;
	gap: 0.375rem;
	align-items: center;
	color: var(--atrio-text-soft);
	font-size: 0.875rem;
	font-weight: 600;
	cursor: pointer;

	input {
		accent-color: var(--atrio-accent);
	}
}

.atrio-console-count {
	color: var(--atrio-text-muted);
	font-size: 0.8125rem;
	font-variant-numeric: tabular-nums;
}

.atrio-console-logs {
	flex: 1;
	min-height: 0;
	margin: 0;
	padding: 1rem;
	overflow: auto;
	border-radius: var(--atrio-radius-md, 20px);
	background: rgba(0, 0, 0, 0.35);
	color: #cbd5e1;
	font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	font-size: 0.8125rem;
	line-height: 1.5;
	white-space: pre-wrap;
	word-break: break-word;
	scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
	scrollbar-width: thin;
}

.atrio-console-terminal {
	position: relative;
	display: flex;
	flex: 1;
	flex-direction: column;
	min-height: 0;
	overflow: auto;
	border-radius: var(--atrio-radius-md, 20px);
	background: #0b0f17;

	.fullScreen {
		position: relative;
		flex: 1;
		margin-top: 0 !important;
		padding: 0.75rem !important;
	}

	.fullscreen-button {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		z-index: 2;
		color: var(--atrio-text-soft);
	}

	.xterm.sheight {
		height: 100%;
		min-height: 20rem;
	}

	// SSH sign-in card of the server terminal
	.card {
		background: rgba(255, 255, 255, 0.05);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
		color: var(--atrio-text);

		.label {
			color: var(--atrio-text-soft);
		}

		.input {
			border-color: rgba(255, 255, 255, 0.12);
			background: rgba(255, 255, 255, 0.06);
			color: var(--atrio-text);
		}

		.button.is-primary {
			background: var(--atrio-text);
			color: #0b1120;
			font-weight: 700;
		}
	}
}

.atrio-console-hint {
	padding: 0.75rem 1rem 0;
	color: var(--atrio-text-muted);
	font-size: 0.8125rem;
}
</style>
