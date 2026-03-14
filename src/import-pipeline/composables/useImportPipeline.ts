import {
  AUTO_EXTRACT_CANDIDATES,
  DEFAULT_BATCH_SIZE,
  DEFAULT_DYNAMIC_PARAMS_TEXT,
  DEFAULT_FIXED_PARAMS_TEXT,
  DEFAULT_HEADERS_TEXT,
  DEFAULT_INPUT_TEXT,
  DEFAULT_METHOD,
  DEFAULT_REQUEST_MODE,
  DEFAULT_WRAPPER_KEY,
  FORBIDDEN_REQUEST_HEADER_NAMES,
  FORBIDDEN_REQUEST_HEADER_PREFIXES,
  READY_MESSAGE,
} from '../config/local.config'
import type {
  BatchResult,
  CookieDiagnostic,
  JsonObject,
  ParsedHeadersResult,
  RequestMethod,
  RequestMode,
  RunStatus,
} from '../types'
import { useImportPipelineTemplate } from './useImportPipelineTemplate'

export function useImportPipeline() {
  const { parseJsonObject, buildRequestBody } = useImportPipelineTemplate()

  const endpoint = ref('')
  const method = ref<RequestMethod>(DEFAULT_METHOD)
  const batchSize = ref(DEFAULT_BATCH_SIZE)
  const requestMode = ref<RequestMode>(DEFAULT_REQUEST_MODE)
  const wrapperKey = ref(DEFAULT_WRAPPER_KEY)
  const autoExtractObjectField = ref(true)

  const headersText = ref(DEFAULT_HEADERS_TEXT)
  const fixedParamsText = ref(DEFAULT_FIXED_PARAMS_TEXT)
  const dynamicParamsText = ref(DEFAULT_DYNAMIC_PARAMS_TEXT)
  const inputText = ref(DEFAULT_INPUT_TEXT)

  const parsedItems = ref<Record<string, unknown>[]>([])
  const parseError = ref('')
  const previewIndex = ref(0)

  const runStatus = ref<RunStatus>('idle')
  const runningBatch = ref(0)
  const totalBatch = ref(0)
  const result = ref<BatchResult>({ total: 0, success: 0, failed: 0 })
  const logs = ref<string[]>([READY_MESSAGE])
  const stopRequested = ref(false)

  const canRun = computed(() => {
    return runStatus.value !== 'running'
      && endpoint.value.trim().length > 0
      && parsedItems.value.length > 0
      && !parseError.value
  })

  const previewItems = computed(() => parsedItems.value.slice(0, 3))

  const mergedPreviewError = computed(() => {
    if (parsedItems.value.length === 0)
      return '暂无可预览数据，请先解析输入 JSON。'

    try {
      parseJsonObject(fixedParamsText.value, '固定参数')
      parseJsonObject(dynamicParamsText.value, '动态参数模板')
      return ''
    }
    catch (error) {
      return error instanceof Error ? error.message : '预览构建失败'
    }
  })

  const mergedPreviewText = computed(() => {
    if (mergedPreviewError.value)
      return ''

    const index = Math.min(Math.max(previewIndex.value, 0), parsedItems.value.length - 1)
    const item = parsedItems.value[index] as JsonObject
    const fixedParams = parseJsonObject(fixedParamsText.value, '固定参数')
    const dynamicTemplate = parseJsonObject(dynamicParamsText.value, '动态参数模板')
    const body = buildRequestBody(item, index, fixedParams, dynamicTemplate, requestMode.value, wrapperKey.value)
    return JSON.stringify(body, null, 2)
  })

  const statusTone = computed(() => {
    if (runStatus.value === 'success')
      return 'bg-emerald-100 text-emerald-700'
    if (runStatus.value === 'error')
      return 'bg-rose-100 text-rose-700'
    if (runStatus.value === 'running')
      return 'bg-amber-100 text-amber-700'
    if (runStatus.value === 'stopped')
      return 'bg-slate-200 text-slate-700'
    return 'bg-slate-100 text-slate-600'
  })

  const statusText = computed(() => {
    if (runStatus.value === 'success')
      return '执行成功'
    if (runStatus.value === 'error')
      return '执行失败'
    if (runStatus.value === 'running')
      return '执行中'
    if (runStatus.value === 'stopped')
      return '已停止'
    return '待执行'
  })

  const cookieDiagnostic = computed<CookieDiagnostic>(() => {
    const endpointValue = endpoint.value.trim()
    const { value: headerObject, error: headerParseError } = tryParseHeadersObject(headersText.value)

    if (headerParseError) {
      return {
        toneClass: 'border-rose-200 bg-rose-50 text-rose-700',
        title: 'Cookie 检测：请求头 JSON 解析失败',
        messages: [`请先修复请求头 JSON：${headerParseError}`],
      }
    }

    const keys = Object.keys(headerObject)
    const hasCookieHeader = keys.some(key => key.trim().toLowerCase() === 'cookie')

    let parsedEndpoint: URL | null = null
    if (endpointValue) {
      try {
        parsedEndpoint = new URL(endpointValue)
      }
      catch {
        parsedEndpoint = null
      }
    }

    if (hasCookieHeader) {
      const messages: string[] = [
        '检测到你填写了 Cookie 请求头。浏览器会阻止手动设置该头，因此它不会实际发出。',
        '页面已启用 credentials=include，浏览器只会自动附带目标域已有且策略允许的 Cookie。',
      ]

      if (parsedEndpoint) {
        messages.push(`目标域：${parsedEndpoint.host}，请先在该域完成登录并确认 Cookie 存在。`)
        if (parsedEndpoint.protocol === 'http:')
          messages.push('目标是 HTTP；若 Cookie 标记了 Secure，将不会被发送。')
      }
      else if (endpointValue) {
        messages.push('接口地址不是合法 URL，无法判断目标域 Cookie 发送条件。')
      }

      return {
        toneClass: 'border-amber-200 bg-amber-50 text-amber-800',
        title: 'Cookie 检测：当前配置无法手动携带 Cookie',
        messages,
      }
    }

    const messages = [
      '未检测到手动 Cookie 头，符合浏览器安全规则。',
      '如需鉴权，请确保目标域已有 Cookie，并由浏览器通过 credentials=include 自动携带。',
    ]

    if (parsedEndpoint)
      messages.push(`当前目标域：${parsedEndpoint.host}`)
    else if (endpointValue)
      messages.push('接口地址不是合法 URL，建议修正后再执行。')

    return {
      toneClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      title: 'Cookie 检测：配置正常',
      messages,
    }
  })

  function appendLog(message: string) {
    logs.value.unshift(`[${new Date().toLocaleTimeString()}] ${message}`)
  }

  function toObjectArray(input: unknown): Record<string, unknown>[] {
    if (Array.isArray(input)) {
      if (!input.every(item => item && typeof item === 'object' && !Array.isArray(item)))
        throw new Error('数组元素必须全部是对象。')
      return input as Record<string, unknown>[]
    }

    if (!input || typeof input !== 'object')
      throw new Error('输入必须是对象数组，或包含对象数组的 JSON 对象。')

    if (autoExtractObjectField.value) {
      for (const key of AUTO_EXTRACT_CANDIDATES) {
        const value = (input as Record<string, unknown>)[key]
        if (Array.isArray(value))
          return toObjectArray(value)
      }
    }

    return [input as Record<string, unknown>]
  }

  function parseInput() {
    parseError.value = ''
    try {
      const parsed = JSON.parse(inputText.value)
      const array = toObjectArray(parsed)
      parsedItems.value = array
      appendLog(`解析成功，共 ${array.length} 条记录。`)
    }
    catch (error) {
      parsedItems.value = []
      parseError.value = error instanceof Error ? error.message : '解析失败'
      appendLog(`解析失败：${parseError.value}`)
    }
  }

  function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file)
      return

    const reader = new FileReader()
    reader.onload = () => {
      inputText.value = String(reader.result ?? '')
      parseInput()
    }
    reader.onerror = () => {
      appendLog('读取文件失败。')
    }
    reader.readAsText(file, 'utf-8')
  }

  function isForbiddenRequestHeaderName(headerName: string): boolean {
    const lowerName = headerName.toLowerCase()
    if (FORBIDDEN_REQUEST_HEADER_NAMES.has(lowerName))
      return true

    for (const prefix of FORBIDDEN_REQUEST_HEADER_PREFIXES) {
      if (lowerName.startsWith(prefix))
        return true
    }

    return false
  }

  function tryParseHeadersObject(text: string): { value: Record<string, unknown>, error: string } {
    try {
      const parsed = JSON.parse(text) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {
          value: {},
          error: '请求头必须是 JSON 对象。',
        }
      }
      return {
        value: parsed as Record<string, unknown>,
        error: '',
      }
    }
    catch (error) {
      return {
        value: {},
        error: error instanceof Error ? error.message : '请求头解析失败。',
      }
    }
  }

  function parseHeaders(): ParsedHeadersResult {
    const parsedResult = tryParseHeadersObject(headersText.value)
    if (parsedResult.error)
      throw new Error(parsedResult.error)

    const result = new Headers()
    const blockedHeaderNames: string[] = []

    for (const [rawKey, value] of Object.entries(parsedResult.value)) {
      const key = rawKey.trim()
      if (!key)
        continue

      if (isForbiddenRequestHeaderName(key)) {
        blockedHeaderNames.push(key)
        continue
      }

      result.set(key, String(value))
    }

    return {
      headers: result,
      blockedHeaderNames,
    }
  }

  function headersToLogString(headers: Headers): string {
    const rows: string[] = []
    headers.forEach((value, key) => {
      rows.push(`${key}: ${value}`)
    })

    if (rows.length === 0)
      return '(空)'

    return rows.join('; ')
  }

  function chunkArray<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < items.length; i += size)
      chunks.push(items.slice(i, i + size))
    return chunks
  }

  async function requestCreateOne(
    item: JsonObject,
    index: number,
    headers: Headers,
    fixedParams: JsonObject,
    dynamicTemplate: JsonObject,
  ) {
    const body = buildRequestBody(item, index, fixedParams, dynamicTemplate, requestMode.value, wrapperKey.value)

    const response = await fetch(endpoint.value.trim(), {
      method: method.value,
      headers,
      body: JSON.stringify(body),
      credentials: 'include',
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`HTTP ${response.status} index=${index} ${text.slice(0, 120)}`)
    }
  }

  function resetRunStats() {
    runningBatch.value = 0
    totalBatch.value = 0
    result.value = {
      total: parsedItems.value.length,
      success: 0,
      failed: 0,
    }
  }

  function resetPipeline() {
    stopRequested.value = false
    runStatus.value = 'idle'
    resetRunStats()
    logs.value = ['已重置运行状态。']
  }

  function requestStop() {
    stopRequested.value = true
    appendLog('收到停止请求，将在当前批次结束后停止。')
  }

  async function runPipeline() {
    if (!canRun.value)
      return

    let headers: Headers
    let blockedHeaderNames: string[]
    let fixedParams: JsonObject
    let dynamicTemplate: JsonObject
    try {
      const parsedHeadersResult = parseHeaders()
      headers = parsedHeadersResult.headers
      blockedHeaderNames = parsedHeadersResult.blockedHeaderNames
      fixedParams = parseJsonObject(fixedParamsText.value, '固定参数')
      dynamicTemplate = parseJsonObject(dynamicParamsText.value, '动态参数模板')
    }
    catch (error) {
      runStatus.value = 'error'
      appendLog(error instanceof Error ? error.message : '参数配置解析失败')
      return
    }

    logs.value = []
    stopRequested.value = false
    runStatus.value = 'running'
    resetRunStats()

    const size = Math.max(1, Math.trunc(batchSize.value) || 1)
    const chunks = chunkArray(parsedItems.value, size)
    totalBatch.value = chunks.length

    appendLog(`开始执行，共 ${parsedItems.value.length} 条，分 ${chunks.length} 批，每批 ${size} 条。`)

    if (blockedHeaderNames.length > 0) {
      appendLog(`以下请求头是浏览器受限头，已忽略：${blockedHeaderNames.join(', ')}`)
      if (blockedHeaderNames.some(name => name.toLowerCase() === 'cookie')) {
        appendLog('Cookie 不能手动设置；已启用 credentials=include，请确认目标域已有可用 Cookie 且服务端允许凭据。')
      }
    }

    appendLog(`请求头快照：${headersToLogString(headers)}`)

    for (let batchIndex = 0; batchIndex < chunks.length; batchIndex += 1) {
      if (stopRequested.value) {
        runStatus.value = 'stopped'
        appendLog('批量执行已停止。')
        return
      }

      const batch = chunks[batchIndex]
      runningBatch.value = batchIndex + 1
      appendLog(`开始批次 ${runningBatch.value}/${totalBatch.value}`)

      const settled = await Promise.allSettled(
        batch.map((item, innerIndex) => {
          const index = batchIndex * size + innerIndex
          return requestCreateOne(item, index, headers, fixedParams, dynamicTemplate)
        }),
      )

      for (const row of settled) {
        if (row.status === 'fulfilled') {
          result.value.success += 1
        }
        else {
          result.value.failed += 1
          appendLog(`失败：${row.reason instanceof Error ? row.reason.message : '未知错误'}`)
        }
      }

      appendLog(`完成批次 ${runningBatch.value}/${totalBatch.value}`)
    }

    runStatus.value = result.value.failed > 0 ? 'error' : 'success'
    appendLog(`执行结束，成功 ${result.value.success}，失败 ${result.value.failed}。`)
  }

  watch(inputText, () => {
    parseError.value = ''
  })

  watch(parsedItems, () => {
    if (parsedItems.value.length === 0) {
      previewIndex.value = 0
      return
    }

    if (previewIndex.value > parsedItems.value.length - 1)
      previewIndex.value = parsedItems.value.length - 1
  })

  parseInput()

  return {
    endpoint,
    method,
    batchSize,
    requestMode,
    wrapperKey,
    autoExtractObjectField,
    headersText,
    fixedParamsText,
    dynamicParamsText,
    inputText,
    parsedItems,
    parseError,
    previewIndex,
    runStatus,
    runningBatch,
    totalBatch,
    result,
    logs,
    canRun,
    previewItems,
    mergedPreviewError,
    mergedPreviewText,
    statusTone,
    statusText,
    cookieDiagnostic,
    parseInput,
    handleFileChange,
    runPipeline,
    requestStop,
    resetPipeline,
  }
}
