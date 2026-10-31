<script>
import AtrioUpdate from '@/components/settings/AtrioUpdate.vue'
import { startRechecking, updateAvailable as atrioUpdateAvailable } from '@/plugins/atrioRelease'
import { restoreFocus, trapTab } from '@/plugins/focusTrap'
import AccountPanel from './account/AccountPanel.vue'
import ConsolePanel from './logsAndTerminal/ConsolePanel.vue'
import PortPanel from './settings/PortPanel.vue'
import UpdateModal from './settings/UpdateModal.vue'
import { mixin } from '@/mixins/mixin'
import messages from '@/assets/lang'

import events from '@/events/events'

const systemConfigName = 'system'

export default {
  name: 'TopBar',
  components: {
    AtrioUpdate,
    AccountPanel,
  },
  mixins: [mixin],
  props: {
    initBarData: {
      type: Object,
    },
  },
  data() {
    return {
      timer: 0,
      // Atrio settings and account panels
      settingsOpen: false,
      accountOpen: false,
      // User
      userInfo: this.$store.state.user,
      // System
      barData: {
        lang: this.getInitLang(),
        search_engine: 'https://duckduckgo.com/?q=',
        search_switch: true,
        recommend_switch: true,
        shortcuts_switch: false, // Not used
        widgets_switch: false, // Not used
        existing_apps_switch: true,
        rss_switch: false,
      },
      rss_switch: false,
      updateInfo: {
        current_version: '0',
        need_update: false,
        version: Object,
      },
      isUpdating: false,
      latestText: 'Currently at the latest version',
      updateText: 'A new version is available!',

      port: '',
      autoUsbMount: false,
      deviceModel: '',
      // Language Sets
      languages: Object.entries(messages).map(([key, value]) => ({
        lang: key,
        name: value.lang_name,
      })),
      // Search Engine Sets
      searchEngines: [
        { url: 'https://duckduckgo.com/?q=', name: 'DuckDuckGo' },
        { url: 'https://www.google.com/search?q=', name: 'Google' },
        { url: 'https://www.bing.com/search?q=', name: 'Bing' },
        { url: 'https://www.startpage.com/do/search?cat=web&pl=chrome&query=', name: 'StartPage' },
        { url: 'https://search.brave.com/search?source=web&q=', name: 'Brave' },
      ],
      restart: 'Restart',
      shutdown: 'Shutdown',
      showPower: false,
      showPowerTitle: '',
      showPowerMessage: '',
    }
  },
  computed: {
    // CasaOS or Atrio has an update: the dot on the settings icon says there is something inside
    hasUpdate() {
      return this.updateInfo.need_update || atrioUpdateAvailable()
    },
    sidebarIcon() {
      return this.$store.state.sidebarOpen ? 'close-outline' : 'menu-outline'
    },
    sidebarIconLabel() {
      return this.$store.state.sidebarOpen ? 'Hide Sidebar' : 'Show SideBar'
    },
    isRaspberryPi() {
      return this.deviceModel.toLowerCase().includes('raspberry')
    },
  },
  watch: {
    'barData.lang': {
      handler(val, oldValue) {
        if (val === oldValue) {
          return
        }
        const lang = val.includes('_') ? val : 'en_us'
        this.$messageBus('dashboardsetting_language', lang)
        this.setLang(lang)
      },
      deep: true,
    },
    'barData.search_engine': {
      handler(val, oldValue) {
        if (val === oldValue) {
          return
        }
        this.$messageBus('dashboardsetting_searchengine', val.toString())
        this.$store.commit('SET_SEARCH_ENGINE', val)
      },
      deep: true,
    },
    'barData.search_switch': {
      handler(val, oldValue) {
        if (val === oldValue) {
          return
        }
        this.$messageBus('dashboardsetting_showsearchbar', val.toString())
        this.$store.commit('SET_SEARCH_ENGINE_SWITCH', val)
      },
      deep: true,
    },

    'barData.recommend_switch': {
      handler(val) {
        this.$store.commit('SET_RECOMMEND_SWITCH', val)
      },
      deep: true,
    },
    'barData.rss_switch': {
      handler(val, oldValue) {
        this.rss_switch = val
        this.$store.commit('SET_RSS_SWITCH', val)
        if (val === oldValue || val === undefined) {
          return
        }
        this.$messageBus('dashboardsetting_news', val.toString())
      },
      deep: true,
    },
    initBarData(val) {
      this.barData = val
    },
  },
  created() {
    this.barData = this.initBarData
    // this.getConfig();
    this.getPort()
  },
  mounted() {
    this.checkVersion()
    this.atrioTimer = startRechecking()
    this.$EventBus.$on('atrio:open-settings', this.openSettings)
    window.addEventListener('keydown', this.onSettingsKey)
    this.getUserInfo()
    this.getUsbStatus()
    this.getHardwareInfo()
  },

  beforeUnmount() {
    clearInterval(this.powerTimer)
    clearInterval(this.atrioTimer)
    this.$EventBus.$off('atrio:open-settings', this.openSettings)
    window.removeEventListener('keydown', this.onSettingsKey)
  },
  methods: {
    /*************************************************
		 * PART 0  Common
		 **************************************************/
    /**
     * @description: Save CasaOs Configs
     * @param {*}
     * @return {*}
     */
    async saveData() {
      const saveRes = await this.$api.users.setCustomStorage(systemConfigName, this.barData)
      if (saveRes.data.success === 200) {
        this.barData = saveRes.data.data
      }
    },

    /**
     * @description: Handle Dropmenu state
     * @param {boolean} isOpen
     * @return {*}
     */
    // Atrio: settings live in a side panel, opened from the icon or the command palette
    openSettings() {
      if (this.settingsOpen) return
      this.$messageBus('dashboardsetting')
      this.settingsReturnFocus = document.activeElement
      this.accountOpen = false
      this.settingsOpen = true
      this.$store.commit('SET_SIDEBAR_CLOSE')
      this.checkVersion()
      this.$nextTick(() => this.$refs.settingsSheet?.focus())
    },
    closeSettings(giveFocusBack = true) {
      if (!this.settingsOpen) return
      this.settingsOpen = false
      // Restart and Shutdown ask again next time
      this.restart = 'Restart'
      this.shutdown = 'Shutdown'
      if (giveFocusBack !== false) this.$nextTick(() => restoreFocus(this.settingsReturnFocus))
    },
    onSettingsKey(event) {
      // A modal opened from the panel (port, wallpaper, update) handles its own keys
      if (document.querySelector('.modal.is-active')) return
      if (this.settingsOpen) {
        if (event.key === 'Escape') this.closeSettings()
        else trapTab(event, this.$refs.settingsSheet)
      }
      else if (this.accountOpen) {
        if (event.key === 'Escape') this.closeAccount()
        else trapTab(event, this.$refs.accountSheet)
      }
    },
    openAccount() {
      if (this.accountOpen) return
      this.$messageBus('account_setting')
      this.closeSettings(false)
      this.accountReturnFocus = document.activeElement
      this.accountOpen = true
      this.getUserInfo()
      this.$nextTick(() => this.$refs.accountSheet?.focus())
    },
    closeAccount() {
      if (!this.accountOpen) return
      this.accountOpen = false
      this.$nextTick(() => restoreFocus(this.accountReturnFocus))
    },
    openHardware() {
      this.closeSettings(false)
      this.$EventBus.$emit('atrio:open-hardware')
    },

    /**
     * @description: Show SideBar
     * @param {*}
     * @return {*}
     */
    showSideBar() {
      this.$store.commit('TOOGLE_SIDEBAR_STATE')
    },

    /*************************************************
		 * PART 1-2  Dashboard Setting - Language
		 **************************************************/

    /**
     * @description: Get Initnal Language
     * @param {*}
     * @return {string} lang
     */
    getInitLang() {
      let lang = localStorage.getItem('lang') ? localStorage.getItem('lang') : this.getLangFromBrowser()
      lang = lang.includes('_') ? lang : 'en_us'
      return lang
    },

    /*************************************************
		 * PART 1-3  Dashboard Setting - Web UI Port
		 **************************************************/

    /**
     * @description: Get CasaOs WebUI port
     * @return {*}
     */
    getPort() {
      this.$api.sys.getServerPort().then((res) => {
        if (res.data.success == 200) {
          this.port = res.data.data
        }
      })
    },

    /**
     * @description: Show Port panel
     * @return {*}
     */
    showPortPanel() {
      this.closeSettings(false)
      this.$buefy.modal.open({
        component: PortPanel,
        hasModalCard: true,
        customClass: 'account-modal',
        trapFocus: true,
        canCancel: ['escape'],
        scroll: 'keep',
        animation: 'zoom-in',
        props: {
          initPort: this.port,
        },
      })
    },
    showChangeWallpaperModal() {
      this.$EventBus.$emit(events.SHOW_CHANGE_WALLPAPER_MODAL)
      this.closeSettings(false)
    },

    /*************************************************
		 * PART 1-4  Dashboard Setting - Auto USB Mount Switch
		 **************************************************/
    /**
     * @description: Get Auto USB Mount State
     * @return {*}
     */
    getUsbStatus() {
      this.$api.sys.getUsbStatus().then((res) => {
        if (res.data.success == 200) {
          this.autoUsbMount = res.data.data === 'True'
        }
      })
    },

    /**
     * @description: Enable or Disable USB Auto Mount
     * @param {*}
     * @return {*}
     */
    usbAutoMount() {
      if (this.autoUsbMount) {
        this.$messageBus('dashboardsetting_automountusb', true.toString())
        this.$api.sys.toggleUsbAutoMount({ state: 'on' })
        // Show
        if (this.isRaspberryPi) {
          this.$buefy.snackbar.open({
            message: this.$t(
              'Enabling this function may cause boot failures when the Raspberry Pi device is booted from USB',
            ),
            type: 'is-warning',
            position: 'is-top',
          })
        }
      }
      else {
        this.$messageBus('dashboardsetting_automountusb', false.toString())
        this.$api.sys.toggleUsbAutoMount({ state: 'off' })
      }
    },
    /**
     * @description: Get Hardware Info etc. Board Info
     * @param {*}
     * @return {*}
     */
    getHardwareInfo() {
      this.$api.sys.hardwareInfo().then((res) => {
        if (res.data.success == 200) {
          this.deviceModel = res.data.data.drive_model
          localStorage.setItem('arch', res.data.data.arch || '')
        }
      })
    },

    /*************************************************
		 * PART 1-5  Dashboard Setting - Update
		 **************************************************/

    /**
     * @description: Get Version info
     * @return {*} void
     */
    checkVersion() {
      this.$api.sys.getVersion().then((res) => {
        if (res.data.success === 200) {
          this.updateInfo = res.data.data
          if (res.data.data.need_update) {
            this.$messageBus('dashboardsetting_versionavailable_show', true.toString())
          }
        }
      })
    },

    /**
     * @description: Open Update Modal
     * @return {*} void
     */
    showUpdateModal() {
      this.$messageBus('dashboardsetting_versionupdate', true.toString())
      this.$buefy.modal.open({
        component: UpdateModal,
        hasModalCard: true,
        trapFocus: true,
        canCancel: ['escape'],
        scroll: 'keep',
        animation: 'zoom-in',
        props: {
          changeLog: this.updateInfo.version.change_log,
        },
      })
    },

    /*************************************************
		 * PART 2  Userinfo
		 **************************************************/
    /**
     * @description: Get user info
     * @return {*} void
     */
    async getUserInfo() {
      this.userInfo = this.$store.state.user
      this.$store.commit('SET_SIDEBAR_CLOSE')
      if (this.$store.state.user.id == 0) {
        try {
          const userRes = await this.$api.users.getUserInfo()
          this.userInfo = userRes.data.data
          this.$store.commit('SET_USER', this.userInfo)
        }
        catch (error) {
          console.error(error)
        }
      }
    },
    /*************************************************
		 * PART 3  Terminal
		 **************************************************/

    /**
     * @description: Show Terminal panel
     * @return {*} void
     */
    showTerminalPanel() {
      this.$messageBus('terminallogs')
      this.$store.commit('SET_SIDEBAR_CLOSE')
      this.$buefy.modal.open({
        component: ConsolePanel,
        hasModalCard: true,
        customClass: 'terminal-modal atrio-console-modal',
        trapFocus: true,
        canCancel: [],
        scroll: 'keep',
        animation: 'zoom-in',
      })
    },

    rssConfirm() {
      if (this.rss_switch == false) {
        this.barData.rss_switch = false
        return this.saveData()
      }
      this.$buefy.dialog.confirm({
        title: this.$t('Show news feed from CasaOS Blog'),
        message: this.$t(
          'CasaOS dashboard will get the the latest news feed of https://blog.casaos.io via Internet, which might leave your visit records to the site. Do you accept?',
        ),
        type: 'is-dark',
        confirmText: this.$t('Accept'),
        cancelText: this.$t('Cancel'),
        onConfirm: () => {
          this.barData.rss_switch = true
          this.saveData()
        },
        onCancel: () => {
          this.barData.rss_switch = false
          this.rss_switch = false
        },
      })
    },
    power(key) {
      if (this[key.toLowerCase()] !== 'Are you sure?') {
        this[key.toLowerCase()] = 'Are you sure?'
        return
      }
      this.closeSettings(false)
      this.showPower = true
      switch (key) {
        case 'Restart':
          this.$messageBus('dashboardsetting_reboot')
          this[key.toLowerCase()] = key
          this.showPowerTitle = 'Restarting now'
          this.showPowerMessage = 'Please wait for about 90 seconds.'
          break
        case 'Shutdown':
          this.$messageBus('dashboardsetting_shutdown')
          this[key.toLowerCase()] = key
          this.showPowerTitle = 'Now shutting down'
          this.showPowerMessage = 'Please wait for about 30 seconds before cutting off the power.'
          break
      }
      const path = key === 'Shutdown' ? 'off' : 'restart'
      this.$api.sys.power(path).then((res) => {
        // After a shutdown there is nothing to wait for
        if (res.data.success === 200 && key !== 'Shutdown') {
          this.showPowerMessage = res.data.data
          clearInterval(this.powerTimer)
          this.powerTimer = setInterval(() => {
            this.$api.users.getUserStatus().then((res) => {
              if (res.data.data.initialized) {
                clearInterval(this.powerTimer)
                location.reload()
              }
            }).catch(() => {
              // Still restarting
            })
          }, 30000)
        }
      }).catch(() => {
        this.resetPower()
        this.$buefy.toast.open({ message: this.$t('the action failed'), type: 'is-danger' })
      })
    },
    resetPower() {
      clearInterval(this.powerTimer)
      this.showPower = false
      this.restart = 'Restart'
      this.shutdown = 'Shutdown'
    },
  },
}
</script>

