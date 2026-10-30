<script setup>
import { computed, ref } from 'vue'
import FilesIcon from './FilesIcon.vue'
import { activity, baseName, cancelUpload, clearFinished, formatSize } from './files.js'

const collapsed = ref(false)

const active = computed(() =>
  activity.uploads.filter(u => u.status === 'waiting' || u.status === 'uploading').length
  + activity.tasks.filter(t => !t.finished).length,
)
const visible = computed(() => activity.uploads.length + activity.tasks.length > 0)

const overall = computed(() => {
  let total = 0
  let done = 0
  activity.uploads.forEach((u) => {
    if (u.status === 'canceled' || u.status === 'failed')
      return
    total += u.total
    done += u.loaded
  })
  activity.tasks.forEach((t) => {
    total += t.total_size || 0
    done += t.finished ? t.total_size || 0 : t.processed_size || 0
  })
  return total ? Math.min(100, Math.round((done / total) * 100)) : 100
})

function percent(loaded, total) {
  return total ? Math.min(100, Math.round((loaded / total) * 100)) : 100
}

const statusIcon = { done: 'checkCircle', failed: 'alert', canceled: 'x', waiting: 'pause' }
</script>

<template>
  <section v-if="visible" :aria-label="$t('files.activity')" class="activity" :class="{ 'is-collapsed': collapsed }">
    <header class="activity__head">
      <FilesIcon :size="18" name="activity" />
      <div class="activity__title" aria-live="polite">
        <strong>{{ active ? $t('files.inProgress', { n: active }) : $t('files.allDone') }}</strong>
        <span>{{ overall }}%</span>
      </div>
      <button :aria-expanded="collapsed ? 'false' : 'true'" :aria-label="$t('files.activity')" class="icon-btn" type="button" @click="collapsed = !collapsed">
        <FilesIcon :class="{ 'is-flipped': collapsed }" :size="18" class="chev" name="chevronDown" />
      </button>
      <button v-if="!active" :aria-label="$t('files.clearFinished')" :title="$t('files.clearFinished')" class="icon-btn" type="button" @click="clearFinished">
        <FilesIcon :size="18" name="x" />
      </button>
    </header>
    <div class="bar" role="progressbar" :aria-valuenow="overall" aria-valuemin="0" aria-valuemax="100">
      <span :style="{ width: `${overall}%` }" />
    </div>

    <ul v-show="!collapsed" class="activity__list">
      <li v-for="task in activity.tasks" :key="`t${task.id}`" class="job">
        <FilesIcon :name="task.type === 'move' ? 'move' : 'copy'" :size="16" />
        <div class="job__main">
          <span class="job__name">{{ $t(task.type === 'move' ? 'files.moving' : 'files.copying') }} · {{ baseName(task.processing_path || task.to || '') }}</span>
          <span class="job__meta">
            {{ task.finished ? $t('files.done') : `${percent(task.processed_size, task.total_size)}% · ${formatSize(task.processed_size)} / ${formatSize(task.total_size)}` }}
          </span>
          <div v-if="!task.finished" class="bar bar--thin">
            <span :style="{ width: `${percent(task.processed_size, task.total_size)}%` }" />
          </div>
        </div>
      </li>
      <li v-for="up in activity.uploads" :key="`u${up.id}`" :class="`is-${up.status}`" class="job">
        <FilesIcon :name="statusIcon[up.status] || 'upload'" :size="16" />
        <div class="job__main">
          <span class="job__name" :title="up.relativePath">{{ up.relativePath }}</span>
          <span class="job__meta">
            <template v-if="up.status === 'uploading'">{{ percent(up.loaded, up.total) }}% · {{ formatSize(up.loaded) }} / {{ formatSize(up.total) }}</template>
            <template v-else-if="up.status === 'failed'">{{ $t('files.failed') }} · {{ up.error }}</template>
            <template v-else>{{ $t(`files.${up.status}`) }} · {{ formatSize(up.total) }}</template>
          </span>
          <div v-if="up.status === 'uploading'" class="bar bar--thin">
            <span :style="{ width: `${percent(up.loaded, up.total)}%` }" />
          </div>
        </div>
        <button
          v-if="up.status === 'uploading' || up.status === 'waiting'" :aria-label="$t('files.cancel')" :title="$t('files.cancel')"
          class="icon-btn icon-btn--small" type="button" @click="cancelUpload(up)"
        >
          <FilesIcon :size="16" name="x" />
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.activity {
  position: absolute;
  right: 20px;
  bottom: 20px;
  z-index: 20;
  width: min(380px, calc(100% - 32px));
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border-radius: 20px;
  background: var(--files-panel-strong);
  backdrop-filter: blur(32px) saturate(150%);
  border: 1px solid var(--files-border-strong);
  box-shadow: 0 16px 48px rgba(2, 6, 23, 0.45);
  color: var(--files-text);
}

.activity__head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.activity__title {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 14px;
}

.activity__title span {
  font-size: 12px;
  color: var(--files-muted);
}

.icon-btn {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--files-text-soft);
  cursor: pointer;
}

.icon-btn:hover {
  background: var(--files-hover-strong);
  color: var(--files-text);
}

.icon-btn--small {
  width: 28px;
  height: 28px;
}

.chev {
  transition: transform 0.15s ease;
}

.chev.is-flipped {
  transform: rotate(180deg);
}

.bar {
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.bar span {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #22D3EE, #6366F1);
  transition: width 0.2s ease;
}

.bar--thin {
  height: 4px;
  margin-top: 4px;
}

.activity__list {
  max-height: 260px;
  overflow-y: auto;
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.job {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 6px;
  border-radius: 12px;
  color: var(--files-text-soft);
}

.job > .files-icon {
  margin-top: 2px;
}

.job__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.job__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--files-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.job__meta {
  font-size: 12px;
  color: var(--files-muted);
  overflow-wrap: anywhere;
}

.is-done > .files-icon {
  color: #6EE7B7;
}

.is-failed > .files-icon,
.is-failed .job__meta {
  color: #FDA4AF;
}

.is-canceled {
  opacity: 0.6;
}

@media (max-width: 720px) {
  .activity {
    right: 16px;
    bottom: 16px;
  }
}
</style>
