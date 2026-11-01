<script>
import isNull from 'lodash/isNull'
import YAML from 'yaml'
import FileSaver from 'file-saver'
import events from '@/events/events'
import cTooltip from '@/components/basicComponents/tooltip/tooltip.vue'
import business_ShowNewAppTag from '@/mixins/app/Business_ShowNewAppTag'
import business_OpenThirdApp from '@/mixins/app/Business_OpenThirdApp'
import business_LinkApp from '@/mixins/app/Business_LinkApp'
import tipEditorModal from '@/components/Apps/TipEditorModal.vue'
import commonI18n, { ice_i18n } from '@/mixins/base/common-i18n'

// The update ring, the same size as the install one
const PULL_RADIUS = 30
const PULL_CIRCUMFERENCE = 2 * Math.PI * PULL_RADIUS

export default {
  name: 'AppCard',
  components: {
    CTooltip: cTooltip,
  },
  mixins: [business_ShowNewAppTag, business_OpenThirdApp, business_LinkApp, commonI18n],
  inject: ['homeShowFiles', 'openAppStore'],
  props: {
    item: {
      type: Object,
    },
    // Atrio: a newer image is available (from the compose app list)
    updateAvailable: {
      type: Boolean,
      default: false,
    },
    // Atrio: download progress (0-100) of an update or new settings, null when nothing is downloading
    pullProgress: {
      type: Number,
      default: null,
    },
  },
  emits: ['configApp', 'importApp', 'updateState'],
  data() {
    return {
      dropState: false,
      // Atrio: a stopped app asks what to do instead of starting on a click
      confirmStart: false,
      pullRadius: PULL_RADIUS,
      pullCircumference: PULL_CIRCUMFERENCE,
      isUninstalling: false,
      isCloning: false,
      isCheckThenUpdate: false,
      isUpdating: false,
      isRestarting: false,
      isStarting: false,
      isRebuilding: false,
      // isStoping: false,
      // Public. Only changes the state of the card, not the state of the button.
      isSaving: false,
      isActiveTooltip: false,
      dropdownPosition: 'is-bottom-right',
    }
  },

  computed: {
    title() {
      return this.i18n(this.item.title) || this.item.name
    },
    isStopped() {
      return Boolean(this.item.status) && this.item.status !== 'running' && (this.isV2App || this.isV1App)
    },
    // Atrio: the address the tile opens, so it can be a real link (middle click, copy link).
    // Empty when a click must do something else: system apps, stopped apps, first launch checks.
    tileHref() {
      const item = this.item
      if (this.isLinkApp) return item.hostname || ''
      if (!(this.isV2App || this.isV1App) || item.status !== 'running' || this.hasNewTag(item.name)) return ''
      if (!item.hostname && !item.port && !item.index) return ''
      const port = item.port ? `:${item.port}` : ''
      return `${item.scheme || 'http'}://${item.hostname || this.$baseIp}${port}${item.index || ''}`
    },
    tileLabel() {
      if (this.item.app_type === 'system' || !this.item.status) return this.$t('Open {name}', { name: this.title })
      if (this.isStopped) return this.$t('{name}, stopped', { name: this.title })
      return this.$t('Open {name}', { name: this.title })
    },
    // Quiet status: running is the normal case, only exceptions get a visible label
    isPulling() {
      return this.pullProgress !== null
    },
    pullOffset() {
      return PULL_CIRCUMFERENCE * (1 - Math.min(100, Math.max(0, this.pullProgress || 0)) / 100)
    },
    statusPill() {
      if (this.isPulling) return this.pullProgress < 100 ? `${this.$t('Downloading')} ${this.pullProgress}%` : this.$t('Updating')
      if (this.item.app_type === 'system' || !this.item.status) return ''
      if (this.isStopped) return this.$t('Stopped')
      if (this.updateAvailable) return this.$t('Update available')
      return ''
    },
    statusClass() {
      if (this.isPulling) return 'is-busy is-pill'
      if (this.item.app_type === 'system' || !this.item.status) return 'is-invisible'
      if (this.isStopped) return 'is-stopped is-pill'
      if (this.updateAvailable) return 'is-update is-pill'
      return 'is-running is-quiet'
    },
    // Long press on touch screens is for dragging: the menu opens on tap only
    menuTriggers() {
      return window.matchMedia?.('(hover: none)').matches ? ['click'] : ['contextmenu', 'click']
    },
    tooltipLabel() {
      if (this.isContainerApp) {
        return this.$t('Import to CasaOS')
      }
      else if (this.item.app_type === 'system') {
        return this.$t('Open')
      }
      else if (this.isUpdating) {
        return this.$t('Updating')
      }
      else if (this.isUninstalling) {
        return this.$t('Uninstalling')
      }
      else if (this.isCloning) {
        return this.$t('Cloning')
      }
      else if (this.isRestarting) {
        return this.$t('Restarting')
      }
      else if (this.isStarting) {
        return this.$t('Starting')
      }
      else if (this.isRebuilding) {
        return this.$t('Rebuilding')
      }
      else if (this.isCheckThenUpdate) {
        return this.$t('CheckThenUpdate')
      }
      else if (this.item.status === 'running') {
        return this.$t('Open')
      }
      else {
        return this.$t('launch-and-open')
      }
    },
    tooltipTriger() {
      return ['hover']
      // if (this.isContainerApp || this.item.app_type === "system" || this.item.status === 'running') {
      //  eturn ['hover'];
      // } else {
      //  return [];
      // }
    },
    isLoading() {
      const active = this.isUninstalling || this.isUpdating || this.isRestarting || this.isStarting || this.isSaving || this.isRebuilding // || this.isStoping || this.isSaving
      return active
    },
    isV1App() {
      return this.item.app_type === 'v1app'
    },
    isV2App() {
      return this.item.app_type === 'v2app'
    },
    isContainerApp() {
      return this.item.app_type === 'container'
    },
    isLinkApp() {
      return this.item.app_type === 'LinkApp'
    },
    shutDownClass() {
      return this.item.status !== 'running' ? 'shutdown-rounded' : ''
    },

  },

  watch: {
    isLoading(active) {
      // design :: The first display is three seconds long
      if (this.isCheckThenUpdate && this.activeTimer === undefined) {
        this.activeTimer = setTimeout(() => {
          this.isActiveTooltip = false
          clearTimeout(this.activeTimer)
          this.activeTimer = undefined
        }, 3000)
        this.isActiveTooltip = true
      }
      else if (active === false && this.isCheckThenUpdate === false && this.activeTimer) {
        clearInterval(this.activeTimer)
        this.activeTimer = undefined
        this.isActiveTooltip = false
      }
    },
  },

  beforeUnmount() {
    document.removeEventListener('pointerdown', this.onOutsideConfirm, true)
  },
  methods: {
    handleDorpdownPosition(event) {
      this.$nextTick(() => {
        const rightOffset = window.innerWidth - event.clientX - 160
        const horizontalPos = rightOffset > 0 ? 'right' : 'left'
        const bottomOffset = window.innerHeight - event.clientY - 212
        const verticalPos = bottomOffset > 0 ? 'bottom' : 'top'
        this.dropdownPosition = `is-${verticalPos}-${horizontalPos}`
      })
    },
    // Atrio: the tile link opens the app in a new tab by itself; keep CasaOS's bookkeeping
    onTileLink() {
      this.$messageBus('apps_open', this.item.name)
      if (this.isLinkApp) this.removeIdFromSessionStorage(this.item.name)
    },
    onTileClick() {
      if (this.isStopped) {
        this.confirmStart = true
        this.$nextTick(() => this.$refs.startButton?.focus())
        document.addEventListener('pointerdown', this.onOutsideConfirm, true)
        return
      }
      this.openApp(this.item)
    },
    onOutsideConfirm(event) {
      if (!this.$el.contains(event.target)) this.closeConfirm()
    },
    closeConfirm() {
      this.confirmStart = false
      document.removeEventListener('pointerdown', this.onOutsideConfirm, true)
    },
    startFromTile(open) {
      this.closeConfirm()
      if (open) this.openApp(this.item)
      else this.toggle(this.item)
    },
    detailsFromTile() {
      this.closeConfirm()
      this.openDetails()
    },
    /**
     * @description: Open app in new windows
     * @param {string} status App status
     * @param {string} port App access port
     * @param {string} index App access index
     * @return {*} void
     */
    openApp(item) {
      if (this.isContainerApp) {
        this.$emit('importApp', item, false)
        return false
      }
      if (item.app_type === 'system') {
        this.openSystemApps(item)
      }
      else if (this.isLinkApp) {
        window.open(item.hostname, '_blank')
        this.removeIdFromSessionStorage(item.name)
      }
      else {
        // type is one of 'official' or 'community'.
        this.$refs.dro.isActive = false
        if (item.status === 'running') {
          this.openAppToNewWindow(item)
        }
        else {
          this.toggle(item)
          this.firstOpenThirdApp(item)
        }
      }
    },

    openSystemApps(item) {
      switch (item.name) {
        case 'App Store':
          this.openAppStore()
          break
        case 'Files':
          this.homeShowFiles()
          break
        default:
          break
      }
    },

    /**
     * @description: Set drop-down menu status
     * @param {boolean} e
     * @return {*} void
     */
    setDropState(e) {
      this.dropState = e
    },

    /**
     * @description: Restart Application
     * @return {*} void
     */
    restartApp() {
      this.$messageBus('apps_restart', this.item.name)
      this.isRestarting = true
      if (this.isV2App) {
        this.restartAppV2()
      }
      else if (this.isV1App) {
        this.restartAppV1()
      }
      this.$refs.dro.isActive = false
    },

    restartAppV1() {
      this.$api.container.updateState(this.item.name, 'restart').then((res) => {
        if (res.data.success === 200) {
          this.updateState()
        }
      }).catch((err) => {
        this.$buefy.toast.open({
          message: err.response?.data?.data || err.response?.data?.message,
          type: 'is-danger',
          position: 'is-top',
          duration: 5000,
        })
      }).finally(() => {
        this.isRestarting = false
      })
    },

    restartAppV2() {
      this.$openAPI.appManagement.compose.setComposeAppStatus(this.item.name, 'restart').then(() => {
        this.updateState()
      }).catch((err) => {
        this.$buefy.toast.open({
          message: err.response?.data?.data || err.response?.data?.message,
          type: 'is-danger',
          position: 'is-top',
          duration: 5000,
        })
      })
    },

    /**
     * @description: Confirm before uninstall
     * @return {*} void
     */
    uninstallConfirm() {
      this.$messageBus('apps_uninstall', this.item.name)
      this.$refs.dro.isActive = false
      this.$buefy.dialog.confirm({
        title: this.$t('Attention'),
        message: this.$t(`Data cannot be recovered after deletion! <br/>Continue on to uninstall this application?<br/>{divS}Delete userdata ( config folder ){divE}`, {
          divS: `<div class="is-flex is-align-items-center mt-4"><input type="checkbox"  id="checkDelConfig">`,
          divE: `</input></div>`,
        }),
        type: 'is-dark',
        confirmText: this.$t('Uninstall'),
        cancelText: this.$t('Cancel'),
        onConfirm: () => {
          const checkDelConfig = document.getElementById('checkDelConfig') ? document.getElementById('checkDelConfig').checked : false
          this.uninstallApp(checkDelConfig)
        },
      })
    },

    /**
     * @description: Uninstall app
     * @return {*} void
     */
    uninstallApp(checkDelConfig) {
      this.isUninstalling = true
      this.removeIdFromSessionStorage(this.item.name)
      if (this.isLinkApp) {
        this.deleteLinkAppByName(this.item.name).then((res) => {
          if (res.data.success === 200) {
            this.$EventBus.$emit(events.RELOAD_APP_LIST)
          }
        })
      }
      else if (this.isV2App) {
        this.$openAPI.appManagement.compose.uninstallComposeApp(this.item.name, checkDelConfig).then((res) => {
          if (res.status === 200) {
            this.$EventBus.$emit(events.UPDATE_SYNC_STATUS)
          }
        }).catch((err) => {
          this.$buefy.toast.open({
            message: err.response?.data?.data,
            type: 'is-danger',
            position: 'is-top',
            duration: 5000,
          })
        })
      }
      else {
        // former app uninstall
        this.$api.container.uninstall(this.item.name, { delete_config_folder: checkDelConfig }).then((res) => {
          if (res.data.success === 200) {
            this.$EventBus.$emit(events.UPDATE_SYNC_STATUS)
          }
        }).catch((err) => {
          this.$buefy.toast.open({
            message: err.response?.data?.data,
            type: 'is-danger',
            position: 'is-top',
            duration: 5000,
          })
        })
      }
    },

    /**
     * @description: Emit the event that the app has been updated
     * @return {*} void
     */
    updateState() {
      this.$refs.dro.isActive = false
      this.$emit('updateState')
      this.$EventBus.$emit(events.UPDATE_SYNC_STATUS)
    },

    async openTips(name) {
      try {
        const ret = await this.$openAPI.appManagement.compose.myComposeApp(name, {
          headers: {
            'content-type': 'application/yaml',
            'accept': 'application/yaml',
          },
        }).then(res => res.data)
        this.$refs.dro.isActive = false
        this.$buefy.modal.open({
          component: tipEditorModal,
          hasModalCard: true,
          customClass: 'network-storage-modal',
          trapFocus: true,
          canCancel: [],
          // scroll: "keep",
          animation: 'zoom-in',
          props: {
            composeData: YAML.parse(ret),
            name,
          },
        })
      }
      catch (e) {
        console.error('openTips Error:', e)
      }
    },

    /**
     * @description: Emit the event that the app has been updated with custom_id
     * @return {*} void
     */
    openDetails() {
      this.$refs.dro.isActive = false
      this.$EventBus.$emit('atrio:open-app', this.item)
    },

    configApp() {
      this.$messageBus('apps_setting', this.item.name)
      this.$refs.dro.isActive = false
      this.$emit('configApp', this.item, this.isV2App)
    },

    /**
     * @description: Start or Stop App
     * @param {object} item the app info object
     * @return {*} void
     */
    toggle(item) {
      // only have 'apps_stop' event
      this.$messageBus('apps_stop', item.name)
      this.isStarting = true
      const status = item.status === 'running' ? 'stop' : 'start'
      if (this.isV2App) {
        this.toggleAppV2(item, status)
      }
      else if (this.isV1App) {
        this.toggleAppV1(item, status)
      }
      this.$refs.dro.isActive = false
    },

    toggleAppV1(item, status) {
      this.$api.container.updateState(item.name, status).then((res) => {
        if (res.data.success === 200) {
          item.status = res.data.data
          this.updateState()
        }
        else {
          this.$buefy.dialog.alert({
            title: 'Error',
            message: res.data.data || res.data.message,
            type: 'is-danger',
            ariaRole: 'alertdialog',
            ariaModal: true,
          })
        }
      }).catch((err) => {
        this.$buefy.toast.open({
          message: err.response?.data?.data || err.response?.data?.message,
          type: 'is-danger',
          position: 'is-top',
          duration: 3000,
        })
      }).finally(() => {
        this.isStarting = false
      })
    },

    toggleAppV2(item, status) {
      this.$openAPI.appManagement.compose.setComposeAppStatus(item.name, status).then(() => {
        this.updateState()
        item.status = status
      }).catch((err) => {
        this.$buefy.dialog.alert({
          title: 'Error',
          message: err.response?.data?.data || err.response?.data?.message,
          type: 'is-danger',
          ariaRole: 'alertdialog',
          ariaModal: true,
        })
      })
    },

    appClone(name) {
      this.isCloning = true
      this.$api.apps.getAppInfo(name).then((resp) => {
        if (resp.data.success === 200) {
          const respData = resp.data.data
          // messageBus :: apps_clone
          this.$messageBus('apps_clone', this.item.name.toString())

          const initData = {}
          initData.protocol = respData.protocol
          initData.host = respData.host
          initData.port_map = respData.port_map
          initData.cpu_shares = 50
          initData.memory = respData.max_memory
          initData.restart = 'always'
          initData.label = respData.title
          initData.position = true
          initData.index = respData.index
          initData.icon = respData.icon
          initData.network_model = respData.network_model
          initData.image = respData.image
          initData.description = respData.description
          initData.origin = respData.origin
          initData.ports = isNull(respData.ports) ? [] : respData.ports
          initData.volumes = isNull(respData.volumes) ? [] : respData.volumes
          initData.envs = isNull(respData.envs) ? [] : respData.envs
          initData.devices = isNull(respData.devices) ? [] : respData.devices
          initData.cap_add = isNull(respData.cap_add) ? [] : respData.cap_add
          initData.cmd = isNull(respData.cmd) ? [] : respData.cmd
          initData.privileged = respData.privileged
          initData.host_name = respData.host_name
          initData.appstore_id = name

          this.$api.container.install(initData).catch((err) => {
            this.$buefy.toast.open({
              message: err.response?.data?.message,
              type: 'is-warning',
            })
          }).then(() => {
            this.isCloning = false
            this.$refs.dro.isActive = false
          })
        }
      }).catch(() => {
        this.$buefy.toast.open({
          message: this.$t(`There was an error loading the data, please try again!`),
          type: 'is-danger',
        })
      })
    },

    exportYAML(item) {
      this.$api.container.exportAsCompose(item.name).then((res) => {
        const blob = new Blob([res.data], { type: '' })
        FileSaver.saveAs(blob, `${item.image}.yaml`)
      }).catch((err) => {
        this.$buefy.toast.open({
          message: err.response?.data?.message,
          type: 'is-warning',
        })
      })
    },

    async rebuild(app) {
      this.isRebuilding = true
      try {
        // 1. get yaml
        const file = await this.$api.container.exportAsCompose(app.name).then(res => res.data)
        // 2. archive
        await this.$api.container.archive(app.name)
        // 3.install compose
        await this.$openAPI.appManagement.compose.installComposeApp(file, { name: app.name })
      }
      catch (e) {
        this.isRebuilding = false
        console.error('rebuild Error:', e)
        this.$buefy.toast.open({
          message: this.$t(`Rebulid error`),
          type: 'is-danger',
        })
      }
      // 4.sockiet :: install-end :: change UI status.
      // this.isRebuilding = false;
      this.$refs.dro.isActive = false
    },

    checkAppVersion(name) {
      this.isCheckThenUpdate = true
      this.$openAPI.appManagement.compose.updateComposeApp(name).then((resp) => {
        // 200:
        if (resp.status === 200) {
          // messageBus :: apps_checkThenUpdate
          this.$messageBus('apps_checkupdate', this.item.name.toString())
          this.$buefy.toast.open({
            // value is `In the process of asynchronous updating.` or `compose app `app Name` is up to date`
            message: resp.data.message,
            type: 'is-success',
          })
        }
        else {
          this.$buefy.toast.open({
            message: this.$t(`No updates are currently available for the application.`),
            type: 'is-success',
          })
        }
      }).catch(() => {
        this.$buefy.toast.open({
          message: this.$t(`Unable to update at the moment!`),
          type: 'is-danger',
        })
      }).finally(() => {
        this.$refs.dro.isActive = false
        this.isCheckThenUpdate = false
      })
    },
    /**
     * @description: Format Dot Class
     * @param {string} status
     * @return {string}
     */
    dotClass(status, loadState) {
      // For updating
      if (loadState) {
        if (status === '0' || status === 'running') {
          return 'disabled start'
        }
        return 'disabled stop'
      }
      if (status === '0') {
        return 'start'
      }
      else {
        return status === 'running' ? 'start' : 'stop'
      }
    },

  },

  sockets: {
    'app:start-error': function (res) {
      // toast info.
      this.$buefy.toast.open({
        message: res.Properties.message,
        duration: 5000,
        type: 'is-danger',
      })
    },
    'app:start-end': function (res) {
      if (res.Properties['app:name'] === this.item.name) {
        this.isRestarting = false
        this.isStarting = false
      }
    },
    'app:stop-error': function (res) {
      // toast info.
      this.$buefy.toast.open({
        message: res.Properties.message,
        duration: 5000,
        type: 'is-danger',
      })
    },
    'app:stop-end': function (res) {
      if (res.Properties['app:name'] === this.item.name) {
        this.isRestarting = false
        this.isStarting = false
      }
    },
    'app:restart-error': function (res) {
      // toast info.
      this.$buefy.toast.open({
        message: res.Properties.message,
        duration: 5000,
        type: 'is-danger',
      })
    },
    'app:restart-end': function (res) {
      if (res.Properties['app:name'] === this.item.name) {
        this.isRestarting = false
        this.isStarting = false
      }
    },
    'app:apply-changes-begin': function (res) {
      if (res.Properties['app:name'] === this.item.name) {
        this.isSaving = true
      }
    },
    'app:apply-changes-error': function (res) {
      // toast info.
      this.$buefy.toast.open({
        message: res.Properties.message,
        duration: 5000,
        type: 'is-danger',
      })
    },
    'app:apply-changes-end': function (res) {
      if (res.Properties['app:name'] === this.item.name) {
        this.isRestarting = false
        this.isStarting = false
        this.isSaving = false
      }
    },
    /**
     * @description: Update App Status
     * @param {object} data
     * @return {void}
     */
    'app:update-begin': function () {

    },

    'docker:image:pull-end': function (data) {
      if (data.Properties['app:name'] === this.item.name) {
        if (data.Properties['docker:image:updated'] === 'true') {
          this.isUpdating = true
        }
        this.isCheckThenUpdate = false
      }
    },

    'docker:image:pull-error': function (data) {
      if (data.Properties['app:name'] === this.item.name) {
        this.isCheckThenUpdate = false
      }
    },

    /**
     * @description: Update App Version
     * @param {object} data
     * @return {void}
     */
    'app:update-end': function (data) {
      if (data.Properties['app:name'] !== this.item.name)
        return
      if (data.Properties['docker:image:updated'] === 'true') {
        return
      }
      this.isUpdating = false
      this.$buefy.toast.open({
        message: this.$t(`{appName} is the latest version!`, { appName: this.item.name }),
        type: 'is-success',
        duration: 5000,
      })
    },
    'app:install-end': function (res) {
      if (res.Properties['dry_run.name'] === this.item.name) {
        // 4.sockiet :: install-end :: change UI status.
        this.isRebuilding = false
        // 5.message toast
        this.$buefy.toast.open({
          message: this.$t(`{title} rebulid completed`, { title: ice_i18n(this.item.title) }),
          type: 'is-success',
        })
      }
    },
    'app:install-error': function (res) {
      if (res.Properties['dry_run.name'] === this.item.name) {
        // 4.sockiet :: install-end :: change UI status.
        this.isRebuilding = false
        // 5.message toast
        this.$buefy.toast.open({
          message: res.Properties.message,
          type: 'is-warning',
        })
      }
    },
    'app:uninstall-error': function (res) {
      if (res.Properties.id === this.item.name) {
        this.isUninstalling = false
      }
    },
  },

}
</script>

