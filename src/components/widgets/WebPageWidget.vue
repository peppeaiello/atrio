<script>
// A web page inside the widget column: an app's status page, a small dashboard, a camera view.
// Added and set up from the widgets panel; its settings live in the widgets configuration.
export const HEIGHTS = { small: '12rem', medium: '18rem', large: '26rem' }

export default {
	name: 'WebPageWidget',
	compatConfig: { MODE: 3 },
	props: {
		title: { type: String, default: '' },
		url: { type: String, required: true },
		height: { type: String, default: 'medium' },
	},
	data() {
		return { reloadKey: 0 }
	},
	computed: {
		frameHeight() {
			return HEIGHTS[this.height] || HEIGHTS.medium
		},
		label() {
			if (this.title) return this.title
			try {
				return new URL(this.url).host
			}
			catch (e) {
				return this.url
			}
		},
	},
}
</script>

<template>
	<div class="widget has-text-grey-100 atrio-webpage-widget">
		<div class="blur-background" />
		<div class="widget-content">
			<div class="widget-header is-flex">
				<div class="widget-title is-flex-grow-1 atrio-webpage-title" :title="url">{{ label }}</div>
				<button :aria-label="$t('Reload')" :title="$t('Reload')" class="widget-icon-button atrio-widget-button" type="button" @click="reloadKey++">
					<b-icon custom-size="mdi-18px" icon="refresh" pack="mdi" />
				</button>
				<a :aria-label="$t('Open in a new tab')" :href="url" :title="$t('Open in a new tab')" class="widget-icon-button atrio-widget-button" rel="noopener" target="_blank">
					<b-icon custom-size="mdi-18px" icon="open-in-new" pack="mdi" />
				</a>
			</div>
			<!-- Sandboxed: the page runs its own scripts but cannot navigate or take over Atrio -->
			<iframe
				:key="reloadKey"
				:src="url"
				:style="{ height: frameHeight }"
				:title="label"
				class="atrio-webpage-frame"
				loading="lazy"
				referrerpolicy="no-referrer"
				sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
			/>
			<p class="atrio-webpage-hint">{{ $t('Empty? Some sites do not allow being shown inside another page: open it in a new tab.') }}</p>
		</div>
	</div>
</template>

<style lang="scss">
.atrio-webpage-widget {
	.atrio-webpage-title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.atrio-widget-button {
		display: grid;
		place-items: center;
		margin-left: 0.25rem;
		padding: 0;
		border: 0;
		border-radius: 0.375rem;
		background: transparent;
		color: inherit;
		cursor: pointer;

		&:hover {
			background: rgba(255, 255, 255, 0.1);
		}
	}
}

.atrio-webpage-frame {
	display: block;
	width: 100%;
	margin-top: 0.75rem;
	border: 0;
	border-radius: 0.75rem;
	background: rgba(255, 255, 255, 0.04);
}

.atrio-webpage-hint {
	margin-top: 0.5rem;
	color: var(--atrio-text-muted);
	font-size: 0.6875rem;
	line-height: 1.3;
}
</style>