<template>
  <div class="atrio-header-wrap">
  <div class="navbar top-bar atrio-header container is-flex is-align-items-center">
    <a class="atrio-brand" href="#/" aria-label="Atrio">
      <img :src="$asset('@/assets/img/logo/atrio-mark.svg')" alt="">
      <span>atrio</span>
    </a>

    <!-- Search / command palette -->
    <button :aria-label="$t('Search apps, actions and settings…')" class="atrio-search" type="button" @click="$EventBus.$emit('atrio:open-palette')">
      <b-icon icon="search-outline" pack="casa" size="is-20" />
      <span class="atrio-search-label">{{ $t('Search apps, actions and settings…') }}</span>
      <kbd>Ctrl K</kbd>
    </button>

    <div class="navbar-brand atrio-actions _fixed-height">
      <!-- SideBar Button Start -->
      <div id="sidebar-btn" class="is-flex is-align-items-center navbar-item">
        <b-tooltip
          :active="!$store.state.isMobile"
          :label="sidebarIconLabel"
          position="is-right"
          type="is-dark"
        >
          <button :aria-label="sidebarIconLabel" class="atrio-header-icon" type="button" @click="showSideBar">
            <b-icon :icon="sidebarIcon" class="picon" pack="casa" size="is-20" />
          </button>
        </b-tooltip>
      </div>
      <!-- SideBar Button Start -->

      <!-- Account Start: the icon opens the account panel -->
      <div class="is-flex is-align-items-center navbar-item">
        <b-tooltip :active="!$store.state.isMobile" :label="$t('Account')" position="is-right" type="is-dark">
          <button :aria-label="$t('Account')" class="atrio-header-icon" type="button" @click="openAccount">
            <b-icon class="picon" icon="account-outline" pack="casa" size="is-20" />
          </button>
        </b-tooltip>
      </div>
      <Teleport to="body">
        <transition name="atrio-sheet">
          <div v-if="accountOpen" class="atrio-sheet-backdrop" @click.self="closeAccount">
            <aside ref="accountSheet" :aria-label="$t('Account')" aria-modal="true" class="atrio-sheet atrio-settings" role="dialog" tabindex="-1">
              <AccountPanel @close="closeAccount" />
            </aside>
          </div>
        </transition>
      </Teleport>
      <!-- Account End -->

      <!-- Settings Start: the icon opens the settings panel -->
      <div class="is-flex is-align-items-center navbar-item">
        <b-tooltip :active="!$store.state.isMobile" :label="$t('Settings')" position="is-right" type="is-dark">
          <button :aria-label="$t('Settings')" class="atrio-header-icon" type="button" @click="openSettings">
            <b-icon :class="{ 'update-icon-dot': hasUpdate }" class="picon" icon="control-outline" pack="casa" size="is-20" />
          </button>
        </b-tooltip>
      </div>

      <Teleport to="body">
        <transition name="atrio-sheet">
          <div v-if="settingsOpen" class="atrio-sheet-backdrop" @click.self="closeSettings">
            <aside ref="settingsSheet" :aria-label="$t('Settings')" aria-modal="true" class="atrio-sheet atrio-settings" role="dialog" tabindex="-1">
              <header class="atrio-sheet-head">
                <span class="atrio-settings-icon">
                  <b-icon icon="control-outline" pack="casa" />
                </span>
                <div class="atrio-sheet-title">
                  <h2>{{ $t('Settings') }}</h2>
                </div>
                <button :aria-label="$t('Close')" class="atrio-icon-button" type="button" @click="closeSettings">
                  <b-icon icon="close-outline" pack="casa" />
                </button>
              </header>

              <section class="atrio-settings-section">
                <h3>{{ $t('Appearance') }}</h3>
                <div class="atrio-setting-row">
                  <b-icon icon="language-outline" pack="casa" size="is-20" />
                  <span class="atrio-setting-label">{{ $t('Language') }}</span>
                  <b-select v-model="barData.lang" class="set-select" size="is-small" @update:model-value="saveData">
                    <option v-for="lang in languages" :key="lang.lang" :value="lang.lang">
                      {{ lang.name }}
                    </option>
                  </b-select>
                </div>
                <div class="atrio-setting-row">
                  <b-icon icon="wallpaper-outline" pack="casa" size="is-20" />
                  <span class="atrio-setting-label">{{ $t('Wallpaper') }}</span>
                  <button class="atrio-button is-small" type="button" @click="showChangeWallpaperModal">
                    {{ $t('Change') }}
                  </button>
                </div>
              </section>

              <section class="atrio-settings-section">
                <h3>{{ $t('Web search') }}</h3>
                <div class="atrio-setting-row">
                  <b-icon icon="show-search-outline" pack="casa" size="is-20" />
                  <span class="atrio-setting-label">{{ $t('Web search in the search') }}</span>
                  <b-switch v-model="barData.search_switch" class="mr-0" @update:model-value="saveData" />
                </div>
                <div v-if="barData.search_switch" class="atrio-setting-row">
                  <b-icon icon="search-outline" pack="casa" size="is-20" />
                  <span class="atrio-setting-label">{{ $t('Search Engine') }}</span>
                  <b-select v-model="barData.search_engine" class="set-select" size="is-small" @update:model-value="saveData">
                    <option v-for="item in searchEngines" :key="item.name" :value="item.url">
                      {{ item.name }}
                    </option>
                  </b-select>
                </div>
              </section>

              <section class="atrio-settings-section">
                <h3>{{ $t('Dashboard') }}</h3>
                <div class="atrio-setting-row">
                  <b-icon icon="display-applications-outline" pack="casa" size="is-20" />
                  <span class="atrio-setting-label">{{ $t('Show Recommended Apps') }}</span>
                  <b-switch v-model="barData.recommend_switch" class="mr-0" @update:model-value="saveData" />
                </div>
                <div class="atrio-setting-row">
                  <b-icon icon="news-outline" pack="casa" size="is-20" />
                  <span class="atrio-setting-label">{{ $t('Show news feed from CasaOS Blog') }}</span>
                  <b-switch v-model="rss_switch" :native-value="barData.rss_switch" class="mr-0" @update:model-value="rssConfirm" />
                </div>
                <div v-if="$store.state.notImportList.length > 0" class="atrio-setting-row">
                  <b-icon icon="docker-outline" pack="casa" size="is-20" />
                  <span class="atrio-setting-label">{{ $t('Show other Docker container app(s)') }}</span>
                  <b-switch v-model="barData.existing_apps_switch" class="mr-0" @update:model-value="saveData" />
                </div>
              </section>

              <section class="atrio-settings-section">
                <h3>{{ $t('Network') }}</h3>
                <div class="atrio-setting-row">
                  <b-icon icon="port-outline" pack="casa" size="is-20" />
                  <span class="atrio-setting-label">{{ $t('WebUI Port') }}</span>
                  <span class="atrio-setting-value">{{ port }}</span>
                  <button class="atrio-button is-small" type="button" @click="showPortPanel">
                    {{ $t('Change') }}
                  </button>
                </div>
              </section>

              <section class="atrio-settings-section">
                <h3>{{ $t('Storage') }}</h3>
                <div class="atrio-setting-row">
                  <b-icon icon="usb-outline" pack="casa" size="is-20" />
                  <span class="atrio-setting-label">
                    {{ $t('Automount USB Drive') }}
                    <small v-if="isRaspberryPi" class="atrio-setting-note">
                      {{ $t('Enabling this function may cause boot failures when the Raspberry Pi device is booted from USB') }}
                    </small>
                  </span>
                  <b-switch v-model="autoUsbMount" class="mr-0" @update:model-value="usbAutoMount" />
                </div>
              </section>

              <section class="atrio-settings-section">
                <h3>{{ $t('Updates') }}</h3>
                <div class="atrio-setting-row is-update">
                  <b-icon icon="update-outline" pack="casa" size="is-20" />
                  <span class="atrio-setting-label">
                    <span :class="{ 'update-text-dot': updateInfo.need_update }">CasaOS</span>
                    <small class="atrio-setting-note">
                      <template v-if="!updateInfo.need_update">
                        {{ $t(latestText) }}
                        <b-icon custom-size="mdi-16px" icon="check" type="is-success" />
                      </template>
                      <template v-else>{{ $t(updateText) }}</template>
                    </small>
                  </span>
                  <span class="atrio-setting-value">v{{ updateInfo.current_version }}</span>
                  <button v-if="updateInfo.need_update" class="atrio-button is-small is-primary" type="button" @click="showUpdateModal">
                    {{ $t('Update') }}
                  </button>
                </div>
                <AtrioUpdate />
              </section>

              <section class="atrio-settings-section">
                <h3>{{ $t('System') }}</h3>
                <div class="atrio-setting-row">
                  <b-icon icon="chip" pack="mdi" size="is-20" />
                  <span class="atrio-setting-label">{{ $t('Hardware details') }}</span>
                  <button class="atrio-button is-small" type="button" @click="openHardware">
                    {{ $t('Open') }}
                  </button>
                </div>
                <div class="atrio-settings-power">
                  <button class="atrio-button" type="button" @click="power('Restart')">
                    <b-icon icon="restart-outline" pack="casa" size="is-16" />
                    {{ $t(restart) }}
                  </button>
                  <button class="atrio-button is-danger" type="button" @click="power('Shutdown')">
                    <b-icon icon="shutdown-outline" pack="casa" size="is-16" />
                    {{ $t(shutdown) }}
                  </button>
                </div>
              </section>
            </aside>
          </div>
        </transition>
      </Teleport>
      <!-- Settings End -->

      <!-- Terminal  Start -->
      <div class="is-flex is-align-items-center navbar-item">
        <b-tooltip
          :active="!$store.state.isMobile"
          :label="$t('Terminal & Logs')"
          position="is-right"
          type="is-dark"
        >
          <button :aria-label="$t('Terminal & Logs')" class="atrio-header-icon" type="button" @click="showTerminalPanel">
            <b-icon class="picon" icon="terminal-outline" pack="casa" size="is-20" />
          </button>
        </b-tooltip>
      </div>
      <!-- Terminal  End -->
    </div>


    <b-modal v-model="showPower" :can-cancel="false" class="_modal" scroll="clip" width="20rem">
      <b-message @close="resetPower">
        <template #header>
          {{ $t(showPowerTitle) }}
          <img
            v-if="showPowerTitle === 'Now shutting down'"
            :src="$asset('@/assets/img/loading/waiting.svg')"
            alt="pending"
            class="ml-1 is-24x24"
          >
        </template>
        <div
          :class="showPowerTitle === 'Now shutting down' ? 'mb-4' : ''"
          class="is-flex is-align-items-center is-justify-content-start _is-normal"
        >
          {{ $t(showPowerMessage) }}
        </div>
      </b-message>
      <footer
        v-if="showPowerTitle !== 'Now shutting down'"
        class="has-background-white is-flex is-flex-direction-row-reverse"
      >
        <button
          class="ml-2 mr-5 mt-3 mb-3 pr-4 pl-4 _is-normal _has-background-blue is-flex is-align-items-center is-justify-content-center"
        >
          {{ $t("Connecting") }}
          <img :src="$asset('@/assets/img/power/waiting-white.svg')" alt="loading" class="ml-1">
        </button>
      </footer>
    </b-modal>
  </div>
  </div>