<template>
  <div
    :class="{ 'has-update': updateAvailable, 'is-confirming': confirmStart }"
    class="common-card is-flex is-align-items-center is-justify-content-center  app-card"
  >
    <!-- Atrio: the whole tile opens the app. A real link where there is an address, so middle click,
         Ctrl click and copy link work; a button otherwise (system apps, stopped apps, first launch) -->
    <a
      v-if="tileHref" :aria-label="tileLabel" :href="tileHref" class="atrio-tile-hit" draggable="false"
      rel="noopener noreferrer" target="_blank" @click="onTileLink"
    />
    <button v-else :aria-label="tileLabel" class="atrio-tile-hit" type="button" @click="onTileClick" />

    <!-- Atrio: a stopped app asks before starting -->
    <div v-if="confirmStart" :aria-label="tileLabel" class="atrio-tile-confirm" role="group" @keydown.esc.stop="closeConfirm">
      <button ref="startButton" class="atrio-tile-confirm-main" type="button" @click="startFromTile(true)">
        {{ $t('Start and open') }}
      </button>
      <button type="button" @click="startFromTile(false)">
        {{ $t('Start') }}
      </button>
      <button v-if="isV2App" type="button" @click="detailsFromTile">
        {{ $t('Details') }}
      </button>
      <button :aria-label="$t('Close')" class="atrio-tile-confirm-close" type="button" @click="closeConfirm">
        <b-icon icon="close-outline" pack="casa" size="is-16" />
      </button>
    </div>

    <!-- Action Button Start -->
    <div v-if="item.app_type !== 'system' && !isContainerApp && !isUninstalling" class="action-btn">
      <b-dropdown
        ref="dro" :mobile-modal="false" :triggers="menuTriggers" animation="fade1"
        append-to-body aria-role="list" class="app-card-drop" :position="dropdownPosition"
        @active-change="setDropState"
      >
        <template #trigger>
          <button :aria-label="$t('Actions for {name}', { name: title })" class="atrio-card-menu" type="button" @click="handleDorpdownPosition">
            <b-icon icon="dots-vertical-outline" pack="casa" />
          </button>
        </template>

        <b-dropdown-item :focusable="false" aria-role="menu-item" class="atrio-app-menu" custom>
          <!-- Atrio: open and details first, then state, maintenance, and removal last -->
          <b-button v-if="!isLinkApp" expanded tag="a" type="is-text" @click="openApp(item)">
            {{ item.status === 'running' ? $t('Open') : $t('Start and open') }}
          </b-button>
          <b-button v-else expanded tag="a" type="is-text" @click="openApp(item)">
            {{ $t('Open') }}
          </b-button>
          <b-button v-if="isV2App" expanded type="is-text" @click="openDetails()">
            {{ $t('Details') }}
          </b-button>

          <template v-if="!isLinkApp">
            <hr class="atrio-menu-sep">
            <b-button :loading="isStarting" expanded type="is-text" @click="toggle(item)">
              {{ item.status === 'running' ? $t('Stop') : $t('Start') }}
            </b-button>
            <b-button :disabled="item.status !== 'running'" :loading="isRestarting" expanded type="is-text" @click="restartApp">
              {{ $t('Restart') }}
            </b-button>
          </template>

          <b-button v-if="isV2App && !item.is_uncontrolled" expanded type="is-text" @click="checkAppVersion(item.name)">
            {{ updateAvailable ? $t('Update now') : $t('Check then update') }}
            <b-loading :model-value="isCheckThenUpdate || isUpdating" :is-full-page="false">
              <img :src="$asset('@/assets/img/loading/waiting.svg')" alt="pending" class="ml-4 is-24x24">
            </b-loading>
          </b-button>
          <b-button v-if="isV2App || isLinkApp" expanded type="is-text" @click="configApp()">
            {{ $t('Setting') }}
          </b-button>
          <b-button v-if="isV2App" expanded type="is-text" @click="openTips(item.name)">
            {{ $t('Tips') }}
          </b-button>

          <b-button v-if="isV1App" expanded type="is-text" @click="exportYAML(item)">
            {{ $t('Export as Compose') }}
          </b-button>
          <b-button v-if="isV1App" :loading="isRebuilding" expanded type="is-text" @click="rebuild(item)">
            {{ $t('Rebuild') }}
          </b-button>

          <hr class="atrio-menu-sep">
          <b-button v-if="isLinkApp" class="has-text-red" expanded type="is-text" @click="uninstallApp(true)">
            {{ $t('Delete') }}
            <b-loading v-model="isUninstalling" :is-full-page="false">
              <img :src="$asset('@/assets/img/loading/waiting.svg')" alt="pending" class="ml-4 is-24x24">
            </b-loading>
          </b-button>
          <b-button v-else class="has-text-red" expanded type="is-text" @click="uninstallConfirm">
            {{ $t('Uninstall') }}
            <b-loading v-model="isUninstalling" :is-full-page="false">
              <img :src="$asset('@/assets/img/loading/waiting.svg')" alt="pending" class="ml-4 is-24x24">
            </b-loading>
          </b-button>
        </b-dropdown-item>
      </b-dropdown>
    </div>
    <!-- Action Button End -->
    <div class="blur-background" />
    <div class="cards-content">
      <!-- Card Content Start -->
      <b-tooltip
        :always="isActiveTooltip" :animated="true" :label="tooltipLabel" :triggers="tooltipTriger"
        animation="fade1" class="in-card" type="is-dark"
      >
        <div class="has-text-centered is-flex is-justify-content-center is-flex-direction-column pt-5 pb-3px img-c">
          <div class="is-flex is-justify-content-center">
            <div class="is-relative">
              <b-image
                :class="dotClass(item.status, isLoading)" :src="item.icon"
                :src-fallback="$asset('@/assets/img/app/default.svg')" class="is-64x64"
                webp-fallback=".jpg"
              />
              <!-- Atrio: running is shown by a small round dot on the icon; the label is for screen readers -->
              <span v-if="statusClass.includes('is-running')" aria-hidden="true" class="atrio-icon-dot" />
              <!-- Atrio: download of an update, with the same ring as an install -->
              <div
                v-if="isPulling" :aria-label="`${title}: ${statusPill}`" :aria-valuenow="pullProgress < 100 ? pullProgress : undefined"
                :class="{ 'is-restarting': pullProgress >= 100 }" aria-valuemax="100" aria-valuemin="0" class="atrio-pull-ring" role="progressbar"
              >
                <svg aria-hidden="true" viewBox="0 0 72 72">
                  <circle :r="pullRadius" class="atrio-installing-track" cx="36" cy="36" />
                  <circle
                    :r="pullRadius" :stroke-dasharray="pullCircumference" :stroke-dashoffset="pullProgress < 100 ? pullOffset : pullCircumference * 0.72"
                    class="atrio-installing-ring" cx="36" cy="36"
                  />
                </svg>
                <span v-if="pullProgress > 0 && pullProgress < 100" class="atrio-installing-percent">{{ pullProgress }}%</span>
                <!-- Download done: the container is being recreated -->
                <b-icon v-else-if="pullProgress >= 100" class="atrio-pull-restart" custom-size="mdi-24px" icon="restart" pack="mdi" />
              </div>
              <!-- Unstable -->
              <CTooltip v-if="newAppIds.includes(item.name)" class="__position" content="NEW" />
            </div>

            <!-- Loading Bar Start -->
            <b-loading
              :model-value="isLoading && !isPulling" :can-cancel="false" :is-full-page="false"
              class="has-background-gray-800 op80 is-64x64"
              style="top: auto;bottom: auto; right: auto; left: auto; border-radius: 11.5px"
            >
              <img :src="$asset('@/assets/img/loading/waiting-white.svg')" alt="loading" class="is-20x20">
            </b-loading>
            <!-- Loading Bar End -->
          </div>

          <p class="mt-3 one-line">
            <span class="one-line atrio-app-name">
              {{ i18n(item.title) }}
            </span>
          </p>
          <!-- Atrio: quiet status. Only exceptions (stopped, update available) get a visible label -->
          <p :class="statusClass" class="atrio-app-status">
            <template v-if="statusPill">
              <span class="atrio-app-dot" />{{ statusPill }}
            </template>
            <span v-else class="is-sr-only">{{ $t('Running') }}</span>
          </p>
        </div>
      </b-tooltip>
      <!-- Card Content End -->
    </div>
  </div>
