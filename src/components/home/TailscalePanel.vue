<script>
// Remote access with Tailscale: install it, sign in with a link or a QR code, see this server's address
// on the tailnet with a QR code for the phone, the other devices, and turn it on or off. The work runs
// on the server (atrio-backup, action "tailscale"). Opened with `$EventBus.$emit('atrio:open-tailscale')`,
// from the settings and the command palette.
import api from '@/service/api.js'
import { copyText } from '@/plugins/copyText'
import { restoreFocus, trapTab } from '@/plugins/focusTrap'
import { backupRun, backupsInstalled, escapeHtml, lastTailscale, tailscale } from '@/plugins/appBackup'
import QrCode from './QrCode.vue'

// While a sign-in is waiting, how often to look whether it is done
const WAIT_POLL_MS = 3000
const ADMIN = 'https://login.tailscale.com/admin/machines'
// As Tailscale names the systems, and how people write them
const OS_NAMES = { android: 'Android', iOS: 'iOS', macOS: 'macOS', windows: 'Windows', linux: 'Linux', freebsd: 'FreeBSD', tvOS: 'tvOS' }
const OS_ICONS = { android: 'android', iOS: 'apple-ios', macOS: 'apple', tvOS: 'apple', windows: 'microsoft-windows', linux: 'linux' }

