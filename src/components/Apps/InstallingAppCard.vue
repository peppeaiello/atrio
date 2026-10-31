<script>
// An app being installed, shown in the home grid until it joins the list: its icon with a progress
// ring and the percentage from the install events, or the error if the install failed.
const RADIUS = 30
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default {
	name: 'InstallingAppCard',
	compatConfig: { MODE: 3 },
	props: {
		install: { type: Object, required: true },
	},
	emits: ['dismiss'],
	data() {
		return { radius: RADIUS, circumference: CIRCUMFERENCE, fallbackIcon: this.$asset('@/assets/img/app/default.svg') }
	},
	computed: {
		offset() {
			return CIRCUMFERENCE * (1 - Math.min(100, Math.max(0, this.install.progress)) / 100)
		},
		status() {
			if (this.install.error) return this.$t('Install failed')
			if (this.install.progress >= 100) return this.$t('Starting')
			return this.install.progress > 0 ? `${this.$t('Installing')} ${this.install.progress}%` : this.$t('Preparing')
		},
	},
}
</script>

<template>
	<div :class="{ 'is-failed': install.error }" class="common-card is-flex is-align-items-center is-justify-content-center app-card atrio-installing-card" :title="install.error || ''">
		<div class="blur-background" />
		<div class="cards-content">
			<div class="has-text-centered is-flex is-justify-content-center is-flex-direction-column pt-5 pb-3px img-c">
				<div class="is-flex is-justify-content-center">
					<div
						:aria-label="`${install.title}: ${status}`"
						:aria-valuenow="install.error ? undefined : install.progress"
						aria-valuemax="100"
						aria-valuemin="0"
						class="atrio-installing-icon"
						role="progressbar"
					>
						<img :src="install.icon || fallbackIcon" alt="" @error="$event.target.src = fallbackIcon">
						<svg aria-hidden="true" viewBox="0 0 72 72">
							<circle :r="radius" class="atrio-installing-track" cx="36" cy="36" />
							<circle
								v-if="!install.error"
								:r="radius"
								:stroke-dasharray="circumference"
								:stroke-dashoffset="offset"
								class="atrio-installing-ring"
								cx="36"
								cy="36"
							/>
						</svg>
						<span v-if="!install.error && install.progress > 0 && install.progress < 100" class="atrio-installing-percent">
							{{ install.progress }}%
						</span>
					</div>
				</div>

				<p class="mt-3 one-line">
					<a class="one-line" style="cursor:default">{{ install.title }}</a>
				</p>
				<p :class="install.error ? 'is-error' : 'is-busy'" class="atrio-app-status">
					<span class="atrio-app-dot" />
					{{ status }}
				</p>
			</div>
		</div>
		<button v-if="install.error" :aria-label="$t('Dismiss')" :title="$t('Dismiss')" class="atrio-installing-dismiss" type="button" @click="$emit('dismiss')">
			<b-icon icon="close-outline" pack="casa" size="is-16" />
		</button>
	</div>
</template>

<style lang="scss">
.atrio-installing-card {
	position: relative;
	cursor: default;
}

.atrio-installing-icon {
	position: relative;
	display: grid;
	place-items: center;
	width: 4rem;
	height: 4rem;

	img {
		width: 4rem;
		height: 4rem;
		border-radius: 11.5px;
		object-fit: cover;
		filter: brightness(0.45) saturate(0.6);
	}

	svg {
		position: absolute;
		inset: -0.5rem;
		width: 5rem;
		height: 5rem;
		transform: rotate(-90deg);
	}

	circle {
		fill: none;
		stroke-width: 3.5;
	}

	.is-failed & img {
		filter: grayscale(1) brightness(0.5);
	}
}

.atrio-installing-track {
	stroke: rgba(255, 255, 255, 0.14);
}

.atrio-installing-ring {
	stroke: var(--atrio-accent);
	stroke-linecap: round;
	transition: stroke-dashoffset 0.5s ease;
}

.atrio-installing-percent {
	position: absolute;
	color: #fff;
	font-size: 0.9375rem;
	font-weight: 700;
	font-variant-numeric: tabular-nums;
	text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
}

.atrio-app-status.is-busy {
	color: #a5f3fc;

	.atrio-app-dot {
		background: var(--atrio-accent);
		animation: atrio-installing-pulse 1.2s ease-in-out infinite;
	}
}

.atrio-app-status.is-error {
	color: #fca5a5;

	.atrio-app-dot {
		border-radius: 2px;
		background: #f87171;
	}
}

@keyframes atrio-installing-pulse {
	50% {
		opacity: 0.35;
	}
}

.atrio-installing-dismiss {
	position: absolute;
	top: 0.5rem;
	right: 0.5rem;
	display: grid;
	place-items: center;
	width: 1.75rem;
	height: 1.75rem;
	border: 0;
	border-radius: 0.5rem;
	background: rgba(255, 255, 255, 0.08);
	color: var(--atrio-text);
	cursor: pointer;

	&:hover {
		background: rgba(255, 255, 255, 0.16);
	}
}

@media (prefers-reduced-motion: reduce) {
	.atrio-app-status.is-busy .atrio-app-dot {
		animation: none;
	}
}
</style>
