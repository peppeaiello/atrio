// How large the greeting above the dashboard is: large, small or hidden. Kept in this browser.
import { reactive } from 'vue'

const STORAGE_KEY = 'atrio:greeting'
export const GREETING_SIZES = ['large', 'small', 'hidden']

function load() {
	try {
		const value = localStorage.getItem(STORAGE_KEY)
		return GREETING_SIZES.includes(value) ? value : 'large'
	}
	catch (e) {
		return 'large'
	}
}

export const greeting = reactive({ size: load() })

export function setGreetingSize(size) {
	if (!GREETING_SIZES.includes(size))
		return
	greeting.size = size
	try {
		localStorage.setItem(STORAGE_KEY, size)
	}
	catch (e) {
		// Private window: the choice lasts until the page closes
	}
}
