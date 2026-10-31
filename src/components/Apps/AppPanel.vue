<script>
import { defineAsyncComponent } from 'vue'
import AppSideBar from './AppSideBar.vue'
import ImportPanel from '../forms/ImportPanel.vue'
import LottieAnimation from 'lottie-web-vue'
import '@/plugins/vee-validate'
import uniq from 'lodash/uniq'
import isNull from 'lodash/isNull'
import orderBy from 'lodash/orderBy'
import debounce from 'lodash/debounce'
import FileSaver from 'file-saver'
import { ValidationObserver, ValidationProvider } from '@/plugins/validation'
import { parse } from 'yaml'
import { vOnClickOutside } from '@vueuse/components'
import AppTerminalPanel from './AppTerminalPanel.vue'
import AppStoreSourceManagement from '@/components/Apps/AppStoreSourceManagement.vue'
import StoreAppCard from '@/components/Apps/StoreAppCard.vue'
import { ice_i18n } from '@/mixins/base/common-i18n'
import AppDetailInfo from '@/components/Apps/AppDetailInfo.vue'
import ComposeConfig from '@/components/Apps/ComposeConfig.vue'
import business_OpenThirdApp from '@/mixins/app/Business_OpenThirdApp'
import business_ShowNewAppTag from '@/mixins/app/Business_ShowNewAppTag'
import AppsInstallationLocation from '@/components/Apps/AppsInstallationLocation'

const data = [
  'AUDIT_CONTROL',
  'AUDIT_READ',
  'BLOCK_SUSPEND',
  'BPF',
  'CHECKPOINT_RESTORE',
  'DAC_READ_SEARCH',
  'IPC_LOCK',
  'IPC_OWNER',
  'LEASE',
  'LINUX_IMMUTABLE',
  'MAC_ADMIN',
  'MAC_OVERRIDE',
  'NET_ADMIN',
  'NET_BROADCAST',
  'PERFMON',
  'SYS_ADMIN',
  'SYS_BOOT',
  'SYS_MODULE',
  'SYS_NICE',
  'SYS_PACCT',
  'SYS_PTRACE',
  'SYS_RAWIO',
  'SYS_RESOURCE',
  'SYS_TIME',
  'SYS_TTY_CONFIG',
  'SYSLOG',
  'WAKE_ALARM',
]

