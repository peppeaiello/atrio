// The CasaOS gateway sends every UI file with the same fixed Last-Modified date, so a normal
// reload asks "changed since then?", gets 304 and shows the cached index.html again.
// Refetch the page bypassing the cache (this also refreshes the cached copy), then reload.

export async function reloadFresh() {
	try {
		await Promise.all(['/', '/index.html'].map((url) => fetch(url, { cache: 'reload' })))
	} catch {
		// Reload anyway
	}
	window.location.reload()
}
