<script>
// Which apps and services use the network: now (measured on the server over a few seconds, again
// while the panel is open) or over the last 24 hours. Opened with
// `$EventBus.$emit('atrio:open-network')`, from the Network Status widget and the command palette.
import { ice_i18n } from '@/mixins/base/common-i18n'
import { renderSize } from '@/mixins/file_utils'
import { restoreFocus, trapTab } from '@/plugins/focusTrap'
import { backupsInstalled, measureNetwork } from '@/plugins/appBackup'
import { loadDayTraffic } from '@/plugins/history'

const REFRESH_MS = 6000
// After a failed measure (the server busy, say), a longer wait before the next one
const RETRY_MS = 15000
// Four series at most on the bar, then "Others": validated for colour blindness on the dark panel
const COLORS = ['#0aa5c4', '#8b5cf6', '#d97706', '#db2777']
const REST = '#475569'
// The server's services by their systemd unit: a name people know and an icon
const SERVICES = {
	smbd: ['Samba', 'folder-network-outline'],
	nmbd: ['Samba', 'folder-network-outline'],
	ssh: ['SSH', 'console'],
	sshd: ['SSH', 'console'],
	casaos: ['CasaOS', 'server'],
	tailscaled: ['Tailscale', 'vpn'],
	'nfs-server': ['NFS', 'folder-network-outline'],
	'avahi-daemon': ['Avahi', 'access-point-network'],
	'systemd-resolved': ['DNS', 'dns-outline'],
	cups: ['CUPS', 'printer-outline'],
	wsdd: ['Windows network discovery', 'microsoft-windows'],
	wsdd2: ['Windows network discovery', 'microsoft-windows'],
	'atrio-alerts': ['Atrio', 'bell-outline'],
}

export default {
	name: 'NetworkPanel',
	compatConfig: { MODE: 3 },
	data() {
		return { open: false, mode: 'now', tab: 'apps', now: null, day: null, grid: {}, error: '', measuring: false, showQuiet: false }
	},
	computed: {
		data() {
			return this.mode === 'now' ? this.now : this.day
		},
		total() {
			return this.data?.server || { down: 0, up: 0 }
		},
		// Every app, the busiest first; on the host's network marked as such
		apps() {
			const hosts = new Set((this.now?.apps || []).filter((a) => a.host).map((a) => a.app))
			return (this.data?.apps || []).map((a) => ({ ...a, host: hosts.has(a.app) || a.host, down: a.down || 0, up: a.up || 0 }))
				.sort((a, b) => b.down + b.up - (a.down + a.up))
		},
		busyApps() {
			return this.apps.filter((a) => this.amount(a) > this.floor)
		},
		quietApps() {
			return this.apps.filter((a) => this.amount(a) <= this.floor)
		},
		services() {
			const merged = new Map()
			for (const s of this.data?.services || []) {
				const [name, icon] = SERVICES[s.name] || [s.name, 'cog-outline']
				const item = merged.get(name) || { name, icon, down: 0, up: 0 }
				item.down += s.down || 0
				item.up += s.up || 0
				merged.set(name, item)
			}
			return [...merged.values()].filter((s) => this.amount(s) > this.floor).sort((a, b) => this.amount(b) - this.amount(a))
		},
		// Below this an app counts as quiet: 1 KB/s now, 1 MB over a day
		floor() {
			return this.mode === 'now' ? 1024 : 1048576
		},
		// The bar: the four busiest apps, then the rest of the server's traffic
		segments() {
			// Traffic between apps on the server never reaches its network card, so the apps can add up to more
			// than the server's total: then their sum is the whole bar
			const apps = this.busyApps.reduce((sum, a) => sum + this.amount(a), 0)
			const all = Math.max(this.amount(this.total), apps)
			if (!all) return []
			const top = this.busyApps.slice(0, 4).map((a, index) => ({ label: this.title(a.app), color: COLORS[index], share: this.amount(a) / all }))
			const used = top.reduce((sum, s) => sum + s.share, 0)
			if (used < 0.995) top.push({ label: this.$t('Other apps and the server\'s services'), color: REST, share: 1 - used })
			return top.filter((s) => s.share > 0.005)
		},
	},
	mounted() {
		this.$EventBus.$on('atrio:open-network', this.show)
		window.addEventListener('keydown', this.onKey)
	},
	beforeUnmount() {
		this.$EventBus.$off('atrio:open-network', this.show)
		window.removeEventListener('keydown', this.onKey)
		clearTimeout(this.timer)
	},
	methods: {
		renderSize,
		async show() {
			if (this.open) return
			this.returnFocus = document.activeElement
			this.open = true
			this.error = ''
			this.$nextTick(() => this.$refs.sheet?.focus())
			this.loadGrid()
			// false: an older service that keeps no history
			loadDayTraffic().then((day) => (this.day = day ?? false))
			if (!(await backupsInstalled())) {
				this.error = this.$t('This needs the service on the server. Run the install command on the server.')
				return
			}
			this.measure()
		},
		close() {
			this.open = false
			clearTimeout(this.timer)
			// A measure still on its way when the panel closes must not start another round
			this.round = (this.round || 0) + 1
			this.$nextTick(() => restoreFocus(this.returnFocus))
		},
		onKey(event) {
			if (!this.open) return
			if (event.key === 'Escape') this.close()
			else trapTab(event, this.$refs.sheet)
		},
		// Names and icons of the apps, as on their tiles (from their x-casaos)
		async loadGrid() {
			try {
				const grid = (await this.$openAPI.appGrid.getAppGrid()).data.data || []
				this.grid = Object.fromEntries(grid.map((app) => [app.name, { title: typeof app.title === 'object' ? ice_i18n(app.title) : app.title || app.name, icon: app.icon }]))
			}
			catch (e) {
				// The apps' own names then
			}
		},
		async measure() {
			if (!this.open || this.measuring) return
			const round = this.round
			this.measuring = true
			try {
				this.now = await measureNetwork()
				this.error = ''
			}
			catch (e) {
				this.error = e.message === 'Unknown request'
					? this.$t('This needs the latest version of the service on the server. Run the install command once more.')
					: this.$t(e.message)
			}
			finally {
				this.measuring = false
			}
			// Closed (and maybe opened again) meanwhile: the new opening has its own round
			if (round !== this.round) {
				if (this.open) this.measure()
				return
			}
			if (this.open) this.timer = setTimeout(this.measure, this.error ? RETRY_MS : REFRESH_MS)
		},
		title(app) {
			return this.grid[app]?.title || app
		},
		icon(app) {
			return this.grid[app]?.icon || ''
		},
		amount(item) {
			return (item.down || 0) + (item.up || 0)
		},
		value(bytes) {
			const size = renderSize(Math.round(bytes || 0)).replace(' Bytes', ' B')
			return this.mode === 'now' ? `${size}/s` : size
		},
		color(app) {
			const index = this.busyApps.findIndex((a) => a.app === app)
			return index >= 0 && index < 4 ? COLORS[index] : REST
		},
	},
}
</script>

