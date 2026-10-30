<script>
// Atrio's own version and updates, in the settings menu next to the CasaOS update.
// The update itself runs on the server: we create the request file through the CasaOS
// file API and atrio-update (installed by scripts/install.sh) reports in the status file.
const REPO = 'peppeaiello/atrio'
const STATE = '/var/lib/casaos/atrio'
const POLL_MS = 2000
const TIMEOUT_MS = 5 * 60 * 1000

/* global __ATRIO_VERSION__ */
const CURRENT = __ATRIO_VERSION__

function isNewer(latest, current) {
	const a = latest.replace(/^v/, '').split('.').map(Number)
	const b = current.replace(/^v/, '').split('.').map(Number)
	for (let i = 0; i < Math.max(a.length, b.length); i++) {
		if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0)
	}
	return false
}

export default {
	name: 'AtrioUpdate',
	compatConfig: { MODE: 3 },
	data() {
		return {
			current: CURRENT,
			latest: '',
			checking: false,
			checkFailed: false,
			updaterInstalled: null,
			updating: false,
			progress: '',
		}
	},
	computed: {
		dev() {
			return import.meta.env.DEV
		},
		updateAvailable() {
			return !this.dev && this.latest && isNewer(this.latest, this.current)
		},
	},
	mounted() {
		this.check()
	},
	beforeUnmount() {
		clearTimeout(this.pollTimer)
	},
	methods: {
		async check() {
			if (this.dev) return
			this.checking = true
			this.checkFailed = false
			try {
				const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } })
				if (res.status === 404) this.latest = ''
				else if (res.ok) this.latest = (await res.json()).tag_name
				else this.checkFailed = true
			} catch (e) {
				this.checkFailed = true
			} finally {
				this.checking = false
			}
			this.updaterInstalled = (await this.readStatus()) !== null
		},
		async readStatus() {
			try {
				const res = await this.$api.file.getContent(`${STATE}/update-status.json`)
				return res.data.success === 200 ? JSON.parse(res.data.data) : null
			} catch (e) {
				return null
			}
		},
		async update() {
			this.updating = true
			this.progress = this.$t('Starting the update…')
			const started = Date.now()
			try {
				await this.$api.file.create(`${STATE}/update-request`)
			} catch (e) {
				this.fail(this.$t('Could not reach the updater on the server'))
				return
			}
			const poll = async () => {
				const status = await this.readStatus()
				const fresh = status && Date.parse(status.time) >= started - 5000
				if (fresh && status.state === 'done') {
					this.progress = this.$t('Updated, reloading…')
					setTimeout(() => window.location.reload(), 1500)
					return
				}
				if (fresh && status.state === 'error') {
					this.fail(status.message)
					return
				}
				if (Date.now() - started > TIMEOUT_MS) {
					this.fail(this.$t('The update is taking too long'))
					return
				}
				if (fresh && status.message) this.progress = status.message
				this.pollTimer = setTimeout(poll, POLL_MS)
			}
			this.pollTimer = setTimeout(poll, POLL_MS)
		},
		fail(message) {
			this.updating = false
			this.progress = ''
			this.$buefy.toast.open({ message: `Atrio: ${message}`, type: 'is-danger', duration: 6000 })
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
			<template v-else-if="updating">{{ progress }}</template>
			<template v-else-if="checking">{{ $t('Checking for updates…') }}</template>
			<template v-else-if="checkFailed">{{ $t('Could not check for updates') }}</template>
			<template v-else-if="updateAvailable">
				<span class="is-flex-grow-1">{{ $t('Version {version} is available', { version: latest }) }}</span>
				<b-button v-if="updaterInstalled" class="ml-2" rounded size="is-small" type="is-dark" @click="update">
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
