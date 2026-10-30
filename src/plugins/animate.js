// `v-animate-css="{ classes: 'fadeIn', duration: 500 }"`: plays an animate.css animation when the
// element is mounted, replacing v-animate-css (Vue 2 only). animate.css is loaded from public/css.

const animate = {
	mounted(el, { value }) {
		if (!value?.classes) return
		el.style.animationDuration = `${value.duration ?? 1000}ms`
		el.classList.add('animated', ...value.classes.split(' '))
	},
}

export default {
	install(app) {
		if (!document.querySelector('link[href="/css/animate.min.css"]')) {
			const link = document.createElement('link')
			link.rel = 'stylesheet'
			link.href = '/css/animate.min.css'
			document.head.appendChild(link)
		}
		app.directive('animate-css', animate)
	},
}