</template>

<style lang="scss">
.pb-3px {
  padding-bottom: 3px;
}

.shutdown-rounded {
  border-radius: 50%;
  background-color: #000;
  color: #fff;
}

// Atrio: the app menu in the glass style, labels left aligned. The menu is moved to the end of the
// page (append-to-body) without the tile's classes, so it is found by its own content.
.dropdown-menu:has(.atrio-app-menu) {
  min-width: 12rem;
}

.dropdown-content:has(.atrio-app-menu) {
  padding: 0.375rem !important;
  border-radius: 0.875rem;
  background: linear-gradient(var(--atrio-glass-bg-strong), var(--atrio-glass-bg-strong)), #0b1222;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1), 0 16px 40px rgba(0, 0, 0, 0.45);
}

.dropdown-item.atrio-app-menu {
  padding: 0;
  background: transparent;

  .button.is-text {
    justify-content: flex-start;
    width: 100%;
    height: 2.25rem;
    padding: 0 0.875rem;
    border: 0 !important;
    border-radius: 0.5rem;
    background: transparent;
    color: var(--atrio-text);
    font-size: 0.875rem;
    font-weight: 600;
    text-decoration: none;

    > span {
      line-height: 1.25rem;
      text-align: left;
    }

    &:hover:not([disabled]) {
      background: rgba(255, 255, 255, 0.1);
    }

    &:focus {
      box-shadow: none;
    }

    &:focus-visible {
      outline: 2px solid var(--atrio-accent);
      outline-offset: -2px;
    }

    &[disabled] {
      opacity: 0.4;
    }

    &.has-text-red {
      color: #fca5a5 !important;

      &:hover {
        background: rgba(248, 113, 113, 0.14);
      }
    }

    &.is-loading::after {
      border-color: transparent transparent var(--atrio-text) var(--atrio-text) !important;
    }
  }

  .atrio-menu-sep {
    height: 1px;
    margin: 0.25rem 0.375rem;
    border: 0;
    background: rgba(255, 255, 255, 0.1);
  }

  .loading-overlay.is-active {
    justify-content: flex-start;
    border-radius: 0.5rem;
    background: rgba(11, 18, 34, 0.9) !important;

    .loading-background {
      background: none;
    }
  }

  .is-24x24 {
    width: 1.5rem;
    height: 1.5rem;
  }
}

