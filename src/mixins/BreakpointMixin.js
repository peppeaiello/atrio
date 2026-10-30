// Window size helpers (isMobile, isTablet, isDesktop), adapted for Vue 3 from
// vue-breakpoint-mixin 1.5.0 (MIT), which only supported Vue 2.

const breakpoints = { xl: 1408, l: 1216, m: 1024, sm: 768, xsm: 375 }

export default {
	data: () => ({
		sizeType: '',
		windowWidth: undefined,
		windowHeight: undefined,
		orientation: '',
	}),
	mounted() {
		window.addEventListener('resize', this.resizeHandler)
		this.resizeHandler()
	},
	beforeUnmount() {
		window.removeEventListener('resize', this.resizeHandler)
	},
	computed: {
		isMobile() {
			return ['sm', 'xsm'].includes(this.sizeType)
		},
		isTablet() {
			return this.sizeType === 'm'
		},
		isDesktop() {
			return ['xxl', 'xl', 'l'].includes(this.sizeType)
		},
	},
	methods: {
		resizeHandler() {
			const { innerWidth, innerHeight } = window
			this.windowWidth = innerWidth
			this.windowHeight = innerHeight
			this.orientation = window.matchMedia('(orientation: landscape)').matches ? 'landscape' : 'portrait'
			if (innerWidth >= breakpoints.xl) this.sizeType = 'xxl'
			else if (innerWidth >= breakpoints.l) this.sizeType = 'xl'
			else if (innerWidth >= breakpoints.m) this.sizeType = 'l'
			else if (innerWidth >= breakpoints.sm) this.sizeType = 'm'
			else if (innerWidth >= breakpoints.xsm) this.sizeType = 'sm'
			else this.sizeType = 'xsm'
		},
		classUtility(config = {}) {
			if (this.isMobile) return config.mobile || ''
			if (this.isTablet) return config.tablet || ''
			if (this.isDesktop) return config.desktop || ''
			return ''
		},
	},
}
