import type {
  RequestRecorderBundle,
  RequestRecorderPendingBundle,
} from '~/shared/logic/request-recorder'
import { sendMessage } from 'webext-bridge/options'
import { request } from '~/shared/composables/useRouterRequest'

type NoticeTone = 'neutral' | 'success' | 'error'
const REQUEST_TIMEOUT_MS = 15000
const PENDING_AUTO_SYNC_INTERVAL_MS = 1200

interface ImportExternalCrudRecordResponseData {
  sessionId: string
  importedCount: number
  skippedCount: number
}

interface ProcessPendingBundleResult {
  pendingId: string
  sessionId: string
  sessionName: string
  rawCount: number
  uniqueCount: number
  importedCount: number
  skippedCount: number
}

let sharedPendingRecorderStore: ReturnType<typeof createPendingRecorderStore> | null = null

export function useDictKeeperPendingRecorder() {
  if (sharedPendingRecorderStore)
    return sharedPendingRecorderStore

  sharedPendingRecorderStore = createPendingRecorderStore()
  return sharedPendingRecorderStore
}

function createPendingRecorderStore() {
  const pendingBundles = ref<RequestRecorderPendingBundle[]>([])
  const isLoading = ref(false)
  const isProcessing = ref(false)
  const noticeText = ref('')
  const noticeTone = ref<NoticeTone>('neutral')
  const lastReceivedAt = ref<number>()
  let autoSyncTimer: ReturnType<typeof setInterval> | null = null
  let isAutoSyncRunning = false

  const pendingCount = computed(() => pendingBundles.value.filter(item => item.status === 'pending').length)

  async function refreshPendingBundles(options: { silent?: boolean } = {}) {
    isLoading.value = true

    try {
      const response = await sendMessage('request-recorder-read-pending', {})
      pendingBundles.value = Array.isArray(response?.items) ? response.items : []

      if (!options.silent && pendingBundles.value.length === 0)
        setNotice('', 'neutral')

      return pendingBundles.value
    }
    catch (error) {
      if (!options.silent)
        setNotice(`读取待处理录制数据失败：${toErrorMessage(error)}`, 'error')

      return []
    }
    finally {
      isLoading.value = false
    }
  }

  async function processPendingBundles(options: { silent?: boolean } = {}) {
    isProcessing.value = true

    try {
      const items = pendingBundles.value.filter(item => item.status === 'pending')
      lastReceivedAt.value = Date.now()

      if (items.length === 0) {
        if (!options.silent)
          setNotice('', 'neutral')

        return []
      }

      const results: ProcessPendingBundleResult[] = []
      const errors: string[] = []
      let totalRawCount = 0
      let totalUniqueCount = 0
      let totalImportedCount = 0
      let totalSkippedCount = 0

      for (const pendingBundle of items) {
        const analysis = analyzeBundle(pendingBundle.bundle)
        const sessionId = resolveSessionId(pendingBundle.bundle, pendingBundle._id)
        const sessionName = resolveSessionName(pendingBundle.bundle, sessionId)

        totalRawCount += analysis.rawCount
        totalUniqueCount += analysis.uniqueCount

        try {
          const body: { bundle: RequestRecorderBundle, sessionId?: string } = {
            bundle: pendingBundle.bundle,
          }

          if (sessionId)
            body.sessionId = sessionId

          const responseData = await requestData<ImportExternalCrudRecordResponseData, typeof body>(
            '/dict-keeper/external-crud-record/import',
            {
              method: 'POST',
              body,
            },
          )

          const importedCount = normalizeCount(responseData.importedCount)
          const skippedCount = normalizeCount(responseData.skippedCount)

          await markPendingBundleProcessed(pendingBundle._id)

          totalImportedCount += importedCount
          totalSkippedCount += skippedCount

          results.push({
            pendingId: pendingBundle._id,
            sessionId: normalizeText(responseData.sessionId) || sessionId,
            sessionName,
            rawCount: analysis.rawCount,
            uniqueCount: analysis.uniqueCount,
            importedCount,
            skippedCount,
          })
        }
        catch (error) {
          errors.push(`${sessionName}: ${toErrorMessage(error)}`)
        }
      }

      await refreshPendingBundles({ silent: true })

      if (!options.silent) {
        if (errors.length === 0) {
          setNotice(
            `已处理 ${results.length} 个录制包：分析 ${totalRawCount} 条请求（去重特征 ${totalUniqueCount}），入库 ${totalImportedCount} 条，跳过 ${totalSkippedCount} 条。`,
            'success',
          )
        }
        else {
          const errorPreview = errors.slice(0, 2).join('；')
          const tail = errors.length > 2 ? '；…' : ''

          setNotice(
            `录制包处理完成 ${results.length}/${items.length}：入库 ${totalImportedCount} 条，跳过 ${totalSkippedCount} 条。失败 ${errors.length} 个：${errorPreview}${tail}`,
            'error',
          )
        }
      }

      return results
    }
    finally {
      isProcessing.value = false
    }
  }

  async function initializePendingRecorder(options: { silent?: boolean } = {}) {
    await refreshPendingBundles({ silent: true })
    return processPendingBundles(options)
  }

  async function runPendingAutoSyncTick(options: { forceNotice?: boolean } = {}) {
    if (isAutoSyncRunning || isLoading.value || isProcessing.value)
      return []

    isAutoSyncRunning = true

    try {
      const pendingIdSetBeforeSync = new Set(
        pendingBundles.value
          .filter(item => item.status === 'pending')
          .map(item => item._id),
      )

      await refreshPendingBundles({ silent: true })

      const pendingItems = pendingBundles.value.filter(item => item.status === 'pending')
      if (pendingItems.length === 0)
        return []

      const hasNewPendingBundle = pendingItems.some(item => !pendingIdSetBeforeSync.has(item._id))

      return processPendingBundles({
        silent: !(options.forceNotice || hasNewPendingBundle),
      })
    }
    finally {
      isAutoSyncRunning = false
    }
  }

  function startPendingAutoSync() {
    if (autoSyncTimer)
      return

    void runPendingAutoSyncTick({ forceNotice: true })

    autoSyncTimer = setInterval(() => {
      void runPendingAutoSyncTick()
    }, PENDING_AUTO_SYNC_INTERVAL_MS)
  }

  function stopPendingAutoSync() {
    if (!autoSyncTimer)
      return

    clearInterval(autoSyncTimer)
    autoSyncTimer = null
  }

  function setNotice(text: string, tone: NoticeTone) {
    noticeText.value = text
    noticeTone.value = tone
  }

  return {
    state: {
      pendingBundles,
      pendingCount,
      isLoading,
      isProcessing,
      noticeText,
      noticeTone,
      lastReceivedAt,
    },
    actions: {
      refreshPendingBundles,
      processPendingBundles,
      initializePendingRecorder,
      startPendingAutoSync,
      stopPendingAutoSync,
      setNotice,
    },
  }
}