export default {
	name: 'TailscalePanel',
	compatConfig: { MODE: 3 },
	components: { QrCode },
	data() {
		return { open: false, info: null, loading: false, busy: '', error: '', port: '' }
	},
	computed: {
		status() {
			return this.info?.status || null
		},
		state() {
			if (!this.info) return ''
			if (!this.info.installed) return 'missing'
			const backend = this.status?.BackendState
			if (backend === 'Running') return 'running'
			if (backend === 'Stopped') return 'stopped'
			if (backend === 'NeedsMachineAuth') return 'approval'
			if (this.status?.AuthURL) return 'signing-in'
			if (backend === 'Starting') return 'starting'
			return 'signed-out'
		},
		name() {
			return (this.status?.Self?.DNSName || '').replace(/\.$/, '')
		},
		ips() {
			return this.status?.TailscaleIPs || this.status?.Self?.TailscaleIPs || []
		},
		ipv4() {
			return this.ips.find((ip) => ip.includes('.')) || this.ips[0] || ''
		},
		// The address of this page through Tailscale: the CasaOS port, plain http as CasaOS serves it
		address() {
			const host = this.name || this.ipv4
			if (!host) return ''
			return `http://${host}${this.port && this.port !== '80' ? `:${this.port}` : ''}/`
		},
		ipAddress() {
			return this.ipv4 ? `http://${this.ipv4}${this.port && this.port !== '80' ? `:${this.port}` : ''}/` : ''
		},
		account() {
			return this.status?.CurrentTailnet?.Name || ''
		},
		devices() {
			return Object.values(this.status?.Peer || {})
				.map((peer) => ({
					name: (peer.DNSName || '').split('.')[0] || peer.HostName,
					os: OS_NAMES[peer.OS] || peer.OS || '',
					icon: OS_ICONS[peer.OS] || 'devices',
					online: Boolean(peer.Online),
					ip: (peer.TailscaleIPs || []).find((ip) => ip.includes('.')) || '',
					seen: peer.LastSeen,
				}))
				.sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name))
		},
		warnings() {
			return (this.status?.Health || []).filter(Boolean)
		},
		headline() {
			return {
				missing: this.$t('Not installed'),
				'signed-out': this.$t('Not signed in'),
				'signing-in': this.$t('Waiting for you to sign in'),
				approval: this.$t('Waiting for approval'),
				starting: this.$t('Starting…'),
				stopped: this.$t('Off'),
				running: this.$t('Connected'),
			}[this.state] || ''
		},
		adminUrl() {
			return ADMIN
		},
	},
	mounted() {
		this.$EventBus.$on('atrio:open-tailscale', this.show)
		window.addEventListener('keydown', this.onKey)
	},
	beforeUnmount() {
		this.$EventBus.$off('atrio:open-tailscale', this.show)
		window.removeEventListener('keydown', this.onKey)
		clearTimeout(this.timer)
	},
	methods: {
		async show() {
			if (this.open) return
			this.returnFocus = document.activeElement
			this.open = true
			this.error = ''
			this.$nextTick(() => this.$refs.sheet?.focus())
			this.loadPort()
			if (!(await backupsInstalled())) {
				this.error = this.$t('This needs the service on the server. Run the install command on the server.')
				return
			}
			// What the server found last time right away, then a fresh look
			this.info = (await lastTailscale()) || this.info
			this.refresh()
		},
		close() {
			this.open = false
			clearTimeout(this.timer)
			this.$nextTick(() => restoreFocus(this.returnFocus))
		},
		onKey(event) {
			if (!this.open) return
			if (event.key === 'Escape') this.close()
			else trapTab(event, this.$refs.sheet)
		},
		async loadPort() {
			try {
				const res = await api.sys.getServerPort()
				this.port = String(res.data.data || '')
			}
			catch (e) {
				this.port = location.protocol === 'http:' ? location.port : ''
			}
		},
		async refresh() {
			// An action under way: it looks again itself when it ends (follow)
			if (this.loading || this.busy) return
			// A backup or an update holds the service: show what it found last time, look again later
			if (backupRun.app) {
				this.info = (await lastTailscale()) || this.info
				this.error = ''
				clearTimeout(this.timer)
				if (this.open) this.timer = setTimeout(this.refresh, WAIT_POLL_MS)
				return
			}
			this.loading = true
			try {
				this.info = await tailscale('status')
				this.error = ''
			}
			catch (e) {
				this.showError(e)
			}
			finally {
				this.loading = false
			}
			this.follow()
		},
		// While a sign-in or a start is under way, look again until it is done
		follow() {
			clearTimeout(this.timer)
			if (this.open && !this.error && ['signing-in', 'approval', 'starting'].includes(this.state)) {
				this.timer = setTimeout(this.refresh, WAIT_POLL_MS)
			}
		},
		showError(e) {
			this.error = e.message === 'Unknown request'
				? this.$t('This needs the latest version of the service on the server. Reload the page in a minute: Atrio brings it up to date by itself.')
				: this.$t(e.message || 'Something went wrong')
		},
		async act(op, done) {
			if (this.busy) return
			this.busy = op
			// The server takes one request at a time: a look at the status still on its way ends first,
			// or this one would fail with "Another backup is in progress"
			clearTimeout(this.timer)
			while (this.loading) await new Promise((resolve) => setTimeout(resolve, 200))
			try {
				this.info = await tailscale(op)
				this.error = ''
				if (done) this.$buefy.toast.open({ message: escapeHtml(this.$t(done)), type: 'is-success' })
			}
			catch (e) {
				this.$buefy.toast.open({ message: escapeHtml(this.$t(e.message || 'Something went wrong')), type: 'is-danger', duration: 6000 })
			}
			finally {
				this.busy = ''
			}
			this.follow()
		},
		install() {
			this.act('install', 'Tailscale is installed')
		},
		signIn() {
			this.act('login')
		},
		turnOn() {
			this.act('up', 'Tailscale is on')
		},
		turnOff() {
			this.$buefy.dialog.confirm({
				title: this.$t('Turn off Tailscale?'),
				message: escapeHtml(this.$t('Devices that reach this server through Tailscale lose the connection until you turn it on again. If you are using Atrio through Tailscale now, this page stops answering.')),
				confirmText: this.$t('Turn off'),
				cancelText: this.$t('Cancel'),
				type: 'is-danger',
				onConfirm: () => this.act('down', 'Tailscale is off'),
			})
		},
		signOut() {
			this.$buefy.dialog.confirm({
				title: this.$t('Sign out of Tailscale?'),
				message: escapeHtml(this.$t('This server leaves your tailnet: to reach it from outside again you will have to sign in once more. Settings made with the tailscale command, such as routes, exit node and SSH, are cleared too. If you are using Atrio through Tailscale now, this page stops answering.')),
				confirmText: this.$t('Sign out'),
				cancelText: this.$t('Cancel'),
				type: 'is-danger',
				onConfirm: () => this.act('logout', 'Signed out of Tailscale'),
			})
		},
		copy(text) {
			copyText(this, text)
		},
		seen(time) {
			const date = new Date(time)
			if (!time || Number.isNaN(date.getTime()) || date.getFullYear() < 2000) return ''
			return date.toLocaleString(this.$i18n.locale?.replace('_', '-'), { dateStyle: 'medium', timeStyle: 'short' })
		},
	},
}
</script>

