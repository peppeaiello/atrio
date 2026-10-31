// Atrio's notification centre: what happened on the server while you were away (installs,
// updates, disk and temperature warnings). Kept in this browser, newest first.
import { reactive } from 'vue'

const STORAGE_KEY = 'atrio:notifications'
const LIMIT = 50

function load() {
	try {
		const items = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
		return Array.isArray(items) ? items : []
	}
	catch (e) {
		return []
	}
}

export const notifications = reactive({ items: load() })

function save() {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.items))
	}
	catch (e) {
		// Private window or full storage: they last until the page closes
	}
}

/**
 * Adds a notification. `key` makes it unique: one with the same key replaces the old one
 * (a disk that is still full, the same update announced twice).
 * level: 'info' | 'success' | 'warning' | 'error'
 */
export function notify({ key, level = 'info', title, body = '', icon = '' }) {
	const id = key || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
	const items = notifications.items.filter((item) => item.id !== id)
	items.unshift({ id, level, title, body, icon, time: Date.now(), read: false })
	notifications.items = items.slice(0, LIMIT)
	save()
}

export function hasNotification(key) {
	return notifications.items.some((item) => item.id === key)
}

export function unreadCount() {
	return notifications.items.filter((item) => !item.read).length
}

export function markAllRead() {
	notifications.items = notifications.items.map((item) => ({ ...item, read: true }))
	save()
}

export function removeNotification(id) {
	notifications.items = notifications.items.filter((item) => item.id !== id)
	save()
}

export function clearNotifications() {
	notifications.items = []
	save()
}

// Another tab added or read notifications
window.addEventListener('storage', (event) => {
	if (event.key === STORAGE_KEY) notifications.items = load()
})