.in-card.b-tooltip {
  &.is-top .tooltip-content {
    bottom: auto;
    top: -15%;
  }

  .tooltip-content {
    box-shadow: none;
    padding: 0.375rem 0.75rem;
    border-radius: 0.5rem;
    font-family: $family-sans-serif;
    font-style: normal;
    line-height: 1.25rem;
    font-feature-settings: 'pnum' on, 'lnum' on;

  }

}

.__position {
  position: absolute !important;
  top: -0.75rem !important;
  left: 3rem !important;
  z-index: 30;
}

// 0.4.4
.dropdown.is-right .dropdown-menu {
  top: 0;
  left: calc(100% + 6px);
}

.dropdown.is-left .dropdown-menu {
  top: 0;
  left: calc(-100% - 14px);
}
</style>

<style lang="scss">
.dialog {
  .modal-card-head {
    padding-left: 1.5rem;
    padding-top: 1.5rem;
    padding-bottom: 0.75rem;
    border: 1px solid hsla(208, 16%, 94%, 1);
  }

  .modal-card-body {
    padding: 1rem 1.5rem 1.5rem;

    #checkDelConfig {
      margin-right: 0.5rem;
      height: 1.25rem;
      width: 1.25rem;
    }

    border: 1px solid hsla(208, 16%, 94%, 1);
  }

  .modal-card-foot {
    padding-top: 0.75rem;
    padding-bottom: 1.5rem;
    padding-right: 1.5rem;

    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    letter-spacing: 0;
    text-align: left;

    .button {
      margin-right: 0;
    }

    .is-dark {
      margin-left: 1rem;
      background: hsla(208, 100%, 45%, 1);
    }
  }
}

