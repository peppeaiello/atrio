<script>
// Details of the machine running CasaOS: system, processor, memory and every sensor it reports.
// Opened with `$EventBus.$emit('atrio:open-hardware')`; shares the sheet styles of AppDetailsPanel.
import { discoverSensors, readLive, readStatic } from '@/plugins/hardware'
import { restoreFocus, trapTab } from '@/plugins/focusTrap'
import { renderSize } from '@/mixins/file_utils'

const POLL_MS = 3000
// Sections in the order they appear, each shown only when the machine has such sensors
const SECTIONS = [
	{ kind: 'temp', title: 'Temperatures', name: 'Temperature' },
	{ kind: 'fan', title: 'Fans', name: 'Fan' },
	{ kind: 'voltage', title: 'Voltages', name: 'Voltage' },
	{ kind: 'power', title: 'Power', name: 'Power' },
	{ kind: 'current', title: 'Current', name: 'Current' },
]

function storedUnit() {
	try {
		return localStorage.getItem('temperatureFormat') === '°F' ? '°F' : '°C'
	}
	catch (e) {
		return '°C'
	}
}

export default {
	name: 'HardwarePanel',
	compatConfig: { MODE: 3 },
	data() {
		return {
			open: false,
			loading: false,
			info: null,
			groups: [],
			live: null,
			unit: '°C',
		}
	},
	computed: {
		sections() {
			return SECTIONS.map((section) => ({
				...section,
				groups: this.groups
					.map((group) => ({ ...group, sensors: group.sensors.filter((s) => s.kind === section.kind && s.value !== null) }))
					.filter((group) => group.sensors.length),
			})).filter((section) => section.groups.length)
		},
		hasExtraSensors() {
			return this.sections.some((section) => section.kind !== 'temp')
		},
		memoryPercent() {
			const memory = this.live?.memory
			return memory?.total ? Math.round((memory.used / memory.total) * 100) : 0
		},
	},
	mounted() {
		this.$EventBus.$on('atrio:open-hardware', this.show)
		window.addEventListener('keydown', this.onKey)
	},
	beforeUnmount() {
		this.$EventBus.$off('atrio:open-hardware', this.show)
		window.removeEventListener('keydown', this.onKey)
		clearInterval(this.timer)
	},
	methods: {
		renderSize,
		async show() {
			if (this.open) return
			this.returnFocus = document.activeElement
			this.open = true
			this.unit = storedUnit()
			this.$nextTick(() => this.$refs.sheet?.focus())
			// Machine details and the sensor list are read once per page load
			if (!this.info) {
				this.loading = true
				const [info, groups] = await Promise.all([readStatic(this.$api), discoverSensors(this.$api)])
				this.info = info
				this.groups = groups
				this.loading = false
			}
			await this.poll()
			clearInterval(this.timer)
			if (this.open) this.timer = setInterval(this.poll, POLL_MS)
		},
		close() {
			this.open = false
			clearInterval(this.timer)
			this.$nextTick(() => restoreFocus(this.returnFocus))
		},
		onKey(event) {
			if (!this.open) return
			if (event.key === 'Escape') this.close()
			else trapTab(event, this.$refs.sheet)
		},
		async poll() {
			if (this.polling) return
			this.polling = true
			try {
				this.live = await readLive(this.$api, this.groups, this.info?.cpu.threads)
			}
			finally {
				this.polling = false
			}
		},
		toggleUnit() {
			this.unit = this.unit === '°C' ? '°F' : '°C'
			try {
				localStorage.setItem('temperatureFormat', this.unit)
			}
			catch (e) {
				// Private window: the choice lasts until the page closes
			}
		},
		temperature(celsius) {
			return this.unit === '°F' ? `${Math.round((celsius * 9) / 5 + 32)}°F` : `${Math.round(celsius)}°C`
		},
		// ok / warm / hot, from the chip's own limits when it reports them
		level(sensor) {
			const crit = sensor.crit || 95
			const warm = sensor.max && sensor.max < crit ? sensor.max : crit - 15
			return sensor.value >= crit ? 'is-hot' : sensor.value >= warm ? 'is-warm' : 'is-ok'
		},
		value(sensor) {
			switch (sensor.kind) {
				case 'temp': return this.temperature(sensor.value)
				case 'fan': return `${Math.round(sensor.value)} RPM`
				case 'voltage': return `${sensor.value.toFixed(2)} V`
				case 'power': return `${sensor.value.toFixed(1)} W`
				default: return `${sensor.value.toFixed(2)} A`
			}
		},
		uptime(seconds) {
			if (seconds === null || seconds === undefined) return '—'
			const days = Math.floor(seconds / 86400)
			const hours = Math.floor((seconds % 86400) / 3600)
			const minutes = Math.floor((seconds % 3600) / 60)
			return days ? this.$t('{days} d, {hours} h', { days, hours }) : this.$t('{hours} h, {minutes} min', { hours, minutes })
		},
		sensorLabel(sensor, section, group) {
			if (sensor.label) return sensor.label
			const name = this.$t(section.name)
			return group.sensors.length > 1 ? `${name} ${sensor.index}` : name
		},
		frequency(mhz) {
			return mhz >= 1000 ? `${(mhz / 1000).toFixed(2)} GHz` : `${mhz} MHz`
		},
	},
}
</script>

