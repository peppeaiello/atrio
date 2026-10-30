// Resolves "@/assets/..." paths at runtime, replacing webpack's require() for images and animations.
// Templates use it as `$asset('@/assets/img/...')`, scripts import `asset`.

const urls = import.meta.glob('/src/assets/{img,background}/**/*.{svg,png,jpg,jpeg,gif,webp}', {
	eager: true,
	query: '?url',
	import: 'default',
})
const animations = import.meta.glob('/src/assets/ani/*.json', { eager: true, import: 'default' })

export function asset(path) {
	const key = path.replace(/^@\//, '/src/')
	const found = urls[key] ?? animations[key]
	if (found === undefined) {
		console.warn(`Asset not found: ${path}`)
	}
	return found
}

// Wallpaper settings saved by CasaOS-UI point at webpack build files such as
// "/img/wallpaper02.92a6b52e.jpg", which no longer exist: map them to the bundled wallpapers.
export function builtInWallpaper(path) {
	const legacy = path.match(/\/img\/(wallpaper0\d)\.[0-9a-f]+\.jpg$/)
	return legacy ? asset(`@/assets/background/${legacy[1]}.jpg`) : path
}

export default {
	install(app) {
		app.config.globalProperties.$asset = asset
	},
}
