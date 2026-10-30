<script setup>
// Small line chart for a series of values between 0 and `max`.
import { computed, useId } from 'vue'

defineOptions({ compatConfig: { MODE: 3 } })

const props = defineProps({
	values: { type: Array, default: () => [] },
	// Top of the scale; by default it follows the data so small changes stay visible
	max: { type: Number, default: null },
	color: { type: String, default: '#22D3EE' },
	// Number of points the chart is laid out for: it fills from the left as samples arrive
	capacity: { type: Number, default: 30 },
})

const gradientId = `spark-${useId()}`
const height = 32

const points = computed(() => {
	const step = 100 / Math.max(props.capacity - 1, 1)
	const max = props.max ?? Math.max(10, ...props.values.map((v) => v * 1.25))
	return props.values.slice(-props.capacity).map((value, index) => {
		const ratio = Math.min(Math.max(value / max, 0), 1)
		return [(index * step).toFixed(2), (height - 2 - ratio * (height - 4)).toFixed(2)]
	})
})

const line = computed(() => points.value.map((p) => p.join(',')).join(' '))
const area = computed(() => {
	if (points.value.length < 2) return ''
	const first = points.value[0][0]
	const last = points.value[points.value.length - 1][0]
	return `M${first},${height} L${line.value.replaceAll(' ', ' L')} L${last},${height} Z`
})
</script>

<template>
	<svg :viewBox="`0 0 100 ${height}`" aria-hidden="true" class="atrio-sparkline" preserveAspectRatio="none">
		<defs>
			<linearGradient :id="gradientId" x1="0" x2="0" y1="0" y2="1">
				<stop :stop-color="color" offset="0" stop-opacity="0.35" />
				<stop :stop-color="color" offset="1" stop-opacity="0" />
			</linearGradient>
		</defs>
		<path v-if="area" :d="area" :fill="`url(#${gradientId})`" />
		<polyline
			v-if="points.length > 1" :points="line" :stroke="color" fill="none" stroke-linecap="round"
			stroke-linejoin="round" stroke-width="2" vector-effect="non-scaling-stroke"
		/>
	</svg>
</template>

<style scoped>
.atrio-sparkline {
	display: block;
	width: 100%;
	height: 2rem;
}
</style>