export default {
  components: {
    AppStoreSourceManagement,
    StoreAppCard,
    AppDetailInfo,
    AppSideBar,
    LottieAnimation,
    AppsInstallationLocation,
    ComposeConfig,
    ValidationObserver,
    ValidationProvider,
  },
  directives: {
    OnClickOutside: vOnClickOutside,
  },
  mixins: [business_ShowNewAppTag, business_OpenThirdApp],
  props: {
    id: String,
    state: String,
    storeId: {
      type: Number,
      default: 0,
    },
    isCasa: {
      type: Boolean,
      default: true,
    },
    runningStatus: String,
    configData: Object,
    // for import app. this.isCasa is false
    settingData: {
      type: Object,
    },
    // for compose app.
    settingComposeData: {
      type: String,
    },
  },

  data() {
    return {
      timer: 0,
      data: [],
      isLoading: true,
      isFetching: false,
      isLoadError: false,
      loadErrorStep: 0,
      isFirst: true,
      errorType: 1,
      currentInstallAppName: null,
      currentInstallAppError: false,
      currentInstallAppType: null,
      currentInstallAppText: '',
      currentInstallAppProgress: {},
      currentInstallAppProgressTotals: {},

      sidebarOpen: false,
      cancelButtonText: 'Cancel',
      totalMemory: 0,
      networks: [],
      tempNetworks: [],
      networkModes: [],
      // about @compose
      // Assign value to compose_config component
      dockerComposeConfig: '',
      capArray: data,
      errInfo: {},
      dockerComposeCommands: '',
      dockerComposeServiceName: '',

      pageIndex: 1,
      pageSize: 5,
      listTotal: 0,
      pageList: {},
      recommendList: [],
      currentSlide: 0,
      currentInstallId: '',

      searchKey: '',
      // What the search field shows; searchKey follows it after a short pause
      searchInput: '',
      currentCate: {},
      // currentAuthor: {},
      currentAuthor: { count: 0, font: 'author', id: 0, name: 'All' },
      currentSort: {},
      cateMenu: [],
      authorMenu: [
        { count: 0, font: 'author', id: 0, name: 'All' },
        { count: 0, font: 'author', id: 1, name: 'official' },
        { count: 0, font: 'author', id: 2, name: 'by_casaos' },
        { count: 0, font: 'author', id: 3, name: 'community' },
      ],
      sortMenu: [
        { icon: '', slash: 'rank', name: 'Popular' },
        { icon: '', slash: 'new', name: 'New' },
        { icon: '', slash: 'name', name: 'Name' },
      ],
      storeQueryData: {
        index: 1,
        category: 'All',
        authorType: 'All',
        type: 'rank',
        key: this.searchKey,
        pageSize: 5,
      },
      //  App Detail info
      appDetailData: {
        title: { en_us: '' },
        tagline: { en_us: '' },
        description: { en_us: '' },
      },
      arch: '',
      // unusable: false, // computer unusable
      architectures: [],

      // APPs Installation Location - requirement document
      storageData: [
        {
          name: 12,
          isSystem: true,
          fsType: 'fsType',
          diskName: 'diakname',
          availSize: '1024',
          disk_type: 'type',
          path: 'path',
          mount_point: 'mount_point',
          usePercent: 20,
          model: 'model',
          size: 123,
          health: true,
          temperature: 100,
        },
      ],
      storage_item_scence: 'select installation location',
      isFirstInstall: false,
      installationLocation: '',
      totalPercentage: 0,
      installedList: [],
      counterPatchGetStoreList: 0,
      searchAndSourcesStatus: '',
      activeAppStoreSourceInput: false,
    }
  },

  computed: {
    showImportButton() {
      return this.currentSlide == 1 && this.state == 'install'
    },
    showExportButton() {
      return this.currentSlide == 1 && this.state == 'update'
    },
    showTerminalButton() {
      return this.currentSlide == 1 && this.state == 'update' && this.runningStatus == 'running'
    },
    panelTitle() {
      if (this.currentSlide == 0) {
        return this.$t('App Store')
      }
      else if (this.currentSlide == 1) {
        if (!this.isCasa) {
          return `${this.$t('Import')} ${this.currentInstallId}`
        }
        if (this.state === 'install') {
          return this.$t('Install a custom app')
        }
        else {
          return this.settingData != undefined || this.settingComposeData != undefined
            ? this.$t('{name} settings', { name: this.currentInstallId })
            : this.$t('Install a new App manually')
        }
      }
      else {
        return `${this.$t('Installing')} ${this.currentInstallId}`
      }
    },
    showDetailSwiper() {
      return this.appDetailData.screenshot_link?.length > 0
    },
    currentInstallAppTextClass() {
      return this.currentInstallAppError ? 'has-text-danger' : 'has-text-black'
    },
    unuseable() {
      if (this.architectures.length === 0 || !this.arch) {
        return false
      }
      return !this.architectures.includes(this.arch)
    },
    archTitle() {
      if (this.arch === 'arm') {
        return 'armv7'
      }
      return this.arch
    },
    // Every word typed must appear in the name, tagline or category
    filteredPageList() {
      if (!Array.isArray(this.pageList))
        return []
      const terms = this.searchKey.toLocaleLowerCase().split(/\s+/).filter(Boolean)
      if (!terms.length)
        return this.pageList
      return this.pageList.filter((app) => {
        const text = `${app.title} ${app.tagline} ${app.category}`.toLocaleLowerCase()
        return terms.every(term => text.includes(term))
      })
    },
    showFeatured() {
      return this.recommendList.length > 0 && !this.searchKey && this.currentCate?.name === 'All' && this.currentAuthor.id === 0
    },
    listTitle() {
      if (this.searchKey)
        return this.$t('Results')
      return this.currentCate?.name && this.currentCate.name !== 'All' ? this.currentCate.name : this.$t('All apps')
    },
    isMobile() {
      return this.$store.state.isMobile
    },
  },
  watch: {
    // Watch if Section index changes
    /*
		 *  === 0 App Store Panel.
		 *  === 1 Setting Panel.	(Importing、Update Setting)
		 *  === 2 Other Panel. (Installing)
		 * */
    currentSlide(val) {
      if (val == 1) {
        this.isLoading = false
      }
    },
    currentCate: {
      handler(val) {
        if (!this.isFirst) {
          this.counterPatchGetStoreList++
        }
      },
      deep: true,
    },
    currentAuthor: {
      handler(val) {
        if (!this.isFirst) {
          this.counterPatchGetStoreList++
        }
      },
      deep: true,
    },
    // Watch if app sort changes
    currentSort: {
      handler(val) {
        if (!this.isFirst) {
          this.counterPatchGetStoreList++
        }
      },
      deep: true,
    },
    counterPatchGetStoreList() {
      this.getStoreList()
      return 0
    },
  },

  created() {
    window.addEventListener('resize', this.setCSSVHVar)
    this.setCSSVHVar()

    // Get recommend
    this.getStoreRecommend()

    // Get Max memory info form device
    this.totalMemory = Math.floor(this.configData.memory.total / 1048576)

    // Handling network types
    this.tempNetworks = this.configData.networks
    this.networkModes = uniq(
      this.tempNetworks.map((item) => {
        return item.driver
      }),
    )
    this.networks = this.networkModes.map((item) => {
      const tempitem = {}
      tempitem.driver = item
      tempitem.networks = this.tempNetworks.filter((net) => {
        return net.driver == item
      })
      return tempitem
    })
    this.networks = orderBy(this.networks, ['driver'], ['asc'])
    // If it is edit, Init data
    if (this.settingData != undefined || this.settingComposeData != undefined) {
      this.isLoading = false
      this.dockerComposeConfig = this.settingComposeData
      this.currentSlide = 1
    }
    else {
      this.getCategoryList()
    }

    // If StoreId is not 0
    if (this.storeId != 0) {
      this.showAppDetial(this.storeId)
    }

    // 这是 选择应用安装位置。 这块功能不被使用，暂且保留。
    // close the function - APPs Installation Location
    // prepare data - APPs Installation Location requirement document
    // this.getDiskList();
    // close the function - APPs Installation Location
    // this.askInstallationLocation();

    // get architecture
    this.arch = localStorage.getItem('arch')
    if (!this.arch) {
      this.$api.sys.hardwareInfo().then((res) => {
        if (res.data.success == 200) {
          localStorage.setItem('arch', res.data.data.arch || '')
          this.arch = res.data.data.arch || ''
        }
      })
    }
  },

  mounted() {
    this.currentSlide === 0
    && !this.isMobile
    && this.$nextTick().then(() => {
      this.$refs.search_app?.focus()
    })
    this.searchAndSourcesStatusController()
  },
  methods: {
    resetSearchAndSourcesStatus() {
      switch (this.isMobile) {
        case true:
          this.searchAndSourcesStatus = 'showSources'
          break
        case false:
          this.searchAndSourcesStatus = 'showAll'
          break
      }
    },
    searchAndSourcesStatusController() {
      // Status for three. One of them is "showSearch", "showSources", "showAll"
      if (this.isMobile && this.searchAndSourcesStatus === 'showSources') {
        this.searchAndSourcesStatus = 'showSearch'
      }
      else if (this.isMobile) {
        this.searchAndSourcesStatus = 'showSources'
      }
      else {
        this.searchAndSourcesStatus = 'showAll'
      }
    },

    refreshAppStoreSourceManagementSizeStatus(status) {
      if (status === 'active_input_state') {
        this.activeAppStoreSourceInput = true
      }
      else {
        this.activeAppStoreSourceInput = false
      }
    },

    setCSSVHVar() {
      const vh = window.innerHeight * 0.01
      document.documentElement.style.setProperty('--vh', `${vh}px`)
    },

    // this.cateMenu : {name: 'appstore', title: 'App Store', icon: 'mdi-apps', component: 'AppStore'}
    // param : this.cateMenu.name
    getCateIcon(name) {
      const tempO = this.cateMenu.find(item => item.name == name) || { font: 'mdi-apps' }
      return tempO.font
    },

    /**
     * @description: Get category list
     * @param {*}
     * @return {*} void
     */
    async getCategoryList() {
      this.isLoading = true
      try {
        this.cateMenu = await this.$openAPI.appManagement.appStore.categoryList().then(res =>
          res.data.data.filter((item) => {
            return item.count > 0
          }),
        )
        this.currentCate = this.cateMenu[0]
        this.currentSort = this.sortMenu[0]
        if (this.isFirst) {
          this.isFirst = false
        }
      }
      catch (error) {
        this.loadErrorStep = 1
        this.isLoading = false
        this.isLoadError = true
      }
    },

    async getStoreRecommend() {
      try {
        const res = await this.$openAPI.appManagement.appStore
          .composeAppStoreInfoList(undefined, undefined, true)
          .then(res => res.data.data.list)

        this.recommendList = Object.keys(res).map((id) => {
          const main_app_info = res[id]
          return {
            id,
            category: main_app_info.category,
            icon: main_app_info.icon,
            tagline: ice_i18n(main_app_info.tagline),
            thumbnail: main_app_info.thumbnail || main_app_info.screenshot_link?.[0],
            title: ice_i18n(main_app_info.title),
            state: 0,
            architectures: main_app_info.architectures,
            // scheme: main_app_info.apps[id].scheme,
            // port: main_app_info.apps[id].port_map,
            // index: main_app_info.apps[id].index,
          }
        })
      }
      catch (error) {
        console.log('load recommend error', error)
      }
    },

    /**
     * @description: Get App store list
     * @param {*}
     * @return {*} void
     */
    async getStoreList() {
      this.isLoading = true
      // Quick clicks on the category chips: only the answer to the latest request is shown
      const request = this.storeListRequest = (this.storeListRequest || 0) + 1

      try {
        const category = this.currentCate.name
        const authorType = this.currentAuthor.name
        let res
        if (authorType !== 'All' && category !== 'All') {
          res = await this.$openAPI.appManagement.appStore
            .composeAppStoreInfoList(category, authorType)
            .then(res => res.data.data)
        }
        else if (authorType !== 'All') {
          res = await this.$openAPI.appManagement.appStore
            .composeAppStoreInfoList(undefined, authorType)
            .then(res => res.data.data)
        }
        else if (category !== 'All') {
          res = await this.$openAPI.appManagement.appStore
            .composeAppStoreInfoList(category, undefined, false)
            .then(res => res.data.data)
        }
        else {
          res = await this.$openAPI.appManagement.appStore
            .composeAppStoreInfoList()
            .then(res => res.data.data)
        }

        const list = res.list
        const listRes = Object.keys(list).map((id) => {
          const main_app_info = list[id]
          return {
            id,
            category: main_app_info.category,
            icon: main_app_info.icon,
            tagline: ice_i18n(main_app_info.tagline),
            thumbnail: main_app_info.thumbnail || main_app_info.screenshot_link?.[0],
            title: ice_i18n(main_app_info.title),
            state: 0,
            architectures: main_app_info.architectures,
            // scheme: main_app_info.apps[id].scheme,
            // port: main_app_info.apps[id].port_map,
            // index: main_app_info.apps[id].index,
          }
        })
        if (request !== this.storeListRequest)
          return
        this.pageList = listRes
        this.installedList = res.installed
      }
      catch (e) {
        console.log('load store list error', e)
      }
      if (request === this.storeListRequest)
        this.isLoading = false
    },

    /**
     * @description: Show the details of app
     * @param {id} String
     * @return {*} void
     */
    async showAppDetial(id) {
      this.isLoading = true
      let { min_memory, compose } = await this.$openAPI.appManagement.appStore.composeApp(id).then((res) => {
        // A district that is reserved for resource.
        return {
          min_memory: res.data.data.compose.services[id]?.deploy?.resources?.reservations?.memory || '0',
          compose: res.data.data.compose,
        }
      })

      if (min_memory.includes('GB')) {
        min_memory = min_memory.replace('GB', '') * 1024
      }
      else if (min_memory.includes('MB')) {
        min_memory = min_memory.replace('MB', '')
      }
      else {
        min_memory = min_memory / 1024 / 1024
      }
      this.$openAPI.appManagement.appStore
        .composeAppStoreInfo(id)
        .then((res) => {
          this.isLoading = false
          this.sidebarOpen = true
          this.appDetailData = res.data.data
          this.appDetailData.id = id
          this.appDetailData.min_memory = min_memory
          this.appDetailData.compose = compose
          this.architectures = res.data.data.architectures || []
        })
        .catch((e) => {
          this.$buefy.toast.open({
            message: e.response.data.message,
            // message: this.$t(`There was an error loading the data, please try again!`),
            type: 'is-danger',
          })
        })
        .finally(() => {
          this.isLoading = false
        })
    },

    retry() {
      if (this.loadErrorStep === 1) {
        this.getCategoryList()
      }
      else if (this.loadErrorStep === 2) {
        this.getStoreList()
      }
    },

    /**
     * @description: Qucik Install App from app store
     * @param {*}
     * @return {*} void
     */
    quickInstall(id) {
      this.sidebarOpen = false
      this.$openAPI.appManagement.appStore
        .composeApp(id, {
          headers: {
            'content-type': 'application/yaml',
            'accept': 'application/yaml',
          },
        })
        .then((res) => {
          if (res.status == 200) {
            const composeJSON = parse(res.data)
            if (composeJSON['x-casaos']?.tips?.before_install?.en_us) {
              this.$buefy.modal.open({
                component: defineAsyncComponent(() => import('@/components/Apps/TipEditorModal.vue')),
                hasModalCard: true,
                customClass: '',
                trapFocus: true,
                canCancel: [''],
                scroll: 'keep',
                animation: 'zoom-in',
                events: {
                  submit: () => {
                    this.currentInstallId = id
                    this.installComposeApp(res.data, id)
                  },
                },
                props: {
                  composeData: composeJSON,
                },
              })
            }
            else {
              this.installComposeApp(res.data, id)
            }
          }
          else {
            this.$buefy.toast.open({
              message: this.$t(`There was an error installing the application, please try again!`),
              type: 'is-warning',
            })
          }
        })
        .catch((e) => {
          this.$buefy.toast.open({
            message: e.response.data.message,
            type: 'is-danger',
          })
        })
    },
    /**
     * @description: Format AppStore tip datas
     * @param {data}
     * @return {html} Str
     */
    formatTips(data) {
      let html = ''
      if (!isNull(data) && data != '') {
        JSON.parse(data).forEach((item) => {
          html += `<span class=' is-size-14px un-break-word'>${item.content}</span>`
          if (item.value != '') {
            html += `<span class='tag is-primary ml-1'>${item.value}</span>`
          }
          html += '<br/>'
        })
      }
      return html
    },

    /**
     * @description: Get App icon form image
     * @param {*} image
     * @return {*}
     */
    getIconFromImage(image) {
      if (image == '') {
        return ''
      }
      else {
        const appIcon = image.split(':')[0].split('/').pop()
        return `https://icon.casaos.io/main/all/${appIcon}.png`
      }
    },
    /**
     * @description: Back to prev Step
     * @param {*}
     * @return {*} void
     */
    prevStep() {
      this.currentSlide--
    },

    /**
     * @description: Validate form async
     * @param {object} ref ref of component
     * @return {boolean}
     */
    async checkStep(ref) {
      const isValid = await ref.validate()
      return isValid
    },

    /**
     * @description: Submit datas after valid
     * @param {*}
     * @return {*} void
     */
    installComposeApp(dockerComposeCommands, appName) {
      return this.$openAPI.appManagement.compose
        .installComposeApp(dockerComposeCommands, false, true)
        .then((res) => {
          if (res.status !== 200) {
            this.dockerComposeConfig = dockerComposeCommands
            this.currentSlide = 1
            this.errInfo = res.data

            this.$buefy.toast.open({
              message: this.$t('The information filled in needs to be corrected'),
              type: 'is-warning',
            })
          }
        })
        .catch((e) => {
          if (e.response.status === 400) {
            this.dockerComposeConfig = dockerComposeCommands
            this.currentSlide = 1
            this.errInfo = e.response.data.data
          }
          this.$buefy.toast.open({
            message: e.response.data || e.response.status,
            type: 'is-danger',
          })
        })
    },

    checkComposeAppAndInstallComposeApp(dockerComposeCommands, appName) {
      this.$refs.ComposeConfig.checkStep().then((valid) => {
        if (valid.every(v => v === true)) {
          this.isLoading = true
          this.installComposeApp(dockerComposeCommands, appName)
            .finally(() => {
              this.isLoading = false
            })
        }
        else {
          // toast info error.
          this.$buefy.toast.open({
            message: this.$t('Please confirm the input content.'),
            duration: 5000,
            type: 'is-danger',
          })
        }
      })
    },

    switchAppConfigContent(composeCommands) {
      this.currentSlide = 1
      this.sidebarOpen = false
      this.dockerComposeConfig = composeCommands
    },

    /**
     * @description: Save edit update
     * @return {*} void
     */
    updateApp() {
      this.$refs.ComposeConfig.checkStep().then((valid) => {
        if (valid.every(v => v === true)) {
          this.$openAPI.appManagement.compose
            .applyComposeAppSettings(this.id, this.dockerComposeCommands, false, true)
            .then((res) => {
              if (res.status == 200) {
                this.$emit('updateState')
              }
              else {
                this.errInfo = res.data

                this.$buefy.toast.open({
                  message: this.$t('The information filled in needs to be corrected'),
                  duration: 10000,
                  type: 'is-warning',
                })
              }
              this.$emit('close')
            })
            .catch((err) => {
              if (err.response.status === 400) {
                console.log('Get ERROR:', err.response?.data)
                this.errInfo = err.response?.data
              }
              this.$buefy.toast.open({
                message: err.response?.data?.message,
                duration: 5000,
                type: 'is-warning',
              })
            })
        }
        else {
          // toast info error.
          this.$buefy.toast.open({
            message: this.$t('Please confirm the input content.'),
            duration: 5000,
            type: 'is-danger',
          })
        }
      })
    },

    updateContainer() {
      this.$refs.containerValida.validate().then((valid) => {
        if (valid) {
          this.isLoading = true
          this.$api.container
            .update(this.id, this.settingData)
            .then((res) => {
              if (res.data.success == 200) {
                this.isLoading = false
                this.$emit('updateState')
              }
              else {
                this.$buefy.toast.open({
                  message: res.data.message.data,
                  type: 'is-warning',
                })
              }
              this.$emit('close')
            })
            .catch((err) => {
              this.isLoading = false
              this.$buefy.toast.open({
                message: err.response?.data?.message,
                type: 'is-warning',
              })
            })
        }
      })
    },

    /**
     * @description: Show import panel
     * @return {*} void
     */
    showImportPanel() {
      this.$buefy.modal.open({
        component: ImportPanel,
        hasModalCard: true,
        customClass: '',
        trapFocus: true,
        canCancel: ['escape'],
        scroll: 'keep',
        animation: 'zoom-in',
        events: {
          update: (e) => {
            this.dockerComposeConfig = e
            this.$buefy.dialog.alert({
              title: `⚠️ ${this.$t('Attention')}`,
              message:
								`<div class="nobrk"><h4 class="title is-5">${
								  this.$t('AutoFill only helps you to complete most of the configuration.')
								}</h4>`
								+ `<p class="mb-3">${
								  this.$t('Some configuration information such as:')
								}</p>`
								+ `<ul>`
								+ `<li>1. ${
								  this.$t('the port and path of the Web UI')
								}</li>`
								+ `<li>2. ${
								  this.$t('the mount location of the volume or file')
								}</li>`
								+ `<li>3. ${
								  this.$t('the port mapping of the Host')
								}</li>`
								+ `<li>4. ${
								  this.$t('optional configuration items')
								}</li>`
								+ `</ul>`
								+ `<p class="mt-3">${
								  this.$t(
								    'These include but are not limited to these cases and <b>still need to be confirmed or modified by you.</b>',
								  )
								}</p>`
								+ `<p class="mt-3">${
								  this.$t('Feel free to suggest improvements to this feature in Discord Server!')
								}</p></div>`,
              type: 'is-dark',
            })
          },
        },
        props: {
          netWorks: this.networks,
          oriNetWorks: this.tempNetworks,
          deviceMemory: this.totalMemory,
        },
      })
    },

    /**
     * @description: Export AppData to json file
     * @param {*} function
     * @return {*} void
     */
    exportYAML() {
      let title = parse(this.dockerComposeCommands)?.['x-casaos']?.title
      if (title) {
        title = ice_i18n(title)
      }
      else {
        title = this.currentInstallId
      }
      const blob = new Blob([this.dockerComposeCommands], { type: '' })
      FileSaver.saveAs(blob, `${title}.yaml`)
    },

    /**
     * @description: change uuid to var
     * @param {*} function
     * @return {data} Object
     */

    uuid2var(data) {
      data.volumes.forEach((item) => {
        item.host = item.host.replace(this.id, '$AppID')
      })
      data.devices.forEach((item) => {
        item.host = item.host.replace(this.id, '$AppID')
      })
      return data
    },

    /**
     * @description: Get Network name from network list
     * @param {*}
     * @return {*} String
     */
    getNetworkName(netId) {
      if (netId == '') {
        return 'bridge'
      }
      else {
        const network = this.tempNetworks.filter((net) => {
          return net.name == netId
        })
        return network[0].name
      }
    },

    /**
     * @description: Show Terminal & Logs panel
     * @return {*} void
     */
    showTerminalPanel() {
      this.$openAPI.appManagement.compose
        .composeAppContainers(this.id)
        .then((res) => {
          if (res.status == 200) {
            const containers = res.data.data.containers
            const containerId = containers[this.dockerComposeServiceName].ID
            this.$buefy.modal.open({
              component: AppTerminalPanel,
              hasModalCard: true,
              customClass: 'terminal-modal',
              trapFocus: true,
              canCancel: [],
              scroll: 'keep',
              animation: 'zoom-in',
              props: {
                appid: containerId,
                appName: this.currentInstallId,
                serviceName: this.dockerComposeServiceName,
              },
            })
          }
        })
        .catch((err) => {
          console.log('$openAPI.appManagement.compose.composeAppContainers', err.response)
        })
    },

    async getDiskList() {
      try {
        const storageRes = await this.$api.storage.list({ system: 'show' })
        const storageArray = []
        storageRes.data.data.forEach((item) => {
          item.children.forEach((part) => {
            part.disk = item.path
            part.diskName = item.disk_name
            storageArray.push(part)
          })
        })
        this.storageData = storageArray.map((storage) => {
          return {
            name: storage.label,
            isSystem: storage.diskName == 'System',
            fsType: storage.type,
            size: storage.size,
            availSize: storage.avail,
            usePercent: 100 - Math.floor((storage.avail * 100) / storage.size),
            diskName: storage.drive_name,
            path: storage.path,
            mount_point: storage.mount_point,
            disk: storage.disk,
          }
        })
      }
      catch (error) {
        console.log(error.response?.data?.message)
      }
    },

    getSelection(val) {
      this.installationLocation = val
    },

    async askInstallationLocation() {
      try {
        // get docker info
        const { data } = await this.$api.container.getInstallationLocation()
        switch (data.success) {
          case 200:
          case 400:
          default:
            this.isFirstInstall = !data.data.docker_root_dir
            break
        }
      }
      catch (err) {
        console.log(`${err} in askInstallationLocation`)
      }
    },

    async submitInstallationLocation(val) {
      this.isLoading = true
      let path = ''
      if (val === '/') {
        path = `${val}var/lib/docker`
      }
      else {
        path = `${val}/docker`
      }
      try {
        await this.$api.folder.create(path)
      }
      catch (e) {
        this.$buefy.toast.open({
          message: this.$t('Error when creating installation path for apps'),
          type: 'is-danger',
        })
        return
      }

      this.$api.container
        .putInstallationLocation(path)
        .then((data) => {
          this.isLoading = false
          this.isFirstInstall = data.data.docker_root_dir
        })
        .catch((err) => {
          this.isLoading = false
          console.log(`${err} in submitInstallationLocation`)
          this.$buefy.toast.open({
            message: err.message,
            type: 'is-danger',
          })
        })
    },

    installAppProgress(resData) {
      if (this.currentInstallAppName !== resData.name) {
        return false
      }

      if (!resData.finished) {
        this.currentInstallAppError = !resData.success
        if (resData.success) {
          this.currentInstallAppType = resData.type

          if (resData.message !== '') {
            const progress = Number(resData.message)
            this.totalPercentage = progress < 0 ? 0 : progress

            if (this.totalPercentage === 0) {
              this.currentInstallAppText = 'Starting installation'
            }
            else if (this.totalPercentage === 100) {
              this.currentInstallAppText = 'Installation completed'
            }
            else {
              this.currentInstallAppText = 'Installing'
            }
          }
        }
        else {
          this.currentInstallAppText = resData.message
        }
      }
      else {
        localStorage.removeItem('app_data')
        this.addIdToSessionStorage(resData.name)

        setTimeout(() => {
          this.$emit('updateState')
          this.$emit('close')
        }, 500)
      }
    },

    updateDockerComposeCommands(val) {
      this.dockerComposeCommands = val
    },

    updateDockerComposeServiceName(val) {
      this.dockerComposeServiceName = val
    },
    debounceSearchInput: debounce(function (e) {
      this.searchKey = e
    }, 250),
    onSearchInput(value) {
      this.searchInput = value
      this.debounceSearchInput(value.trim())
    },
    clearSearch() {
      this.searchInput = ''
      this.searchKey = ''
    },
    // Esc clears the search first; with an empty field it reaches the modal and closes the store
    onSearchEscDown(event) {
      if (!this.searchInput) return
      event.stopPropagation()
      event.preventDefault()
      this.clearSearch()
      this.searchEscHandled = true
    },
    onSearchEscUp(event) {
      if (!this.searchEscHandled) return
      event.stopPropagation()
      this.searchEscHandled = false
    },
    authorLabel(name) {
      return { All: this.$t('All'), official: this.$t('Official'), by_casaos: this.$t('By CasaOS'), community: this.$t('Community') }[name] || name
    },
    scrollFeatured(direction) {
      const row = this.$refs.featured
      row?.scrollBy({ left: direction * row.clientWidth * 0.8, behavior: 'smooth' })
    },
  },

  destroyed() {
    window.removeEventListener('resize', this.setCSSVHVar)
    clearInterval(this.timer)
  },

  sockets: {
    'app:install-begin': function (res) {
      this.currentInstallAppName = res.Properties['app:name']
      this.currentSlide = 2
      this.currentInstallAppText = 'Start Installation...'
      this.cancelButtonText = 'Continue in background'
    },
    'app:install-end': function (res) {
      this.installAppProgress({
        finished: true,
        name: res.Properties['app:name'],
        id: res.Properties['docker:container:id'],
      })
    },
    'app:install-error': function (res) {
      this.installAppProgress({
        finished: false,
        name: res.Properties['app:name'],
        id: res.Properties['docker:container:id'],
        success: false,
        message: res.Properties.message,
      })
    },
    'app:install-progress': function (res) {
      this.installAppProgress({
        finished: false,
        name: res.Properties['app:name'],
        id: res.Properties['docker:container:id'],
        success: true,
        type: 'pull',
        message: res.Properties['app:progress'],
      })
    },
    'docker:image:pull-progress': function (res) {
      this.installAppProgress({
        finished: false,
        name: res.Properties['app:name'],
        id: res.Properties['docker:container:id'],
        success: true,
        type: 'pull',
        message: res.Properties.message,
      })
    },
  },
}
</script>

