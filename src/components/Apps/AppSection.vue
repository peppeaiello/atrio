<template>
	<div class="home-section has-text-left">
		<!-- Title Bar Start -->
		<div class="is-flex is-align-items-center mb-4">
			<app-section-title-tip
				id="appTitle1"
				class="is-flex-grow-1 has-text-sub-04"
				label="Drag icons to sort."
				title="Apps"
			>
			</app-section-title-tip>

			<!-- Atrio: filter by status -->
			<div :aria-label="$t('Filter apps')" class="atrio-segmented mr-3" role="group">
				<button
					v-for="option in filterOptions" :key="option.value" :aria-pressed="filter === option.value"
					:class="{ 'is-active': filter === option.value }" type="button" @click="setFilter(option.value)"
				>
					{{ option.label }}
				</button>
			</div>

			<b-dropdown animation="fade1" aria-role="menu" class="file-dropdown" position="is-bottom-left">
				<template #trigger>
					<b-icon
						class="polymorphic is-clickable has-text-grey-100"
						icon="plus-outline"
						pack="casa"
						size="is-24"
					></b-icon>
				</template>
				<b-dropdown-item aria-role="menuitem" @click="showInstall(0, 'custom')">
					{{ $t('Custom Install APP') }}
				</b-dropdown-item>
				<b-dropdown-item aria-role="menuitem" @click="showExternalLinkPanel">
					{{ $t('Add external link/APP') }}
				</b-dropdown-item>
			</b-dropdown>
		</div>
		<!-- Title Bar End -->

		<!-- App List Start -->
		<draggable
			v-if="!isLoading"
			v-model="appList"
			:draggable="draggable"
			:disabled="filter !== 'all'"
			:item-key="(item) => 'app-' + item.name"
			class="app-list contextmenu-canvas"
			tag="div"
			v-bind="dragOptions"
			@end="onSortEnd"
			@start="drag = true"
		>
			<!-- App Icon Card Start -->
			<template #item="{ element: item }">
				<div v-show="matchesFilter(item)" :id="'app-' + item.name" class="handle">
					<app-card
						:item="item"
						@configApp="showConfigPanel"
						@importApp="showContainerPanel"
						@updateState="getList"
					></app-card>
				</div>
			</template>
			<!-- App Icon Card End -->
			<!-- Atrio: apps being installed, until they join the list -->
			<template #footer>
				<InstallingAppCard
					v-for="install in pendingInstalls"
					v-show="filter === 'all'"
					:key="'installing-' + install.name"
					:install="install"
					@dismiss="dismissInstall(install.name)"
				/>
			</template>
		</draggable>
		<p v-if="!isLoading && filter !== 'all' && !appList.some(matchesFilter)" class="atrio-empty-filter">
			{{ filter === 'running' ? $t('No running apps') : $t('No stopped apps') }}
		</p>
		<div v-else-if="isLoading" class="app-list contextmenu-canvas">
			<div v-for="index in skCount" :id="'app-' + index" :key="'app-' + index" class="handle">
				<app-card-skeleton :index="index"></app-card-skeleton>
			</div>
		</div>
		<!-- App List End -->

		<template v-if="oldAppList.length > 0">
			<!-- Title Bar Start -->
			<div class="title-bar is-flex is-align-items-center mt-2rem mb-5">
				<app-section-title-tip
					id="appTitle2"
					class="is-flex-grow-1 has-text-sub-04"
					label="To be rebuilt."
					title="Legacy app (To be rebuilt)."
				>
				</app-section-title-tip>
			</div>
			<!-- Title Bar End -->

			<!-- App List Start -->
			<div class="app-list contextmenu-canvas">
				<!-- Application not imported Start -->
				<div v-for="item in oldAppList" :id="'app-' + item.name" :key="'app-' + item.name" class="handle">
					<app-card
						:isCasa="false"
						:item="item"
						@configApp="showConfigPanel"
						@importApp="showContainerPanel"
						@updateState="getList"
					></app-card>
				</div>
				<!-- Application not imported End -->
			</div>
			<!-- App List End -->
		</template>
	</div>
</template>