<template>
	<Teleport to="body">
		<transition name="atrio-sheet">
			<div v-if="open" class="atrio-sheet-backdrop" @click.self="close">
				<aside ref="sheet" :aria-label="$t('Remote access')" aria-modal="true" class="atrio-sheet atrio-tailscale" role="dialog" tabindex="-1">
					<header class="atrio-sheet-head">
						<span class="atrio-tailscale-icon"><b-icon icon="vpn" pack="mdi" /></span>
						<div class="atrio-sheet-title">
							<h2>{{ $t('Remote access') }}</h2>
							<p class="atrio-tailscale-sub">
								Tailscale<template v-if="headline"> · <span :class="`is-${state}`" class="atrio-tailscale-state">{{ headline }}</span></template>
							</p>
						</div>
						<button :aria-label="$t('Close')" class="atrio-icon-button" type="button" @click="close">
							<b-icon icon="close-outline" pack="casa" />
						</button>
					</header>

					<p v-if="error" class="atrio-tailscale-error" role="alert">{{ error }}</p>
					<p v-else-if="!info" class="atrio-config-empty">{{ $t('Loading…') }}</p>

					<div v-else class="atrio-sheet-config" aria-live="polite">
						<!-- Not installed -->
						<section v-if="state === 'missing'">
							<p class="atrio-tailscale-text">{{ $t('Tailscale connects your devices in a private network of their own, so you can open Atrio and your apps from anywhere, as if you were at home, without opening ports on your router.') }}</p>
							<p class="atrio-tailscale-text">{{ $t('Atrio installs it with Tailscale\'s own installer, from tailscale.com. It then updates with the rest of the system. Using it needs a free Tailscale account.') }}</p>
							<div class="atrio-tailscale-actions">
								<button :disabled="Boolean(busy)" class="atrio-button is-primary" type="button" @click="install">
									<span v-if="busy === 'install'" class="atrio-update-spinner" />
									{{ busy === 'install' ? $t('Installing, it takes a minute or two…') : $t('Install Tailscale') }}
								</button>
								<a class="atrio-button" href="https://tailscale.com/kb/1151/what-is-tailscale" rel="noopener noreferrer" target="_blank">{{ $t('What is Tailscale?') }}</a>
							</div>
						</section>

						<!-- Installed, not signed in -->
						<section v-else-if="state === 'signed-out' || state === 'starting'">
							<p class="atrio-tailscale-text">{{ $t('Sign in with your Tailscale account to add this server to your tailnet. You get a link and a QR code: open it here or on your phone.') }}</p>
							<div class="atrio-tailscale-actions">
								<button :disabled="Boolean(busy) || state === 'starting'" class="atrio-button is-primary" type="button" @click="signIn">
									<span v-if="busy === 'login' || state === 'starting'" class="atrio-update-spinner" />
									{{ $t('Sign in') }}
								</button>
							</div>
						</section>

						<!-- A sign-in link is waiting -->
						<section v-else-if="state === 'signing-in'">
							<h3>{{ $t('Sign in to Tailscale') }}</h3>
							<div class="atrio-tailscale-pair">
								<QrCode :label="$t('QR code of the sign-in link')" :text="status.AuthURL" class="atrio-tailscale-qr" />
								<div>
									<p class="atrio-tailscale-text">{{ $t('Scan the code with your phone, or open the link on this computer, and sign in. This page goes on by itself once you are in.') }}</p>
									<div class="atrio-tailscale-actions">
										<a :href="status.AuthURL" class="atrio-button is-primary" rel="noopener noreferrer" target="_blank">
											<b-icon icon="open-in-new" custom-size="mdi-18px" pack="mdi" />{{ $t('Open the sign-in page') }}
										</a>
										<!-- Links expire, and one asked for long ago stays in Tailscale's status -->
										<button :disabled="Boolean(busy)" class="atrio-button" type="button" @click="signIn">
											<span v-if="busy === 'login'" class="atrio-update-spinner" />{{ $t('Get a new link') }}
										</button>
									</div>
									<p class="atrio-tailscale-wait"><span class="atrio-update-spinner" />{{ $t('Waiting for you to sign in') }}</p>
								</div>
							</div>
						</section>

						<!-- Signed in, but the tailnet's admin has to approve new devices -->
						<section v-else-if="state === 'approval'">
							<p class="atrio-tailscale-text">{{ $t('Signed in. Your tailnet asks an administrator to approve new devices: approve this server in the Tailscale admin console.') }}</p>
							<div class="atrio-tailscale-actions">
								<a :href="adminUrl" class="atrio-button is-primary" rel="noopener noreferrer" target="_blank">
									<b-icon icon="open-in-new" custom-size="mdi-18px" pack="mdi" />{{ $t('Open the admin console') }}
								</a>
							</div>
							<p class="atrio-tailscale-wait"><span class="atrio-update-spinner" />{{ $t('Waiting for approval') }}</p>
						</section>

						<!-- Signed in and turned off -->
						<section v-else-if="state === 'stopped'">
							<p class="atrio-tailscale-text">{{ $t('Tailscale is off: this server cannot be reached through it until you turn it on.') }}</p>
							<div class="atrio-tailscale-actions">
								<button :disabled="Boolean(busy)" class="atrio-button is-primary" type="button" @click="turnOn">
									<span v-if="busy === 'up'" class="atrio-update-spinner" />{{ $t('Turn on') }}
								</button>
								<button :disabled="Boolean(busy)" class="atrio-button" type="button" @click="signOut">{{ $t('Sign out') }}</button>
							</div>
						</section>

						<!-- Connected -->
						<template v-else-if="state === 'running'">
							<section v-if="address">
								<h3>{{ $t('Open Atrio from anywhere') }}</h3>
								<div class="atrio-tailscale-pair">
									<QrCode :label="$t('QR code of the address of Atrio')" :text="address" class="atrio-tailscale-qr" />
									<div>
										<p class="atrio-tailscale-text">{{ $t('On your phone or laptop, install the Tailscale app and sign in with the same account. Then scan the code or open this address:') }}</p>
										<div class="atrio-tailscale-address">
											<code>{{ address }}</code>
											<button :aria-label="$t('Copy')" class="atrio-icon-button" type="button" @click="copy(address)">
												<b-icon icon="content-copy" custom-size="mdi-18px" pack="mdi" />
											</button>
										</div>
										<div v-if="name && ipAddress" class="atrio-tailscale-address is-secondary">
											<code>{{ ipAddress }}</code>
											<button :aria-label="$t('Copy')" class="atrio-icon-button" type="button" @click="copy(ipAddress)">
												<b-icon icon="content-copy" custom-size="mdi-18px" pack="mdi" />
											</button>
										</div>
										<p class="atrio-tailscale-note">{{ $t('The same name with the port of an app opens that app.') }}</p>
									</div>
								</div>
							</section>

							<section>
								<h3>{{ $t('This server') }}</h3>
								<dl class="atrio-sheet-info">
									<dt>{{ $t('Name') }}</dt>
									<dd :title="name" class="is-mono">{{ name || '—' }}</dd>
									<dt>{{ $t('Addresses') }}</dt>
									<dd :title="ips.join(', ')" class="is-mono">{{ ips.join(', ') || '—' }}</dd>
									<template v-if="account">
										<dt>{{ $t('Tailnet') }}</dt>
										<dd :title="account">{{ account }}</dd>
									</template>
									<dt>{{ $t('Version') }}</dt>
									<dd>{{ info.version || '—' }}</dd>
								</dl>
							</section>

							<section>
								<h3>{{ $t('Devices') }}</h3>
								<p v-if="!devices.length" class="atrio-config-empty">{{ $t('No other device yet: install Tailscale on your phone and sign in with the same account.') }}</p>
								<ul v-else class="atrio-tailscale-devices">
									<li v-for="device in devices" :key="device.name + device.ip">
										<b-icon :icon="device.icon" custom-size="mdi-20px" pack="mdi" />
										<span class="atrio-tailscale-device-name">
											{{ device.name }}
											<small>{{ [device.os, device.ip].filter(Boolean).join(' · ') }}</small>
										</span>
										<span :class="{ 'is-online': device.online }" class="atrio-tailscale-presence">
											<i />{{ device.online ? $t('Online') : seen(device.seen) ? $t('Seen {time}', { time: seen(device.seen) }) : $t('Offline') }}
										</span>
									</li>
								</ul>
							</section>

							<section v-if="warnings.length">
								<h3>{{ $t('Tailscale says') }}</h3>
								<ul class="atrio-tailscale-warnings">
									<li v-for="warning in warnings" :key="warning">{{ warning }}</li>
								</ul>
							</section>

							<section>
								<div class="atrio-tailscale-actions">
									<a :href="adminUrl" class="atrio-button" rel="noopener noreferrer" target="_blank">
										<b-icon icon="open-in-new" custom-size="mdi-18px" pack="mdi" />{{ $t('Admin console') }}
									</a>
									<button :disabled="Boolean(busy)" class="atrio-button" type="button" @click="turnOff">
										<span v-if="busy === 'down'" class="atrio-update-spinner" />{{ $t('Turn off') }}
									</button>
									<button :disabled="Boolean(busy)" class="atrio-button" type="button" @click="signOut">
										<span v-if="busy === 'logout'" class="atrio-update-spinner" />{{ $t('Sign out') }}
									</button>
								</div>
								<p class="atrio-tailscale-note">{{ $t('Turning Tailscale off and on keeps the routes, exit node and SSH set with the tailscale command. Signing out clears them.') }}</p>
							</section>
						</template>
					</div>
				</aside>
			</div>
		</transition>
	</Teleport>