// Atrio: the whole tile answers the click; the menu and the confirm sit above it
.app-card {
	.atrio-tile-hit {
		position: absolute;
		inset: 0;
		z-index: 3;
		padding: 0;
		border: 0;
		border-radius: inherit;
		background: transparent;
		cursor: pointer;

		&:focus-visible {
			outline: 2px solid var(--atrio-accent);
			outline-offset: 2px;
		}
	}

	// The menu button: faint until the tile is hovered or focused, always there on touch screens
	.action-btn {
		top: 0.5rem;
		right: 0.5rem;
		z-index: 20;
		visibility: visible;
		opacity: 0;
	}

	&:hover .action-btn,
	&:focus-within .action-btn {
		opacity: 1;
	}

	@media (hover: none) {
		.action-btn {
			opacity: 0.85;
		}
	}

	.atrio-app-name {
		color: var(--atrio-text);
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.55);
	}

	// Icon, name and status sit above the hit area: let clicks through to it
	.cards-content {
		pointer-events: none;
	}
}

.atrio-card-menu {
	display: grid;
	place-items: center;
	width: 2.5rem;
	height: 2.5rem;
	padding: 0;
	border: 0;
	border-radius: 0.75rem;
	background: transparent;
	color: var(--atrio-text);
	cursor: pointer;

	&:hover,
	&:focus-visible {
		background: rgba(255, 255, 255, 0.12);
	}

	&:focus-visible {
		outline: 2px solid var(--atrio-accent);
		outline-offset: 1px;
	}
}