<script>
import { asset } from '@/plugins/asset'
import AppCard from './AppCard.vue'
import AppCardSkeleton from './AppCardSkeleton.vue'
import InstallingAppCard from './InstallingAppCard.vue'
import AppPanel from './AppPanel.vue'
import ExternalLinkPanel from '@/components/Apps/ExternalLinkPanel'
import AppSectionTitleTip from './AppSectionTitleTip.vue'
import draggable from 'vuedraggable'
import xor from 'lodash/xor'
import concat from 'lodash/concat'
import events from '@/events/events'
import last from 'lodash/last'
import business_ShowNewAppTag from '@/mixins/app/Business_ShowNewAppTag'
import business_LinkApp from '@/mixins/app/Business_LinkApp'
import isEqual from 'lodash/isEqual'
import { ice_i18n } from '@/mixins/base/common-i18n'
import YAML from 'yamljs'

const SYNCTHING_STORE_ID = 74

// meta_data :: build-in app
const builtInApplications = [
	{
		id: '1',
		name: 'App Store',
		title: {
			en_us: 'App Store'
		},
		icon: asset(`@/assets/img/app/appstore.svg`),
		status: 'running',
		app_type: 'system'
	},
	{
		id: '2',
		name: 'Files',
		title: {
			en_us: 'Files'
		},
		icon: asset(`@/assets/img/app/files.svg`),
		status: 'running',
		app_type: 'system'
	}
]

const orderConfig = 'app_order'

const FILTER_KEY = 'atrio:app-filter'

function readFilter () {
	try {
		const value = localStorage.getItem(FILTER_KEY)
		return ['all', 'running', 'stopped'].includes(value) ? value : 'all'
	} catch {
		return 'all'
	}
}

