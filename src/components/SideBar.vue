<script>
import lowerFirst from 'lodash/lowerFirst'
import camelCase from 'lodash/camelCase'
import find from 'lodash/find'
import isEqual from 'lodash/isEqual'
import WebPageWidget from '@/components/widgets/WebPageWidget.vue'
import WidgetsPanel from '@/components/widgets/WidgetsPanel.vue'

const widgetsComponents = import.meta.glob('@/widgets/*.vue', { eager: true })

const widgetsConfig = 'widgets_config'

export default {
  name: 'SideBar',
  components: {
    WidgetsPanel,
  },
  data() {
    return {
      isLoading: true,
      comps: [],
      apps: [],
      widgetsSettings: [],
      panelOpen: false,
    }
  },
  computed: {
    // Shown widgets in the saved order: built-in components, or a web page with its settings
    activeApps() {
      return this.widgetsSettings.filter(item => item.show).map((item) => {
        if (item.name === 'webpage')
          return { key: item.id, app: WebPageWidget, props: { title: item.title, url: item.url, height: item.height } }
        const obj = find(this.apps, o => o.app.name === item.name)
        return obj && { key: item.name, app: obj.app, props: {} }
      }).filter(Boolean)
    },
    // Titles and icons of the built-in widgets, for the widgets panel
    widgetsMeta() {
      return Object.fromEntries(this.apps.map(({ app }) => [app.name, { title: app.title, icon: app.icon }]))
    },
    sidebarOpen() {
      return this.$store.state.sidebarOpen
    },
    showWidgets() {
      return this.widgetsSettings.filter((item) => {
        return item.show
      })
    },
  },
  created() {
    Object.keys(widgetsComponents).forEach((fileName) => {
      const componentName = lowerFirst(
        camelCase(
          fileName
            .split('/')
            .pop()
            .replace(/\.\w+$/, ''),
        ),
      )
      this.comps.push(componentName)
      this.apps.push({ app: widgetsComponents[fileName].default })
    })
  },
  mounted() {
    this.getConfig()

    window.addEventListener('resize', this.handleResize)
    this.scroller = document.querySelector('.contents')
    this.scroller?.addEventListener('scroll', this.handleResize, { passive: true })
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.handleResize)
    this.scroller?.removeEventListener('scroll', this.handleResize)
  },

  methods: {
    /**
     * @description: Get Widgets Configs
     * @return {*} void
     */
    getConfig() {
      const initData = this.getInitData()
      this.$api.users.getCustomStorage(widgetsConfig).then((res) => {
        if (res.status === 200) {
          if (res.data === '') {
            this.saveData(initData)
            this.widgetsSettings = initData
            this.isLoading = false
            this.handleResize()
          }
          else {
            this.diffAndCombineData(initData, res.data.data)
          }
        }
      })
    },
    // Atrio: keeps the saved order and the web page widgets; built-in widgets missing from the
    // saved list (new in this version) are added at the end, unknown ones are dropped
    diffAndCombineData(initData, remoteData) {
      const remote = Array.isArray(remoteData) ? remoteData : []
      const known = name => initData.some(item => item.name === name)
      const newData = remote
        .filter(item => (item.name === 'webpage' && item.url && item.id) || known(item.name))
        .map(item => (item.name === 'webpage' ? { ...item, show: item.show !== false } : { name: item.name, show: Boolean(item.show) }))
      for (const item of initData) {
        if (!newData.some(el => el.name === item.name))
          newData.push({ name: item.name, show: item.show })
      }
      this.widgetsSettings = newData
      if (!isEqual(newData, remoteData)) {
        this.saveData(newData)
      }
      this.isLoading = false
      this.handleResize()
    },
    /**
     * @description: Get Local widgets datas
     * @return {Array} array of widgets
     */
    getInitData() {
      return this.apps.map((item) => {
        return {
          name: item.app.name,
          show: item.app.initShow,
        }
      })
    },

    /**
     * @description: Save Widgets Configs
     * @return {*} void
     */
    saveData(data) {
      this.$api.users.setCustomStorage(widgetsConfig, data).then((res) => {
        if (res.data.success === 200) {
          this.widgetsSettings = res.data.data
        }
      })
    },

    handleChange(data) {
      this.widgetsSettings = data
      this.saveData(this.widgetsSettings)
      this.handleResize()
    },

    handleResize() {
      if (this.isLoading)
        return false
      this.$nextTick(() => {
        const el = this.$refs.sidebar
        if (!el)
          return
        // On phones the column is a drawer as wide as its parent
        if (window.innerWidth <= 480) {
          el.style.width = `${document.querySelector('.slider-content').offsetWidth}px`
          el.style.maxHeight = ''
          return
        }
        el.style.width = ''
        // Fit between the column's top edge and the brand bar at the bottom of the screen
        const contentsTop = document.querySelector('.contents')?.getBoundingClientRect().top || 0
        const top = Math.max(el.getBoundingClientRect().top, contentsTop)
        el.style.maxHeight = `${window.innerHeight - top - 56}px`
      })
    },

  },
}
</script>

<template>
  <div v-if="!isLoading" ref="sidebar" :class="{ open: sidebarOpen }" class="side-bar contextmenu-canvas">
    <div class="scroll-area scrollbars contextmenu-canvas" style="overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain;">
      <div v-for="(item, index) in activeApps" :key="`widgets_${item.key}`">
        <component :is="item.app" v-bind="item.props" :class="{ 'last-block': index === activeApps.length - 1 }" />
      </div>
    </div>
    <!-- Atrio: opens the widgets panel -->
    <button :class="{ 'mt-4': activeApps.length > 0 }" class="widget atrio-widgets-open" type="button" @click="panelOpen = true">
      <span class="blur-background" />
      <span class="widget-content is-flex is-align-items-center">
        <span class="widget-title is-flex-grow-1">{{ $t('Widgets Settings') }}</span>
        <b-icon icon="right-outline" pack="casa" size="is-20" />
      </span>
    </button>
    <WidgetsPanel v-if="panelOpen" :items="widgetsSettings" :meta="widgetsMeta" @change="handleChange" @close="panelOpen = false" />
  </div>
</template>

<style lang="scss">
// The column stays in view while the page scrolls, and scrolls on its own when the widgets are taller
.side-bar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;

    @include until(480px) {
        position: fixed;
        z-index: 20;
        left: 0rem;
        width: auto;
        height: calc(var(--vh, 1vh) * 100 - 6rem);
        max-height: none;
        margin: 0 0 0 1rem !important;
        transform: translateX(-100vw);
        transition: all 0.3s ease-in-out;

        &.open {
            transform: translateX(0);
        }
    }
}

// The scrollbar (8px) and a small gap sit outside the column, so the widgets are as wide as the
// settings card below them, with or without a scrollbar
.atrio-widgets-open {
    display: block;
    width: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--atrio-text);
    font: inherit;
    text-align: left;
    cursor: pointer;

    .widget-title {
        font-weight: 600;
    }
}

.scroll-area {
    flex: 1 1 auto;
    min-height: 0;
    padding-right: 0.25rem;
    margin-right: -0.75rem;
    scrollbar-gutter: stable;
}
</style>