<template>
  <div
    :class="{ 'narrow': currentSlide > 0, 'card-width': isFirstInstall, '_stepStoreList': currentSlide === 0 }"
    class="modal-card atrio-glass-panel"
  >
    <!--    first setting！！ apps installation location -->
    <template v-if="isFirstInstall">
      <header class="modal-card-head b-line">
        <div class="is-flex-grow-1">
          <h3 class="is-flex-grow-1 title is-3 pri-line-height has-text-black">
            {{ $t('Apps Installation Location') }}
          </h3>
        </div>
        <b-icon
          class="close-button"
          icon="close-outline"
          pack="casa"
          @click.native="
            $emit('close');
            $messageBus('appstore_close');
          "
        />
      </header>
      <p class="modal-card-body">
        {{ $t('Please choose a location with enough storage space and stable connection.') }}
        <span class="has-text-danger">
          {{ $t('(Cannot be changed)') }}
        </span>
      </p>

      <section class="modal-card-body is-overlay">
        <AppsInstallationLocation
          v-for="(item, index) in storageData"
          :key="`storage${index}`"
          :item="item"
          :scence="storage_item_scence"
          @selection="getSelection"
        />
      </section>
    </template>
    <!--    first setting have done!! -->
    <template v-else>
      <!-- Sidebar Start -->
      <AppSideBar v-model="sidebarOpen" :overlay="true" :right="true" position="absolute">
        <template #default="{ close }">
          <AppDetailInfo
            :app-detail-data="appDetailData"
            :arch="arch"
            :cate-menu="cateMenu"
            :close="close"
            :current-install-id="currentInstallId"
            :installed-list="installedList"
            :show-detail-swiper="showDetailSwiper"
            @install="quickInstall"
            @switchAppConfigContent="switchAppConfigContent"
          />
        </template>
      </AppSideBar>
      <!-- Sidebar End -->

      <!-- Modal-Card Header Start -->
      <header :class="{ 'setting-compose-panel': currentSlide == 1 && isCasa }" class="modal-card-head _b-line">
        <div class="is-flex-grow-1">
          <h3 class="setting_title is-5">
            {{ panelTitle }}
          </h3>
        </div>
        <div class="is-flex is-align-items-center">
          <b-button
            v-if="currentSlide == 0"
            :label="$t('Custom Install')"
            class="mr-2"
            icon-left="view-grid-plus"
            rounded
            size="is-small"
            type="is-primary"
            @click="currentSlide = 1"
          />

          <b-tooltip v-if="showImportButton" :label="$t('Import')" position="is-bottom" type="is-dark">
            <button class="icon-button mdi mdi-import" type="button" @click="showImportPanel" />
          </b-tooltip>

          <b-tooltip
            v-if="showTerminalButton"
            :label="$t('Terminal & Logs')"
            position="is-bottom"
            type="is-dark"
          >
            <button class="icon-button mdi mdi-console" type="button" @click="showTerminalPanel" />
          </b-tooltip>

          <b-tooltip
            v-if="showExportButton"
            :label="$t('Export ComposeFile')"
            position="is-bottom"
            type="is-dark"
          >
            <button class="icon-button mdi mdi-export-variant" type="button" @click="exportYAML" />
          </b-tooltip>
          <div
            v-if="currentSlide < 2"
            class="is-flex is-align-items-center modal-close-container modal-close-container-line"
          >
            <b-icon class="close-button" icon="close-outline" pack="casa" @click.native="$emit('close')" />
          </div>
          <div v-else-if="currentSlide === 2" class="is-flex is-align-items-center">
            <b-icon class="close-button" icon="close-outline" pack="casa" @click.native="$emit('close')" />
          </div>
        </div>
      </header>
      <!-- Modal-Card Header End -->
      <!-- Modal-Card Body Start -->
      <!-- App Store List Start -->
      <section v-if="currentSlide == 0" class="modal-card-body atrio-store">
        <template v-if="!isLoadError">
          <!-- Search first: it is the quickest way to an app among hundreds -->
          <div class="atrio-store-toolbar">
            <label class="atrio-store-search">
              <b-icon icon="search-outline" pack="casa" size="is-20" />
              <input
                ref="search_app"
                :aria-label="$t('Search an app...')"
                :placeholder="pageList.length ? $t('Search {count} apps…', { count: pageList.length }) : $t('Search an app...')"
                :value="searchInput"
                type="search"
                @input="onSearchInput($event.target.value)"
                @keydown.esc="onSearchEscDown"
                @keyup.esc="onSearchEscUp"
              >
              <button v-if="searchInput" :aria-label="$t('Clear')" class="atrio-store-clear" type="button" @click="clearSearch">
                <b-icon icon="close-outline" pack="casa" size="is-16" />
              </button>
            </label>
            <AppStoreSourceManagement
              :total-apps="pageList.length"
              class="atrio-store-sources"
              @refreshAppStore="getStoreList"
              @refreshSize="refreshAppStoreSourceManagementSizeStatus"
            />
          </div>

          <div class="atrio-store-filters">
            <div :aria-label="$t('Categories')" class="atrio-store-chips" role="group">
              <button
                v-for="menu in cateMenu"
                :key="menu.id"
                :aria-pressed="menu.id === currentCate.id"
                :class="{ 'is-active': menu.id === currentCate.id }"
                class="atrio-store-chip"
                type="button"
                @click="currentCate = menu; $messageBus('appstore_type', menu.name)"
              >
                {{ menu.name === 'All' ? $t('All') : menu.name }}<span class="atrio-store-count">{{ menu.count }}</span>
              </button>
            </div>
            <div :aria-label="$t('Author')" class="atrio-store-authors" role="group">
              <button
                v-for="menu in authorMenu"
                :key="menu.id"
                :aria-pressed="menu.id === currentAuthor.id"
                :class="{ 'is-active': menu.id === currentAuthor.id }"
                type="button"
                @click="currentAuthor = menu; $messageBus('appstore_author', menu.name)"
              >
                {{ authorLabel(menu.name) }}
              </button>
            </div>
          </div>

          <!-- Featured Start -->
          <section v-if="showFeatured" class="atrio-store-section">
            <div class="atrio-store-section-head">
              <h3>{{ $t('Featured Apps') }}</h3>
              <div class="atrio-store-arrows">
                <button :aria-label="$t('Previous')" type="button" @click="scrollFeatured(-1)">
                  <b-icon icon="left-outline" pack="casa" size="is-16" />
                </button>
                <button :aria-label="$t('Next')" type="button" @click="scrollFeatured(1)">
                  <b-icon icon="right-outline" pack="casa" size="is-16" />
                </button>
              </div>
            </div>
            <div ref="featured" class="atrio-store-featured">
              <StoreAppCard
                v-for="item in recommendList"
                :key="`featured-${item.id}`"
                :arch="arch"
                :installed="installedList.includes(item.id)"
                :installing="item.id == currentInstallId"
                :item="item"
                featured
                @details="showAppDetial(item.id); $messageBus('appstore_detail', item.title)"
                @install="quickInstall(item.id); $messageBus('appstore_install', item.title)"
                @open="openThirdContainerByAppInfo(item)"
              />
            </div>
          </section>
          <!-- Featured End -->

          <!-- App list Start -->
          <section class="atrio-store-section">
            <div class="atrio-store-section-head">
              <h3>{{ listTitle }}</h3>
              <span class="atrio-store-total">{{ filteredPageList.length }}</span>
            </div>
            <div v-if="filteredPageList.length" class="atrio-store-grid">
              <StoreAppCard
                v-for="item in filteredPageList"
                :key="item.id"
                :arch="arch"
                :installed="installedList.includes(item.id)"
                :installing="item.id == currentInstallId"
                :item="item"
                @details="showAppDetial(item.id); $messageBus('appstore_detail', item.title)"
                @install="quickInstall(item.id); $messageBus('appstore_install', item.title)"
                @open="openThirdContainerByAppInfo(item)"
              />
            </div>
            <div v-else-if="!isLoading" class="atrio-store-empty">
              <p v-if="searchKey">{{ $t('No apps match "{search}".', { search: searchKey }) }}</p>
              <p v-else>{{ $t('No apps in this category.') }}</p>
              <button class="atrio-store-action" type="button" @click="currentSlide = 1">
                {{ $t('Install a custom app') }}
              </button>
            </div>
          </section>
          <!-- App list End -->
        </template>
        <div v-else class="atrio-store-empty is-error">
          <p>{{ $t('There was an error loading the data, please try again!') }}</p>
          <button class="atrio-store-action is-primary" type="button" @click="retry()">
            {{ $t('Retry') }}
          </button>
        </div>
      </section>
      <!-- App Store List End -->

      <!-- App Install Form Start -->
      <template v-if="currentSlide == 1">
        <ComposeConfig
          v-if="isCasa"
          ref="ComposeConfig"
          :cap-array="capArray"
          :docker-compose-commands="dockerComposeConfig"
          :err-info="errInfo"
          :networks="networks"
          :state="state"
          :total-memory="totalMemory"
          @updateDockerComposeCommands="updateDockerComposeCommands"
          @updateDockerComposeServiceName="updateDockerComposeServiceName"
          @updateMainName="name => (currentInstallId = name)"
        />

        <section v-else :class="{ _hideOverflow: !isCasa }" class="modal-card-body pt-3">
          <!--	导入"已存在的容器"，进行初始化操作	-->
          <ValidationObserver ref="containerValida">
            <ValidationProvider v-slot="{ errors, valid }" name="appName" rules="required">
              <b-field
                :label="`${$t('App name')} *`"
                :message="(errors[0] ? $t(errors[0]) : '')"
                :type="{ 'is-danger': errors[0], 'is-success': valid }"
              >
                <b-input
                  v-model="settingData.label"
                  :placeholder="$t('Your custom App Name')"
                  maxlength="40"
                />
              </b-field>
            </ValidationProvider>

            <b-field :label="$t('Icon URL')">
              <p class="control">
                <span class="button is-static container-icon">
                  <b-image
                    :key="settingData.icon"
                    :src="settingData.icon"
                    :src-fallback="$asset('@/assets/img/app/default.svg')"
                    class="is-32x32"
                    ratio="1by1"
                  />
                </span>
              </p>
              <b-input
                v-model="settingData.icon"
                :placeholder="$t('Your custom icon URL')"
                expanded
              />
            </b-field>

            <b-field label="Web UI">
              <b-select v-model="settingData.protocol">
                <option value="http">
                  http://
                </option>
                <option value="https">
                  https://
                </option>
              </b-select>
              <b-input v-model="settingData.host" :placeholder="$baseHostname" expanded />
              <b-autocomplete
                v-model="settingData.port_map"
                :data="
                  (() => {
                    return (settingData.ports || []).map(item => {
                      return item.host
                    })
                  })()
                "
                :open-on-focus="true"
                :placeholder="$t('Port')"
                class="has-colon"
                field="hostname"
                @select="option => (settingData.port_map = option)"
              />
              <b-input
                v-model="settingData.index"
                :placeholder="`/index.html ${$t('[Optional]')}`"
                expanded
              />
            </b-field>
          </ValidationObserver>
        </section>
      </template>
      <!-- App Install Form End -->

      <!-- App Install Process Start -->
      <section v-if="currentSlide == 2" :class="{ _hideOverflow: !isCasa }" class="modal-card-body pt-3 _b-line">
        <div class="installing-warpper mb-5">
          <div class="is-flex is-align-items-center is-justify-content-center">
            <LottieAnimation
              :animation-data="$asset('@/assets/ani/loading.json')"
              :auto-play="true"
              :loop="true"
              class="install-animation mt-5 mb-2"
            />
          </div>
          <b-progress :value="totalPercentage" format="percent" show-value type="is-primary" />
          <h3
            v-dompurify-html="currentInstallAppText"
            :class="currentInstallAppTextClass"
            class="title is-6 has-text-centered"
            style="height: 20px"
          />
        </div>
      </section>
      <!-- App Install Process End -->
      <b-loading v-model="isLoading" :can-cancel="false" :is-full-page="false" />
      <!-- Modal-Card Body End -->
    </template>
    <!-- Modal-Card Footer Start -->
    <footer
      :class="{ 'is-justify-content-center': currentSlide == 0 }"
      class="modal-card-foot is-flex is-align-items-center"
    >
      <template>
        <div class="is-flex-grow-1" />
        <div>
          <b-button
            v-if="currentSlide == 2 && currentInstallAppError"
            :label="$t('Back')"
            rounded
            @click="prevStep"
          />
          <b-button
            v-if="currentSlide == 1 && state == 'install'"
            :label="$t('Install')"
            :loading="isLoading"
            rounded
            type="is-primary"
            @click="checkComposeAppAndInstallComposeApp(dockerComposeCommands, currentInstallId)"
          />
          <b-button
            v-if="isCasa && currentSlide == 1 && state == 'update'"
            :label="$t('Save')"
            :loading="isLoading"
            rounded
            type="is-primary"
            @click="updateApp()"
          />
          <b-button
            v-if="!isCasa && currentSlide == 1 && state == 'update'"
            :label="$t('Save')"
            :loading="isLoading"
            rounded
            type="is-primary"
            @click="updateContainer()"
          />
          <b-button
            v-if="currentSlide == 2 && !currentInstallAppError"
            :label="$t(cancelButtonText)"
            rounded
            type="is-primary"
            @click="$emit('close')"
          />
          <b-button
            v-if="isFirstInstall"
            :label="$t('Submit')"
            :loading="isLoading"
            rounded
            type="is-primary"
            @click="submitInstallationLocation(installationLocation)"
          />
        </div>
      </template>
    </footer>
    <!-- Modal-Card Footer End -->
  </div>
