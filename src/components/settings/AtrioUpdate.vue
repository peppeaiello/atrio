<script>
// Atrio's own version and updates, in the settings menu next to the CasaOS update.
// The check and the update live in plugins/atrioRelease, shared with the settings icon dot and
// the full-page progress screen.
import { copyText } from '@/plugins/copyText'
import { KOFI } from '@/plugins/supportNote'
import { CURRENT, INSTALL_COMMAND, checkLatest, checkServices, release, repair, repairServer, services, startUpdate, updateAvailable } from '@/plugins/atrioRelease'

export default {
	name: 'AtrioUpdate',
	compatConfig: { MODE: 3 },
	data() {
		return { current: CURRENT, release, services, repair, install: INSTALL_COMMAND, kofi: KOFI }
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
		checkServices().then((outdated) => outdated && repairServer())
	},
	methods: {
		update() {
			startUpdate()
		},
		copyInstall() {
			copyText(this, this.install)
		},
	},
}
</script>

<template>
	<div class="_is-large _is-radius pr-2 mr-4 ml-4">
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

		<p class="atrio-update-support pl-55 ml-1">
			{{ $t('Atrio is free and made by one person. If you find it useful, you can support it on Ko-fi.') }}
			<a :href="kofi" rel="noopener" target="_blank">{{ $t('Support Atrio on Ko-fi') }}</a>
		</p>

		<!-- Services older than the web UI: Atrio brings them up to date by itself (repairServer) -->
		<template v-if="services.outdated && !dev">
			<p v-if="repair.running" class="atrio-update-services atrio-update-services-ok pl-55 ml-1" role="status">
				{{ $t('Bringing the services on the server up to date…') }}
			</p>
			<div v-else-if="repair.failed" class="atrio-update-services pl-55 ml-1" role="alert">
				<p>{{ $t('The services on the server (updates, backups, push alerts) are older than this version, and Atrio could not bring them up to date by itself. Run this command once on the server:') }}</p>
				<button :title="$t('Copy')" class="atrio-update-services-code" type="button" @click="copyInstall">{{ install }}</button>
				<p v-if="repair.message" class="mt-1">{{ repair.message }}</p>
			</div>
			<p v-else-if="updateAvailable" class="atrio-update-services atrio-update-services-ok pl-55 ml-1">
				{{ $t('The update also brings the services on the server up to date.') }}
			</p>
		</template>
	</div>
</template>

<style scoped>
.atrio-update-services {
	margin-top: 0.5rem;
	padding-right: 0.5rem;
	color: #fcd34d;
	font-size: 0.75rem;
	line-height: 1.4;
}

.atrio-update-services-ok {
	color: var(--atrio-text-soft, #cbd5e1);
}

.atrio-update-services-code {
	display: block;
	width: 100%;
	margin-top: 0.375rem;
	padding: 0.5rem 0.625rem;
	border: 0;
	border-radius: 0.5rem;
	background: rgba(0, 0, 0, 0.35);
	color: var(--atrio-text, #e2e8f0);
	font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	font-size: 0.6875rem;
	text-align: left;
	word-break: break-all;
	cursor: pointer;
}

.atrio-update-support {
	margin-top: 0.375rem;
	padding-right: 0.5rem;
	color: var(--atrio-text-muted, #94a3b8);
	font-size: 0.75rem;
	line-height: 1.4;

	a {
		color: var(--atrio-text-soft, #cbd5e1);
		text-decoration: underline;
	}
}

.atrio-update-logo {
	width: 1.25rem;
	height: 1.25rem;
}
</style>
