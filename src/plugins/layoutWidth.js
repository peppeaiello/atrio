// How wide the dashboard is on large screens, from 0 (Bulma's container) to 100 (most of the window).
// Kept in this browser; a class and a variable on <html> let the top bar and the dashboard follow it together.
import { reactive } from 'vue'

const STORAGE_KEY = 'atrio:layout-width'

function clampWidth(value) {
	const number = Math.round(Number(value))
	return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0
}

function load() {
	try {
		const value = localStorage.getItem(STORAGE_KEY)
		// The first version had normal and wide only
		if (value === 'wide') return 100
		if (value === 'normal' || !value) return 0
		return clampWidth(value)
	}
	catch (e) {
		return 0
	}
}

export const layout = reactive({ width: load() })

function apply() {
	const root = document.documentElement
	root.classList.toggle('atrio-wide', layout.width > 0)
	root.style.setProperty('--atrio-wide', String(layout.width / 100))
}

apply()

export function setLayoutWidth(width) {
	layout.width = clampWidth(width)
	apply()
	try {
		localStorage.setItem(STORAGE_KEY, String(layout.width))
	}
	catch (e) {
		// Private window: the choice lasts until the page closes
	}
}