<template>
	<Teleport to="body">
		<transition name="atrio-sheet">
			<div v-if="open" class="atrio-sheet-backdrop" @click.self="close">
				<aside ref="sheet" :aria-label="$t('Hardware')" aria-modal="true" class="atrio-sheet atrio-hardware" role="dialog" tabindex="-1">
					<header class="atrio-sheet-head">
						<span class="atrio-hardware-icon">
							<b-icon icon="chip" pack="mdi" />
						</span>
						<div class="atrio-sheet-title">
							<h2>{{ $t('Hardware') }}</h2>
							<p class="atrio-hardware-sub">{{ info?.machine || info?.hostname || '' }}</p>
						</div>
						<button :aria-label="$t('Close')" class="atrio-icon-button" type="button" @click="close">
							<b-icon icon="close-outline" pack="casa" />
						</button>
					</header>

					<p v-if="loading || !info" class="atrio-config-empty">{{ $t('Loading…') }}</p>

					<div v-else class="atrio-sheet-config">
						<section>
							<h3>{{ $t('System') }}</h3>
							<dl class="atrio-sheet-info">
								<template v-if="info.machine">
									<dt>{{ $t('Machine') }}</dt>
									<dd :title="info.machine">{{ info.machine }}</dd>
								</template>
								<template v-if="info.board && info.board !== info.machine">
									<dt>{{ $t('Motherboard') }}</dt>
									<dd :title="info.board">{{ info.board }}</dd>
								</template>
								<template v-if="info.bios">
									<dt>BIOS</dt>
									<dd :title="info.bios">{{ info.bios }}</dd>
								</template>
								<dt>{{ $t('Operating system') }}</dt>
								<dd>{{ info.os || '—' }}</dd>
								<dt>Kernel</dt>
								<dd class="is-mono">{{ info.kernel || '—' }}</dd>
								<dt>{{ $t('Host name') }}</dt>
								<dd class="is-mono">{{ info.hostname || '—' }}</dd>
								<dt>{{ $t('Uptime') }}</dt>
								<dd>{{ uptime(live?.uptime) }}</dd>
							</dl>
						</section>

						<section>
							<h3>{{ $t('Processor') }}</h3>
							<dl class="atrio-sheet-info">
								<dt>{{ $t('Model') }}</dt>
								<dd :title="info.cpu.model">{{ info.cpu.model || '—' }}</dd>
								<dt>{{ $t('Cores') }}</dt>
								<dd>{{ info.cpu.cores === info.cpu.threads ? info.cpu.cores : $t('{cores} cores, {threads} threads', info.cpu) }}</dd>
								<template v-if="live?.avgMHz">
									<dt>{{ $t('Frequency') }}</dt>
									<dd>{{ frequency(live.avgMHz) }}<span v-if="info.cpu.maxMHz" class="atrio-hardware-muted"> / {{ frequency(info.cpu.maxMHz) }} max</span></dd>
								</template>
								<template v-if="live?.load?.[0] !== null && live?.load?.length">
									<dt>{{ $t('Load average') }}</dt>
									<dd class="is-mono">{{ live.load.map((n) => n?.toFixed(2)).join(' · ') }}</dd>
								</template>
								<template v-if="info.cpu.cache">
									<dt>Cache</dt>
									<dd>{{ info.cpu.cache }}</dd>
								</template>
							</dl>
						</section>

						<section v-if="live?.memory.total">
							<h3>{{ $t('Memory') }}</h3>
							<div class="atrio-hardware-meter">
								<div class="atrio-hardware-meter-text">
									<span>{{ renderSize(live.memory.used) }} / {{ renderSize(live.memory.total) }}</span>
									<span>{{ memoryPercent }}%</span>
								</div>
								<div class="atrio-hardware-bar"><span :style="{ width: `${memoryPercent}%` }" /></div>
							</div>
							<p v-if="live.memory.swapTotal" class="atrio-hardware-muted atrio-hardware-swap">
								Swap: {{ renderSize(live.memory.swapUsed) }} / {{ renderSize(live.memory.swapTotal) }}
							</p>
						</section>

						<section v-for="section in sections" :key="section.kind">
							<div class="atrio-hardware-section-head">
								<h3>{{ $t(section.title) }}</h3>
								<button v-if="section.kind === 'temp'" :title="$t('Switch °C / °F')" class="atrio-config-tag atrio-hardware-unit" type="button" @click="toggleUnit">
									{{ unit }}
								</button>
							</div>
							<div v-for="group in section.groups" :key="group.id" class="atrio-hardware-group">
								<h4>{{ $t(group.name.split(' · ')[0]) }}<template v-if="group.name.includes(' · ')"> · {{ group.name.split(' · ')[1] }}</template></h4>
								<ul class="atrio-config-list">
									<li v-for="sensor in group.sensors" :key="sensor.id">
										<span v-if="sensor.kind === 'temp'" :class="level(sensor)" class="atrio-hardware-dot" />
										<span class="atrio-hardware-label">{{ sensorLabel(sensor, section, group) }}</span>
										<span class="atrio-hardware-value">{{ value(sensor) }}</span>
									</li>
								</ul>
							</div>
						</section>

						<p v-if="!hasExtraSensors" class="atrio-config-hint">
							{{ $t('This machine does not report fans, voltages or power. They appear here on machines whose sensors expose them.') }}
						</p>
					</div>
				</aside>
			</div>
		</transition>
	</Teleport>