</template>

<style lang="scss">
// appPanel global style
.app-panel {
    .modal-card-head {
        background-color: hsla(208, 16%, 94%, 1);
    }

    ._stepStoreList {
        min-height: calc(100vh - 2.5rem);

        .modal-card-body {
            overflow-y: scroll;
            overflow-x: clip;
        }
    }
}

.app-search {
    max-width: 12.5rem;
    width: 100%;

    .input {
        height: 2rem !important;
    }
}

.app-item {
    border-radius: 0.5rem;
    transition: background 0.3s ease;

    &:hover {
        background-color: hsl(0, 0%, 97%);
    }
}

.level-item {
    .icon {
        overflow: initial;
    }
}

.install-animation {
    width: 100px;
    height: 100px;
}

.creating-animation {
    width: 16rem;
    height: 16rem;
}

.app-detial {
    overflow: auto;
    height: 100%;

    .app-header {
        position: relative;
    }

    .level {
        .footing {
            color: hsl(0, 0%, 48%);
        }
    }

    .swiper-button-next,
    .swiper-rtl .swiper-button-prev {
        right: -20px;
        left: auto;
    }

    .swiper-button-prev,
    .swiper-rtl .swiper-button-next {
        left: -20px;
        right: auto;
    }
}

.featured-app {
    .swiper-button-next,
    .swiper-rtl .swiper-button-prev {
        right: -20px;
        top: calc(50% - 3.625rem);
        left: auto;
    }

    .swiper-button-prev,
    .swiper-rtl .swiper-button-next {
        left: -20px;
        top: calc(50% - 3.625rem);
        right: auto;
    }

    .button {
        box-sizing: border-box !important;
    }
}

