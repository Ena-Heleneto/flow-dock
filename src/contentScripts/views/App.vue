<script setup lang="ts">
import { useDraggable } from '@vueuse/core'
import { computed, onMounted, ref } from 'vue'
import { sendMessage } from 'webext-bridge/content-script'

const hasMoved = ref<boolean>(false)
const startPos = ref<{ x: number, y: number } | null>(null)
async function handleSavePage() {
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

/**
 * 初始化拖动功能
 *
 * @description
 * 使用 useDraggable 组合式函数来管理元素的拖动行为。
 * 通过跟踪鼠标位置变化来判断是否发生了真实的拖动移动（阈值为3像素）。
 *
 * @property {number} x - 元素当前的X轴位置坐标
 * @property {number} y - 元素当前的Y轴位置坐标
 * @property {object} style - 应用于元素的样式对象（包含transform等）
 * @property {boolean} isDragging - 指示元素是否正在被拖动
 *
 * @config {object} options - 拖动配置选项
 * @config {object} options.initialValue - 初始位置 {x: 0, y: 0}
 * @config {boolean} options.capture - 是否使用事件捕获阶段，false 表示冒泡阶段
 * @config {boolean} options.preventDefault - 是否阻止默认行为，设为 false
 * @config {boolean} options.stopPropagation - 是否阻止事件冒泡，设为 false
 *
 * @callback onStart - 拖动开始时的回调函数
 * @param {object} position - 拖动起始位置 {x, y}
 *
 * @callback onMove - 拖动移动时的回调函数
 * @param {object} position - 当前鼠标位置 {x, y}
 * @description 当移动距离超过3像素阈值时，标记 hasMoved 为 true
 *
 * @callback onEnd - 拖动结束时的回调函数
 * @description 清空保存的起始位置信息
 */
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

/**
 * 拖拽样式计算属性
 * 根据拖拽状态动态计算应用于元素的样式
 *
 * @returns {Array} 返回样式数组，包含：
 *   - style.value: 基础样式对象
 *   - cursor: 鼠标光标样式，拖拽时为 'grabbing'，否则为 'grab'
 *   - touchAction: 触摸操作设置，禁用默认触摸行为
 */
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

// const result = await sendMessage('save-page', {}, 'background')
await sendMessage('exists-pages')
</script>

<template>
  <div
    ref="DragTargetRef"
    :style="dragStyle"
    fixed="~"
    z="100"
    flex="~"
    font="sans"
    justify="center"
    items="center"
    select="none"
    leading="1em"
    w="100px"
    h="50px"
    bg="#7C3CFF hover:#6A2BFF"
  >
    <button
      class="flex w-10 h-10 rounded-full shadow cursor-pointer border-none"
      @click.stop="!hasMoved && handleSavePage()"
    >
      <div i-mdi:clipboard-text-clock-outline block="~" m="auto" text="white lg" />

      <!-- mdi:record-rec -->
    </button>
  </div>
</template>
