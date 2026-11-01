<template>
	<div>
		<!-- Disk Info Start -->
		<div class="widget has-text-white disk is-relative">
			<div class="blur-background"></div>
			<div class="widget-content">
				<!-- Header Start -->
				<div class="widget-header is-flex">
					<div class="widget-title is-flex-grow-1">
						{{ $t('Storage') }}
					</div>
					<div class="widget-icon-button is-flex-shrink-0" @click="showDiskManagement">
						<b-icon icon="settings-outline" pack="casa" size="is-20"></b-icon>
					</div>
				</div>
				<!-- Header End -->
				<div class="columns is-mobile is-multiline pt-2 ">
					<div class="column is-full pb-0">
						<div class="is-flex is-align-items-center">
							<div class="header-icon">
								<b-image :src="$asset('@/assets/img/storage/storage.svg')" class="is-64x64"></b-image>
							</div>
							<div class="ml-2 is-flex-grow-1 ">
								<h4 class="title mb-1 mt-0 has-text-left one-line is-align-items-center is-flex">
									<b-tag v-if="health" type="is-success">{{ $t('Healthy') }}</b-tag>
									<b-tag v-else type="is-danger">{{ $t('Damage') }}</b-tag>
								</h4>
								<p v-if="totalSize > 0" class="has-text-left is-size-14px disk-info">
									{{ $t('Used') }}: {{ renderSize(totalUsed) }}<br>
									{{ $t('Total') }}: {{ renderSize(totalSize) }}
								</p>
								<!-- Atrio: containers (LXC) and some VMs report no disk size -->
								<p v-else class="has-text-left is-size-14px disk-info">
									{{ $t('Size not reported by CasaOS') }}
								</p>
							</div>
						</div>
						<!-- A missing value would make Buefy draw an endless animated bar: no bar instead -->
						<b-progress v-if="totalSize > 0" :type="totalPercent | getProgressType" :value="totalPercent" class="mt-2"
							size="is-small"></b-progress>
					</div>
				</div>
			</div>
		</div>
		<!-- Disk Info End -->
		<!-- Usb Disk List Start -->
		<div v-if="usbDisks.length > 0" class="widget has-text-white disk is-relative">
			<div class="blur-background"></div>
			<div class="widget-content">
				<div class="columns is-mobile is-multiline pt-2 ">
					<div v-for="(item) in usbDisks" :key="'usb_' + item.name" class="column is-full pb-0">
						<div class="is-flex">
							<div class="header-icon is-flex-shrink-0">
								<b-image :src="$asset('@/assets/img/storage/USB.svg')" class="is-64x64"></b-image>
							</div>
							<div class="ml-2 is-flex-grow-1 ">
								<h4 class="title is-size-14px mb-1 mt-0 has-text-left has-text-white one-line ">
									{{ item.model }}
								</h4>
								<p class="has-text-left is-size-14px disk-info">
									{{ $t('Used') }}: {{ renderSize(item.size - item.avail) }}<br>
									{{ $t('Total') }}: {{ renderSize(item.size) }}
								</p>
							</div>
						</div>
						<b-progress v-if="item.size > 0" :type="usedPercent(item.size, item.avail) | getProgressType"
							:value="usedPercent(item.size, item.avail)" class="mt-2"
							size="is-small"></b-progress>
					</div>
				</div>
			</div>
		</div>

		<!-- Usb Disk List End -->
	</div>
</template>

<script>
import StorageManagerPanel from '@/components/Storage/StorageManagerPanel.vue'
import { mixin } from '@/mixins/mixin';

export default {
	// eslint-disable-next-line vue/multi-word-component-names
	name: 'disks',
	icon: "storage-outline",
	title: "Storage Status",
	initShow: true,
	mixins: [mixin],

	data() {
		return {
			totalSize: 0,
			totalUsed: 0,
			totalPercent: 0,
			health: "Healthy",
			usbDisks: []
		}
	},

	mounted() {
		this.getDiskInfo(this.$store.state.hardwareInfo.sys_disk)
		this.usbDisks = this.$store.state.hardwareInfo.sys_usb || []
	},
	methods: {
		// Atrio: a size of 0 or a missing value (containers, some VMs) used to give NaN
		usedPercent(size, avail) {
			if (!(size > 0) || !Number.isFinite(avail)) return 0
			return Math.min(100, Math.max(0, 100 - Math.floor(avail * 100 / size)))
		},
		getDiskInfo(diskInfo = {}) {
			this.totalSize = Number(diskInfo.size) || 0
			this.totalUsed = Number(diskInfo.used) || 0
			this.totalPercent = this.usedPercent(this.totalSize, Number(diskInfo.avail))
			this.health = diskInfo.health
		},

		showDiskManagement() {
			this.$messageBus('widget_storagemanager');
			this.$buefy.modal.open({
				component: StorageManagerPanel,
				hasModalCard: true,
				customClass: 'storage-modal',
				trapFocus: true,
				canCancel: [],
				scroll: "keep",
				animation: "zoom-in",
			})
		},
	},
	sockets: {
		"casaos:system:utilization"(res) {
			let data = res.Properties
			// DISK
			this.getDiskInfo(JSON.parse(data.sys_disk))
			// USB
			this.usbDisks = JSON.parse(data.sys_usb) || []
		}
	}
}
</script>

<style lang="scss">
.disk {
	.progress {
		border-radius: 6px;
		height: 12px;

		&::-webkit-progress-bar {
			background: rgba(172, 184, 195, 0.4);
		}

		&::-webkit-progress-value {
			opacity: 1;
			border-radius: 6px;
		}

	}

	.disk-info {
		font-size: 0.875rem;
		line-height: 1.25rem;
		font-weight: 400;
		color: $grey-400;
	}
}
</style>

<style lang="scss" scoped>
.tag {
	font-size: 0.75rem;
	line-height: 1rem;
	font-weight: 400;
	height: 1.25rem;
	border-radius: 4px;
	padding-left: 0.375rem;
	padding-right: 0.375rem;
	border-width: 1px;
	border-style: solid;

	&.is-success {
		background-color: transparent;
		color: $green;
		border-color: $green;
	}

	&.is-danger {
		background-color: transparent;
		color: $red;
		border-color: $red;
	}

}
</style>