<template>
	<Teleport to="body">
		<transition name="atrio-sheet">
			<div v-if="open" class="atrio-sheet-backdrop" @click.self="close">
				<aside ref="sheet" :aria-label="$t('Network detail')" aria-modal="true" class="atrio-sheet atrio-network" role="dialog" tabindex="-1">
					<header class="atrio-sheet-head">
						<span class="atrio-network-icon"><b-icon icon="swap-vertical" pack="mdi" /></span>
						<div class="atrio-sheet-title">
							<h2>{{ $t('Network detail') }}</h2>
							<p class="atrio-network-sub">{{ $t('Which apps and services use the network') }}</p>
						</div>
						<button :aria-label="$t('Close')" class="atrio-icon-button" type="button" @click="close">
							<b-icon icon="close-outline" pack="casa" />
						</button>
					</header>

					<div :aria-label="$t('Period')" class="atrio-segmented atrio-network-mode" role="radiogroup">
						<button :aria-checked="mode === 'now'" :class="{ 'is-active': mode === 'now' }" role="radio" type="button" @click="mode = 'now'">
							{{ $t('Now') }}<span v-if="mode === 'now' && measuring && now" class="atrio-network-live" />
						</button>
						<button :aria-checked="mode === 'day'" :class="{ 'is-active': mode === 'day' }" role="radio" type="button" @click="mode = 'day'">{{ $t('Last 24 hours') }}</button>
					</div>

					<p v-if="error && mode === 'now'" class="atrio-network-error" role="alert">{{ error }}</p>
					<p v-else-if="mode === 'day' && day === false" class="atrio-config-empty">{{ $t('The last 24 hours need the latest version of the service on the server. Run the install command once more.') }}</p>
					<p v-else-if="!data" class="atrio-config-empty">{{ mode === 'now' ? $t('Measuring…') : $t('Loading…') }}</p>

					<template v-else>
						<div class="atrio-network-totals">
							<div>
								<span><b-icon icon="arrow-down" pack="mdi" size="is-12" /> {{ $t('Received') }}</span>
								<strong>{{ value(total.down) }}</strong>
							</div>
							<div>
								<span><b-icon icon="arrow-up" pack="mdi" size="is-12" /> {{ $t('Sent') }}</span>
								<strong>{{ value(total.up) }}</strong>
							</div>
						</div>

						<template v-if="segments.length">
							<div aria-hidden="true" class="atrio-network-share">
								<span v-for="s in segments" :key="s.label" :style="{ flex: s.share, background: s.color }" />
							</div>
							<p class="atrio-network-legend">
								<span v-for="s in segments" :key="s.label"><i :style="{ background: s.color }" />{{ s.label }} {{ Math.round(s.share * 100) }}%</span>
							</p>
						</template>

						<div :aria-label="$t('Sections')" class="atrio-sheet-tabs" role="tablist">
							<button :aria-selected="tab === 'apps'" :class="{ 'is-active': tab === 'apps' }" role="tab" type="button" @click="tab = 'apps'">{{ $t('Apps') }}</button>
							<button :aria-selected="tab === 'services'" :class="{ 'is-active': tab === 'services' }" role="tab" type="button" @click="tab = 'services'">{{ $t('The server\'s services') }}</button>
						</div>

						<table class="atrio-network-table">
							<thead>
								<tr>
									<th :colspan="2" scope="col">{{ tab === 'apps' ? $t('App') : $t('Service') }}</th>
									<th scope="col">{{ $t('Received') }}</th>
									<th scope="col">{{ $t('Sent') }}</th>
								</tr>
							</thead>
							<tbody v-if="tab === 'apps'">
								<tr v-for="item in busyApps" :key="item.app">
									<td class="atrio-network-pic">
										<img v-if="icon(item.app)" :src="icon(item.app)" alt="" @error="grid[item.app].icon = ''">
										<b-icon v-else icon="application-outline" pack="mdi" size="is-20" />
										<i :style="{ background: color(item.app) }" class="atrio-network-swatch" />
									</td>
									<td>
										{{ title(item.app) }}
										<small v-if="item.host">{{ $t('on the server\'s network') }}</small>
									</td>
									<td>{{ value(item.down) }}</td>
									<td>{{ value(item.up) }}</td>
								</tr>
								<tr v-if="!busyApps.length">
									<td class="atrio-network-none" colspan="4">{{ mode === 'now' ? $t('No app is using the network now.') : $t('No app used the network in the last 24 hours.') }}</td>
								</tr>
								<template v-if="showQuiet">
									<tr v-for="item in quietApps" :key="item.app" class="is-quiet">
										<td class="atrio-network-pic">
											<img v-if="icon(item.app)" :src="icon(item.app)" alt="">
											<b-icon v-else icon="application-outline" pack="mdi" size="is-20" />
										</td>
										<td>{{ title(item.app) }}</td>
										<td>{{ value(item.down) }}</td>
										<td>{{ value(item.up) }}</td>
									</tr>
								</template>
							</tbody>
							<tbody v-else>
								<tr v-for="item in services" :key="item.name">
									<td class="atrio-network-pic"><b-icon :icon="item.icon" pack="mdi" size="is-20" /></td>
									<td>{{ $te(item.name) ? $t(item.name) : item.name }}</td>
									<td>{{ value(item.down) }}</td>
									<td>{{ value(item.up) }}</td>
								</tr>
								<tr v-if="!services.length">
									<td class="atrio-network-none" colspan="4">{{ mode === 'now' ? $t('No service of the server is using the network now.') : $t('No service of the server used the network in the last 24 hours.') }}</td>
								</tr>
							</tbody>
						</table>
						<button v-if="tab === 'apps' && quietApps.length" :aria-expanded="showQuiet" class="atrio-network-more" type="button" @click="showQuiet = !showQuiet">
							<b-icon :icon="showQuiet ? 'chevron-up' : 'chevron-down'" pack="mdi" size="is-16" />
							{{ showQuiet ? $t('Hide the apps with no traffic') : $t('{count} more apps with no traffic', { count: quietApps.length }) }}
						</button>

						<p class="atrio-network-note">
							{{ $t('Apps on the server\'s own network and the server\'s services are counted from their TCP connections only. Traffic between apps, for example through a reverse proxy, counts for both.') }}
							<template v-if="mode === 'now'">{{ $t('Measured every few seconds while this is open.') }}</template>
						</p>
					</template>
				</aside>
			</div>
		</transition>
	</Teleport>