</template>

<style lang="scss">
.atrio-tailscale {
	width: min(36rem, calc(100% - 2rem));

	// Long names and addresses wrap instead of being cut
	.atrio-sheet-info dd {
		overflow: visible;
		white-space: normal;
		overflow-wrap: anywhere;
	}
}

.atrio-tailscale-icon {
	display: grid;
	place-items: center;
	width: 3.75rem;
	height: 3.75rem;
	border-radius: 1.125rem;
	background: rgba(10, 165, 196, 0.16);
	color: #a5f3fc;

	.icon,
	.mdi::before {
		font-size: 1.75rem;
	}
}

.atrio-tailscale-sub {
	color: var(--atrio-text-soft);
	font-size: 0.8125rem;
}

.atrio-tailscale-state {
	&.is-running {
		color: #86efac;
	}

	&.is-signing-in,
	&.is-approval,
	&.is-starting {
		color: #fde68a;
	}
}

.atrio-tailscale-error {
	padding: 0.75rem 1rem;
	border-radius: 0.75rem;
	background: rgba(239, 68, 68, 0.12);
	color: #fecaca;
	font-size: 0.875rem;
}

.atrio-tailscale-text {
	margin: 0 0 0.75rem;
	color: var(--atrio-text-soft);
	font-size: 0.875rem;
	line-height: 1.5;
}

