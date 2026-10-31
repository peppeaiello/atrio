<script>
// Full-page progress while Atrio updates itself, so the update stays visible after the settings
// menu closes and the dashboard is not used while the CasaOS gateway restarts.
import { CURRENT, STEPS, dismissUpdate, release } from '@/plugins/atrioRelease'
import { trapTab } from '@/plugins/focusTrap'

export default {
	name: 'AtrioUpdateScreen',
	compatConfig: { MODE: 3 },
	data() {
		return { current: CURRENT, release, steps: STEPS }
	},
	computed: {
		run() {
			return release.run
		},
		percent() {
			return this.run ? Math.round((this.run.step / (STEPS.length - 1)) * 100) : 0
		},
	},
	watch: {
		run(run, before) {
			if (run && !before) this.$nextTick(() => this.$refs.card?.focus())
		},
		'run.error'(error) {
			if (error) this.$nextTick(() => this.$refs.close?.focus())
		},
	},
	methods: {
		dismissUpdate,
		trapTab,
		stepState(index) {
			if (this.run.error) return index < this.run.step ? 'is-done' : index === this.run.step ? 'is-failed' : ''
			return index < this.run.step || this.run.step === STEPS.length - 1 ? 'is-done' : index === this.run.step ? 'is-active' : ''
		},
	},
}
</script>

<template>
	<Teleport to="body">
		<transition name="atrio-update-screen">
			<div v-if="run" class="atrio-update-screen" @keydown.tab="trapTab($event, $refs.card)">
				<div ref="card" :aria-label="$t('Updating Atrio')" aria-live="polite" aria-modal="true" class="atrio-update-card" role="dialog" tabindex="-1">
					<img :src="$asset('@/assets/img/logo/atrio-mark.svg')" alt="" class="atrio-update-mark">
					<h2>{{ run.error ? $t('Update failed') : $t('Updating Atrio') }}</h2>
					<p class="atrio-update-versions">
						v{{ current }}<template v-if="run.to"> → {{ run.to }}</template>
					</p>

					<div :class="{ 'is-failed': run.error }" class="atrio-update-bar">
						<span :style="{ width: `${run.error ? 100 : Math.max(percent, 4)}%` }" />
					</div>

					<ol class="atrio-update-steps">
						<li v-for="(step, index) in steps" :key="step" :class="stepState(index)">
							<span class="atrio-update-step-icon">
								<b-icon v-if="stepState(index) === 'is-done'" custom-size="mdi-18px" icon="check" pack="mdi" />
								<b-icon v-else-if="stepState(index) === 'is-failed'" custom-size="mdi-18px" icon="close" pack="mdi" />
								<span v-else-if="stepState(index) === 'is-active'" class="atrio-update-spinner" />
							</span>
							{{ $t(step) }}
						</li>
					</ol>

					<template v-if="run.error">
						<p class="atrio-update-error">{{ $t(run.error) }}</p>
						<p class="atrio-update-note">{{ $t('You can keep using Atrio and try again later.') }}</p>
						<button ref="close" class="atrio-update-close" type="button" @click="dismissUpdate">{{ $t('Close') }}</button>
					</template>
					<p v-else class="atrio-update-note">{{ $t('This takes a few seconds. The page reloads by itself when the update is done.') }}</p>
				</div>
			</div>
		</transition>
	</Teleport>
</template>

<style lang="scss">
.atrio-update-screen {
	position: fixed;
	inset: 0;
	z-index: 1000;
	display: grid;
	place-items: center;
	padding: 1rem;
	background: rgba(2, 6, 23, 0.55);
	backdrop-filter: blur(12px);
}

.atrio-update-card {
	display: flex;
	flex-direction: column;
	align-items: center;
	width: min(26rem, 100%);
	padding: 2rem 1.75rem 1.75rem;
	border-radius: 28px;
	background: var(--atrio-glass-bg-strong);
	backdrop-filter: blur(32px) saturate(150%);
	box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1), 0 24px 64px rgba(0, 0, 0, 0.4);
	color: var(--atrio-text);
	text-align: center;

	&:focus {
		outline: none;
	}

	h2 {
		margin-top: 1rem;
		font-size: 1.375rem;
		font-weight: 700;
		letter-spacing: -0.02em;
	}
}

.atrio-update-mark {
	width: 3rem;
	height: 3rem;
}

.atrio-update-versions {
	margin-top: 0.25rem;
	color: var(--atrio-text-muted);
	font-size: 0.875rem;
	font-variant-numeric: tabular-nums;
}

.atrio-update-bar {
	width: 100%;
	height: 0.375rem;
	margin: 1.5rem 0 1.25rem;
	overflow: hidden;
	border-radius: 999px;
	background: rgba(255, 255, 255, 0.08);

	span {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--atrio-accent);
		transition: width 0.6s ease;
	}

	&.is-failed span {
		background: #f87171;
	}
}

.atrio-update-steps {
	display: flex;
	flex-direction: column;
	gap: 0.625rem;
	width: 100%;
	text-align: left;

	li {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: var(--atrio-text-muted);
		font-size: 0.9375rem;
		font-weight: 600;

		&.is-active,
		&.is-done {
			color: var(--atrio-text);
		}

		&.is-failed {
			color: #fca5a5;
		}
	}
}

.atrio-update-step-icon {
	display: grid;
	flex-shrink: 0;
	place-items: center;
	width: 1.5rem;
	height: 1.5rem;
	border-radius: 50%;
	box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.18);

	.is-done & {
		background: var(--atrio-ok);
		box-shadow: none;
		color: #052e16;
	}

	.is-failed & {
		background: #f87171;
		box-shadow: none;
		color: #450a0a;
	}

	.is-active & {
		box-shadow: none;
	}
}

.atrio-update-spinner {
	width: 1.25rem;
	height: 1.25rem;
	border: 2px solid rgba(255, 255, 255, 0.18);
	border-top-color: var(--atrio-accent);
	border-radius: 50%;
	animation: atrio-update-spin 0.8s linear infinite;
}

@keyframes atrio-update-spin {
	to {
		transform: rotate(360deg);
	}
}

.atrio-update-error {
	margin-top: 1.25rem;
	color: #fca5a5;
	font-size: 0.875rem;
	font-weight: 600;
}

.atrio-update-note {
	margin-top: 1rem;
	color: var(--atrio-text-muted);
	font-size: 0.8125rem;
}

.atrio-update-close {
	height: 2.75rem;
	margin-top: 1.25rem;
	padding: 0 1.5rem;
	border: 0;
	border-radius: 0.875rem;
	background: var(--atrio-text);
	color: #0b1120;
	font: inherit;
	font-size: 0.875rem;
	font-weight: 700;
	cursor: pointer;
}

.atrio-update-screen-enter-active,
.atrio-update-screen-leave-active {
	transition: opacity 0.25s ease;
}

.atrio-update-screen-enter-from,
.atrio-update-screen-leave-to {
	opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
	.atrio-update-spinner {
		animation-duration: 2.4s;
	}
}
</style>
