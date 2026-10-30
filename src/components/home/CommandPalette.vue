<script>
// Command palette (Ctrl/Cmd + K): find an app or an action and run it from the keyboard.
import business_OpenThirdApp from '@/mixins/app/Business_OpenThirdApp'
import business_ShowNewAppTag from '@/mixins/app/Business_ShowNewAppTag'
import { ice_i18n } from '@/mixins/base/common-i18n'
import events from '@/events/events'

export default {
	name: 'CommandPalette',
	compatConfig: { MODE: 3 },
	mixins: [business_ShowNewAppTag, business_OpenThirdApp],
	inject: ['homeShowFiles', 'homeShowAppStore'],
	data() {
		return { open: false, query: '', apps: [], active: 0 }
	},
	computed: {
		actions() {
			const system = [
				{ id: 'files', label: this.$t('Files'), hint: this.$t('Open the file manager'), icon: 'folder-outline', run: () => this.homeShowFiles() },
				{ id: 'store', label: 'App Store', hint: this.$t('Install new apps'), icon: 'app-store-outline', run: () => this.homeShowAppStore() },
				{ id: 'wallpaper', label: this.$t('Wallpaper'), hint: this.$t('Change the wallpaper'), icon: 'wallpaper-outline', run: () => this.$EventBus.$emit(events.SHOW_CHANGE_WALLPAPER_MODAL) },
			].map((item) => ({ ...item, group: this.$t('System') }))
			const apps = this.apps.flatMap((app) => {
				const name = ice_i18n(app.title) || app.name
				const running = app.status === 'running'
				const items = [{
					id: `open-${app.name}`,
					label: running ? `${this.$t('Open')} ${name}` : `${this.$t('Start and open')} ${name}`,
					hint: running ? this.$t('Running') : this.$t('Stopped'),
					image: app.icon,
					group: this.$t('Apps'),
					keywords: name,
					run: () => (running ? this.openThirdApp(app, true) : this.firstOpenThirdApp(app)),
				}]
				if (app.app_type === 'v2app') {
					items.push({
						id: `details-${app.name}`,
						label: `${this.$t('Details')}: ${name}`,
						hint: this.$t('Health, resources and live logs'),
						image: app.icon,
						group: this.$t('Apps'),
						keywords: `${name} log dettagli details`,
						run: () => this.$EventBus.$emit('atrio:open-app', app),
					})
				}
				if (running && app.app_type === 'v2app') {
					items.push({
						id: `restart-${app.name}`,
						label: `${this.$t('Restart')} ${name}`,
						hint: this.$t('Restarts the containers of the app'),
						image: app.icon,
						group: this.$t('Actions'),
						keywords: `${name} restart riavvia`,
						run: () => this.restart(app, name),
					})
				}
				return items
			})
			return [...apps, ...system]
		},
		// The web search that used to live in the search bar above the apps
		webSearch() {
			const query = this.query.trim()
			if (!query || !this.$store.state.searchEngineSwitch) return null
			const engine = this.$store.state.searchEngine || 'https://duckduckgo.com/?q='
			return {
				id: 'web-search',
				label: this.$t('Search “{query}” on the web', { query }),
				hint: new URL(engine).hostname.replace(/^www\./, ''),
				icon: 'search-outline',
				group: this.$t('Web'),
				run: () => window.open(engine + encodeURIComponent(query), '_blank', 'noopener'),
			}
		},
		results() {
			const words = this.query.toLowerCase().split(/\s+/).filter(Boolean)
			const matches = words.length
				? this.actions.filter((item) => {
					const text = `${item.label} ${item.keywords || ''} ${item.hint || ''}`.toLowerCase()
					return words.every((word) => text.includes(word))
				})
				: this.actions
			const list = this.webSearch ? [...matches, this.webSearch] : matches
			// Same order as the groups on screen, so the arrow keys move down the list
			const order = [...new Set(list.map((item) => item.group))]
			return [...list].sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group))
		},
		groups() {
			const groups = []
			this.results.forEach((item, index) => {
				let group = groups.find((g) => g.name === item.group)
				if (!group) groups.push((group = { name: item.group, items: [] }))
				group.items.push({ ...item, index })
			})
			return groups
		},
	},
	watch: {
		query() {
			this.active = 0
		},
		active() {
			this.$nextTick(() => this.$el?.ownerDocument?.querySelector('.atrio-palette-item.is-active')?.scrollIntoView({ block: 'nearest' }))
		},
	},
	mounted() {
		window.addEventListener('keydown', this.onGlobalKey)
		this.$EventBus.$on('atrio:open-palette', this.show)
	},
	beforeUnmount() {
		window.removeEventListener('keydown', this.onGlobalKey)
		this.$EventBus.$off('atrio:open-palette', this.show)
	},
	methods: {
		async show() {
			this.query = ''
			this.active = 0
			this.open = true
			this.$nextTick(() => this.$refs.input?.focus())
			try {
				const res = await this.$openAPI.appGrid.getAppGrid()
				this.apps = (res.data.data || []).map((app) => ({
					...app,
					hostname: app.hostname || this.$baseIp,
					icon: app.icon || this.$asset('@/assets/img/app/default.svg'),
				}))
			} catch (e) {
				console.error(e)
			}
		},
		close() {
			this.open = false
		},
		onGlobalKey(event) {
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
				event.preventDefault()
				this.open ? this.close() : this.show()
			}
		},
		onKey(event) {
			if (event.key === 'Escape') this.close()
			else if (event.key === 'ArrowDown') {
				event.preventDefault()
				this.active = Math.min(this.active + 1, this.results.length - 1)
			} else if (event.key === 'ArrowUp') {
				event.preventDefault()
				this.active = Math.max(this.active - 1, 0)
			} else if (event.key === 'Enter' && this.results[this.active]) {
				// Otherwise a focused result button would also get a click
				event.preventDefault()
				this.run(this.results[this.active])
			}
		},
		run(item) {
			this.close()
			item.run()
		},
		async restart(app, name) {
			try {
				await this.$openAPI.appManagement.compose.setComposeAppStatus(app.name, 'restart')
				this.$buefy.toast.open({ message: `${name}: ${this.$t('restarted')}`, type: 'is-success' })
			} catch (e) {
				this.$buefy.toast.open({ message: `${name}: ${this.$t('restart failed')}`, type: 'is-danger' })
			}
		},
	},
}
</script>

