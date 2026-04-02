<script setup lang="ts">
import { useDraggable } from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { sendMessage } from 'webext-bridge/content-script'

const FLOAT_MIN_SIZE = 44
const FLOAT_MARGIN = 20
const STATUS_AUTO_CLEAR_MS = 2600

/**
 * 用于跟踪元素是否发生过移动
 * @type {Ref<boolean>}
 * @default false
 */
const hasMoved = ref<boolean>(false)

/**
 * 记录鼠标按下时的起始位置坐标
 * @type {Ref<{x: number, y: number} | null>}
 * @remarks
 * - 当鼠标按下时，存储起始位置的 x 和 y 坐标
 * - 初始值为 null，表示还未记录位置
 * - 用于计算鼠标拖动的距离和方向
 */
const startPos = ref<{ x: number, y: number } | null>(null)

const isProcessing = ref<boolean>(false)
const statusMessage = ref<string>('')
const isExists = ref<boolean>(false)
let statusClearTimer: ReturnType<typeof setTimeout> | null = null

function setStatus(message: string, autoClear = false) {
  statusMessage.value = message
  if (statusClearTimer) {
    clearTimeout(statusClearTimer)
    statusClearTimer = null
  }

  if (autoClear && message) {
    statusClearTimer = setTimeout(() => {
      statusMessage.value = ''
      statusClearTimer = null
    }, STATUS_AUTO_CLEAR_MS)
  }
}

/**
 * 处理保存页面的异步函数
 * 向后台发送保存页面的消息，并根据结果进行日志记录
 *
 * @async
 * @function handleSavePage
 * @returns {Promise<void>}
 * @throws {Error} 当消息发送失败时捕获错误并记录
 */
async function handleAnalyzePage() {
  const analyzeResult = await sendMessage('pages/analyze', {})
  logger.success('analyze-page success', analyzeResult)
  return analyzeResult
}

function getResponseCode(result: unknown): number {
  if (!result || typeof result !== 'object')
    return -1

  const code = (result as { code?: unknown }).code
  return typeof code === 'number' ? code : -1
}

function isSaveSuccess(result: unknown) {
  return getResponseCode(result) === 0
}

async function requestSaveWithRetry() {
  try {
    const result = await sendMessage('pages/save', {})
    logger.success('save-page success', result)
    return result
  }
  catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (!errorMessage.includes('Extension context invalidated'))
      throw error

    await new Promise(resolve => setTimeout(resolve, 300))
    const retryResult = await sendMessage('pages/save', {})
    logger.success('save-page success after retry', retryResult)
    return retryResult
  }
}

async function handleSavePage() {
  if (isProcessing.value)
    return

  isProcessing.value = true
  setStatus('处理中...')

  try {
    const result = await requestSaveWithRetry()
    if (isSaveSuccess(result)) {
      const analyzeResult = await handleAnalyzePage()
      if (getResponseCode(analyzeResult) === 0) {
        setStatus('保存并分析成功', true)
        isExists.value = true
      }
      else {
        setStatus('保存成功，分析失败', true)
      }
    }
    else {
      setStatus('保存未成功', true)
    }
  }
  catch (error: unknown) {
    setStatus('保存失败', true)
    logger.error('save-page failed', error)
  }
  finally {
    isProcessing.value = false
  }
}

function handleActionClick() {
  if (!hasMoved.value && !isProcessing.value)
    void handleSavePage()
}

/**
 * 获取拖拽目标元素的模板引用
 * @type {Ref<HTMLElement | null>}
 * @description 用于获取页面中用于拖拽操作的目标 DOM 元素的引用，
 * 初始值为 null，当组件挂载后会绑定到对应的 HTML 元素上
 */
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
  initialValue: { x: 100, y: 50 },
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
    transition: isDragging.value ? 'none' : 'box-shadow 0.2s ease',
  },
])

/**
 * 当前页面的 URL 地址
 * 通过 ref 包装，使其成为响应式数据
 * 初始值为 location.href（当前浏览器地址栏的完整 URL）
 *
 * @type {Ref<string>}
 */
const currentUrl = ref<string>(location.href)

/**
 * 处理页面位置变化
 * 监听URL变化，当URL发生改变时更新当前URL值并检查页面是否存在
 * @returns {void}
 */
function handleLocationChange() {
  const nextUrl = location.href
  if (nextUrl === currentUrl.value)
    return
  currentUrl.value = nextUrl
  void handleExistsPages()
}

/**
 * 保存原始的 history.pushState 方法的引用
 * 用于后续可能的方法拦截或恢复操作
 * @type {Function}
 */