.atrio-tailscale-note {
	margin: 0.75rem 0 0;
	color: var(--atrio-text-muted);
	font-size: 0.75rem;
	line-height: 1.45;
}

.atrio-tailscale-actions {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem;

	a.atrio-button {
		text-decoration: none;
	}

	.atrio-update-spinner {
		width: 1rem;
		height: 1rem;
	}
}

.atrio-tailscale-pair {
	display: grid;
	grid-template-columns: 9.5rem minmax(0, 1fr);
	gap: 1.25rem;
	align-items: start;
}

.atrio-tailscale-qr {
	box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12);
}

.atrio-tailscale-wait {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	margin: 1rem 0 0;
	color: #fde68a;
	font-size: 0.8125rem;

	.atrio-update-spinner {
		width: 0.875rem;
		height: 0.875rem;
	}
}

.atrio-tailscale-address {
	display: flex;
	align-items: center;
	gap: 0.25rem;
	min-width: 0;
	padding: 0.25rem 0.25rem 0.25rem 0.75rem;
	border-radius: 0.75rem;
	background: rgba(255, 255, 255, 0.06);

	code {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		padding: 0;
		background: none;
		color: var(--atrio-text);
		font-size: 0.8125rem;
		// Whole, to be read and typed on another device
		overflow-wrap: anywhere;
	}

	.atrio-icon-button {
		flex: none;
		width: 2.25rem;
		height: 2.25rem;
	}

	&.is-secondary {
		margin-top: 0.375rem;

		code {
			color: var(--atrio-text-soft);
		}
	}
}