.app-select {
    .dropdown-menu {
        min-width: 1rem !important;
    }

    .dropdown-content {
        border-radius: 0.5rem;
        overflow-y: overlay !important;

        &::-webkit-scrollbar {
            width: 8px;
        }

        &::-webkit-scrollbar-track {
            background: transparent;
        }

        &::-webkit-scrollbar-thumb {
            background: rgba(0, 0, 0, 0.2);
            border-radius: 10px;
            outline: none;
        }
    }

    a.dropdown-item {
        padding-right: 1.5rem;
        font-size: 0.875rem;
    }
}

@media screen and (min-width: 769px) {
    .app-panel {
        .animation-content {
            max-width: 90% !important;
        }

        .modal-card {
            width: 90vw;
            transition: all 0.3s;

            &.narrow {
                width: 50rem !important;
            }

            ._pl {
                margin-right: 0;
                margin-left: calc(90vw - 100%);
            }
        }
    }
}

@media screen and (min-width: 1440px) {
    .app-panel {
        .modal-card {
            width: 81rem !important;

            ._pl {
                margin-right: 0;
                margin-left: calc(81rem - 100%);
            }
        }
    }
}

@media screen and (max-width: 1366px) {
    .f-list {
        .is-one-quarter {
            width: 33.333333% !important;
        }
    }
}

