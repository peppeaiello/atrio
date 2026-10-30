// Minimal Vue 3 replacement for the vee-validate 3 API the app uses: ValidationObserver,
// ValidationProvider (`rules="required|min:5"`, `vid`, slot props `errors` / `valid`) and extend().
// The value is read from the v-model (or `value`) of the first input inside the provider.
import { reactive } from 'vue'

const rules = {}

export function extend(name, rule) {
	rules[name] = rule
}

function parseRules(expression) {
	if (!expression) return []
	return String(expression)
		.split('|')
		.filter(Boolean)
		.map((part) => {
			const index = part.indexOf(':')
			if (index < 0) return { name: part, params: [] }
			return { name: part.slice(0, index), params: part.slice(index + 1).split(',') }
		})
}

const UNSET = Symbol('unset')

// Finds the bound value of the first input-like vnode (modelValue or value prop)
function findValue(vnodes) {
	for (const vnode of [].concat(vnodes || [])) {
		if (!vnode || typeof vnode !== 'object') continue
		const props = vnode.props || {}
		if (typeof vnode.type === 'object' || typeof vnode.type === 'string') {
			// Templates may write either :modelValue or :model-value, vnode props keep the spelling
			if ('modelValue' in props) return props.modelValue
			if ('model-value' in props) return props['model-value']
			if ('value' in props && vnode.type !== 'option') return props.value
		}
		if (Array.isArray(vnode.children)) {
			const found = findValue(vnode.children)
			if (found !== UNSET) return found
		} else if (vnode.children && typeof vnode.children.default === 'function') {
			const found = findValue(vnode.children.default({}))
			if (found !== UNSET) return found
		}
	}
	return UNSET
}

export const ValidationObserver = {
	name: 'ValidationObserver',
	compatConfig: { MODE: 3 },
	// An observer inside another one validates with it, as in vee-validate 3
	inject: { validationObserver: { default: null } },
	props: { slim: Boolean, tag: { type: String, default: 'span' } },
	provide() {
		return { validationObserver: this }
	},
	data() {
		return { providers: [] }
	},
	computed: {
		invalid() {
			return this.providers.some((p) => !p.isValid)
		},
		isValid() {
			return !this.invalid
		},
	},
	created() {
		this.validationObserver?.register(this)
	},
	beforeUnmount() {
		this.validationObserver?.unregister(this)
	},
	methods: {
		register(provider) {
			this.providers.push(provider)
		},
		unregister(provider) {
			this.providers = this.providers.filter((p) => p !== provider)
		},
		findByVid(vid) {
			for (const p of this.providers) {
				if (p.vid === vid) return p
				const nested = p.findByVid?.(vid)
				if (nested) return nested
			}
			return undefined
		},
		async validate() {
			const results = await Promise.all(this.providers.map((p) => p.validate()))
			return results.every(Boolean)
		},
		reset() {
			this.providers.forEach((p) => p.reset())
		},
		handleSubmit(callback) {
			return this.validate().then((valid) => valid && callback())
		},
	},
	render() {
		return this.$slots.default?.({
			invalid: this.invalid,
			valid: !this.invalid,
			handleSubmit: this.handleSubmit,
			validate: this.validate,
			reset: this.reset,
		})
	},
}

export const ValidationProvider = {
	name: 'ValidationProvider',
	compatConfig: { MODE: 3 },
	inject: { validationObserver: { default: null } },
	props: {
		rules: { type: [String, Object], default: '' },
		name: { type: String, default: '' },
		vid: { type: String, default: undefined },
		slim: Boolean,
		tag: { type: String, default: 'span' },
	},
	data() {
		return { errors: [], isValid: true, validated: false }
	},
	created() {
		// Not reactive: it is read and written while rendering
		this.currentValue = UNSET
		this.validationObserver?.register(this)
	},
	beforeUnmount() {
		this.validationObserver?.unregister(this)
	},
	watch: {
		rules() {
			if (this.validated) this.validate()
		},
	},
	methods: {
		async check() {
			const errors = []
			for (const { name, params } of parseRules(this.rules)) {
				const rule = rules[name]
				if (!rule) continue
				const value = this.currentValue === UNSET ? undefined : this.currentValue
				let args = params
				if (name === 'confirmed') {
					const target = this.validationObserver?.findByVid(params[0])
					args = [target && target.currentValue !== UNSET ? target.currentValue : undefined]
				}
				const empty = value === undefined || value === null || value === ''
				if (empty && name !== 'required' && !rule.computesRequired) continue
				const ok = await rule.validate(value, args)
				if (!ok) {
					const message = typeof rule.message === 'function' ? rule.message(this.name, args) : rule.message
					errors.push(String(message).replace(/\{(\w+)\}/g, (_, key) => (key === '_field_' ? this.name : args[0] ?? '')))
					break
				}
			}
			this.isValid = errors.length === 0
			return errors
		},
		async validate() {
			this.errors = await this.check()
			this.validated = true
			return this.isValid
		},
		reset() {
			this.errors = []
			this.validated = false
		},
	},
	render() {
		const vnodes = this.$slots.default?.(
			reactive({
				errors: this.errors,
				valid: this.validated && this.isValid,
				invalid: !this.isValid,
				validated: this.validated,
			}),
		)
		const value = findValue(vnodes)
		if (value !== this.currentValue) {
			const first = this.currentValue === UNSET
			this.currentValue = value
			// Validate silently on first render, show errors once the user changes the value
			Promise.resolve().then(() => (first ? this.check() : this.validate()))
		}
		return vnodes
	},
}

// Built-in rules used by the app, with vee-validate 3 semantics
export const builtInRules = {
	required: { validate: (value) => !(value === undefined || value === null || String(value).trim() === '' || (Array.isArray(value) && !value.length)), computesRequired: true },
	email: { validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) },
	min: { validate: (value, [length]) => String(value).length >= Number(length) },
	length: { validate: (value, [length]) => (Array.isArray(value) ? value.length : String(value).length) === Number(length) },
	confirmed: { validate: (value, [other]) => value === other },
}
