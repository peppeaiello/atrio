<template>
	<div class="contact-bar is-flex is-align-items-center has-text-white">
		<a :aria-label="$t('Atrio on GitHub')" :data-tooltip="$t('Atrio on GitHub')" href="https://github.com/peppeaiello/atrio" rel="noopener" target="_blank">
			<b-icon icon="github" pack="casa"></b-icon>
		</a>
		<a :aria-label="$t('Support Atrio on Ko-fi')" :data-tooltip="$t('Support Atrio on Ko-fi')" href="https://ko-fi.com/peppeaiello" rel="noopener" target="_blank">
			<b-icon icon="coffee-outline" pack="mdi"></b-icon>
		</a>
	</div>
</template>

<script>
export default {
	name: "contact-bar",
}
</script>

<style lang="scss" scoped>
.contact-bar {
	position: fixed;
	right: 1.375rem;
	bottom: 0;
	//z-index: 10;

	a {
		color: #fff;
		margin: 0.625rem;
		display: flex;
		align-items: center;

		&:hover {
			color: #fff;
		}
	}
}

// Tooltip drawn in CSS: nothing to measure or position, so it cannot flicker
a[data-tooltip] {
	position: relative;

	&::after {
		content: attr(data-tooltip);
		position: absolute;
		right: 0;
		bottom: calc(100% + 0.375rem);
		padding: 0.35rem 0.75rem;
		border-radius: 0.5rem;
		background: var(--atrio-glass-bg-strong);
		backdrop-filter: var(--atrio-glass-blur);
		box-shadow: inset 0 0 0 1px var(--atrio-glass-border);
		color: var(--atrio-text);
		font-size: 0.8125rem;
		white-space: nowrap;
		opacity: 0;
		pointer-events: none;
		transform: translateY(0.25rem);
		transition: opacity 0.15s ease, transform 0.15s ease;
	}

	&:hover::after,
	&:focus-visible::after {
		opacity: 1;
		transform: translateY(0);
	}
}


@media screen and (max-width: 480px) {
	.contact-bar {
		right: 0;
		bottom: 0rem;
		background-color: transparent;
		backdrop-filter: none;
		display: flex;
		justify-content: center;
		width: 100%;
	}
}
</style>