</template>

<style lang="scss">
.atrio-network {
	width: min(38rem, calc(100% - 2rem));

	.atrio-sheet-tabs {
		margin-top: 0.5rem;
	}
}

.atrio-network-icon {
	display: grid;
	place-items: center;
	width: 3.75rem;
	height: 3.75rem;
	border-radius: 1.125rem;
	background: rgba(10, 165, 196, 0.16);
	color: #a5f3fc;

	.icon {
		width: 2rem;
		height: 2rem;
		font-size: 2rem;
	}
}

.atrio-network-sub,
.atrio-network-note {
	color: var(--atrio-text-muted);
	font-size: 0.8125rem;
}

.atrio-network-mode {
	align-self: flex-start;
}

.atrio-network-live {
	display: inline-block;
	width: 0.4375rem;
	height: 0.4375rem;
	margin-left: 0.375rem;
	border-radius: 50%;
	background: #0aa5c4;
	vertical-align: middle;
	animation: atrio-network-pulse 1s ease-in-out infinite alternate;
}

@keyframes atrio-network-pulse {
	to { opacity: 0.3; }
}

.atrio-network-error {
	padding: 0.5rem 0.75rem;
	border-radius: 0.5rem;
	background: rgba(248, 113, 113, 0.15);
	color: #fecaca;
	font-size: 0.8125rem;
}

