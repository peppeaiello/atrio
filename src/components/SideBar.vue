<script>
import lowerFirst from 'lodash/lowerFirst'
import camelCase from 'lodash/camelCase'
import find from 'lodash/find'
import isEqual from 'lodash/isEqual'
import Settings from '@/components/widgets/Settings.vue'

const widgetsComponents = import.meta.glob('@/widgets/*.vue', { eager: true })

const widgetsConfig = 'widgets_config'

export default {
  name: 'SideBar',
  components: {
    Settings,
  },
  data() {
    return {
      isLoading: true,
      comps: [],
      apps: [],
      widgetsSettings: [],
    }
  },
  computed: {
    activeApps() {
      const showWidgets = this.widgetsSettings.filter((item) => {
        return item.show
      })
      const newArray = showWidgets.map((item) => {
        const obj = find(this.apps, (o) => {
          return o.app.name === item.name
        })
        return obj
      })
      return newArray
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
    diffAndCombineData(initData, remoteData) {
      const newData = initData.map((item) => {
        const remoteItem = find(remoteData, el => el.name === item.name)
        if (remoteItem && item.name === remoteItem.name) {
          return {
            name: item.name,
            show: (item.show === remoteItem.show) ? item.show : remoteItem.show,
          }
        }
        else {
          return {
            name: item.name,
            show: item.show,
          }
        }
      })
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
      <div v-for="(item, index) in activeApps" :key="`widgets_${index}`">
        <component :is="item.app" :class="{ 'last-block': index === activeApps.length - 1 }" />
      </div>
    </div>
    <Settings v-model="widgetsSettings" :class="{ 'mt-4': activeApps.length > 0 }" @change="handleChange" />
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

.scroll-area {
    flex: 1 1 auto;
    min-height: 0;
    padding-right: 0.25rem;
    margin-right: -0.25rem;
}
</style>