</template>

<style lang="scss">
.atrio-hardware {
	width: min(36rem, calc(100% - 2rem));

	.atrio-sheet-info {
		grid-template-columns: 9rem minmax(0, 1fr);
	}
}

.atrio-hardware-icon {
	display: grid;
	place-items: center;
	width: 3.75rem;
	height: 3.75rem;
	border-radius: 1.125rem;
	background: rgba(34, 211, 238, 0.14);
	color: #a5f3fc;

	.icon {
		width: 2rem;
		height: 2rem;
		font-size: 2rem;
	}
}

.atrio-hardware-sub,
.atrio-hardware-muted {
	color: var(--atrio-text-muted);
	font-size: 0.8125rem;
}

.atrio-hardware-section-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 0.625rem;

	h3 {
		margin-bottom: 0 !important;
	}
}

.atrio-hardware-unit {
	border: 0;
	font: inherit;
	font-size: 0.75rem;
	cursor: pointer;

	&:hover {
		background: rgba(255, 255, 255, 0.14);
	}
}

.atrio-hardware-group + .atrio-hardware-group {
	margin-top: 0.25rem;
}

.atrio-hardware-group h4 {
	margin-top: 0.5rem !important;
}

.atrio-hardware-label {
	flex: 1;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.atrio-hardware-value {
	font-variant-numeric: tabular-nums;
	font-weight: 600;
}

.atrio-hardware-dot {
	flex-shrink: 0;
	width: 0.5rem;
	height: 0.5rem;
	border-radius: 50%;

	&.is-ok {
		background: var(--atrio-ok);
	}

	&.is-warm {
		background: var(--atrio-warn);
	}

	&.is-hot {
		border-radius: 2px;
		background: #f87171;
	}
}

.atrio-hardware-meter-text {
	display: flex;
	justify-content: space-between;
	margin-bottom: 0.375rem;
	font-size: 0.875rem;
	font-variant-numeric: tabular-nums;
}

.atrio-hardware-bar {
	height: 0.5rem;
	overflow: hidden;
	border-radius: 999px;
	background: rgba(255, 255, 255, 0.08);

	span {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: #818cf8;
		transition: width 0.4s ease;
	}
}

.atrio-hardware-swap {
	margin-top: 0.5rem;
}
</style>
