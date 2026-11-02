// How wide the dashboard is on large screens: normal (Bulma's container) or wide (most of the window).
// Kept in this browser; the class on <html> lets the top bar and the dashboard follow it together.
import { reactive } from 'vue'

const STORAGE_KEY = 'atrio:layout-width'
export const LAYOUT_WIDTHS = ['normal', 'wide']

function load() {
	try {
		const value = localStorage.getItem(STORAGE_KEY)
		return LAYOUT_WIDTHS.includes(value) ? value : 'normal'
	}
	catch (e) {
		return 'normal'
	}
}

export const layout = reactive({ width: load() })

function apply() {
	document.documentElement.classList.toggle('atrio-wide', layout.width === 'wide')
}

apply()

export function setLayoutWidth(width) {
	if (!LAYOUT_WIDTHS.includes(width))
		return
	layout.width = width
	apply()
	try {
		localStorage.setItem(STORAGE_KEY, width)
	}
	catch (e) {
		// Private window: the choice lasts until the page closes
	}
}