@media screen and (max-width: 1024px) {
    .f-list {
        .is-one-quarter {
            width: 50% !important;
        }
    }
}

@media screen and (max-width: 768px) {
    .modal-card {
        max-height: calc(var(--vh, 1vh) * 100);
        border-radius: 0;

        ._pl {
            margin-right: 0;
            margin-left: calc(100vw - 100%);
        }
    }
}

@media screen and (max-width: 480px) {
    .app-detial {
        overflow: auto;
        height: 100%;

        .modal-card-head {
            .button {
                -webkit-tap-highlight-color: transparent;
            }
        }

        .app-header {
            position: relative;

            .header-icon {
                .is-128x128 {
                    height: 96px;
                    width: 96px;
                }
            }

            .store-title {
                font-size: 1.125rem;
            }

            .subtitle {
                font-size: 0.75rem;
                margin-bottom: 0.75rem;
            }

            .description {
                .button {
                    font-size: 0.75rem;
                }
            }
        }

        .level {
            .mdi-36px.mdi-set,
            .mdi-36px.mdi:before {
                font-size: 24px;
            }

            .title {
                font-size: 24px;
            }

            .footing {
                font-size: 0.6rem !important;
            }
        }
    }

    .f-list {
        .is-one-quarter {
            width: 100% !important;
        }
    }
}

.pri-line-height {
    line-height: 1.875rem;
}

.pri-message-alert {
    height: 2rem;
    margin-top: 0.5rem;
    margin-bottom: 1rem;
    background: #fff6e5;
    border-radius: 0.25rem;
    color: #d99000;
    font-size: 0.875rem;
    font-style: normal;
}

.is-overlay {
    overflow: overlay;
}

.card-width {
    max-width: 35rem;
    min-width: 30rem;
}
</style>

