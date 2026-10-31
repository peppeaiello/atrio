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

// A built-in wallpaper is saved with the file name of the build that offered it: webpack names
// from CasaOS-UI ("/img/wallpaper02.92a6b52e.jpg"), Vite names from an older Atrio build
// ("/assets/wallpaper01-DQqdEKCq.jpg"), or the source path of the dev server. Any of them is
// mapped to the wallpaper of this build, so a new build never leaves the background empty.
export function builtInWallpaper(path) {
	if (typeof path !== 'string') return path
	const builtIn = path.match(/\/(?:img|assets|src\/assets\/background)\/(wallpaper0\d)(?:[.-][\w-]+)?\.jpg(?:[?#].*)?$/)
	return builtIn ? asset(`@/assets/background/${builtIn[1]}.jpg`) ?? path : path
}

export default {
	install(app) {
		app.config.globalProperties.$asset = asset
	},
}
