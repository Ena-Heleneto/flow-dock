<script setup lang="ts">
import { computed } from 'vue'

interface RecorderOverlayState {
  isRecording: boolean
  isSyncingSession: boolean
  sessionId: string
  sentCount: number
  failedCount: number
  isCollapsed: boolean
}

const props = defineProps<{
  state: RecorderOverlayState
}>()

const emit = defineEmits<{
  toggle: []
  toggleCollapse: []
  dragStart: [event: PointerEvent]
}>()

const statusText = computed(() => {
  return props.state.isRecording ? '状态：录制中' : '状态：未录制'
})

const countText = computed(() => {
  return `已录制 ${props.state.sentCount} · 保存失败 ${props.state.failedCount}`
})

const sessionText = computed(() => {
  return `会话: ${props.state.sessionId || '--'}`
})

const actionText = computed(() => {
  if (props.state.isSyncingSession)
    return '处理中...'

  return props.state.isRecording ? '停止录制' : '开始录制'
})

const collapsedStatusText = computed(() => {
  return props.state.isRecording
    ? `录制中 · 已录制 ${props.state.sentCount}`
    : '未录制'
})

function handleToggleClick() {
  emit('toggle')
}

function handleToggleCollapse() {
  emit('toggleCollapse')
}

function handleDragStart(event: PointerEvent) {
  emit('dragStart', event)
}
</script>

<template>
  <div
    class="flow-dock-recorder-root"
    :class="{ 'is-collapsed': state.isCollapsed }"
    :data-recording="state.isRecording ? 'yes' : 'no'"
  >
    <div class="flow-dock-recorder-header" @pointerdown="handleDragStart">
      <div class="flow-dock-recorder-title">
        FlowDock 录制器
      </div>

      <button
        type="button"
        class="flow-dock-recorder-collapse-button"
        :title="state.isCollapsed ? '展开浮框' : '收起浮框'"
        @pointerdown.stop
        @click.stop="handleToggleCollapse"
      >
        {{ state.isCollapsed ? '展开' : '收起' }}
      </button>
    </div>

    <div v-if="!state.isCollapsed" class="flow-dock-recorder-details">
      <div class="flow-dock-recorder-line">
        {{ statusText }}
      </div>

      <div class="flow-dock-recorder-line">
        {{ countText }}
      </div>

      <div class="flow-dock-recorder-session">
        {{ sessionText }}
      </div>
    </div>

    <div v-else class="flow-dock-recorder-collapsed-status">
      {{ collapsedStatusText }}
    </div>

    <button
      type="button"
      class="flow-dock-recorder-button"
      :class="{
        'is-syncing': state.isSyncingSession,
        'is-recording': state.isRecording && !state.isSyncingSession,
        'is-idle': !state.isRecording && !state.isSyncingSession,
      }"
      :disabled="state.isSyncingSession"
      @click="handleToggleClick"
    >
      {{ actionText }}
    </button>
  </div>
</template>
