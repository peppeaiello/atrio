<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import FilesIcon from './FilesIcon.vue'
import FileThumb from './FileThumb.vue'
import { formatDate, formatSize, kindOf } from './files.js'

const props = defineProps({
  items: { type: Array, required: true },
  selected: { type: Array, required: true },
  cutPaths: { type: Array, default: () => [] },
  focusIndex: { type: Number, default: -1 },
  view: { type: String, default: 'grid' },
  sortKey: { type: String, default: 'name' },
  sortDir: { type: String, default: 'asc' },
  locale: { type: String, default: undefined },
})

const emit = defineEmits(['pick', 'open', 'toggle', 'menu', 'sort'])

const root = ref(null)
const selectedSet = computed(() => new Set(props.selected))
const cutSet = computed(() => new Set(props.cutPaths))

function meta(item) {
  return item.is_dir ? '' : formatSize(item.size)
}

// Number of columns the grid lays out right now, for arrow-key navigation.
function columns() {
  if (props.view !== 'grid' || !root.value)
    return 1
  const template = getComputedStyle(root.value).gridTemplateColumns
  return Math.max(1, template.split(' ').filter(Boolean).length)
}
defineExpose({ columns })

watch(() => props.focusIndex, async (index) => {
  await nextTick()
  const el = root.value?.querySelector(`[data-index="${index}"]`)
  el?.scrollIntoView({ block: 'nearest' })
})

const sortColumns = [
  { key: 'name', label: 'files.name' },
  { key: 'date', label: 'files.modified' },
  { key: 'size', label: 'files.size' },
  { key: 'type', label: 'files.kind' },
]
</script>

<template>
  <div v-if="view === 'list'" :class="{ 'has-selection': selected.length }" class="list" role="presentation">
    <div class="list__head" role="presentation">
      <span class="list__check" />
      <button
        v-for="col in sortColumns" :key="col.key" :class="[`col--${col.key}`, { 'is-active': sortKey === col.key }]"
        class="list__sort" type="button" @click="emit('sort', col.key)"
      >
        {{ $t(col.label) }}
        <FilesIcon v-if="sortKey === col.key" :class="{ 'is-desc': sortDir === 'desc' }" :size="14" class="sort-arrow" name="arrowUp" />
      </button>
      <span class="list__more" />
    </div>
    <div ref="root" class="list__body">
      <div
        v-for="(item, index) in items" :id="`files-item-${index}`" :key="item.path"
        :aria-selected="selectedSet.has(item.path) ? 'true' : 'false'"
        :class="{ 'is-selected': selectedSet.has(item.path), 'is-focused': index === focusIndex, 'is-cut': cutSet.has(item.path) }"
        :data-index="index" class="row" role="option"
        @click="emit('pick', index, $event)" @contextmenu.prevent="emit('menu', index, $event)" @dblclick="emit('open', index)"
      >
        <span class="list__check">
          <button
            :aria-label="item.name" :aria-pressed="selectedSet.has(item.path) ? 'true' : 'false'" class="check" tabindex="-1"
            type="button" @click.stop="emit('toggle', index)"
          >
            <FilesIcon v-if="selectedSet.has(item.path)" :size="12" :stroke-width="3" name="check" />
          </button>
        </span>
        <span class="col--name row__name">
          <FileThumb :item="item" size="small" />
          <span class="row__label" :title="item.name">{{ item.name }}</span>
        </span>
        <span class="col--date row__meta">{{ formatDate(item.date, locale) }}</span>
        <span class="col--size row__meta">{{ item.is_dir ? '—' : formatSize(item.size) }}</span>
        <span class="col--type row__meta">{{ item.is_dir ? $t('files.folder') : kindOf(item) === 'file' ? $t('files.file') : item.name.split('.').pop().toUpperCase() }}</span>
        <span class="list__more">
          <button :aria-label="$t('files.more')" class="more" tabindex="-1" type="button" @click.stop="emit('menu', index, $event)">
            <FilesIcon :size="18" name="more" />
          </button>
        </span>
      </div>
    </div>
  </div>

  <div v-else ref="root" :class="{ 'has-selection': selected.length }" class="grid" role="presentation">
    <div
      v-for="(item, index) in items" :id="`files-item-${index}`" :key="item.path"
      :aria-selected="selectedSet.has(item.path) ? 'true' : 'false'"
      :class="{ 'is-selected': selectedSet.has(item.path), 'is-focused': index === focusIndex, 'is-cut': cutSet.has(item.path) }"
      :data-index="index" class="tile" role="option"
      @click="emit('pick', index, $event)" @contextmenu.prevent="emit('menu', index, $event)" @dblclick="emit('open', index)"
    >
      <FileThumb :item="item" />
      <span class="tile__name" :title="item.name">{{ item.name }}</span>
      <span class="tile__meta">{{ meta(item) }}</span>
      <button
        :aria-label="item.name" :aria-pressed="selectedSet.has(item.path) ? 'true' : 'false'" class="check tile__check" tabindex="-1"
        type="button" @click.stop="emit('toggle', index)"
      >
        <FilesIcon v-if="selectedSet.has(item.path)" :size="12" :stroke-width="3" name="check" />
      </button>
      <button :aria-label="$t('files.more')" class="more tile__more" tabindex="-1" type="button" @click.stop="emit('menu', index, $event)">
        <FilesIcon :size="18" name="more" />
      </button>
    </div>
  </div>
