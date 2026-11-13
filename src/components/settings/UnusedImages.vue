<script>
// Unused app images, in the Storage section of the settings: CasaOS keeps the old image after each
// update and after an uninstall. atrio-backup lists the ones no container and no installed app uses,
// and removes them when asked (see plugins/appBackup.js).
import { renderSize } from '@/mixins/file_utils'
import { backupRun, backupsInstalled, escapeHtml, removeImages, scanImages } from '@/plugins/appBackup'

export default {
	name: 'UnusedImages',
	compatConfig: { MODE: 3 },
	data() {
		return {
			installed: null,
			list: null,
			open: false,
			working: false,
			error: '',
			run: backupRun,
		}
	},
	computed: {
		images() {
			return [...(this.list?.images || [])].sort((a, b) => b.size - a.size)
		},
		total() {
			return this.list?.total || 0
		},
		busy() {
			return this.working || Boolean(this.run.app)
		},
	},
	async mounted() {
		this.installed = await backupsInstalled()
		if (this.installed) this.scan()
	},
	methods: {
		renderSize,
		message(e) {
			return e.message === 'Unknown request'
				? this.$t('This needs the latest version of the service on the server. Run the install command once more.')
				: this.$t(e.message)
		},
		async scan() {
			this.working = true
			this.error = ''
			try {
				this.list = await scanImages()
			}
			catch (e) {
				this.error = this.message(e)
			}
			finally {
				this.working = false
			}
		},
		name(image) {
			return image.tags ? image.tags.split(' ')[0] : this.$t('Image without a name')
		},
		age(image) {
			const date = new Date(image.created)
			return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(this.$i18n.locale?.replace('_', '-'), { dateStyle: 'medium' })
		},
		ask(image) {
			const all = !image
			this.$buefy.dialog.confirm({
				title: all ? this.$t('Remove every unused image?') : this.$t('Remove this image?'),
				message: all
					? this.$t('{count} images that no app uses are removed, {size} in all. Apps are not touched; going back to one of these versions, for example by restoring an old backup, downloads it again.', { count: this.images.length, size: renderSize(this.total) })
					: this.$t('{name} is removed ({size}). No app uses it; going back to this version, for example by restoring an old backup, downloads it again.', { name: escapeHtml(this.name(image)), size: renderSize(image.size) }),
				confirmText: this.$t('Remove'),
				cancelText: this.$t('Cancel'),
				type: 'is-danger',
				onConfirm: () => this.remove(all ? [] : [image.id]),
			})
		},
		async remove(ids) {
			this.working = true
			this.error = ''
			try {
				const { removed, freed } = await removeImages(ids)
				this.$buefy.toast.open({
					message: freed > 0
						? this.$t('{count} images removed, {size} freed', { count: removed, size: renderSize(freed) })
						: this.$t('{count} images removed', { count: removed }),
					type: 'is-success',
					duration: 6000,
				})
			}
			catch (e) {
				this.error = this.message(e)
			}
			finally {
				this.working = false
				try {
					this.list = await scanImages()
				}
				catch (e) {
					// The list stays as it was
				}
			}
		},
	},
}
</script>

<template>
	<div v-if="installed" class="atrio-images">
		<div class="atrio-setting-row">
			<b-icon icon="layers-outline" pack="mdi" size="is-20" />
			<span class="atrio-setting-label">
				{{ $t('Unused app images') }}
				<small class="atrio-setting-note">
					<template v-if="!list">{{ working ? $t('Checking…') : '' }}</template>
					<template v-else-if="images.length">{{ $t('{count} images, {size}: old versions left after updates and uninstalls', { count: images.length, size: renderSize(total) }) }}</template>
					<template v-else>{{ $t('None: every image is used by an app') }}</template>
				</small>
			</span>
			<button v-if="images.length" :disabled="busy" class="atrio-button is-small" type="button" @click="open = !open">{{ open ? $t('Hide') : $t('Show') }}</button>
		</div>

		<div v-if="open && images.length" class="atrio-images-list">
			<ul>
				<li v-for="image in images" :key="image.id">
					<div>
						<span class="atrio-images-name">{{ name(image) }}</span>
						<small>{{ [renderSize(image.size), age(image)].filter(Boolean).join(' · ') }}</small>
					</div>
					<button :aria-label="$t('Remove')" :disabled="busy" class="atrio-button is-small" type="button" @click="ask(image)">
						<b-icon icon="trash-outline" pack="casa" size="is-16" />
					</button>
				</li>
			</ul>
			<div class="atrio-images-actions">
				<button :disabled="busy" class="atrio-button is-small is-danger" type="button" @click="ask(null)">{{ working ? $t('Removing…') : $t('Remove all ({size})', { size: renderSize(total) }) }}</button>
				<button :disabled="busy" class="atrio-button is-small" type="button" @click="scan">{{ $t('Check again') }}</button>
			</div>
		</div>
		<p v-if="error" class="atrio-images-error" role="alert">{{ error }}</p>
	</div>
</template>

<style lang="scss">
.atrio-images-list {
	padding: 0 0.5rem 0.75rem 2.75rem;

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);

		> div {
			min-width: 0;
		}

		small {
			display: block;
			color: var(--atrio-text-muted);
			font-size: 0.75rem;
		}
	}

	.atrio-images-name {
		display: block;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.8125rem;
		word-break: break-all;
	}
}

.atrio-images-actions {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem;
	margin-top: 0.75rem;
}

.atrio-images-error {
	margin: 0.25rem 0.5rem 0.5rem;
	padding: 0.5rem 0.75rem;
	border-radius: 0.5rem;
	background: rgba(248, 113, 113, 0.15);
	color: #fecaca;
	font-size: 0.8125rem;
}
</style>
