<script>
import { defineAsyncComponent } from 'vue'
import { nanoid } from 'nanoid'
import SideBar from '@/components/SideBar.vue'
import TopBar from '@/components/TopBar.vue'
import CoreService from '@/components/CoreService.vue'
import AppSection from '@/components/Apps/AppSection.vue'
import CommandPalette from '@/components/home/CommandPalette.vue'
import AppDetailsPanel from '@/components/home/AppDetailsPanel.vue'
import HardwarePanel from '@/components/home/HardwarePanel.vue'
import FilePanel from '@/components/files/FileManager.vue'
import UpdateCompleteModal from '@/components/settings/UpdateCompleteModal.vue'
import { mixin } from '@/mixins/mixin'
import events from '@/events/events'

const wallpaperConfig = 'wallpaper'

export default {
  name: 'HomePage',
  components: {
    SideBar,
    AppSection,
    TopBar,
    CoreService,
    FilePanel,
    CommandPalette,
    AppDetailsPanel,
    HardwarePanel,
  },
  mixins: [mixin],
  provide() {
    return {
      homeShowFiles: this.showFiles,
      homeShowAppStore: () => this.$refs.apps?.showInstall(),
    }
  },
  data() {
    return {
      isLoading: true,
      // Drives the date, time and greeting above the dashboard
      now: new Date(),
      // Status chips next to the greeting
      systemLoad: null,
      appsSummary: { running: 0, total: 0 },
      hardwareInfoLoading: true,
      user_id: localStorage.getItem('user_id') ? localStorage.getItem('user_id') : 1,
      isFileActive: false,
      barData: {},
      topBarAni: {
        classes: 'fadeInDown',
        duration: 800,
      },
    }
  },

  computed: {
    // "it_it" -> "it-IT" for Intl
    locale() {
      const [lang, region] = (this.$i18n.locale || 'en_us').split('_')
      return region ? `${lang}-${region.toUpperCase()}` : lang
    },
    today() {
      const date = new Intl.DateTimeFormat(this.locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(this.now)
      const time = new Intl.DateTimeFormat(this.locale, { hour: '2-digit', minute: '2-digit' }).format(this.now)
      return `${date.charAt(0).toUpperCase() + date.slice(1)} · ${time}`
    },
    greeting() {
      const hour = this.now.getHours()
      const part = hour < 5 ? 'Good evening' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
      const name = this.$store.state.user?.username
      return name ? `${this.$t(part)}, ${name}` : this.$t(part)
    },
    sidebarOpen() {
      return this.$store.state.sidebarOpen
    },
  },
  created() {
    this.getHardwareInfo()
    this.getWallpaperConfig()
    this.getConfig()

    this.$store.commit('SET_ACCESS_ID', nanoid())
  },
  mounted() {
    this.clockTimer = setInterval(() => (this.now = new Date()), 10000)
    this.$EventBus.$on('atrio:apps-summary', this.setAppsSummary)
    window.addEventListener('resize', this.onResize)
    this.onResize()
    if (localStorage.getItem('is_update') === 'true') {
      this.showUpdateCompleteModal()
      localStorage.removeItem('is_update')
    }
    if (sessionStorage.getItem('fromWelcome')) {
      this.$messageBus('global_newvisit')
      this.rssConfirm()
      // one-off consumption
      sessionStorage.removeItem('fromWelcome')
    }
    this.$messageBus('global_visit')

    this.$EventBus.$on('casaUI:openStorageManager', this.showStorageManagerPanelModal)
  },
  beforeUnmount() {
    clearInterval(this.clockTimer)
    this.$EventBus.$off('atrio:apps-summary', this.setAppsSummary)
    window.removeEventListener('resize', this.onResize)
    this.$EventBus.$off('casaUI:openStorageManager', this.showStorageManagerPanelModal)
  },
  sockets: {
    'casaos:system:utilization'(res) {
      const cpu = JSON.parse(res.Properties.sys_cpu)
      const mem = JSON.parse(res.Properties.sys_mem)
      // The processor's temperature as CasaOS reads it; the Hardware panel shows every sensor
      this.systemLoad = { busy: cpu.percent >= 90 || mem.usedPercent >= 90, hot: cpu.temperature >= 85 }
    },
  },
  methods: {
    setAppsSummary(summary) {
      this.appsSummary = summary
    },

    /**
     * @description: Get CasaOS Configs
     * @param {*}
     * @return {*}
     */
    async getConfig() {
      const defaults = {
        lang: this.getLangFromBrowser(),
        search_engine: 'https://duckduckgo.com/?q=',
        search_switch: true,
        recommend_switch: true,
        shortcuts_switch: true,
        widgets_switch: true,
        existing_apps_switch: true,
        rss_switch: this.barData.rss_switch,
      }
      let systemConfig
      try {
        systemConfig = await this.$api.users.getCustomStorage('system')
      }
      catch (e) {
        // Backend unreachable: show the dashboard with the defaults instead of a blank page
        console.error(e)
        systemConfig = { data: { success: 200, data: defaults } }
      }
      if (systemConfig.data.success != 200 || systemConfig.data.data == '') {
        const barData = {
          lang: this.getLangFromBrowser(),
          search_engine: 'https://duckduckgo.com/?q=',
          search_switch: true,
          recommend_switch: true,
          shortcuts_switch: true,
          widgets_switch: true,
          existing_apps_switch: true,
          rss_switch: this.barData.rss_switch,
        }
        // save
        const saveRes = await this.$api.users.setCustomStorage('system', barData).catch(() => null)
        systemConfig = saveRes?.data.success === 200 ? saveRes : { data: { success: 200, data: barData } }
      }

      this.$store.commit('SET_SEARCH_ENGINE_SWITCH', systemConfig.data.data.search_switch)
      this.$store.commit('SET_RECOMMEND_SWITCH', systemConfig.data.data.recommend_switch)
      this.$store.commit('SET_RSS_SWITCH', systemConfig.data.data.rss_switch)
      this.barData = systemConfig.data.data
      this.isLoading = false
    },

    /**
     * @description: Show SideBar
     * @param {*}
     * @return {*} void
     */
    showSideBar() {
      console.log('showSidebar')
    },

    /**
     * @description: Show Files
     * @param {*}
     * @return {*} void
     */
    showFiles(path) {
      this.isFileActive = true
      this.$nextTick(() => {
        this.$refs.filePanel.init(path)
      })
    },

    afterFileEnter() {
      this.$EventBus.$emit(events.AFTER_FILES_ENTER)
    },

    /**
     * @description: Window Resize Handler
     * @param {*}
     * @return {*} void
     */
    onResize() {
      if (window.innerWidth > 480 && this.sidebarOpen) {
        this.$store.commit('SET_SIDEBAR_CLOSE')
      }
    },

    /**
     * @description: Get Hardware info and save to store
     * @param {*}
     * @return {*} void
     */

    getHardwareInfo() {
      this.$api.sys.getUtilization().then((res) => {
        if (res.data.success === 200) {
          this.hardwareInfoLoading = false
          this.$store.commit('SET_HARDWARE_INFO', res.data.data)
        }
      })
    },

    openHomeContaxtMenu(e) {
      // console.log(e.target);
      this.$EventBus.$emit(events.SHOW_HOME_CONTEXT_MENU, e)
    },

    getWallpaperConfig() {
      this.$api.users.getCustomStorage(wallpaperConfig).then((res) => {
        if (res.data.success === 200 && res.data.data != '') {
          this.$store.commit('SET_WALLPAPER', {
            path: res.data.data.path,
            from: res.data.data.from,
          })
        }
      })
    },

    async showUpdateCompleteModal() {
      await this.$api.users.getLinkAppDetail()
      const versionRes = await this.$api.sys.getVersion()
      if (versionRes.data.success == 200) {
        this.$buefy.modal.open({
          component: UpdateCompleteModal,
          hasModalCard: true,
          customClass: 'network-storage-modal',
          trapFocus: true,
          canCancel: [],
          scroll: 'keep',
          animation: 'zoom-in',
          props: {
            changeLog: versionRes.data.data.version.change_log,
          },
        })
      }
    },

    // one-off
    rssConfirm() {
      this.$buefy.dialog.confirm({
        title: this.$t('Show news feed from CasaOS Blog'),
        message: this.$t('CasaOS dashboard will get the the latest news feed of https://blog.casaos.io via Internet, which might leave your visit records to the site. Do you accept?'),
        type: 'is-dark',
        confirmText: this.$t('Accept'),
        cancelText: this.$t('Cancel'),
        onConfirm: async () => {
          const systemConfig = await this.$api.users.getCustomStorage('system')
          const barData = systemConfig.data.data
          barData.rss_switch = true
          const saveRes = await this.$api.users.setCustomStorage('system', barData)
          this.barData = saveRes.data.data
        },
        onCancel: () => {
          this.barData.rss_switch = false
        },
      })
    },

    // show storage settings modal
    async showStorageManagerPanelModal() {
      this.$messageBus('widget_storagemanager')
      this.$buefy.modal.open({
        component: defineAsyncComponent(() => import('@/components/Storage/StorageManagerPanel.vue')),
        hasModalCard: true,
        customClass: 'storage-modal',
        trapFocus: true,
        canCancel: [],
        scroll: 'keep',
        animation: 'zoom-in',
      })
    },

  },

}
</script>

<template>
  <div v-if="!isLoading" class="out-container">
    <!-- NavBar Start -->
    <TopBar v-animate-css="topBarAni" :init-bar-data="barData" @showSideBar="showSideBar" />
    <!-- NavBar End -->

    <!-- Content Start -->
    <div class="contents contextmenu-canvas" @contextmenu.prevent="openHomeContaxtMenu">
      <div class="container">
        <!-- Greeting Start -->
        <section class="atrio-greeting">
          <div>
            <p class="atrio-greeting-date">{{ today }}</p>
            <h1 class="atrio-greeting-title">{{ greeting }}</h1>
          </div>
          <div class="atrio-chips">
            <button
              v-if="systemLoad" :class="systemLoad.busy || systemLoad.hot ? 'is-warn' : 'is-ok'" :title="$t('Hardware details')"
              class="atrio-chip is-button" type="button" @click="$EventBus.$emit('atrio:open-hardware')"
            >
              <span class="atrio-chip-dot" />{{ systemLoad.hot ? $t('High temperature') : systemLoad.busy ? $t('High system load') : $t('System healthy') }}
            </button>
            <span v-if="appsSummary.total" class="atrio-chip">
              {{ $t('{running} of {total} apps running', appsSummary) }}
            </span>
          </div>
        </section>
        <!-- Greeting End -->
        <div class="columns is-variable is-5">
          <div class="column is-one-quarter slider-content">
            <!-- SideBar Start -->
            <SideBar v-if="!hardwareInfoLoading" />
            <!-- SideBar End -->
          </div>
          <div :class="{ open: sidebarOpen }" class="column is-three-quarters main-content">
            <!-- MainContent Start -->
            <div class=" contextmenu-canvas">

              <!-- core-service Start -->
              <section>
                <transition name="fade">
                  <CoreService />
                </transition>
              </section>
              <!-- core-service End -->

              <!-- Apps Start -->
              <section>
                <AppSection ref="apps" />
              </section>
              <!-- Apps End -->

              <!-- Shortcuts Start -->
              <!-- <section>
								<shortcuts></shortcuts>
							</section> -->
              <!-- Shortcuts End -->
            </div>
            <!-- MainContent End -->
          </div>
        </div>
      </div>
    </div>
    <!-- Content End -->

    <CommandPalette />
    <AppDetailsPanel />
    <HardwarePanel />

    <!-- File Panel Start -->
    <b-modal
      v-model="isFileActive" :can-cancel="[]" :destroy-on-hide="false" animation="zoom-in" aria-modal
      custom-class="file-panel" full-screen has-modal-card @after-enter="afterFileEnter"
    >
      <template #default="props">
        <FilePanel ref="filePanel" @close="props.close" />
      </template>
    </b-modal>
    <!-- File Panel End -->
  </div>
</template>

<style lang="scss" scoped>
.atrio-greeting {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.75rem 0.25rem 1.25rem;
    color: var(--atrio-text);

    .atrio-greeting-date {
        color: var(--atrio-text-soft);
        font-size: 0.875rem;
        font-weight: 600;
    }

    .atrio-greeting-title {
        margin-top: 0.25rem;
        font-size: 2.5rem;
        font-weight: 700;
        line-height: 1.1;
        letter-spacing: -0.03em;
    }

    @include mobile {
        .atrio-greeting-title {
            font-size: 1.75rem;
        }
    }
}

.out-container {
    position: relative;
    height: 100%;
}

.contents {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    height: calc(100% - 7rem);
}

.main-content {
    z-index: 10;

    @include until-widescreen {
        width: calc(100% - 18rem);
    }
}

.dark-bg {
    position: fixed;
    transition: all 0.3s ease;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 1);
    z-index: 19;
    opacity: 0;
    visibility: hidden;

    &.open {
        opacity: 1;
        visibility: visible;
    }
}

.slider-content {
    min-width: 18rem;
    position: relative;
    // height: calc(100vh - 6rem);
}

@media screen and (max-width: 480px) {
    .slider-content {
        position: absolute;
        width: 100%;
    }

    .contents {
        height: calc(100dvh - 44px) !important;
        padding-bottom: 1rem;
    }

    .container {
        padding-bottom: 1rem;
    }

    .columns {
        height: 100%;
    }

    .column {
        padding: 0;
        width: 100%;
        right: 0;
    }

    .main-content {
        margin-left: 0;
        transition: all 0.3s;

        &.open {
            transform: scale(0.9);
            opacity: 0;
        }
    }
}

@media screen and (max-width: $tablet) {
    .columns {
        display: flex;
    }
}
</style>