export default {
	mixins: [business_ShowNewAppTag, business_LinkApp],
	data () {
		return {
			// Atrio status filter, remembered in this browser
			filter: readFilter(),
			user_id: localStorage.getItem('user_id'),
			appList: [],
			oldAppList: [],
			appConfig: {},
			drag: false,
			isLoading: false,
			isShowing: false,
			importHelpText: 'Click icon to import.',
			appHelpText: 'Drag icons to sort.',
			draggable: '.handle',
			retryCount: 0,
			appListErrorMessage: '',
			skCount: 0,
			ListRefreshTimer: null,
			listLoading: false,
			// Atrio: installs in progress by app name, from the message bus
			installing: {}
		}
	},
	components: {
		AppCard,
		InstallingAppCard,
		draggable,
		AppSectionTitleTip,
		AppCardSkeleton
	},
	provide () {
		return {
			openAppStore: this.showInstall
		}
	},
	computed: {
		filterOptions () {
			return [
				{ value: 'all', label: this.$t('All') },
				{ value: 'running', label: this.$t('Running apps') },
				{ value: 'stopped', label: this.$t('Stopped apps') },
			]
		},
		dragOptions () {
			return {
				animation: 300,
				// On touch screens a swipe scrolls the page: press and hold an app to move it
				delay: 400,
				delayOnTouchOnly: true,
				touchStartThreshold: 5,
				group: 'description',
				disabled: false,
				ghostClass: 'ghost'
			}
		},
		showDragTip () {
			return this.draggable === '.handle'
		},
		exsitingAppsShow () {
			return this.$store.state.existingAppsSwitch
		},
		// Installs whose app is not in the list yet
		pendingInstalls () {
			return Object.values(this.installing).filter(install => !this.appList.some(item => item.name === install.name))
		}
	},
	created () {
		this.getList()
		this.draggable = '.handle'
		this.$EventBus.$on(events.OPEN_APP_STORE_AND_GOTO_SYNCTHING, this.openSyncthingStore)
		this.$EventBus.$on(events.RELOAD_APP_LIST, this.getList)

		// Polling skips while a request is running or an app is being dragged
		this.ListRefreshTimer = setInterval(() => {
			if (!this.listLoading && !this.drag) this.getList()
		}, 5000)
	},
	beforeDestroy () {
		this.$EventBus.$off(events.OPEN_APP_STORE_AND_GOTO_SYNCTHING, this.openSyncthingStore)
		this.$EventBus.$off(events.RELOAD_APP_LIST, this.getList)
		this.$EventBus.$off('atrio:refresh-apps', this.getList)
		this.$EventBus.$off('atrio:config-app', this.openConfigFromPanel)
		window.removeEventListener('resize', this.getSkCount)

		clearInterval(this.ListRefreshTimer)
	},
	mounted () {
		window.addEventListener('resize', this.getSkCount)
		this.getSkCount()
		// From the app details panel
		this.$EventBus.$on('atrio:refresh-apps', this.getList)
		this.$EventBus.$on('atrio:config-app', this.openConfigFromPanel)
	},
	watch: {
		// Running / total apps for the status chips next to the greeting
		appList: {
			deep: true,
			handler (list) {
				const apps = list.filter(item => item.app_type !== 'system' && item.status)
				this.$EventBus.$emit('atrio:apps-summary', {
					running: apps.filter(item => item.status === 'running').length,
					total: apps.length,
				})
			},
		},
	},
	methods: {
		// Atrio: keeps the card of an app being installed up to date
		trackInstall (properties, progress) {
			const name = properties['app:name']
			if (!name) return
			let title = name
			try {
				title = ice_i18n(JSON.parse(properties['app:title'])) || name
			} catch (e) {
				// Title missing or not JSON: the app name will do
			}
			const install = this.installing[name] || { name, progress: 0, error: '' }
			this.installing[name] = {
				...install,
				title,
				icon: properties['app:icon'] || install.icon,
				// A new install of the same app after a failure starts clean
				error: progress === 0 ? '' : install.error,
				progress: progress === undefined ? install.progress : progress,
			}
		},
		dismissInstall (name) {
			delete this.installing[name]
		},
		openSyncthingStore () {
			this.showInstall(SYNCTHING_STORE_ID)
		},
		openConfigFromPanel (item) {
			this.showConfigPanel(item, true)
		},
		setFilter (value) {
			this.filter = value
			try {
				localStorage.setItem(FILTER_KEY, value)
			} catch {
				// Not remembered when storage is unavailable
			}
		},
		matchesFilter (item) {
			if (this.filter === 'running') return item.status === 'running'
			if (this.filter === 'stopped') return Boolean(item.status) && item.status !== 'running'
			return true
		},
		isMobile () {
			const userAgent = navigator.userAgent
			const mobileRegex =
				/(phone|pad|pod|iPhone|iPod|ios|iPad|Android|Mobile|BlackBerry|IEMobile|MQQBrowser|JUC|Fennec|wOSBrowser|BrowserNG|WebOS|Symbian|Windows Phone)/i
			const isMobile = mobileRegex.exec(userAgent)
			return isMobile !== null
		},

		getSkCount () {
			const windowWidth = window.innerWidth
			if (windowWidth < 1024) {
				this.skCount = 4
			} else if (windowWidth < 1216) {
				this.skCount = 6
			} else if (windowWidth < 1408) {
				this.skCount = 8
			} else {
				this.skCount = 10
			}
		},

		/**
		 * @description: Fetch the list of installed apps
		 * @return {*} void
		 */
		async getList () {
			this.listLoading = true
			try {
				const orgAppList = await this.$openAPI.appGrid.getAppGrid().then(res => res.data.data || [])
				let orgOldAppList = [],
					orgNewAppList = []
				orgAppList.forEach(item => {
					item.hostname = item.hostname || this.$baseIp
					// Container app does not have icon.
					item.icon = item.icon || asset(`@/assets/img/app/default.svg`)
					if (item.app_type === 'v1app' || item.app_type === 'container') {
						orgOldAppList.push(item)
					} else {
						orgNewAppList.push(item)
					}
				})
				this.oldAppList = orgOldAppList

				let listLinkApp = await this.getLinkAppList()
				listLinkApp.forEach(item => {
					// linkApp does not have title.
					item.title = {
						en_us: item.name
					}
				})
				// all app list
				let casaAppList = concat(builtInApplications, orgNewAppList, listLinkApp)
				// get app sort info.
				let lateSortList = await this.$api.users
					.getCustomStorage(orderConfig)
					.then(res => res.data.data.data || [])

				// filter anything not in casaAppList.
				const propList = casaAppList.map(obj => obj.name)
				const existingList = lateSortList.filter(item => propList.includes(item))
				const futureList = propList.filter(item => !lateSortList.includes(item))
				const newSortList = existingList.concat(futureList)

				// then sort.
				const sortedAppList = casaAppList.sort((obj1, obj2) => {
					return newSortList.indexOf(obj1.name) - newSortList.indexOf(obj2.name)
				})

				const sortedList = sortedAppList.map(obj => obj.name)
				this.appList = sortedAppList
				if (!isEqual(lateSortList, sortedList)) {
					this.saveSortData()
				}

				this.isLoading = false
				this.retryCount = 0
				this.appListErrorMessage = ''
			} catch (error) {
				console.error(error)
				// Keep showing the last list while it refreshes; skeletons only before the first load
				this.isLoading = this.appList.length === 0
				if (this.retryCount < 5) {
					setTimeout(() => {
						this.retryCount++
						this.getList()
					}, 2000)
				} else if (!this.appListErrorMessage) {
					// Once, not on every polling tick while the backend is down
					this.appListErrorMessage = 'Failed to get app list.'
					this.$buefy.toast.open({
						message: this.$t(`Failed to load apps, please refresh later.`),
						type: 'is-danger'
					})
				}
			} finally {
				this.listLoading = false
			}
		},

		/**
		 * @description:
		 * @param {Array} oriList
		 * @param {Array} newList
		 * @return {*}
		 */
		getNewSortList (oriList, newList) {
			let xorList = xor(oriList, newList)
			// xorList.reverse()
			return concat(oriList, xorList)
		},

		/**
		 * @description: Save Sort Table
		 * @param {*}
		 * @return {*}
		 */
		saveSortData () {
			let newList = this.appList.map(item => {
				// compose milestone :: name is unique, global index.
				return item.name
			})
			let data = {
				data: newList
			}
			this.$api.users.setCustomStorage(orderConfig, data)
		},
		/**
		 * @description: Handle on Sort End
		 * @param {*}
		 * @return {*}
		 */
		onSortEnd () {
			this.drag = false
			this.saveSortData()
		},

		/**
		 * @description: Show Install Panel Programmatic
		 * @return {*} void
		 */
		async showInstall (storeId = 0, mode = '') {
			if (mode === 'custom') {
				this.$messageBus('apps_custominstall')
			}
			this.isShowing = true

			const networks = await this.$api.container.getNetworks()
			const memory = this.$store.state.hardwareInfo.mem
			const configData = {
				networks: networks.data.data,
				memory: memory
			}
			this.isShowing = false
			this.$buefy.modal.open({
				component: AppPanel,
				hasModalCard: true,
				customClass: 'app-panel',
				trapFocus: true,
				canCancel: ['escape'],
				scroll: 'keep',
				animation: 'zoom-in',
				events: {
					updateState: () => {
						this.getList()
					}
				},
				props: {
					id: '0',
					state: 'install',
					configData: configData,
					storeId: storeId,
					settingData: mode !== 'custom' ? undefined : {}
				}
			})
		},

		/**
		 * @description: Show Settings Panel Programmatic
		 * @param {Object} {id:String,status:String }
		 * @param {Boolean} isCasa
		 * @return {*}
		 */
		async showConfigPanel (item, isCasa) {
			let name = item.name
			this.$messageBus('appsexsiting_open', name)
			try {
				if (item?.app_type === 'LinkApp') {
					await this.showExternalLinkPanel(item)
					return
				}
				const networks = await this.$api.container.getNetworks()
				const memory = this.$store.state.hardwareInfo.mem
				const configData = {
					networks: networks.data.data,
					memory: memory
				}
				const ret = await this.$openAPI.appManagement.compose.myComposeApp(name, {
					headers: {
						'content-type': 'application/yaml',
						accept: 'application/yaml'
					}
				})
				this.$buefy.modal.open({
					component: AppPanel,
					hasModalCard: true,
					customClass: '',
					trapFocus: true,
					canCancel: [''],
					scroll: 'keep',
					animation: 'zoom-in',
					events: {
						updateState: () => {
							this.getList()
						}
					},
					props: {
						id: name,
						state: 'update',
						isCasa: isCasa,
						// 区分 terminal
						runningStatus: item.status,
						configData: configData,
						// settingData: ret.data,
						settingComposeData: ret.data
					}
				})
			} catch (e) {
				console.error(e)
			}
		},

		async showContainerPanel (item) {
			this.$messageBus('appsexsiting_open', item.name)
			let id = item.name
			const networks = await this.$api.container.getNetworks()
			const memory = this.$store.state.hardwareInfo.mem
			const configData = {
				networks: networks.data.data,
				memory: memory
			}
			const ret = await this.$api.container.getInfo(id)
			this.$buefy.modal.open({
				component: AppPanel,
				hasModalCard: true,
				customClass: '',
				trapFocus: true,
				canCancel: [''],
				scroll: 'keep',
				animation: 'zoom-in',
				events: {
					updateState: () => {
						this.getList()
					}
				},
				props: {
					id: id,
					state: 'update',
					isCasa: false,
					runningStatus: item.status,
					configData: configData,
					settingData: ret.data.data
				}
			})
		},

		async showExternalLinkPanel (item = {}) {
			this.$buefy.modal.open({
				component: ExternalLinkPanel,
				hasModalCard: true,
				customClass: '',
				trapFocus: true,
				canCancel: [''],
				scroll: 'keep',
				animation: 'zoom-in',
				events: {
					updateState: () => {
						this.$messageBus('apps_external')
						this.getList().then(() => {
							this.scrollToNewApp()
						})
					}
				},
				props: {
					linkName: item.name,
					linkHost: item.hostname,
					linkIcon: item.icon
				}
			})
		},

		scrollToNewApp () {
			// business :: scroll to last position
			let name = last(this.newAppIds)
			let showEl = document.getElementById('app-' + name)
			showEl?.scrollIntoView({ behavior: 'smooth', block: 'end' })
		},

		messageBusToast (message, type) {
			let duration = 5000
			this.$buefy.toast.open({
				message: message,
				duration,
				type
			})
		}
	},
	sockets: {
		'app:install-begin' (res) {
			this.trackInstall(res.Properties, 0)
		},
		'app:install-progress' (res) {
			const progress = Number(res.Properties['app:progress'])
			this.trackInstall(res.Properties, Number.isFinite(progress) ? Math.max(0, Math.min(100, Math.round(progress))) : undefined)
		},
		'app:install-end' (res) {
			this.getList().then(() => {
				delete this.installing[res.Properties['app:name']]
				this.scrollToNewApp()
			})
		},
		'app:install-error' (res) {
			const name = res.Properties['app:name']
			if (this.installing[name]) this.installing[name].error = res.Properties.message || this.$t('Install failed')
			this.getList().then(() => {
				this.scrollToNewApp()
			})
		},
		'app:uninstall-end' () {
			this.getList()
		},
		'app:apply-changes-error' (res) {
			// toast info
			this.messageBusToast(res.Properties.message, 'is-danger')
		},
		'app:apply-changes-end' (res) {
			let languages = JSON.parse(res.Properties['app:title'])
			const title = ice_i18n(languages)
			// toast info
			this.messageBusToast(title + ' is OK', 'is-success')

			// business :: Tagging of new app / scrollIntoView
			this.addIdToSessionStorage(res.Properties['app:name'])

			this.getList().then(() => {
				this.scrollToNewApp()
			})
		},
		/**
		 * @description: Update App Version
		 * @param {Object} data
		 * @return {void}
		 */
		'app:update-end' (data) {
			if (data.Properties['docker:image:updated'] === 'true') {
				// business :: Tagging of new app / scrollIntoView
				this.addIdToSessionStorage(data.Properties['app:name'])

				this.$buefy.toast.open({
					message: this.$t(`{name} has been updated to the latest version!`, {
						name: data.Properties.name
					}),
					type: 'is-success'
				})
				this.getList().then(() => {
					this.scrollToNewApp()
				})
			}
		},
		'app:update-error' (data) {
			if (data.Properties.cid === this.item.id) {
				this.isUpdating = false
				this.$buefy.toast.open({
					message: this.$t(data.Properties['error']),
					type: 'is-danger'
				})
			}
		}
	}
}
</script>

<style lang="scss" scoped>
.app-list {
	position: relative;
	display: grid;
	gap: 1rem;

	@include touch {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	@include desktop {
		grid-template-columns: repeat(4, minmax(0, 1fr));
	}

	@include fullhd {
		grid-template-columns: repeat(5, minmax(0, 1fr));
	}
}
</style>
