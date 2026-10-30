// Binds the `sockets: { event() {} }` option of components to the CasaOS message bus socket,
// replacing vue-socket.io-extended (Vue 2 only).

export default {
	install(app, socket) {
		// vue-socket.io-extended's helpers for listeners added outside the `sockets` option
		socket.$subscribe = (event, handler) => socket.on(event, handler)
		socket.$unsubscribe = (event) => socket.off(event)
		app.config.globalProperties.$socket = socket
		app.mixin({
			created() {
				const handlers = this.$options.sockets
				if (!handlers) return
				this.$_socketHandlers = Object.entries(handlers).map(([event, handler]) => {
					const bound = handler.bind(this)
					socket.on(event, bound)
					return [event, bound]
				})
			},
			beforeUnmount() {
				this.$_socketHandlers?.forEach(([event, bound]) => socket.off(event, bound))
			},
		})
	},
}