</template>

<style lang="scss">
._is-large {
	// bulma 3rem;
	//height: 2.5rem;
	padding-bottom: 0.625rem;
	padding-top: 0.625rem;
}

._box {
	height: 2.5rem;
}

._footer {
	height: 3.5rem;
	border-top: 1px solid rgb(228 233 237);
}

._title {
	font-family: $family-sans-serif;
	font-size: 1rem;
	font-weight: 500;
	line-height: 1.5rem;
	letter-spacing: 0em;
	text-align: left;
	padding: 1.25rem 1.25rem 0.5rem 1.5rem;
	border-bottom: 1px solid rgb(228 233 237);
}

._is-normal {
	font-family: $family-sans-serif;
	font-size: 0.875rem;
	font-weight: 400;
	line-height: 1.25rem;
	letter-spacing: 0em;
	text-align: left;
}

._has-text-attention {
	color: hsla(18, 98%, 55%, 1);
}

._has-text-gray {
	color: hsla(208, 14%, 58%, 1);
}

._fixed-height {
	height: 2.75rem;
	min-height: 2.75rem;
}

.top-bar {
	position: relative;
	z-index: 20;
	height: 2.75rem;
	background: rgba(255, 255, 255, 1);

	.navbar-brand {
		margin-left: 1.25rem;

		.picon {
			cursor: pointer;
		}

		.navbar-item {
			height: 2.75rem;
			padding: 0.75rem 0.75rem 0.5rem;

			.icon {
				&:only-child {
					margin-left: 0;
					margin-right: 0;
				}
			}
		}

		.dropdown + .dropdown {
			margin-left: 0;
		}

		.dropdown-trigger,
		.tooltip-trigger {
			height: 1.5rem;
		}

		.dropdown-menu {
			margin-top: 0.5rem;
			min-width: 22.5rem;

			.dropdown-content {
				background: rgba(255, 255, 255, 1);
				border-radius: 10px;

				.dropdown-item {
					padding: 0.875rem 1.25rem;
					text-align: left;

					.item {
						height: 2rem;
					}
				}
			}
		}
	}

	.set-select {
		.select {
			&::after {
				border-color: #000 !important;
			}
		}

		select {
			background-color: transparent !important;
			border-color: #000 !important;
		}
	}

	.field {
		line-height: 1rem;
	}

	.switch {
		&.is-flex-direction-row-reverse {
			.control-label {
				padding-left: 0;
				padding-right: calc(0.75em - 1px);
			}
		}

		// TODO: remove this when the switch to be component.
		&._small input[type="checkbox"] {
			& + .check {
				width: 2.286em;
				height: 1.429em;
				padding: 0;

				&::before {
					width: 1.143em;
					height: 1.143em;
					margin-left: 2px;
					margin-right: 2px;
				}
			}

			&:checked + .check {
				&::before {
					transform: translate3d(80%, 0, 0);
				}
			}
		}
	}

	.update-container {
		.button.is-rounded {
			padding-left: calc(1em + 0.25em);
			padding-right: calc(1em + 0.25em);
			border-radius: 9999px !important;
		}
	}

	.button {
		&.is-small {
			height: 2em;
		}
	}

	.icon {
		color: rgb(74, 74, 74);
	}
}