const originalPushState = history.pushState

/**
 * 保存原始的 history.replaceState 方法
 * 用于后续恢复或调用原生的历史记录替换功能
 * @type {Function}
 */
const originalReplaceState = history.replaceState

/**
 * 重写浏览器历史记录方法
 *
 * 拦截 history.pushState 和 history.replaceState 方法，
 * 在调用原始方法后触发位置变化的处理程序。
 * 用于监听和响应浏览器历史记录的变更事件。
 *
 * @function overrideHistoryMethods
 * @returns {void}
 */
function overrideHistoryMethods() {
  history.pushState = function (...args) {
    originalPushState.apply(this, args)
    handleLocationChange()
  }

  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args)
    handleLocationChange()
  }
}

/**
 * 恢复历史记录方法
 * 将浏览器的 history.pushState 和 history.replaceState 方法
 * 恢复为原始的实现，用于撤销之前进行的方法重写或拦截
 */
function restoreHistoryMethods() {
  history.pushState = originalPushState
  history.replaceState = originalReplaceState
}

function getWidgetSize() {
  const element = DragTargetRef.value
  const width = element?.offsetWidth ?? FLOAT_MIN_SIZE
  const height = element?.offsetHeight ?? FLOAT_MIN_SIZE
  return { width, height }
}

function clampPosition() {
  const { width, height } = getWidgetSize()
  const maxX = Math.max(window.innerWidth - FLOAT_MARGIN - width, 0)
  const maxY = Math.max(window.innerHeight - FLOAT_MARGIN - height, 0)

  x.value = Math.min(Math.max(x.value, FLOAT_MARGIN), maxX)
  y.value = Math.min(Math.max(y.value, FLOAT_MARGIN), maxY)
}

function handleWindowResize() {
  clampPosition()
}

onMounted(async () => {
  await nextTick()
  const { width, height } = getWidgetSize()
  x.value = window.innerWidth - FLOAT_MARGIN - width
  y.value = window.innerHeight - FLOAT_MARGIN - height
  clampPosition()
  void handleExistsPages()
  overrideHistoryMethods()
  window.addEventListener('popstate', handleLocationChange)
  window.addEventListener('hashchange', handleLocationChange)
  window.addEventListener('resize', handleWindowResize)
})

onBeforeUnmount(() => {
  if (statusClearTimer)
    clearTimeout(statusClearTimer)

  restoreHistoryMethods()
  window.removeEventListener('popstate', handleLocationChange)
  window.removeEventListener('hashchange', handleLocationChange)
  window.removeEventListener('resize', handleWindowResize)
})

/**
 * 检查页面是否存在
 *
 * 向后台脚本发送消息，查询指定页面是否已存在。
 *
 * @async
 * @function handleExistsPages
 * @returns {Promise<void>}
 *
 * @throws {Error} 当发送消息失败时捕获错误并记录
 */
async function handleExistsPages() {
  try {
    const result = await sendMessage('pages/exists', {})
    const data = result && typeof result === 'object' ? (result as { data?: unknown }).data : false
    isExists.value = Boolean(data)
  }
  catch (error: unknown) {
    isExists.value = false
    logger.error('exists-pages failed', error)
  }
}
</script>

<template>
  <div
    ref="DragTargetRef"
    class="fd-widget"
    :style="dragStyle"
  >
    <div class="fd-status">
      <div class="fd-status-row">
        <div
          class="fd-status-dot"
          :class="isExists ? 'is-exists' : 'is-missing'"
        />
        <div class="fd-status-text">
          {{ isExists ? '页面已存在' : '页面未保存' }}
        </div>
      </div>

      <div v-if="statusMessage" class="fd-status-message">
        {{ statusMessage }}
      </div>
    </div>

    <button
      class="fd-action-button"
      :disabled="isProcessing"
      :title="isProcessing ? '处理中...' : '保存并分析当前页面'"
      @click.stop="handleActionClick"
    >
      <span v-if="isProcessing" class="fd-spinner" />
      <svg
        v-else
        class="fd-action-icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M9 2c-.6 0-1 .4-1 1v1H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h5.1a6.5 6.5 0 0 1-.6-2H6V6h2v1h8V6h2v4.6a6.5 6.5 0 0 1 2 1.3V6a2 2 0 0 0-2-2h-2V3c0-.6-.4-1-1-1H9Zm1 2h4v1h-4V4Zm7 8a5 5 0 1 0 0 10a5 5 0 0 0 0-10Zm-.5 2h1.5v2.7l2.2 1.3l-.8 1.3l-2.9-1.8V14Z" />
      </svg>
    </button>
  </div>
</template>