<style lang="scss">
// The App Store, install, settings and progress share the Calm glass window
.atrio-glass-panel {
    background: var(--atrio-glass-bg-strong);
    backdrop-filter: blur(32px) saturate(150%);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1), 0 24px 64px rgba(0, 0, 0, 0.4);
    color: var(--atrio-text);

    .modal-card-head {
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        background: transparent;

        .setting_title {
            color: var(--atrio-text);
            font-size: 1.375rem;
            font-weight: 700;
            letter-spacing: -0.02em;
        }

        .close-button,
        .modal-close-container-line::before,
        .icon-button {
            color: var(--atrio-text);
        }

        .icon-button {
            border-radius: 0.5rem;

            &:hover {
                background: rgba(255, 255, 255, 0.1);
            }
        }

        .button.is-primary {
            height: 2.25rem;
            border: 1px solid rgba(255, 255, 255, 0.14);
            background: rgba(255, 255, 255, 0.08);
            color: var(--atrio-text);
            font-weight: 600;

            &:hover {
                background: rgba(255, 255, 255, 0.16);
            }

            // Phones: the icon alone, so the title keeps one line
            @include mobile {
                width: 2.75rem;
                height: 2.75rem;
                padding: 0;

                span:not(.icon) {
                    display: none;
                }

                .icon {
                    margin: 0 !important;
                }
            }
        }
    }

    .modal-card-body,
    .modal-card-foot {
        background: transparent;
    }

    .modal-card-foot {
        border-top: 0;
    }
}

// App details opened from the store: same glass, CasaOS markup underneath
.app-panel ._stepStoreList .app-detial {
    // Opaque: it lies over the list inside the same glass window, and nested glass cannot blur
    background: linear-gradient(var(--atrio-glass-bg-strong), var(--atrio-glass-bg-strong)), #0b1222;
    color: var(--atrio-text);

    .modal-card-head {
        border-bottom: 0;
        background: transparent;

        .button.is-ghost {
            color: var(--atrio-text-soft);
            font-weight: 600;
            text-decoration: none;

            &:hover {
                color: var(--atrio-text);
            }
        }
    }

    .modal-card-body {
        background: transparent;
    }

    .b-line {
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .header-icon img {
        border-radius: 1.75rem;
    }

    .store-title,
    .title {
        color: var(--atrio-text);
    }

    .subtitle {
        color: var(--atrio-text-soft);
    }

    .button.is-primary {
        background: var(--atrio-text);
        color: #0b1120;
        font-weight: 700;

        &:hover,
        &:focus {
            background: #e2e8f0;
            color: #0b1120;
        }
    }

    // Versions menu next to Install
    .custom-install-button .dropdown-content {
        background: var(--atrio-glass-bg-strong);

        .button.is-primary {
            background: rgba(255, 255, 255, 0.08);
            color: var(--atrio-text);
        }
    }

    .level {
        padding: 1rem 0;
        border-radius: var(--atrio-radius-md, 20px);
        background: rgba(255, 255, 255, 0.04);

        .heading {
            color: var(--atrio-text-muted);
            letter-spacing: 0.06em;
        }

        .title,
        .icon {
            color: var(--atrio-text);
        }

        .footing {
            color: var(--atrio-text-soft) !important;
        }
    }

    .swiper-button-prev,
    .swiper-button-next {
        color: var(--atrio-text);
    }

    // Description, rendered from Markdown
    .v-md-editor {
        background: transparent;
        box-shadow: none;
    }

    .github-markdown-body {
        color: var(--atrio-text-soft);

        h1,
        h2,
        h3,
        h4,
        h5,
        h6,
        strong {
            border-color: rgba(255, 255, 255, 0.08);
            color: var(--atrio-text);
        }

        a {
            color: #67e8f9;
        }

        code,
        pre {
            background: rgba(255, 255, 255, 0.07);
            color: var(--atrio-text);
        }

        blockquote {
            border-left-color: rgba(255, 255, 255, 0.16);
            color: var(--atrio-text-muted);
        }

        hr {
            background: rgba(255, 255, 255, 0.1);
        }

        table tr {
            border-color: rgba(255, 255, 255, 0.1);
            background: transparent;

            th,
            td {
                border-color: rgba(255, 255, 255, 0.1);
            }

            &:nth-child(2n) {
                background: rgba(255, 255, 255, 0.03);
            }
        }

        img {
            background: transparent;
        }
    }
}

// Install and settings forms on the glass: CasaOS form controls in dark
.atrio-glass-panel {
    .label {
        color: var(--atrio-text-soft);
        font-size: 0.8125rem;
        font-weight: 600;
    }

    .tab-content,
    .modal-card-body {
        scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
        scrollbar-width: thin;
    }

    // Image name wider than its tag
    .atrio-form-section .field.is-grouped > .field-body > :first-child,
    .atrio-form-section .field.is-grouped > :first-child {
        flex: 2 1 0;
    }

    .input,
    .textarea,
    .select select,
    .taginput .taginput-container.is-focusable {
        border-color: rgba(255, 255, 255, 0.12);
        background: rgba(255, 255, 255, 0.06);
        box-shadow: none;
        color: var(--atrio-text);

        &::placeholder {
            color: var(--atrio-text-muted);
        }

        &:focus,
        &.is-focused {
            border-color: var(--atrio-accent);
            box-shadow: 0 0 0 1px var(--atrio-accent);
        }

        &[readonly] {
            color: var(--atrio-text-soft);
            background: rgba(255, 255, 255, 0.03);
        }

        &.is-danger {
            border-color: #f87171;
        }

        &.is-success {
            border-color: rgba(134, 239, 172, 0.5);
        }
    }

    .taginput .taginput-container .input {
        border: 0;
        background: transparent;
        box-shadow: none;
    }

    .select:not(.is-multiple):not(.is-loading)::after {
        border-color: var(--atrio-text-soft);
    }

    select option,
    select optgroup {
        background: #111a2e;
        color: var(--atrio-text);
    }

    .control.has-icons-left .icon,
    .control.has-icons-right .icon {
        color: var(--atrio-text-soft);
    }

    .help {
        color: var(--atrio-text-muted);

        &.is-danger {
            color: #fca5a5;
        }

        &.is-success {
            color: #86efac;
        }
    }

    .button.is-static {
        border-color: rgba(255, 255, 255, 0.12);
        background: rgba(255, 255, 255, 0.06);
    }

    .dropdown-content {
        background: #111a2e;
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1), 0 12px 32px rgba(0, 0, 0, 0.4);

        .dropdown-item {
            color: var(--atrio-text);

            &:hover,
            &.is-hovered,
            &.is-active {
                background: rgba(255, 255, 255, 0.1);
                color: var(--atrio-text);
            }
        }
    }

    .tag:not(body) {
        background: rgba(255, 255, 255, 0.12);
        color: var(--atrio-text);
    }

    .switch input[type='checkbox'] + .check {
        background: rgba(255, 255, 255, 0.18);
    }

    .switch input[type='checkbox']:checked + .check {
        background: var(--atrio-accent);
    }

    // "No volumes now, click + to add one" and the row icons of the CasaOS form groups
    .info {
        color: var(--atrio-text-muted);
    }

    .port-item .icon,
    .field .is-clickable {
        color: var(--atrio-text-soft);
    }

    // Services of a compose app, as tabs
    .b-tabs .tabs {
        border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;

        li a {
            border-bottom-color: transparent;
            color: var(--atrio-text-muted);
        }

        li.is-active a {
            border-bottom-color: var(--atrio-accent);
            color: var(--atrio-text);
        }
    }

    .vue-slider-rail {
        background: rgba(255, 255, 255, 0.12);
    }

    .vue-slider-process {
        background: var(--atrio-accent);
    }

    .vue-slider-mark-step {
        background: #111a2e;
        box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.25);
    }

    .vue-slider-mark-label {
        color: var(--atrio-text-muted);
    }

    // Footer and form buttons
    .modal-card-foot .button,
    .modal-card-body .button:not(.is-static):not(.atrio-store-action),
    .b-tabs .button:not(.is-static) {
        border: 1px solid rgba(255, 255, 255, 0.14);
        background: rgba(255, 255, 255, 0.06);
        color: var(--atrio-text);

        &:hover {
            background: rgba(255, 255, 255, 0.14);
        }

        &.is-primary {
            border-color: transparent;
            background: var(--atrio-text);
            color: #0b1120;
            font-weight: 700;

            &:hover {
                background: #e2e8f0;
            }
        }
    }

    // Installing step
    .installing-warpper {
        .title {
            color: var(--atrio-text) !important;

            &.has-text-danger {
                color: #fca5a5 !important;
            }
        }

        .progress {
            background: rgba(255, 255, 255, 0.1);
        }

        .progress-value {
            color: var(--atrio-text);
        }
    }
}