.update-text-dot {
	position: relative;

	&::after {
		content: "";
		position: absolute;
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background-color: $danger;
		right: -0.5rem;
		top: 0rem;
	}
}

.update-icon-dot {
	position: relative;

	&::after {
		content: "";
		position: absolute;
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background-color: $danger;
		right: 0;
		top: 0;
	}
}

#sidebar-btn {
	display: none !important;
}

@media screen and (max-width: 480px) {
	#sidebar-btn {
		display: flex !important;
	}
}

@media (prefers-color-scheme: dark) {
	.top-bar {
		background: rgba(53, 54, 58, 1);

		.picon {
			color: #fff;
		}
	}
}

// TODO
._is-normal {
	/* Text 400Regular/Text03 */
	font-family: $family-sans-serif;
	font-style: normal;
	font-weight: 400;
	font-size: 0.875rem;
	line-height: 1.25rem;
	/* or 143% */
	font-feature-settings: "pnum" on, "lnum" on;
}

._has-background-blue {
	background: hsla(208, 100%, 75%, 1);
}

._modal {
	.modal-content {
		border-radius: 0.625rem;

		.message {
			margin-bottom: 0rem;
			border-radius: 0rem;

			.message-header {
				background: hsla(0, 0%, 100%, 1);
				border-bottom: 1px solid hsla(208, 16%, 94%, 1);
				//margin-top: 1.25rem;
				//margin-left: 1.5rem;
				padding: 1.25rem 1.5rem 0.75rem 1.5rem;

				> div {
					display: flex;
					//align-items: center;
					justify-content: center;
					vertical-align: middle;

					color: hsla(208, 20%, 20%, 1);

					font-family: $family-sans-serif;
					font-size: 1rem;
					font-weight: 500;
					line-height: 1.5rem;
					letter-spacing: 0em;
					text-align: left;
					font-feature-settings: "pnum" on, "lnum" on;

					.is-24x24 {
						width: 1.5rem;
						height: 1.5rem;
					}
				}

				> button {
					width: 1.5rem;
					height: 1.5rem;
					max-height: 1.5rem;
					max-width: 1.5rem;
					min-height: 1.5rem;
					min-width: 1.5rem;
					display: none;
				}
			}

			.message-body {
				background: hsla(0, 0%, 100%, 1);
				padding-top: 1rem;
				padding-bottom: 1rem;
			}
		}

		footer {
			border: 1px solid hsla(208, 16%, 94%, 1);

			button {
				border-radius: 0.875rem;
				border: none;
				color: hsla(0, 0%, 100%, 1);
				height: 2rem;

				img {
					width: 1.25rem;
					height: 1.25rem;
				}
			}
		}
	}
}

