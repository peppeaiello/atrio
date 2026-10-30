<script>
// Drop-in replacement for the parts of vue-popperjs (Vue 2 only) that the app uses:
// a `reference` slot, the popper content in the default slot, hover or click triggers.
import { createPopper } from '@popperjs/core'

export default {
	name: 'Popper',
	compatConfig: { MODE: 3 },
	props: {
		// Only `placement` is used from the vue-popperjs (Popper.js v1) options
		options: { type: Object, default: () => ({}) },
		trigger: { type: String, default: 'hover' }, // hover, click, clickToOpen
		appendToBody: { type: Boolean, default: false },
		transition: { type: String, default: '' },
		enterActiveClass: { type: String, default: undefined },
		leaveActiveClass: { type: String, default: undefined },
		delayOnMouseOut: { type: Number, default: 10 },
	},
	emits: ['show', 'hide'],
	data() {
		return { showPopper: false }
	},
	watch: {
		showPopper(value) {
			if (value) {
				this.$nextTick(this.createInstance)
				this.$emit('show')
			} else {
				this.destroyInstance()
				this.$emit('hide')
			}
		},
	},
	mounted() {
		document.addEventListener('click', this.onDocumentClick, true)
	},
	beforeUnmount() {
		document.removeEventListener('click', this.onDocumentClick, true)
		clearTimeout(this.hideTimer)
		this.destroyInstance()
	},
	methods: {
		createInstance() {
			if (!this.$refs.reference || !this.$refs.popper) return
			this.destroyInstance()
			this.instance = createPopper(this.$refs.reference, this.$refs.popper, {
				placement: this.options.placement || 'bottom',
				modifiers: [{ name: 'offset', options: { offset: [0, 4] } }],
			})
		},
		destroyInstance() {
			this.instance?.destroy()
			this.instance = null
		},
		doShow() {
			this.showPopper = true
		},
		doClose() {
			this.showPopper = false
		},
		onMouseEnter() {
			if (this.trigger !== 'hover') return
			clearTimeout(this.hideTimer)
			this.showPopper = true
		},
		onMouseLeave() {
			if (this.trigger !== 'hover') return
			this.hideTimer = setTimeout(() => (this.showPopper = false), this.delayOnMouseOut)
		},
		onReferenceClick() {
			if (this.trigger === 'click') this.showPopper = !this.showPopper
			else if (this.trigger === 'clickToOpen') this.showPopper = true
		},
		onDocumentClick(event) {
			if (!this.showPopper || this.trigger === 'hover') return
			const inside = [this.$refs.reference, this.$refs.popper].some((el) => el?.contains(event.target))
			if (!inside) this.showPopper = false
		},
	},
}
</script>

<template>
	<span class="popper-root" @mouseenter="onMouseEnter" @mouseleave="onMouseLeave">
		<span ref="reference" class="popper-reference" @click="onReferenceClick">
			<slot name="reference" />
		</span>
		<Teleport to="body" :disabled="!appendToBody">
			<transition :name="transition" :enter-active-class="enterActiveClass" :leave-active-class="leaveActiveClass">
				<div v-show="showPopper" ref="popper" class="popper-layer" @mouseenter="onMouseEnter" @mouseleave="onMouseLeave">
					<slot />
				</div>
			</transition>
		</Teleport>
	</span>
</template>

<style>
.popper-root,
.popper-reference {
	display: inline-block;
}

.popper-layer {
	z-index: 1000;
}
</style>