</template>

<style scoped>
/* ---------- grid */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  align-content: start;
}

.tile {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 8px 10px;
  border-radius: 18px;
  border: 1px solid transparent;
  cursor: default;
  user-select: none;
  transition: background-color 0.12s ease, border-color 0.12s ease;
}

.tile:hover {
  background: var(--files-hover);
}

.tile__name {
  margin-top: 4px;
  padding: 0 2px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--files-text);
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tile__meta {
  padding: 0 2px;
  min-height: 16px;
  font-size: 12px;
  color: var(--files-muted);
}

.tile__check {
  position: absolute;
  top: 14px;
  left: 14px;
}

.tile__more {
  position: absolute;
  top: 12px;
  right: 12px;
  background: rgba(15, 23, 42, 0.7);
}

/* ---------- shared states */
.is-selected {
  background: var(--files-selected);
  border-color: var(--files-selected-border);
}

.is-selected:hover {
  background: var(--files-selected);
}

.is-focused {
  outline: 2px solid var(--files-focus);
  outline-offset: -2px;
}

.is-cut {
  opacity: 0.5;
}

.check {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, 0.55);
  background: rgba(15, 23, 42, 0.55);
  color: #0B1120;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s ease;
}

.is-selected .check {
  opacity: 1;
  border-color: transparent;
  background: var(--files-accent);
}

.more {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--files-text);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s ease;
}

.more:hover {
  background: var(--files-hover-strong);
}

.tile:hover .check,
.tile:hover .more,
.row:hover .check,
.row:hover .more,
.is-focused .check,
.is-focused .more,
.has-selection .check {
  opacity: 1;
}

@media (hover: none) {
  .check,
  .more {
    opacity: 1;
  }
}

/* ---------- list */
.list {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.list__head,
.row {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) 170px 96px 90px 40px;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
}

.list__head {
  position: sticky;
  top: 0;
  z-index: 1;
  height: 40px;
  border-bottom: 1px solid var(--files-border);
}

.list__sort {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 32px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--files-muted);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
}

.list__sort.is-active,
.list__sort:hover {
  color: var(--files-text);
}

.sort-arrow {
  transition: transform 0.15s ease;
}

.sort-arrow.is-desc {
  transform: rotate(180deg);
}

.list__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 4px;
}

.row {
  min-height: 48px;
  border-radius: 12px;
  border: 1px solid transparent;
  cursor: default;
  user-select: none;
}

.row:hover {
  background: var(--files-hover);
}

.row__name {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.row__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 600;
  color: var(--files-text);
}

.row__meta {
  font-size: 13px;
  color: var(--files-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.list__check,
.list__more {
  display: grid;
  place-items: center;
}

@media (max-width: 720px) {
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 8px;
  }

  .list__head,
  .row {
    grid-template-columns: 28px minmax(0, 1fr) 72px 36px;
  }

  .col--date,
  .col--type {
    display: none;
  }
}
</style>
