<script>
// Side panel to choose, order and add widgets. Every change is emitted right away and saved by
// the side bar in the widgets configuration on the server.
import draggable from 'vuedraggable'
import { restoreFocus, trapTab } from '@/plugins/focusTrap'
import { HEIGHTS } from './WebPageWidget.vue'

export default {
	name: 'WidgetsPanel',
	compatConfig: { MODE: 3 },
	components: { draggable },
	props: {
		items: { type: Array, required: true },
		// Built-in widgets by name: { title, icon }
		meta: { type: Object, required: true },
	},
	emits: ['change', 'close'],
	data() {
		return {
			list: this.items.map((item) => ({ ...item })),
			// Web page form, for a new widget or the one being edited
			form: null,
			heights: Object.keys(HEIGHTS),
		}
	},
	computed: {
		urlValid() {
			try {
				const url = new URL(this.form?.url || '')
				return url.protocol === 'http:' || url.protocol === 'https:'
			}
			catch (e) {
				return false
			}
		},
	},
	watch: {
		items(items) {
			this.list = items.map((item) => ({ ...item }))
		},
	},
	mounted() {
		this.returnFocus = document.activeElement
		window.addEventListener('keydown', this.onKey)
		this.$nextTick(() => this.$refs.sheet?.focus())
	},
	beforeUnmount() {
		window.removeEventListener('keydown', this.onKey)
		restoreFocus(this.returnFocus)
	},
	methods: {
		key(item) {
			return item.id || item.name
		},
		title(item) {
			if (item.name === 'webpage') return item.title || item.url
			return this.$t(this.meta[item.name]?.title || item.name)
		},
		icon(item) {
			return item.name === 'webpage' ? null : this.meta[item.name]?.icon
		},
		save() {
			this.$emit('change', this.list.map((item) => ({ ...item })))
		},
		move(index, step) {
			const to = index + step
			if (to < 0 || to >= this.list.length) return
			const [item] = this.list.splice(index, 1)
			this.list.splice(to, 0, item)
			this.save()
		},
		remove(index) {
			this.list.splice(index, 1)
			this.save()
		},
		newPage() {
			this.form = { id: '', title: '', url: '', height: 'medium' }
			this.$nextTick(() => this.$refs.formTitle?.focus())
		},
		edit(item) {
			this.form = { id: item.id, title: item.title || '', url: item.url, height: item.height || 'medium' }
			this.$nextTick(() => this.$refs.formTitle?.focus())
		},
		submit() {
			if (!this.urlValid) return
			const page = { name: 'webpage', show: true, title: this.form.title.trim(), url: this.form.url.trim(), height: this.form.height }
			const at = this.form.id ? this.list.findIndex((item) => item.id === this.form.id) : -1
			if (at === -1) this.list.push({ ...page, id: `webpage-${Date.now().toString(36)}` })
			else this.list.splice(at, 1, { ...this.list[at], ...page })
			this.form = null
			this.save()
		},
		onKey(event) {
			if (document.querySelector('.modal.is-active')) return
			if (event.key === 'Escape') {
				if (this.form) this.form = null
				else this.$emit('close')
			}
			else trapTab(event, this.$refs.sheet)
		},
	},
}
</script>