// Running: a small round dot on the icon instead of a label on every tile
.atrio-pull-ring {
	position: absolute;
	inset: 0;
	display: grid;
	place-items: center;
	border-radius: 11.5px;
	background: rgba(2, 6, 23, 0.55);
	pointer-events: none;

	svg {
		position: absolute;
		inset: -0.5rem;
		width: 5rem;
		height: 5rem;
		transform: rotate(-90deg);
	}

	circle {
		fill: none;
		stroke-width: 3.5;
	}

	// An arc going round until the app is back
	&.is-restarting svg {
		animation: atrio-pull-spin 1.1s linear infinite;
	}
}

.atrio-pull-restart {
	color: #fff;
	filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.6));
}

@keyframes atrio-pull-spin {
	from {
		transform: rotate(-90deg);
	}

	to {
		transform: rotate(270deg);
	}
}

@media (prefers-reduced-motion: reduce) {
	.atrio-pull-ring.is-restarting svg {
		animation: none;
	}
}

.atrio-icon-dot {
	position: absolute;
	right: -0.25rem;
	bottom: -0.25rem;
	width: 0.75rem;
	height: 0.75rem;
	border-radius: 50%;
	background: var(--atrio-ok);
	box-shadow: 0 0 0 2px rgba(11, 18, 34, 0.9);
}