// Atrio header (Calm glass)
.atrio-header-wrap {
	position: relative;
	z-index: 20;
	padding: 1rem 0 0;
}

.top-bar.atrio-header {
	height: auto;
	min-height: 3.75rem;
	padding: 0.5rem 0.75rem 0.5rem 1rem;
	gap: 1rem;
	background: var(--atrio-glass-bg);
	backdrop-filter: var(--atrio-glass-blur);
	-webkit-backdrop-filter: var(--atrio-glass-blur);
	border-radius: 20px;
	box-shadow: inset 0 0 0 1px var(--atrio-glass-border);
	color: var(--atrio-text);

	.navbar-brand.atrio-actions {
		order: 3;
		margin-left: 0;
		align-items: center;

		.picon,
		.icon {
			color: var(--atrio-text);
		}

		.navbar-item {
			border-radius: var(--atrio-radius-sm);
			transition: background 0.2s;

			&:hover {
				background: var(--atrio-glass-hover);
			}
		}
	}
}

.atrio-brand {
	display: flex;
	flex-shrink: 0;
	align-items: center;
	gap: 0.625rem;
	color: var(--atrio-text);
	font-size: 1.25rem;
	font-weight: 800;
	letter-spacing: -0.02em;

	img {
		width: 1.875rem;
		height: 1.875rem;
	}

	&:hover {
		color: var(--atrio-text);
	}
}