.atrio-network-totals {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 0.625rem;

	> div {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		padding: 0.625rem 0.875rem;
		border-radius: 0.875rem;
		background: rgba(255, 255, 255, 0.05);
	}

	span {
		color: var(--atrio-text-muted);
		font-size: 0.75rem;
	}

	strong {
		color: var(--atrio-text);
		font-size: 1.375rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
}

.atrio-network-share {
	display: flex;
	flex: none;
	gap: 2px;
	height: 10px;
	overflow: hidden;
	border-radius: 5px;

	span {
		min-width: 3px;
	}
}

.atrio-network-legend {
	display: flex;
	flex-wrap: wrap;
	gap: 0.25rem 0.875rem;
	color: var(--atrio-text-soft);
	font-size: 0.75rem;

	i {
		display: inline-block;
		width: 0.5rem;
		height: 0.5rem;
		margin-right: 0.375rem;
		border-radius: 50%;
	}
}

.atrio-network-table {
	width: 100%;
	border-collapse: collapse;
	font-size: 0.875rem;

	th {
		padding: 0.375rem 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		color: var(--atrio-text-muted);
		font-size: 0.75rem;
		font-weight: 500;
		text-align: left;
	}

	td {
		padding: 0.5rem 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		color: var(--atrio-text);
		vertical-align: middle;

		small {
			display: block;
			color: var(--atrio-text-muted);
			font-size: 0.6875rem;
		}
	}

	th:nth-child(n + 2),
	td:nth-child(n + 3) {
		width: 6.5rem;
		padding-left: 0.5rem;
		text-align: right;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	td:nth-child(4) {
		color: var(--atrio-text-soft);
	}

	tr.is-quiet td {
		color: var(--atrio-text-muted);
	}
}

.atrio-network-pic {
	position: relative;
	width: 2.5rem;

	img,
	.icon {
		display: grid;
		place-items: center;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 0.5rem;
		color: var(--atrio-text-soft);
		object-fit: cover;
	}
}

.atrio-network-swatch {
	position: absolute;
	bottom: 0.375rem;
	left: 1.375rem;
	width: 0.5rem;
	height: 0.5rem;
	border: 2px solid #111827;
	border-radius: 50%;
	box-sizing: content-box;
}

.atrio-network-none {
	color: var(--atrio-text-muted) !important;
	font-size: 0.8125rem;
}

.atrio-network-more {
	display: flex;
	gap: 0.25rem;
	align-items: center;
	align-self: flex-start;
	padding: 0.25rem 0;
	border: 0;
	background: none;
	color: var(--atrio-text-soft);
	font: inherit;
	font-size: 0.8125rem;
	cursor: pointer;
}

.atrio-network-note {
	font-size: 0.75rem;
}

@media (max-width: 480px) {
	.atrio-network-table th:nth-child(n + 2),
	.atrio-network-table td:nth-child(n + 3) {
		width: 5rem;
	}
}
</style>