.atrio-form-index {
    position: sticky;
    // Over the 1rem top padding of the scrolling tab content, so nothing shows above it
    top: -1rem;
    z-index: 5;
    display: flex;
    gap: 0.375rem;
    margin: -1rem -1.5rem 1rem;
    padding: 1rem 1.5rem 0.75rem;
    overflow-x: auto;
    background: linear-gradient(var(--atrio-glass-bg-strong), var(--atrio-glass-bg-strong)), #0b1222;
    scrollbar-width: none;

    &::-webkit-scrollbar {
        display: none;
    }

    button {
        flex-shrink: 0;
        height: 2rem;
        padding: 0 0.75rem;
        border: 0;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.06);
        color: var(--atrio-text-soft);
        font: inherit;
        font-size: 0.8125rem;
        font-weight: 600;
        cursor: pointer;

        &:hover {
            background: rgba(255, 255, 255, 0.12);
            color: var(--atrio-text);
        }
    }
}

.atrio-form-section {
    margin-bottom: 1rem;
    padding: 1.25rem;
    border-radius: var(--atrio-radius-md, 20px);
    background: rgba(255, 255, 255, 0.04);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
    scroll-margin-top: 3.75rem;

    > h3,
    summary h3 {
        margin-bottom: 1rem;
        color: var(--atrio-text);
        font-size: 1rem;
        font-weight: 700;
    }

    .field:last-child {
        margin-bottom: 0;
    }
}

.atrio-form-hint {
    margin: -0.625rem 0 1rem;
    color: var(--atrio-text-muted);
    font-size: 0.8125rem;
}

.atrio-form-advanced {
    summary {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem 0.75rem;
        align-items: baseline;
        list-style: none;
        cursor: pointer;

        &::-webkit-details-marker {
            display: none;
        }

        &::before {
            content: '';
            align-self: center;
            width: 0.5rem;
            height: 0.5rem;
            border-right: 2px solid var(--atrio-text-soft);
            border-bottom: 2px solid var(--atrio-text-soft);
            transform: rotate(-45deg);
            transition: transform 0.2s ease;
        }

        h3 {
            margin-bottom: 0 !important;
        }

        .atrio-form-hint {
            margin: 0;
        }
    }

    &[open] summary {
        margin-bottom: 1.25rem;

        &::before {
            transform: rotate(45deg);
        }
    }
}

.atrio-store {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.25rem 1.5rem 2rem !important;
}

.atrio-store-toolbar {
    display: flex;
    gap: 0.75rem;
    align-items: center;

    // On phones the source manager (with its Add Source field) goes below the search
    @include mobile {
        flex-wrap: wrap;

        .atrio-store-search {
            flex-basis: 100%;
        }

        .atrio-store-sources {
            max-width: 100%;
        }
    }
}

.atrio-store-search {
    display: flex;
    flex: 1;
    gap: 0.625rem;
    align-items: center;
    height: 3rem;
    padding: 0 0.75rem 0 1rem;
    border-radius: 1rem;
    background: rgba(255, 255, 255, 0.07);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
    color: var(--atrio-text-soft);
    cursor: text;

    &:focus-within {
        box-shadow: inset 0 0 0 2px var(--atrio-accent);
    }

    input {
        flex: 1;
        min-width: 0;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--atrio-text);
        font: inherit;
        font-size: 1rem;

        &::placeholder {
            color: var(--atrio-text-muted);
        }

        &::-webkit-search-cancel-button {
            display: none;
        }
    }
}

.atrio-store-clear {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border: 0;
    border-radius: 0.625rem;
    background: transparent;
    color: var(--atrio-text-soft);
    cursor: pointer;

    &:hover {
        background: rgba(255, 255, 255, 0.1);
    }
}

// The source manager is a CasaOS component: dress its buttons like ours
.atrio-store-sources .button {
    height: 3rem;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 1rem;
    background: rgba(255, 255, 255, 0.06);
    color: var(--atrio-text);
    font-weight: 600;

    .icon {
        color: inherit;
    }

    &:hover {
        background: rgba(255, 255, 255, 0.12);
        color: var(--atrio-text);
    }
}

.atrio-store-filters {
    display: flex;
    gap: 1rem;
    align-items: center;
    justify-content: space-between;
    margin-top: -0.5rem;

    @include mobile {
        flex-direction: column;
        align-items: stretch;
    }
}

.atrio-store-chips {
    display: flex;
    gap: 0.5rem;
    min-width: 0;
    padding: 0.125rem 2rem 0.125rem 0.125rem;
    overflow-x: auto;
    // Scrolls sideways with the wheel or a swipe; the fade on the right says there is more
    scrollbar-width: none;
    mask-image: linear-gradient(to right, #000 calc(100% - 2.5rem), transparent);

    &::-webkit-scrollbar {
        display: none;
    }
}

.atrio-store-chip {
    display: inline-flex;
    flex-shrink: 0;
    gap: 0.375rem;
    align-items: center;
    height: 2.25rem;
    padding: 0 0.875rem;
    border: 0;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.06);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
    color: var(--atrio-text-soft);
    font: inherit;
    font-size: 0.8125rem;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;

    &:hover {
        background: rgba(255, 255, 255, 0.12);
        color: var(--atrio-text);
    }

    &.is-active {
        background: var(--atrio-text);
        box-shadow: none;
        color: #0b1120;

        .atrio-store-count {
            color: rgba(11, 17, 32, 0.6);
        }
    }
}

.atrio-store-count {
    color: var(--atrio-text-muted);
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
}

.atrio-store-authors {
    display: inline-flex;
    flex-shrink: 0;
    padding: 0.25rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.06);

    button {
        height: 1.875rem;
        padding: 0 0.75rem;
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: var(--atrio-text-soft);
        font: inherit;
        font-size: 0.8125rem;
        font-weight: 600;
        cursor: pointer;

        &:hover {
            color: var(--atrio-text);
        }

        &.is-active {
            background: rgba(255, 255, 255, 0.16);
            color: var(--atrio-text);
        }
    }
}

.atrio-store-section-head {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.875rem;

    h3 {
        color: var(--atrio-text);
        font-size: 1.0625rem;
        font-weight: 700;
    }
}

.atrio-store-total {
    color: var(--atrio-text-muted);
    font-size: 0.8125rem;
    font-variant-numeric: tabular-nums;
}

.atrio-store-arrows {
    display: flex;
    gap: 0.375rem;

    button {
        display: grid;
        place-items: center;
        width: 2rem;
        height: 2rem;
        border: 0;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.08);
        color: var(--atrio-text);
        cursor: pointer;

        &:hover {
            background: rgba(255, 255, 255, 0.16);
        }
    }
}

.atrio-store-featured {
    display: grid;
    grid-auto-columns: minmax(17rem, calc((100% - 2rem) / 3));
    grid-auto-flow: column;
    gap: 1rem;
    padding-bottom: 0.5rem;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    // The arrows above move it
    scrollbar-width: none;

    &::-webkit-scrollbar {
        display: none;
    }

    > * {
        scroll-snap-align: start;
    }
}

.atrio-store-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(16.5rem, 1fr));
    gap: 1rem;
}

.atrio-store-empty {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    align-items: center;
    padding: 3rem 1rem;
    color: var(--atrio-text-soft);
    text-align: center;

    &.is-error {
        margin: auto;
    }
}
</style>

<style lang="scss" scoped>
.close {
    height: 2rem;
    width: 2rem;
    border-radius: 0.375rem;
}

.button[disabled] {
    opacity: 0.3;
}
.icon-button{
    width: 1.5rem;
    height: 1.5rem;
    min-width: 1.5rem;
    min-height: 1.5rem;
}

._hideOverflow {
    overflow: unset;
}

._b-line {
    border-bottom: 1px solid hsla(208, 16%, 94%, 1) !important;
}

.progress {
    border-radius: 6px;
    height: 12px;

    &::-webkit-progress-bar {
        background: rgba(172, 184, 195, 0.4);
    }

    &::-webkit-progress-value {
        opacity: 1;
    }
}

._dropdown {
    height: 2rem;
    border-radius: 0.25rem;

    ._dropdown__typeIcon {
        margin-left: 0.625rem;
        width: 18px;
        height: 18px;
    }

    ._dropdown__stateIcon {
        margin-right: 0.625rem;
        width: 16px;
        height: 16px;
    }

    ._dropdown__item {
        margin-bottom: 2px;
    }
}

.slide-fade-enter-active,
.search-fade-enter-active {
    transition: all 0.3s ease-out;
}

.slide-fade-leave-active,
search-fade-leave-active {
    transition: opacity 0s;
}

.search-fade-enter-from {
    transform: translateY(-20px);
    opacity: 0;
}

.slide-fade-enter-from {
    transform: translateX(20px);
    opacity: 0;
}
</style>
