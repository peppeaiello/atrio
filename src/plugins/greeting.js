// The greeting above the dashboard: shown or not, and its size from 0 (smallest) to 100 (largest).
// Kept in this browser.
import { reactive } from 'vue'

const STORAGE_KEY = 'atrio:greeting'
// The size of the greeting before it could be set, 2.5rem
export const GREETING_DEFAULT = 73
// Title size in rem at 0 and at 100
const MIN_REM = 1.125
const MAX_REM = 3

function clampSize(value) {
	const number = Math.round(Number(value))
	return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : GREETING_DEFAULT
}

function load() {
	try {
		const value = localStorage.getItem(STORAGE_KEY)
		// 0.1.11 kept a choice of three
		if (value === 'hidden') return { visible: false, size: GREETING_DEFAULT }
		if (value === 'small') return { visible: true, size: 13 }
		if (value === 'large' || !value) return { visible: true, size: GREETING_DEFAULT }
		const saved = JSON.parse(value)
		return { visible: saved.visible !== false, size: clampSize(saved.size) }
	}
	catch (e) {
		return { visible: true, size: GREETING_DEFAULT }
	}
}

export const greeting = reactive(load())

export function greetingRem(size = greeting.size) {
	return MIN_REM + (MAX_REM - MIN_REM) * clampSize(size) / 100
}

function save() {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ visible: greeting.visible, size: greeting.size }))
	}
	catch (e) {
		// Private window: the choice lasts until the page closes
	}
}

export function setGreetingVisible(visible) {
	greeting.visible = Boolean(visible)
	save()
}

export function setGreetingSize(size) {
	greeting.size = clampSize(size)
	save()
}