.atrio-tile-confirm {
	position: absolute;
	inset: 0;
	z-index: 25;
	display: flex;
	flex-direction: column;
	gap: 0.375rem;
	align-items: stretch;
	justify-content: center;
	padding: 0.875rem;
	border-radius: inherit;
	background: rgba(11, 18, 34, 0.92);
	backdrop-filter: blur(8px);

	button {
		height: 2.25rem;
		padding: 0 0.75rem;
		border: 0;
		border-radius: 0.625rem;
		background: rgba(255, 255, 255, 0.08);
		color: var(--atrio-text);
		font: inherit;
		font-size: 0.8125rem;
		font-weight: 600;
		cursor: pointer;

		&:hover {
			background: rgba(255, 255, 255, 0.16);
		}

		&:focus-visible {
			outline: 2px solid var(--atrio-accent);
			outline-offset: 1px;
		}
	}

	.atrio-tile-confirm-main {
		background: var(--atrio-text);
		color: #0b1120;
		font-weight: 700;

		&:hover {
			background: #e2e8f0;
		}
	}

	.atrio-tile-confirm-close {
		position: absolute;
		top: 0.375rem;
		right: 0.375rem;
		display: grid;
		place-items: center;
		width: 1.75rem;
		height: 1.75rem !important;
		padding: 0 !important;
		background: transparent !important;
	}
}

