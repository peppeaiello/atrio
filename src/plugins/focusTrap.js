// Keeps Tab inside a dialog and gives focus back to whatever opened it.
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function trapTab(event, container) {
	if (event.key !== 'Tab' || !container) return
	const items = [...container.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null)
	if (!items.length) {
		event.preventDefault()
		return
	}
	const first = items[0]
	const last = items[items.length - 1]
	const inside = container.contains(document.activeElement)
	if (event.shiftKey && (document.activeElement === first || !inside)) {
		event.preventDefault()
		last.focus()
	} else if (!event.shiftKey && (document.activeElement === last || !inside)) {
		event.preventDefault()
		first.focus()
	}
}

export function restoreFocus(element) {
	if (element && element.isConnected && typeof element.focus === 'function') element.focus()
}
