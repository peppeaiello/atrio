<script>
// CodeMirror 5 editor with the vue-codemirror 4 API used by the file browser (Vue 2 only):
// v-model, `options`, and `ready` / `input` events.
import CodeMirror from 'codemirror'

export default {
	name: 'Codemirror',
	compatConfig: { MODE: 3 },
	props: {
		modelValue: { type: String, default: undefined },
		value: { type: String, default: undefined },
		options: { type: Object, default: () => ({}) },
	},
	emits: ['update:modelValue', 'input', 'ready'],
	computed: {
		content() {
			return this.modelValue ?? this.value ?? ''
		},
	},
	watch: {
		content(value) {
			if (this.cm && value !== this.cm.getValue()) this.cm.setValue(value)
		},
		options: {
			deep: true,
			handler(options) {
				Object.entries(options).forEach(([key, value]) => this.cm?.setOption(key, value))
			},
		},
	},
	mounted() {
		this.cm = CodeMirror.fromTextArea(this.$refs.textarea, this.options)
		// vue-codemirror exposed the instance as `codemirror`
		this.codemirror = this.cm
		this.cm.setValue(this.content)
		this.cm.on('change', (cm) => {
			const value = cm.getValue()
			this.$emit('update:modelValue', value)
			this.$emit('input', value)
		})
		this.$emit('ready', this.cm)
	},
	beforeUnmount() {
		this.cm?.toTextArea()
	},
}
</script>

<template>
	<div class="vue-codemirror">
		<textarea ref="textarea"></textarea>
	</div>
</template>