.atrio-app-status {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 0.375rem;
	margin-top: 0.125rem;
	font-size: 0.75rem;
	font-weight: 600;

	.atrio-app-dot {
		width: 0.5rem;
		height: 0.5rem;
	}

	&.is-running {
		color: var(--atrio-ok-text);

		.atrio-app-dot {
			border-radius: 50%;
			background: var(--atrio-ok);
		}
	}

	&.is-stopped {
		color: var(--atrio-warn-text);

		.atrio-app-dot {
			border-radius: 2px;
			background: var(--atrio-warn);
		}
	}

	&.is-update {
		color: #a5f3fc;

		.atrio-app-dot {
			width: 0;
			height: 0;
			border-right: 0.3rem solid transparent;
			border-bottom: 0.45rem solid var(--atrio-accent);
			border-left: 0.3rem solid transparent;
			background: none;
		}
	}

	&.is-busy {
		color: #a5f3fc;

		.atrio-app-dot {
			border-radius: 50%;
			background: var(--atrio-accent);
		}
	}

	// Exceptions on their own dark pill: readable on any wallpaper
	&.is-pill {
		padding: 0.125rem 0.5rem;
		border-radius: 999px;
		background: rgba(2, 6, 23, 0.6);
	}

	// Keeps the row height so names line up
	&.is-quiet {
		min-height: 1.25rem;
	}
}
</style>
