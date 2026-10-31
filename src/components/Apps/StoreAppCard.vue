<script>
// One app in the App Store: icon, name, tagline and the action that fits its state
// (install, installing, open, or not available for this machine).
export default {
	name: 'StoreAppCard',
	compatConfig: { MODE: 3 },
	props: {
		item: { type: Object, required: true },
		installed: { type: Boolean, default: false },
		installing: { type: Boolean, default: false },
		arch: { type: String, default: '' },
		// Featured apps show their screenshot above the card
		featured: { type: Boolean, default: false },
	},
	emits: ['details', 'install', 'open'],
	data() {
		return { fallbackIcon: this.$asset('@/assets/img/app/default.svg') }
	},
	computed: {
		// Apps without a list of architectures are taken as available everywhere
		available() {
			return !this.arch || !this.item.architectures?.length || this.item.architectures.includes(this.arch)
		},
	},
}
</script>

<template>
	<article :class="{ 'is-featured': featured, 'is-installed': installed }" class="atrio-store-card">
		<button v-if="featured" class="atrio-store-shot" tabindex="-1" type="button" @click="$emit('details')">
			<img v-if="item.thumbnail" :src="item.thumbnail" alt="" loading="lazy">
		</button>
		<button :aria-label="`${item.title}: ${$t('Details')}`" class="atrio-store-main" type="button" @click="$emit('details')">
			<img :src="item.icon || fallbackIcon" alt="" class="atrio-store-icon" loading="lazy" @error="$event.target.src = fallbackIcon">
			<span class="atrio-store-text">
				<span class="atrio-store-name">{{ item.title }}</span>
				<span class="atrio-store-tagline">{{ item.tagline }}</span>
			</span>
		</button>
		<footer class="atrio-store-foot">
			<span v-if="installed" class="atrio-store-state">
				<span class="atrio-store-dot" />{{ $t('Installed') }}
			</span>
			<span v-else class="atrio-store-category">{{ item.category }}</span>

			<button v-if="installing" class="atrio-store-action" disabled type="button">
				<span class="atrio-store-spinner" />{{ $t('Installing') }}
			</button>
			<button v-else-if="installed" class="atrio-store-action" type="button" @click="$emit('open')">
				{{ $t('Open') }}
			</button>
			<button v-else-if="available" class="atrio-store-action is-primary" type="button" @click="$emit('install')">
				{{ $t('Install') }}
			</button>
			<span v-else :title="$t('This app does not support {arch}', { arch })" class="atrio-store-unavailable">
				{{ $t('Not for {arch}', { arch }) }}
			</span>
		</footer>
	</article>
</template>

<style lang="scss">
.atrio-store-card {
	display: flex;
	flex-direction: column;
	min-width: 0;
	overflow: hidden;
	border-radius: var(--atrio-radius-md, 20px);
	background: rgba(255, 255, 255, 0.05);
	box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.07);
	transition: background 0.2s ease, transform 0.2s ease;

	&:hover {
		background: rgba(255, 255, 255, 0.09);
	}

	button {
		font: inherit;
		color: inherit;
	}
}

.atrio-store-shot {
	display: block;
	width: 100%;
	aspect-ratio: 16 / 9;
	padding: 0;
	overflow: hidden;
	border: 0;
	background: rgba(255, 255, 255, 0.04);
	cursor: pointer;

	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
}

.atrio-store-main {
	display: flex;
	flex: 1;
	gap: 0.875rem;
	align-items: flex-start;
	padding: 1rem 1rem 0.5rem;
	border: 0;
	background: none;
	text-align: left;
	cursor: pointer;

	&:focus-visible {
		outline: 2px solid var(--atrio-accent);
		outline-offset: -2px;
		border-radius: inherit;
	}
}

.atrio-store-icon {
	flex-shrink: 0;
	width: 3rem;
	height: 3rem;
	border-radius: 0.875rem;
	object-fit: cover;
}

.atrio-store-text {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	min-width: 0;
}

.atrio-store-name {
	overflow: hidden;
	color: var(--atrio-text);
	font-size: 0.9375rem;
	font-weight: 700;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.atrio-store-tagline {
	display: -webkit-box;
	overflow: hidden;
	color: var(--atrio-text-soft);
	font-size: 0.8125rem;
	line-height: 1.35;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
}

.atrio-store-foot {
	display: flex;
	gap: 0.5rem;
	align-items: center;
	justify-content: space-between;
	padding: 0.5rem 1rem 1rem calc(1rem + 3rem + 0.875rem);
}

.atrio-store-category,
.atrio-store-state {
	display: inline-flex;
	gap: 0.375rem;
	align-items: center;
	min-width: 0;
	overflow: hidden;
	color: var(--atrio-text-muted);
	font-size: 0.75rem;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.atrio-store-state {
	color: #86efac;
	font-weight: 600;
}

.atrio-store-dot {
	width: 0.4375rem;
	height: 0.4375rem;
	border-radius: 50%;
	background: var(--atrio-ok);
}

.atrio-store-action {
	display: inline-flex;
	flex-shrink: 0;
	gap: 0.375rem;
	align-items: center;
	height: 2rem;
	padding: 0 0.875rem;
	border: 1px solid rgba(255, 255, 255, 0.14);
	border-radius: 999px;
	background: rgba(255, 255, 255, 0.06);
	font-size: 0.8125rem !important;
	font-weight: 700 !important;
	cursor: pointer;

	&:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.14);
	}

	&:disabled {
		cursor: default;
		opacity: 0.8;
	}

	&.is-primary {
		border-color: transparent;
		background: var(--atrio-text);
		color: #0b1120 !important;

		&:hover {
			background: #e2e8f0;
		}
	}
}

.atrio-store-unavailable {
	flex-shrink: 0;
	color: var(--atrio-text-muted);
	font-size: 0.75rem;
	font-style: italic;
}

.atrio-store-spinner {
	width: 0.875rem;
	height: 0.875rem;
	border: 2px solid rgba(255, 255, 255, 0.2);
	border-top-color: var(--atrio-accent);
	border-radius: 50%;
	animation: atrio-store-spin 0.8s linear infinite;
}

@keyframes atrio-store-spin {
	to {
		transform: rotate(360deg);
	}
}
</style>
