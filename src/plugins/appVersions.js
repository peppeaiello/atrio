// The App Store pins each app to one tag, and CasaOS calls any other tag an update, even an older one.
// An older image can refuse the data of a newer one, so Atrio checks the direction before offering or running it.

function tagOf(image = '') {
	const ref = image.split('@')[0]
	const colon = ref.lastIndexOf(':')
	return colon > ref.lastIndexOf('/') ? ref.slice(colon + 1) : 'latest'
}

function versionParts(tag) {
	const match = /^v?(\d+(?:\.\d+)*)/.exec(tag)
	return match ? match[1].split('.').map(Number) : null
}

/** True when moving to the store's tag goes back, or when a tag like "latest" makes it impossible to tell. */
export function wouldGoBack(installed, store) {
	if (!store || installed === store) return false
	const store_ = versionParts(store)
	if (!store_) return false
	const installed_ = versionParts(installed)
	if (!installed_) return true
	for (let i = 0; i < Math.max(store_.length, installed_.length); i++) {
		const diff = (store_[i] || 0) - (installed_[i] || 0)
		if (diff) return diff < 0
	}
	return false
}

/** The first service of an app that the store's version would take back, or null. Pass `compose` if already loaded. */
export async function findDowngrade(openAPI, name, compose) {
	try {
		const { appStore, compose: api } = openAPI.appManagement
		const services = (compose || (await api.myComposeApp(name)).data.data.compose)?.services || {}
		const checks = await Promise.all(Object.entries(services).map(async ([service, { image }]) => {
			const store = await appStore.composeAppServiceStableTag(name, service).then((res) => res.data.data.tag, () => '')
			return { service, installed: tagOf(image), store }
		}))
		return checks.find((check) => wouldGoBack(check.installed, check.store)) || null
	}
	catch (e) {
		return null
	}
}
