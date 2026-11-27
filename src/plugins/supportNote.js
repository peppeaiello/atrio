// One quiet note, once in the life of this browser: after the first update of Atrio that it sees, a
// message at the bottom says that Atrio is free and can be supported on Ko-fi. Closed, it never comes
// back. Only the versions seen are kept, in this browser; nothing is sent anywhere.
import { CURRENT } from '@/plugins/atrioRelease'

const SEEN = 'atrio:last-version'
const ASKED = 'atrio:support-asked'
export const KOFI = 'https://ko-fi.com/peppeaiello'

function read(key) {
  try {
    return localStorage.getItem(key)
  }
  catch {
    return null
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value)
    return true
  }
  catch {
    // A private window: then the note is never shown, as it could not be remembered as shown
    return false
  }
}

/** Shows the note if this page is the first one after an update; `vm` for $t and $buefy. */
export function maybeAskSupport(vm) {
  if (import.meta.env.DEV)
    return
  const previous = read(SEEN)
  if (previous === CURRENT || !write(SEEN, CURRENT))
    return
  // A first visit is not an update, and the note is shown only once
  if (!previous || read(ASKED) || !write(ASKED, CURRENT))
    return
  vm.$buefy.snackbar.open({
    message: vm.$t('Atrio is now on version {version}. It is free and made by one person: if it is useful to you, you can support it on Ko-fi.', { version: CURRENT }),
    actionText: vm.$t('Support on Ko-fi'),
    cancelText: vm.$t('Close'),
    indefinite: true,
    position: 'is-bottom-right',
    type: 'is-primary',
    onAction: () => window.open(KOFI, '_blank', 'noopener'),
  })
}
