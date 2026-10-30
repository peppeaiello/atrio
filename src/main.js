import 'intersection-observer'
import { configureCompat, createApp } from 'vue'
import App from '@/App.vue'
import router from '@/router'
import store from '@/store'
import i18n from '@/plugins/i18n'
import api from '@/service/api.js'
import openAPI from '@/service/index.js'
import Buefy from 'buefy'
import VueFullscreen from 'vue-fullscreen'
import VueSocialSharing from 'vue-social-sharing'
import messageBus from '@/events/index.js'
import createEventBus from '@/events/bus.js'
import { buildVueDompurifyHTMLDirective } from 'vue-dompurify-html'
import io from 'socket.io-client'
import Asset from '@/plugins/asset'
import Socket from '@/plugins/socket'
import Animate from '@/plugins/animate'

// Import Styles
import '@fontsource/manrope/400.css'
import '@fontsource/manrope/500.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
import '@fontsource/manrope/800.css'
import '@/assets/scss/app.scss'

const isDev = process.env.NODE_ENV === 'dev';
const protocol = document.location.protocol
const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:'
const devIp = process.env.VUE_APP_DEV_IP
const devPort = process.env.VUE_APP_DEV_PORT
const localhost = document.location.host
const localhostName = document.location.hostname
const baseIp = isDev ? `${devIp}` : `${localhostName}`
const baseURL = isDev ? `${devIp}:${devPort}` : `${localhost}`

const socket = io( {
	transports: ['websocket', 'polling'],
	path: '/v2/message_bus/socket.io/',
});

// Vue 3 behaviour where nothing in the app relies on Vue 2's, so Vue 3 libraries
// (Buefy 3, vuedraggable, ...) work; the rest stays in compat mode while code is migrated.
configureCompat({
	RENDER_FUNCTION: false,
	INSTANCE_SCOPED_SLOTS: false,
	COMPONENT_V_MODEL: false,
})

const app = createApp(App)

app.use(router)
app.use(store)
app.use(i18n)
app.use(Buefy)
// Buefy 3 is written for Vue 3: run its components without the Vue 2 compat behaviours
for (const [name, component] of Object.entries(app._context.components)) {
	if (name.startsWith('B')) component.compatConfig = { MODE: 3 }
}
app.use(Asset)
app.use(Animate)
app.use(VueFullscreen)
app.use(Socket, socket)
app.use(VueSocialSharing)
app.directive('dompurify-html', buildVueDompurifyHTMLDirective({
	default: {
		ALLOWED_ATTR: ['target', 'href']
	}
}))

Object.assign(app.config.globalProperties, {
	$api: api,
	$openAPI: openAPI,
	$baseIp: baseIp,
	$baseURL: baseURL,
	$protocol: protocol,
	$wsProtocol: wsProtocol,
	$EventBus: createEventBus(),
	$messageBus: messageBus,
})

app.mount('#app')

// CasaOS serves the UI without cache headers, so after an update the browser may still run
// the previous build. When the server has another version, reload once from a fresh URL.
/* global __ATRIO_VERSION__ */
if (!import.meta.env.DEV) {
	fetch(`/atrio-version.json?t=${Date.now()}`, { cache: 'no-store' })
		.then((res) => (res.ok ? res.json() : null))
		.then((server) => {
			if (!server || server.version === __ATRIO_VERSION__) return
			const key = 'atrio:reloaded-for'
			try {
				if (sessionStorage.getItem(key) === server.version) return
				sessionStorage.setItem(key, server.version)
			} catch {
				return
			}
			window.location.replace(`${window.location.pathname}?v=${server.version}${window.location.hash}`)
		})
		.catch(() => {})
}