.atrio-tailscale-devices,
.atrio-tailscale-warnings {
	margin: 0;
	padding: 0;
	list-style: none;
}

.atrio-tailscale-devices li {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	padding: 0.625rem 0;
	border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	font-size: 0.875rem;

	&:last-child {
		border-bottom: 0;
	}

	> .icon {
		flex: none;
		color: var(--atrio-text-soft);
	}
}

.atrio-tailscale-device-name {
	display: flex;
	flex: 1;
	flex-direction: column;
	min-width: 0;
	overflow-wrap: anywhere;

	small {
		color: var(--atrio-text-muted);
		font-size: 0.75rem;
	}
}

.atrio-tailscale-presence {
	display: inline-flex;
	flex: none;
	align-items: center;
	gap: 0.375rem;
	color: var(--atrio-text-muted);
	font-size: 0.75rem;
	text-align: right;

	i {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: #64748b;
	}

	&.is-online {
		color: #86efac;

		i {
			background: #22c55e;
		}
	}
}

.atrio-tailscale-warnings li {
	padding: 0.5rem 0.75rem;
	margin-bottom: 0.375rem;
	border-radius: 0.625rem;
	background: rgba(253, 230, 138, 0.08);
	color: #fde68a;
	font-size: 0.8125rem;
}

@media (max-width: 480px) {
	// On two lines rather than cut, in longer languages too
	.atrio-tailscale .atrio-sheet-head h2 {
		overflow: visible;
		font-size: 1.25rem;
		line-height: 1.2;
		white-space: normal;
	}

	.atrio-tailscale-pair {
		grid-template-columns: minmax(0, 1fr);

		.atrio-tailscale-qr {
			max-width: 12rem;
			margin: 0 auto;
		}
	}

	.atrio-tailscale-presence {
		max-width: 7rem;
	}
}
</style>