function analyzeBundle(bundle: RequestRecorderBundle) {
  const rawItems = Array.isArray(bundle.items) ? bundle.items : []
  const uniqueRequestKeySet = new Set<string>()

  for (const item of rawItems) {
    const method = normalizeText(item.method).toUpperCase() || 'GET'
    const path = normalizeText(item.path) || extractPathFromUrl(item.url)
    const status = typeof item.status === 'number' && Number.isFinite(item.status)
      ? item.status
      : -1

    uniqueRequestKeySet.add(`${method} ${path || '/'} #${status}`)
  }

  return {
    rawCount: rawItems.length,
    uniqueCount: uniqueRequestKeySet.size,
  }
}

function resolveSessionId(bundle: RequestRecorderBundle, fallbackId: string) {
  return normalizeText(bundle.session?._id) || fallbackId
}

function resolveSessionName(bundle: RequestRecorderBundle, sessionId: string) {
  return normalizeText(bundle.session?.name) || sessionId
}

function extractPathFromUrl(input: unknown) {
  const url = normalizeText(input)
  if (!url)
    return ''

  try {
    return new URL(url).pathname || '/'
  }
  catch {
    return ''
  }
}

async function markPendingBundleProcessed(id: string) {
  const response = await sendMessage('request-recorder-mark-pending-processed', { id })
  if (!response?.item)
    throw new Error(`标记待处理录制包失败：${id}`)
}

async function requestData<TData, TBody = unknown>(
  path: string,
  options: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE'
    body?: TBody
  },
) {
  const response = await withTimeout(
    request<TData, TBody>(path, options),
    REQUEST_TIMEOUT_MS,
    `请求超时（${REQUEST_TIMEOUT_MS}ms）：${path}`,
  )

  if (response.ok)
    return response.data

  const errorCode = response.error.code ? `[${response.error.code}] ` : ''
  throw new Error(`${errorCode}${response.error.message}`)
}

function withTimeout<TData>(promise: Promise<TData>, timeoutMs: number, message: string): Promise<TData> {
  return new Promise<TData>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message))
    }, timeoutMs)

    promise
      .then((data) => {
        clearTimeout(timer)
        resolve(data)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

function normalizeCount(input: unknown) {
  if (typeof input === 'number' && Number.isFinite(input))
    return Math.max(0, Math.trunc(input))

  if (typeof input === 'string' && input.trim()) {
    const parsed = Number(input)
    if (Number.isFinite(parsed))
      return Math.max(0, Math.trunc(parsed))
  }

  return 0
}

function normalizeText(input: unknown) {
  if (typeof input !== 'string')
    return ''

  return input.trim()
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error)
    return error.message

  return '未知错误'
}