<template>
	<Teleport to="body">
		<transition name="atrio-palette">
			<div v-if="open" class="atrio-palette-backdrop" @click.self="close">
				<div aria-label="Command palette" aria-modal="true" class="atrio-palette" role="dialog" @keydown="onKey">
					<label class="atrio-palette-input">
						<b-icon icon="search-outline" pack="casa" size="is-20" />
						<span class="is-sr-only">{{ $t('Search') }}</span>
						<input ref="input" v-model="query" :placeholder="$t('Search apps, actions and settings…')" type="text">
						<kbd>Esc</kbd>
					</label>
					<div class="atrio-palette-results">
						<template v-for="group in groups" :key="group.name">
							<p class="atrio-palette-group">{{ group.name }}</p>
							<button
								v-for="item in group.items" :key="item.id" :class="{ 'is-active': item.index === active }"
								class="atrio-palette-item" type="button" @click="run(item)" @mousemove="active = item.index"
							>
								<span class="atrio-palette-icon">
									<img v-if="item.image" :src="item.image" alt="">
									<b-icon v-else :icon="item.icon" pack="casa" size="is-20" />
								</span>
								<span class="atrio-palette-text">
									<span class="atrio-palette-label">{{ item.label }}</span>
									<span class="atrio-palette-hint">{{ item.hint }}</span>
								</span>
								<kbd v-if="item.index === active">↵</kbd>
							</button>
						</template>
						<p v-if="!results.length" class="atrio-palette-empty">{{ $t('No results') }}</p>
					</div>
					<div class="atrio-palette-footer">
						<span><kbd>↑↓</kbd> {{ $t('move') }}</span>
						<span><kbd>↵</kbd> {{ $t('run') }}</span>
						<span><kbd>Esc</kbd> {{ $t('close') }}</span>
					</div>
				</div>
			</div>
		</transition>
	</Teleport>