.atrio-header-icon {
	display: inline-flex;
	align-items: center;
	padding: 0;
	border: 0;
	background: none;
	color: inherit;
	cursor: pointer;
	border-radius: 0.375rem;

	&:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 2px;
	}
}

.atrio-search {
	flex: 1 1 18rem;
	max-width: 32rem;
	margin: 0 auto;
	display: flex;
	align-items: center;
	gap: 0.625rem;
	height: 2.75rem;
	padding: 0 0.5rem 0 0.875rem;
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: var(--atrio-radius-sm);
	background: rgba(255, 255, 255, 0.06);
	color: var(--atrio-text-soft);
	font: inherit;
	font-size: 0.875rem;
	cursor: pointer;
	transition: background 0.2s;

	&:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	.atrio-search-label {
		flex: 1;
		overflow: hidden;
		text-align: left;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	kbd {
		padding: 0.1875rem 0.5rem;
		border-radius: 0.5rem;
		background: rgba(255, 255, 255, 0.08);
		color: var(--atrio-text);
		font: inherit;
		font-size: 0.75rem;
	}
}

@media screen and (max-width: 768px) {
	.atrio-search {
		flex: 0 0 2.75rem;
		justify-content: center;
		padding: 0;

		.atrio-search-label,
		kbd {
			display: none;
		}
	}
}
</style>

<style lang="scss">
// Atrio settings panel (shares the sheet styles of the app details panel)
.atrio-settings {
	width: min(32rem, calc(100% - 2rem));
	gap: 1rem;
	scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
	scrollbar-width: thin;
}

.atrio-settings-icon {
	display: grid;
	place-items: center;
	width: 3rem;
	height: 3rem;
	border-radius: 1rem;
	background: rgba(255, 255, 255, 0.08);
	color: var(--atrio-text);
}

.atrio-settings-section {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	padding: 0.75rem;
	border-radius: var(--atrio-radius-md, 20px);
	background: rgba(255, 255, 255, 0.04);
	box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);

	> h3 {
		margin: 0.125rem 0.5rem 0.375rem;
		color: var(--atrio-text-muted);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	// The Atrio update row comes from the old menu: fit it to the panel
	> ._is-large {
		margin: 0 !important;
		padding: 0.625rem 0.5rem !important;
		border-radius: 0.75rem;
		color: var(--atrio-text);

		._has-text-gray,
		.is-size-7 {
			color: var(--atrio-text-soft);
		}

		.pl-55 {
			padding-left: 2rem !important;
		}

		// Logo in the same column as the other rows' icons
		.atrio-update-logo {
			margin: 0 0.75rem 0 0 !important;
		}

		a {
			color: #67e8f9;
		}

		.button.is-dark {
			background: var(--atrio-text);
			color: #0b1120;
			font-weight: 700;
		}
	}
}

.atrio-setting-row {
	display: flex;
	gap: 0.75rem;
	align-items: center;
	min-height: 3rem;
	padding: 0.375rem 0.5rem;
	border-radius: 0.75rem;
	color: var(--atrio-text);

	&:hover {
		background: rgba(255, 255, 255, 0.04);
	}

	> .icon {
		flex-shrink: 0;
		color: var(--atrio-text-soft);
	}

	.field {
		margin: 0;
	}

	.select select {
		border-color: rgba(255, 255, 255, 0.12);
		background: rgba(255, 255, 255, 0.06);
		color: var(--atrio-text);

		option {
			background: #111a2e;
		}
	}

	.select:not(.is-multiple):not(.is-loading)::after {
		border-color: var(--atrio-text-soft);
	}

	.switch input[type='checkbox'] + .check {
		background: rgba(255, 255, 255, 0.18);
	}

	.switch input[type='checkbox']:checked + .check {
		background: var(--atrio-accent);
	}
}

.atrio-setting-label {
	display: flex;
	flex: 1;
	flex-direction: column;
	gap: 0.125rem;
	min-width: 0;
	font-size: 0.9375rem;
	font-weight: 600;
}

.atrio-setting-note {
	display: inline-flex;
	align-items: center;
	gap: 0.25rem;
	color: var(--atrio-text-muted);
	font-size: 0.75rem;
	font-weight: 500;
}

.atrio-setting-value {
	color: var(--atrio-text-soft);
	font-size: 0.875rem;
	font-variant-numeric: tabular-nums;
}

.atrio-settings-power {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 0.5rem;
	margin-top: 0.5rem;

	.atrio-button {
		justify-content: center;
	}

	.atrio-button.is-danger {
		border-color: rgba(248, 113, 113, 0.35);
		color: #fca5a5;

		&:hover {
			background: rgba(248, 113, 113, 0.12);
		}
	}
}
</style>
