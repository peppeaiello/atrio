// What the terminal icon in the header opens first: the logs or the terminal. Kept in this browser.
import { reactive } from 'vue'

const STORAGE_KEY = 'atrio:console-view'
const VIEWS = ['logs', 'terminal']

function load() {
	try {
		const value = localStorage.getItem(STORAGE_KEY)
		return VIEWS.includes(value) ? value : 'logs'
	}
	catch (e) {
		return 'logs'
	}
}

export const consolePrefs = reactive({ view: load() })

export function setConsoleView(view) {
	if (!VIEWS.includes(view)) return
	consolePrefs.view = view
	try {
		localStorage.setItem(STORAGE_KEY, view)
	}
	catch (e) {
		// Private window: the choice lasts until the page closes
	}
}
