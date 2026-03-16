import { sendMessage } from 'webext-bridge/options'
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
  SavedImportPipelineConfig,
} from '../types'
import { useImportPipelineTemplate } from './useImportPipelineTemplate'
import { useXls } from './useXls'

export function useImportPipeline() {
  const { parseJsonObject, buildRequestBody } = useImportPipelineTemplate()
  const { parseExcelFile } = useXls()

  const waitForUiPaint = async () => {
    await nextTick()
    await new Promise<void>(resolve => setTimeout(resolve, 30))
  }

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
  const isImporting = ref(false)
  const previewIndex = ref(0)

  const runStatus = ref<RunStatus>('idle')
  const runningBatch = ref(0)
  const totalBatch = ref(0)
  const result = ref<BatchResult>({ total: 0, success: 0, failed: 0 })
  const logs = ref<string[]>([READY_MESSAGE])
  const stopRequested = ref(false)
  const savedConfigs = ref<SavedImportPipelineConfig[]>([])
  const selectedConfigId = ref('')
  const configNameInput = ref('')

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

  function buildDefaultConfigName() {
    const now = new Date()
    const pad2 = (num: number) => String(num).padStart(2, '0')
    return `配置 ${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`
  }

  async function refreshSavedConfigList() {
    const normalized = await sendMessage('list-import-pipeline-configs', {}, 'background')

    savedConfigs.value = normalized

    if (normalized.length === 0) {
      selectedConfigId.value = ''
      return
    }

    const selectedExists = normalized.some(row => row.id === selectedConfigId.value)
    if (!selectedExists)
      selectedConfigId.value = normalized[0].id
  }

  function applySavedConfig(config: SavedImportPipelineConfig) {
    endpoint.value = config.endpoint
    method.value = config.method
    batchSize.value = config.batchSize
    requestMode.value = config.requestMode
    wrapperKey.value = config.wrapperKey
    autoExtractObjectField.value = config.autoExtractObjectField
    headersText.value = config.headersText
    fixedParamsText.value = config.fixedParamsText
    dynamicParamsText.value = config.dynamicParamsText
    inputText.value = config.inputText
  }

  function buildCurrentConfigSnapshot(id: string, name: string, createdAt: number): SavedImportPipelineConfig {
    return {
      id,
      name,
      endpoint: endpoint.value,
      method: method.value,
      batchSize: Math.max(1, Math.trunc(batchSize.value) || 1),
      requestMode: requestMode.value,
      wrapperKey: wrapperKey.value,
      autoExtractObjectField: autoExtractObjectField.value,
      headersText: headersText.value,
      fixedParamsText: fixedParamsText.value,
      dynamicParamsText: dynamicParamsText.value,
      inputText: inputText.value,
      createdAt,
      updatedAt: Date.now(),
    }
  }

  function findSelectedConfig() {
    if (!selectedConfigId.value)
      return null
    return savedConfigs.value.find(row => row.id === selectedConfigId.value) ?? null
  }

  async function loadSavedConfig(showLog = true) {
    try {
      const targetId = selectedConfigId.value
      if (!targetId) {
        if (showLog)
          appendLog('请先在配置列表中选择一条配置。')
        return false
      }

      const saved = await sendMessage('get-import-pipeline-config', { id: targetId }, 'background')
      if (!saved) {
        await refreshSavedConfigList()
        if (showLog)
          appendLog('未找到所选配置，可能已被删除。')
        return false
      }

      applySavedConfig(saved)
      parseInput()
      if (showLog)
        appendLog(`已加载配置：${saved.name}`)
      return true
    }
    catch (error) {
      appendLog(`加载配置失败：${error instanceof Error ? error.message : '未知错误'}`)
      return false
    }
  }

  async function saveCurrentConfig() {
    const selected = findSelectedConfig()
    if (!selected) {
      appendLog('当前没有已选配置，请先输入名称后新建保存。')
      return false
    }

    try {
      const snapshot = buildCurrentConfigSnapshot(selected.id, selected.name, selected.createdAt)
      await sendMessage('save-import-pipeline-config', snapshot, 'background')
      await refreshSavedConfigList()
      appendLog(`已覆盖保存配置：${snapshot.name}`)
      return true
    }
    catch (error) {
      appendLog(`保存配置失败：${error instanceof Error ? error.message : '未知错误'}`)
      return false
    }
  }

  async function createConfigFromCurrent() {
    const trimmedName = configNameInput.value.trim()
    const name = trimmedName || buildDefaultConfigName()

    try {
      const now = Date.now()
      const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${now}-${Math.random().toString(36).slice(2, 10)}`
      const snapshot = buildCurrentConfigSnapshot(id, name, now)
      await sendMessage('save-import-pipeline-config', snapshot, 'background')
      await refreshSavedConfigList()
      selectedConfigId.value = id
      configNameInput.value = ''
      appendLog(`已新建配置：${name}`)
      return true
    }
    catch (error) {
      appendLog(`新建配置失败：${error instanceof Error ? error.message : '未知错误'}`)
      return false
    }
  }

  async function deleteSelectedConfig() {
    const selected = findSelectedConfig()
    if (!selected) {
      appendLog('当前没有可删除的已选配置。')
      return false
    }

    try {
      await sendMessage('delete-import-pipeline-config', { id: selected.id }, 'background')
      await refreshSavedConfigList()
      appendLog(`已删除配置：${selected.name}`)
      return true
    }
    catch (error) {
      appendLog(`删除配置失败：${error instanceof Error ? error.message : '未知错误'}`)
      return false
    }
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

  async function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file)
      return

    if (isImporting.value)
      return

    const readTextFile = () => new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result ?? ''))
      reader.onerror = () => reject(new Error('读取文件失败。'))
      reader.readAsText(file, 'utf-8')
    })

    const loadingStart = Date.now()
    isImporting.value = true
    appendLog(`开始导入文件：${file.name}`)
    await waitForUiPaint()

    const lowerName = file.name.toLowerCase()
    const isExcelFile = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')

    try {
      if (isExcelFile) {
        const rows = await parseExcelFile(file)
        inputText.value = JSON.stringify(rows, null, 2)
        parseInput()
        appendLog(`Excel 导入成功，共 ${rows.length} 条记录。`)
      }
      else {
        inputText.value = await readTextFile()
        parseInput()
        appendLog('文件导入成功。')
      }
    }
    catch (error) {
      appendLog(`读取文件失败：${error instanceof Error ? error.message : '未知错误'}`)
    }
    finally {
      const elapsed = Date.now() - loadingStart
      const minDisplay = 350
      if (elapsed < minDisplay)
        await new Promise<void>(resolve => setTimeout(resolve, minDisplay - elapsed))

      isImporting.value = false
      target.value = ''
    }
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
  onMounted(() => {
    void (async () => {
      try {
        await refreshSavedConfigList()
        if (savedConfigs.value.length > 0) {
          const loaded = await loadSavedConfig(false)
          if (loaded)
            appendLog(`已自动加载最近配置：${savedConfigs.value[0].name}`)
        }
      }
      catch (error) {
        appendLog(`初始化配置列表失败：${error instanceof Error ? error.message : '未知错误'}`)
      }
    })()
  })

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
    isImporting,
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
    saveCurrentConfig,
    loadSavedConfig,
    savedConfigs,
    selectedConfigId,
    configNameInput,
    createConfigFromCurrent,
    deleteSelectedConfig,
  }
}
