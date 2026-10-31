<script>
// Atrio's own version and updates, in the settings menu next to the CasaOS update.
// The check and the update live in plugins/atrioRelease, shared with the settings icon dot and
// the full-page progress screen.
import { CURRENT, checkLatest, release, startUpdate, updateAvailable } from '@/plugins/atrioRelease'

export default {
	name: 'AtrioUpdate',
	compatConfig: { MODE: 3 },
	data() {
		return { current: CURRENT, release }
	},
	computed: {
		dev() {
			return import.meta.env.DEV
		},
		latest() {
			return release.latest
		},
		updateAvailable() {
			return updateAvailable()
		},
		updating() {
			return !!release.run && !release.run.error
		},
	},
	mounted() {
		checkLatest()
	},
	methods: {
		update() {
			startUpdate()
		},
	},
}
</script>

<template>
	<div class="_is-large hover-effect _is-radius pr-2 mr-4 ml-4">
		<div class="is-flex is-align-items-center">
			<div class="is-flex is-align-items-center is-flex-grow-1 _is-normal">
				<img :src="$asset('@/assets/img/logo/atrio-mark.svg')" alt="" class="mr-2 ml-2 atrio-update-logo">
				<div :class="{ 'update-text-dot': updateAvailable }">Atrio</div>
			</div>
			<div class="_has-text-gray">v{{ current }}</div>
		</div>

		<div class="is-flex is-align-items-center pl-55 ml-1 is-size-7">
			<template v-if="dev">{{ $t('Development build') }}</template>
			<template v-else-if="updating">{{ $t('Updating…') }}</template>
			<template v-else-if="release.checking">{{ $t('Checking for updates…') }}</template>
			<template v-else-if="release.checkFailed">{{ $t('Could not check for updates') }}</template>
			<template v-else-if="updateAvailable">
				<span class="is-flex-grow-1">{{ $t('Version {version} is available', { version: latest }) }}</span>
				<b-button v-if="release.updaterInstalled" class="ml-2" rounded size="is-small" type="is-dark" @click="update">
					{{ $t('Update') }}
				</b-button>
				<a v-else class="ml-2" href="https://github.com/peppeaiello/atrio#install" rel="noopener" target="_blank">{{ $t('How to update') }}</a>
			</template>
			<template v-else>
				{{ $t('You have the latest version') }}
				<b-icon class="ml-1" custom-size="mdi-18px" icon="check" type="is-success" />
			</template>
		</div>
	</div>
</template>

<style scoped>
.atrio-update-logo {
	width: 1.25rem;
	height: 1.25rem;
}
</style>
