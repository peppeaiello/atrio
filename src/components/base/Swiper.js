// Swiper and SwiperSlide with the vue-awesome-swiper API the app uses (`:options`, `@ready`,
// swiper events as kebab-case component events), built on Swiper 11 for Vue 3.
import { h } from 'vue'
import SwiperCore from 'swiper'
import { Autoplay, Navigation, Pagination } from 'swiper/modules'

const kebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

export const Swiper = {
	name: 'Swiper',
	compatConfig: { MODE: 3 },
	props: {
		options: { type: Object, default: () => ({}) },
	},
	emits: ['ready'],
	mounted() {
		this.swiper = new SwiperCore(this.$el, {
			modules: [Autoplay, Navigation, Pagination],
			observer: true,
			observeParents: true,
			...this.options,
		})
		this.swiper.onAny((event, ...args) => this.$emit(kebab(event), ...args))
		this.$emit('ready', this.swiper)
	},
	updated() {
		this.swiper?.update()
	},
	beforeUnmount() {
		this.swiper?.destroy(true, false)
	},
	render() {
		return h('div', { class: 'swiper' }, [h('div', { class: 'swiper-wrapper' }, this.$slots.default?.())])
	},
}

export const SwiperSlide = {
	name: 'SwiperSlide',
	compatConfig: { MODE: 3 },
	render() {
		return h('div', { class: 'swiper-slide' }, this.$slots.default?.())
	},
}
