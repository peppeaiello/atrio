<script>
// Picks a folder on the server, among the disks, USB drives, network folders and cloud drives
// connected in Files: the backup folder in the Backup tab of an app, and the folders to back up.
import FilesIcon from '@/components/files/FilesIcon.vue'
import { errorMessage, listFolder, listLocations, parentPath } from '@/components/files/files.js'
import '@/components/files/messages.js'

export default {
	name: 'BackupFolderPicker',
	compatConfig: { MODE: 3 },
	components: { FilesIcon },
	props: {
		start: { type: String, default: '/DATA' },
		note: { type: String, default: '' },
		action: { type: String, default: 'Use this folder' },
		busy: { type: Boolean, default: false },
	},
	emits: ['pick', 'cancel'],
	data() {
		return { dir: '', folders: [], loading: false, error: '', places: [] }
	},
	async mounted() {
		this.goTo(this.start)
		const { places, storage } = await listLocations()
		this.places = [...places.slice(0, 1), ...storage.filter((place) => place.kind)]
	},
	methods: {
		parentPath,
		async goTo(dir) {
			this.dir = dir
			this.loading = true
			this.error = ''
			try {
				const items = await listFolder(dir)
				if (dir !== this.dir) return
				this.folders = items.filter((item) => item.is_dir && !item.name.startsWith('.')).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
			}
			catch (e) {
				this.folders = []
				this.error = errorMessage(e)
			}
			finally {
				this.loading = false
			}
		},
		placeName(place) {
			return place.label || this.$t(`files.${place.name}`)
		},
	},
}
</script>

<template>
	<div class="atrio-backups-picker">
		<p class="atrio-backups-note">{{ $t('Disks, USB drives, network folders and cloud drives connected in Files appear here. To add one, connect it in Files first.') }}</p>
		<div class="atrio-backups-places">
			<button v-for="place in places" :key="place.path" :class="{ 'is-active': dir === place.path }" type="button" @click="goTo(place.path)">
				<FilesIcon :name="place.icon" :size="15" />{{ placeName(place) }}
			</button>
		</div>
		<strong class="is-mono">{{ dir }}</strong>
		<div class="atrio-backups-pick-list">
			<button v-if="dir !== '/'" type="button" @click="goTo(parentPath(dir))"><FilesIcon :size="16" name="arrowUp" />..</button>
			<p v-if="loading" class="atrio-config-empty">{{ $t('Loading…') }}</p>
			<p v-else-if="error" class="atrio-backups-note" role="alert">{{ error }}</p>
			<button v-for="folder in folders" v-else :key="folder.path" type="button" @click="goTo(folder.path)"><FilesIcon :size="16" name="folder" />{{ folder.name }}</button>
		</div>
		<p v-if="note" class="atrio-backups-note">{{ note }}</p>
		<div class="atrio-backups-actions">
			<button :disabled="busy || !!error" class="atrio-button is-small" type="button" @click="$emit('pick', dir)">{{ $t(action) }}</button>
			<button :disabled="busy" class="atrio-button is-small" type="button" @click="$emit('cancel')">{{ $t('Cancel') }}</button>
		</div>
	</div>
</template>

<style lang="scss">
.atrio-backups-picker {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	margin: 0.75rem 0;
	padding: 0.75rem;
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.75rem;

	strong {
		color: inherit;
	}

	.is-mono {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.8125rem;
		word-break: break-all;
	}

	button {
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.atrio-backups-note {
		display: block;
		margin-top: 0.375rem;
		color: var(--atrio-text-muted);
		font-size: 0.75rem;
	}

	.atrio-backups-actions {
		display: flex;
		flex: none;
		gap: 0.375rem;
	}
}

.atrio-backups-places {
	display: flex;
	flex-wrap: wrap;
	gap: 0.375rem;

	button {
		display: flex;
		gap: 0.375rem;
		align-items: center;
		min-height: 2rem;
		padding: 0 0.75rem;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.06);
		font-size: 0.8125rem;

		&.is-active {
			background: rgba(255, 255, 255, 0.18);
		}
	}
}

.atrio-backups-pick-list {
	display: flex;
	flex-direction: column;
	gap: 2px;
	height: 12rem;
	padding: 0.25rem;
	overflow-y: auto;
	border-radius: 0.5rem;
	background: rgba(0, 0, 0, 0.25);

	button {
		display: flex;
		flex: none;
		gap: 0.5rem;
		align-items: center;
		min-height: 2.25rem;
		padding: 0 0.5rem;
		border: 0;
		border-radius: 0.375rem;
		background: transparent;
		font-size: 0.875rem;
		text-align: left;

		&:hover {
			background: rgba(255, 255, 255, 0.1);
		}
	}
}
</style>
