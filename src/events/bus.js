// Minimal event bus with the Vue 2 instance API ($on, $once, $off, $emit) used across the app.

export default function createEventBus() {
	const handlers = new Map()
	const bus = {
		$on(event, handler) {
			if (!handlers.has(event)) handlers.set(event, new Set())
			handlers.get(event).add(handler)
			return bus
		},
		$once(event, handler) {
			const once = (...args) => {
				bus.$off(event, once)
				handler(...args)
			}
			return bus.$on(event, once)
		},
		$off(event, handler) {
			if (event === undefined) handlers.clear()
			else if (handler === undefined) handlers.delete(event)
			else handlers.get(event)?.delete(handler)
			return bus
		},
		$emit(event, ...args) {
			handlers.get(event)?.forEach((handler) => handler(...args))
			return bus
		},
	}
	return bus
}