</template>

<style lang="scss">
.atrio-palette-backdrop {
	position: fixed;
	inset: 0;
	z-index: 100;
	display: flex;
	justify-content: center;
	align-items: flex-start;
	padding: 12vh 1rem 1rem;
	background: rgba(2, 6, 23, 0.5);
	backdrop-filter: blur(8px);
}

.atrio-palette {
	width: 100%;
	max-width: 40rem;
	overflow: hidden;
	border-radius: var(--atrio-radius-lg);
	background: var(--atrio-glass-bg-strong);
	backdrop-filter: blur(32px) saturate(150%);
	box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12), 0 24px 64px rgba(0, 0, 0, 0.4);
	color: var(--atrio-text);

	kbd {
		padding: 0.125rem 0.375rem;
		border-radius: 0.375rem;
		background: rgba(255, 255, 255, 0.08);
		color: var(--atrio-text-soft);
		font: inherit;
		font-size: 0.75rem;
	}
}

.atrio-palette-input {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	height: 4rem;
	padding: 0 1.25rem;
	border-bottom: 1px solid var(--atrio-glass-border);
	color: var(--atrio-text-muted);

	input {
		flex: 1;
		border: 0;
		outline: 0;
		background: transparent;
		color: var(--atrio-text);
		font: inherit;
		font-size: 1.125rem;

		&::placeholder {
			color: var(--atrio-text-muted);
		}
	}
}

.atrio-palette-results {
	max-height: 50vh;
	overflow-y: auto;
	padding: 0.5rem;
}

.atrio-palette-group {
	padding: 0.625rem 0.75rem 0.375rem;
	color: var(--atrio-text-muted);
	font-size: 0.75rem;
	font-weight: 700;
	letter-spacing: 0.04em;
	text-transform: uppercase;
}

.atrio-palette-item {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	width: 100%;
	min-height: 3rem;
	padding: 0.375rem 0.75rem;
	border: 0;
	border-radius: 0.875rem;
	background: transparent;
	color: inherit;
	font: inherit;
	text-align: left;
	cursor: pointer;

	&.is-active {
		background: rgba(255, 255, 255, 0.1);
	}
}

.atrio-palette-icon {
	display: grid;
	flex-shrink: 0;
	place-items: center;
	width: 2rem;
	height: 2rem;
	overflow: hidden;
	border-radius: 0.625rem;
	background: rgba(255, 255, 255, 0.08);

	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
}

.atrio-palette-text {
	display: flex;
	flex: 1;
	flex-direction: column;
	min-width: 0;
}

.atrio-palette-label {
	overflow: hidden;
	font-size: 0.9375rem;
	font-weight: 600;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.atrio-palette-hint {
	color: var(--atrio-text-muted);
	font-size: 0.75rem;
}

.atrio-palette-empty {
	padding: 1.5rem;
	color: var(--atrio-text-muted);
	text-align: center;
}

.atrio-palette-footer {
	display: flex;
	gap: 1rem;
	padding: 0.75rem 1.25rem;
	border-top: 1px solid var(--atrio-glass-border);
	color: var(--atrio-text-muted);
	font-size: 0.75rem;
}

.atrio-palette-enter-active,
.atrio-palette-leave-active {
	transition: opacity 0.15s ease;
}

.atrio-palette-enter-from,
.atrio-palette-leave-to {
	opacity: 0;
}
</style>
