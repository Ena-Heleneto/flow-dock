<script setup lang="ts">
import { useDraggable } from '@vueuse/core'
import { computed, onMounted, ref } from 'vue'
import { sendMessage } from 'webext-bridge/content-script'
import 'uno.css'
// import logger from '~/utils/logger.util'

const hasMoved = ref<boolean>(false)
const startPos = ref<{ x: number, y: number } | null>(null)
async function handleClick() {
  // show.value = !show.value
  logger.log('Button clicked!')
  try {
    const result = await sendMessage('save-page', {}, 'background')
    logger.success('save-page success', result)
  }
  catch (error) {
    logger.error('save-page failed', error)
  }
}

const DragTargetRef = useTemplateRef<HTMLElement | null>('DragTargetRef')

const { x, y, style, isDragging } = useDraggable(DragTargetRef, {
  initialValue: { x: 0, y: 0 },
  capture: false,
  preventDefault: false,
  stopPropagation: false,
  onStart(position) {
    hasMoved.value = false
    startPos.value = { x: position.x, y: position.y }
  },
  onMove(position) {
    const start = startPos.value
    if (!start)
      return
    if (Math.abs(position.x - start.x) + Math.abs(position.y - start.y) > 3)
      hasMoved.value = true
  },
  onEnd() {
    startPos.value = null
  },
})

const dragStyle = computed(() => [
  style.value,
  {
    cursor: isDragging.value ? 'grabbing' : 'grab',
    touchAction: 'none',
  },
])

onMounted(() => {
  const margin = 20
  const size = 40
  x.value = window.innerWidth - margin - size
  y.value = window.innerHeight - margin - size
})
</script>

<template>
  <div
    ref="DragTargetRef"
    :style="dragStyle"
    items="center"
    fixed="~"
    z="100"
    flex="~"
    font="sans"
    select="none"
    leading="1em"
  >
    <button
      class="flex w-10 h-10 rounded-full shadow cursor-pointer border-none"
      bg="#7C3CFF hover:#6A2BFF"
      @click.stop="!hasMoved && handleClick()"
    >
      <div i-mdi:clipboard-text-clock-outline block="~" m="auto" text="white lg" />

      <!-- 录制中 -->
      <!-- mdi:record-rec -->
    </button>
  </div>
</template>