<template>
	<Teleport to="body">
		<div class="atrio-sheet-backdrop" @click.self="$emit('close')">
			<aside ref="sheet" :aria-label="$t('Widgets')" aria-modal="true" class="atrio-sheet atrio-settings atrio-widgets-panel" role="dialog" tabindex="-1">
				<header class="atrio-sheet-head">
					<span class="atrio-settings-icon"><b-icon icon="view-dashboard-outline" pack="mdi" /></span>
					<div class="atrio-sheet-title">
						<h2>{{ $t('Widgets') }}</h2>
					</div>
					<button :aria-label="$t('Close')" class="atrio-icon-button" type="button" @click="$emit('close')">
						<b-icon icon="close-outline" pack="casa" />
					</button>
				</header>

				<p class="atrio-widgets-hint">{{ $t('Show, hide and drag the widgets into the order you like. Changes are saved right away.') }}</p>

				<draggable v-model="list" :item-key="key" class="atrio-widgets-list" handle=".atrio-widget-drag" tag="ul" @end="save">
					<template #item="{ element: item, index }">
						<li :class="{ 'is-hidden-widget': !item.show }">
							<span :title="$t('Drag to reorder')" class="atrio-widget-drag" aria-hidden="true">
								<b-icon icon="drag-vertical" pack="mdi" size="is-20" />
							</span>
							<b-icon v-if="icon(item)" :icon="icon(item)" class="atrio-widget-icon" pack="casa" size="is-20" />
							<b-icon v-else class="atrio-widget-icon" icon="web" pack="mdi" size="is-20" />
							<span class="atrio-widget-name">
								{{ title(item) }}
								<small v-if="item.name === 'webpage'">{{ $t('Web page') }}</small>
							</span>
							<span class="atrio-widget-order">
								<button :aria-label="$t('Move up')" :disabled="index === 0" type="button" @click="move(index, -1)">
									<b-icon icon="chevron-up" pack="mdi" size="is-16" />
								</button>
								<button :aria-label="$t('Move down')" :disabled="index === list.length - 1" type="button" @click="move(index, 1)">
									<b-icon icon="chevron-down" pack="mdi" size="is-16" />
								</button>
							</span>
							<template v-if="item.name === 'webpage'">
								<button :aria-label="$t('Edit')" :title="$t('Edit')" class="atrio-widget-action" type="button" @click="edit(item)">
									<b-icon icon="pencil-outline" pack="mdi" size="is-16" />
								</button>
								<button :aria-label="$t('Remove')" :title="$t('Remove')" class="atrio-widget-action" type="button" @click="remove(index)">
									<b-icon icon="trash-can-outline" pack="mdi" size="is-16" />
								</button>
							</template>
							<b-switch v-model="item.show" :aria-label="title(item)" class="mr-0" @update:model-value="save" />
						</li>
					</template>
				</draggable>

				<section class="atrio-settings-section">
					<h3>{{ $t('Add a widget') }}</h3>
					<form v-if="form" class="atrio-widget-form" @submit.prevent="submit">
						<label>
							<span>{{ $t('Title') }}</span>
							<input ref="formTitle" v-model="form.title" :placeholder="$t('For example: Uptime')" class="atrio-console-input" type="text">
						</label>
						<label>
							<span>{{ $t('Web address') }} *</span>
							<input v-model="form.url" class="atrio-console-input" placeholder="http://192.168.1.10:3001/status" required type="url">
							<small v-if="form.url && !urlValid" class="atrio-widget-error">{{ $t('Enter an address that starts with http:// or https://') }}</small>
						</label>
						<div class="atrio-widget-heights" role="radiogroup" :aria-label="$t('Height')">
							<span>{{ $t('Height') }}</span>
							<div class="atrio-segmented">
								<button v-for="size in heights" :key="size" :aria-checked="form.height === size" :class="{ 'is-active': form.height === size }" role="radio" type="button" @click="form.height = size">
									{{ $t({ small: 'Compact', medium: 'Normal', large: 'Tall' }[size]) }}
								</button>
							</div>
						</div>
						<div class="atrio-account-actions">
							<button class="atrio-button" type="button" @click="form = null">{{ $t('Cancel') }}</button>
							<button :disabled="!urlValid" class="atrio-button is-primary" type="submit">{{ form.id ? $t('Save') : $t('Add') }}</button>
						</div>
					</form>
					<div v-else class="atrio-setting-row">
						<b-icon icon="web" pack="mdi" size="is-20" />
						<span class="atrio-setting-label">
							{{ $t('Web page') }}
							<small class="atrio-setting-note">{{ $t('An app\'s status page, a small dashboard or any page of your network') }}</small>
						</span>
						<button class="atrio-button is-small" type="button" @click="newPage">{{ $t('Add') }}</button>
					</div>
				</section>
			</aside>
		</div>
	</Teleport>
</template>

<style lang="scss">
.atrio-widgets-hint {
	color: var(--atrio-text-muted);
	font-size: 0.8125rem;
}

.atrio-widgets-list {
	display: flex;
	flex-direction: column;
	gap: 0.375rem;

	li {
		display: flex;
		gap: 0.625rem;
		align-items: center;
		min-height: 3.25rem;
		padding: 0.375rem 0.75rem 0.375rem 0.375rem;
		border-radius: 0.875rem;
		background: rgba(255, 255, 255, 0.05);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
		color: var(--atrio-text);

		&.is-hidden-widget .atrio-widget-name,
		&.is-hidden-widget .atrio-widget-icon {
			opacity: 0.5;
		}

		&.sortable-ghost {
			opacity: 0.4;
		}
	}

	.switch input[type='checkbox'] + .check {
		background: rgba(255, 255, 255, 0.18);
	}

	.switch input[type='checkbox']:checked + .check {
		background: var(--atrio-accent);
	}
}

.atrio-widget-drag {
	display: grid;
	place-items: center;
	color: var(--atrio-text-muted);
	cursor: grab;
}

.atrio-widget-icon {
	flex-shrink: 0;
	color: var(--atrio-text-soft);
}

.atrio-widget-name {
	display: flex;
	flex: 1;
	flex-direction: column;
	min-width: 0;
	overflow: hidden;
	font-size: 0.9375rem;
	font-weight: 600;
	text-overflow: ellipsis;
	white-space: nowrap;

	small {
		color: var(--atrio-text-muted);
		font-size: 0.75rem;
		font-weight: 500;
	}
}

.atrio-widget-order {
	display: flex;
	flex-direction: column;

	button {
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.125rem;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--atrio-text-soft);
		cursor: pointer;

		&:disabled {
			opacity: 0.25;
			cursor: default;
		}

		&:hover:not(:disabled) {
			color: var(--atrio-text);
		}
	}
}

.atrio-widget-action {
	display: grid;
	place-items: center;
	width: 1.75rem;
	height: 1.75rem;
	padding: 0;
	border: 0;
	border-radius: 0.5rem;
	background: transparent;
	color: var(--atrio-text-soft);
	cursor: pointer;

	&:hover {
		background: rgba(255, 255, 255, 0.1);
		color: var(--atrio-text);
	}
}

.atrio-widget-form {
	display: flex;
	flex-direction: column;
	gap: 0.875rem;
	padding: 0.25rem 0.5rem 0.5rem;

	label,
	.atrio-widget-heights {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;

		> span {
			color: var(--atrio-text-soft);
			font-size: 0.8125rem;
			font-weight: 600;
		}
	}

	.atrio-segmented {
		align-self: flex-start;
	}
}

.atrio-widget-error {
	color: #fca5a5;
	font-size: 0.75rem;
}
</style>
