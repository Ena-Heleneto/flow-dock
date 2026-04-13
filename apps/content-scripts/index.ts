import type {
  RequestRecorderBundle,
  RequestRecorderCapturedRecord,
} from '~/shared/logic/request-recorder'
import { consola } from 'consola'
import { createApp, reactive } from 'vue'
import { sendMessage } from 'webext-bridge/content-script'
import { storage } from 'webextension-polyfill'
import { REQUEST_RECORDER_BUNDLE_VERSION } from '~/shared/logic/request-recorder'
import requestRecorderStyleText from './views/request-recorder.css?raw'
import RequestRecorderOverlay from './views/RequestRecorderOverlay.vue'
import './styles/main.css'

interface CapturedRecordDraft {
  url: string
  method: string
  requestHeaders?: Record<string, string>
  requestQuery?: Record<string, string>
  requestBodyText?: string
  requestBodyJson?: unknown
  responseBodyText?: string
  responseBodyJson?: unknown
  contentType?: string
  status?: number
  durationMs?: number
  sourceUrl?: string
  truncated?: boolean
}

interface RecorderRuntimeState {
  isRecording: boolean
  isSyncingSession: boolean
  sessionId: string
  sessionName: string
  sessionStartedAt: number
  records: RequestRecorderCapturedRecord[]
  sentCount: number
  failedCount: number
  refreshOverlay: () => void
}

interface RecorderOverlayViewState {
  isRecording: boolean
  isSyncingSession: boolean
  sessionId: string
  sentCount: number
  failedCount: number
  isCollapsed: boolean
}

interface RecorderOverlayPosition {
  left: number
  top: number
}

interface RecorderOverlayPreferences {
  collapsed: boolean
  position?: RecorderOverlayPosition
}

interface MountedRecorderOverlay {
  refresh: () => void
  teardown: () => void
}

const BODY_TEXT_LIMIT = 50_000
const EXTENSION_PROTOCOL_SET = new Set(['chrome-extension:', 'moz-extension:'])
const RECORDER_OVERLAY_ID = 'flow-dock-request-recorder-overlay'
const RECORDER_BOOTED_FLAG = '__FLOW_DOCK_RECORDER_BOOTED__'
const RECORDER_BOOT_ERROR_FLAG = '__FLOW_DOCK_RECORDER_BOOT_ERROR__'
const RECORDER_OVERLAY_PREFS_KEY = 'flow-dock.request-recorder.overlay-preferences'
const OVERLAY_DEFAULT_OFFSET_PX = 12
const OVERLAY_VIEWPORT_MARGIN_PX = 8

let activeOverlay: MountedRecorderOverlay | null = null

function bootRecorder() {
  try {
    setRuntimeMarker(RECORDER_BOOTED_FLAG, false)
    setRuntimeMarker(RECORDER_BOOT_ERROR_FLAG, '')

    if (!shouldStartRecorder())
      return

    const state: RecorderRuntimeState = {
      isRecording: false,
      isSyncingSession: false,
      sessionId: '',
      sessionName: '',
      sessionStartedAt: 0,
      records: [],
      sentCount: 0,
      failedCount: 0,
      refreshOverlay: () => {},
    }

    state.refreshOverlay = mountRecorderOverlay(state)

    installFetchInterceptor(state)
    installXhrInterceptor(state)

    setRuntimeMarker(RECORDER_BOOTED_FLAG, true)

    consola.info(`[${__NAME__}] content request recorder ready`)
  }
  catch (error) {
    setRuntimeMarker(RECORDER_BOOT_ERROR_FLAG, toErrorMessage(error))
    consola.warn(`[${__NAME__}] content request recorder boot failed`, error)
  }
}

bootRecorder()

function shouldStartRecorder() {
  if (typeof window === 'undefined')
    return false

  if (EXTENSION_PROTOCOL_SET.has(window.location.protocol))
    return false

  return true
}

function mountRecorderOverlay(state: RecorderRuntimeState) {
  activeOverlay?.teardown()
  activeOverlay = null

  const existing = document.getElementById(RECORDER_OVERLAY_ID)
  if (existing)
    existing.remove()

  const host = document.createElement('flow-dock-recorder-overlay')
  host.id = RECORDER_OVERLAY_ID
  host.setAttribute('data-flow-dock', 'request-recorder-overlay')
  host.style.setProperty('all', 'initial', 'important')
  host.style.setProperty('position', 'fixed', 'important')
  host.style.setProperty('z-index', '2147483647', 'important')
  host.style.setProperty('top', `${OVERLAY_DEFAULT_OFFSET_PX}px`, 'important')
  host.style.setProperty('right', `${OVERLAY_DEFAULT_OFFSET_PX}px`, 'important')
  host.style.setProperty('display', 'block', 'important')

  const mountRoot = resolveOverlayMountRoot(host)
  const style = document.createElement('style')
  style.textContent = requestRecorderStyleText
  mountRoot.appendChild(style)

  const appRoot = document.createElement('div')
  mountRoot.appendChild(appRoot)

  const overlayState = reactive<RecorderOverlayViewState>({
    isRecording: state.isRecording,
    isSyncingSession: state.isSyncingSession,
    sessionId: state.sessionId,
    sentCount: state.sentCount,
    failedCount: state.failedCount,
    isCollapsed: false,
  })

  let hasCustomPosition = false

  const persistPreferences = () => {
    void persistOverlayPreferences(host, overlayState, hasCustomPosition)
  }

  const app = createApp(RequestRecorderOverlay, {
    state: overlayState,
    onToggle: () => {
      void toggleRecording(state)
    },
    onToggleCollapse: () => {
      overlayState.isCollapsed = !overlayState.isCollapsed
      persistPreferences()
    },
    onDragStart: (event: PointerEvent) => {
      startOverlayDrag(event, host, () => {
        hasCustomPosition = true
        persistPreferences()
      })
    },
  })

  app.mount(appRoot)
  mountOverlayNode(host)
  const stopRecover = installOverlayRecovery(host)
  void hydrateOverlayPreferences(host, overlayState).then((nextHasCustomPosition) => {
    hasCustomPosition = nextHasCustomPosition
  })

  const refresh = () => {
    overlayState.isRecording = state.isRecording
    overlayState.isSyncingSession = state.isSyncingSession
    overlayState.sessionId = state.sessionId
    overlayState.sentCount = state.sentCount
    overlayState.failedCount = state.failedCount
  }

  const teardown = () => {
    stopRecover()
    app.unmount()
    host.remove()
  }

  activeOverlay = {
    refresh,
    teardown,
  }

  refresh()
  return refresh
}

function mountOverlayNode(node: HTMLElement) {
  if (node.isConnected)
    return

  const mount = () => {
    if (node.isConnected)
      return

    if (document.body)
      document.body.appendChild(node)
    else
      document.documentElement.appendChild(node)
  }

  if (document.readyState === 'loading') {
    const handleReady = () => {
      document.removeEventListener('DOMContentLoaded', handleReady)
      mount()
    }

    document.addEventListener('DOMContentLoaded', handleReady)
    return
  }

  mount()
}

function resolveOverlayMountRoot(host: HTMLElement): ShadowRoot | HTMLElement {
  try {
    return host.attachShadow({ mode: 'open' })
  }
  catch (error) {
    consola.warn(`[${__NAME__}] overlay attachShadow failed, fallback to light DOM`, error)
    return host
  }
}

function installOverlayRecovery(node: HTMLElement) {
  let bodyObserver: MutationObserver | null = null

  const ensureMounted = () => {
    if (!node.isConnected)
      mountOverlayNode(node)
  }

  const observeBody = () => {
    bodyObserver?.disconnect()

    if (!document.body)
      return

    bodyObserver = new MutationObserver(() => {
      ensureMounted()
    })

    bodyObserver.observe(document.body, {
      childList: true,
    })
  }

  const rootObserver = new MutationObserver(() => {
    observeBody()
    ensureMounted()
  })

  rootObserver.observe(document.documentElement, {
    childList: true,
  })

  observeBody()
  ensureMounted()

  return () => {
    rootObserver.disconnect()
    bodyObserver?.disconnect()
  }
}

function startOverlayDrag(event: PointerEvent, node: HTMLElement, onDragEnd: () => void) {
  if (event.button !== 0)
    return

  const rect = node.getBoundingClientRect()
  const offsetX = event.clientX - rect.left
  const offsetY = event.clientY - rect.top

  let frameId = 0
  let nextClientX = event.clientX
  let nextClientY = event.clientY

  const handlePointerMove = (moveEvent: PointerEvent) => {
    nextClientX = moveEvent.clientX
    nextClientY = moveEvent.clientY

    if (frameId)
      return

    frameId = window.requestAnimationFrame(() => {
      frameId = 0

      const nextPosition = clampOverlayPosition(
        {
          left: nextClientX - offsetX,
          top: nextClientY - offsetY,
        },
        rect.width,
        rect.height,
      )

      applyOverlayPosition(node, nextPosition)
    })
  }

  const handlePointerUp = () => {
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerUp)
    window.removeEventListener('pointercancel', handlePointerUp)

    if (frameId)
      window.cancelAnimationFrame(frameId)

    onDragEnd()
  }

  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', handlePointerUp)
  window.addEventListener('pointercancel', handlePointerUp)
}

function applyOverlayPosition(node: HTMLElement, position: RecorderOverlayPosition) {
  node.style.setProperty('left', `${Math.round(position.left)}px`, 'important')
  node.style.setProperty('top', `${Math.round(position.top)}px`, 'important')
  node.style.setProperty('right', 'auto', 'important')
  node.style.setProperty('bottom', 'auto', 'important')
}

function clampOverlayPosition(position: RecorderOverlayPosition, overlayWidth: number, overlayHeight: number): RecorderOverlayPosition {
  const width = Number.isFinite(overlayWidth) && overlayWidth > 0
    ? overlayWidth
    : 220
  const height = Number.isFinite(overlayHeight) && overlayHeight > 0
    ? overlayHeight
    : 72

  const maxLeft = Math.max(OVERLAY_VIEWPORT_MARGIN_PX, window.innerWidth - width - OVERLAY_VIEWPORT_MARGIN_PX)
  const maxTop = Math.max(OVERLAY_VIEWPORT_MARGIN_PX, window.innerHeight - height - OVERLAY_VIEWPORT_MARGIN_PX)

  return {
    left: Math.min(Math.max(position.left, OVERLAY_VIEWPORT_MARGIN_PX), maxLeft),
    top: Math.min(Math.max(position.top, OVERLAY_VIEWPORT_MARGIN_PX), maxTop),
  }
}

function readOverlayPosition(node: HTMLElement): RecorderOverlayPosition {
  const rect = node.getBoundingClientRect()
  return {
    left: Math.round(rect.left),
    top: Math.round(rect.top),
  }
}

async function hydrateOverlayPreferences(node: HTMLElement, overlayState: RecorderOverlayViewState) {
  const preferences = await readOverlayPreferences()
  overlayState.isCollapsed = preferences.collapsed

  if (!preferences.position)
    return false

  applyOverlayPosition(node, preferences.position)
  return true
}

async function persistOverlayPreferences(
  node: HTMLElement,
  overlayState: RecorderOverlayViewState,
  includePosition: boolean,
) {
  const preferences: RecorderOverlayPreferences = {
    collapsed: overlayState.isCollapsed,
  }

  if (includePosition)
    preferences.position = readOverlayPosition(node)

  try {
    await storage.local.set({ [RECORDER_OVERLAY_PREFS_KEY]: preferences })
  }
  catch (error) {
    consola.warn(`[${__NAME__}] persist overlay preferences failed`, error)
  }
}

async function readOverlayPreferences(): Promise<RecorderOverlayPreferences> {
  try {
    const data = await storage.local.get(RECORDER_OVERLAY_PREFS_KEY)
    return normalizeOverlayPreferences(data[RECORDER_OVERLAY_PREFS_KEY])
  }
  catch (error) {
    consola.warn(`[${__NAME__}] read overlay preferences failed`, error)
    return { collapsed: false }
  }
}

function normalizeOverlayPreferences(input: unknown): RecorderOverlayPreferences {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return { collapsed: false }

  const source = input as Record<string, unknown>
  const position = normalizeOverlayPosition(source.position)

  return {
    collapsed: source.collapsed === true,
    position,
  }
}

function normalizeOverlayPosition(input: unknown): RecorderOverlayPosition | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return undefined

  const source = input as Record<string, unknown>
  const left = typeof source.left === 'number' ? source.left : Number.NaN
  const top = typeof source.top === 'number' ? source.top : Number.NaN

  if (!Number.isFinite(left) || !Number.isFinite(top))
    return undefined

  return {
    left,
    top,
  }
}

function setRuntimeMarker(key: string, value: unknown) {
  if (typeof window === 'undefined')
    return

  try {
    Reflect.set(window, key, value)
  }
  catch {
    // noop
  }
}

async function toggleRecording(state: RecorderRuntimeState) {
  if (state.isSyncingSession)
    return

  state.isSyncingSession = true
  state.refreshOverlay()

  try {
    if (state.isRecording) {
      await stopRecordingSession(state)
      return
    }

    await startRecordingSession(state)
  }
  finally {
    state.isSyncingSession = false
    state.refreshOverlay()
  }
}

async function startRecordingSession(state: RecorderRuntimeState) {
  state.sessionId = createRuntimeId('request-recorder-session')
  state.sessionName = buildSessionName()
  state.sessionStartedAt = Date.now()
  state.records = []
  state.sentCount = 0
  state.failedCount = 0
  state.isRecording = true
}

async function stopRecordingSession(state: RecorderRuntimeState) {
  const bundle = buildRecordedBundle(state)
  let saved = false

  try {
    if (bundle && bundle.items.length > 0)
      await savePendingRecordedBundle(bundle)

    saved = true
  }
  catch (error) {
    state.failedCount += 1
    consola.warn(`[${__NAME__}] flush recorded bundle failed`, error)
  }
  finally {
    state.isRecording = false

    if (saved) {
      state.sessionId = ''
      state.records = []
    }

    state.sessionName = ''
    state.sessionStartedAt = 0
  }
}

function installFetchInterceptor(state: RecorderRuntimeState) {
  const originalFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!state.isRecording)
      return originalFetch(input, init)

    const startedAt = Date.now()
    const requestDraft = await buildFetchRequestDraft(input, init)

    try {
      const response = await originalFetch(input, init)

      if (requestDraft) {
        const responseInfo = await readFetchResponseInfo(response)
        void bufferCapturedRecord(state, {
          ...requestDraft,
          status: response.status,
          durationMs: Date.now() - startedAt,
          responseBodyText: responseInfo.text,
          responseBodyJson: responseInfo.json,
          contentType: requestDraft.contentType ?? responseInfo.contentType,
          truncated: requestDraft.truncated || responseInfo.truncated,
        })
      }

      return response
    }
    catch (error) {
      if (requestDraft) {
        void bufferCapturedRecord(state, {
          ...requestDraft,
          status: 0,
          durationMs: Date.now() - startedAt,
          responseBodyText: toErrorMessage(error),
          truncated: requestDraft.truncated,
        })
      }

      throw error
    }
  }
}

function installXhrInterceptor(state: RecorderRuntimeState) {
  const originalOpen = XMLHttpRequest.prototype.open
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader
  const originalSend = XMLHttpRequest.prototype.send

  const xhrDraftMap = new WeakMap<XMLHttpRequest, CapturedRecordDraft & { startedAt?: number }>()

  XMLHttpRequest.prototype.open = function patchedOpen(
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null,
  ) {
    const normalizedUrl = typeof url === 'string' ? url : String(url)
    xhrDraftMap.set(this, {
      method: normalizeMethod(method),
      url: normalizedUrl,
      requestHeaders: {},
    })

    return originalOpen.call(this, method, normalizedUrl, async ?? true, username, password)
  }

  XMLHttpRequest.prototype.setRequestHeader = function patchedSetRequestHeader(header: string, value: string) {
    const draft = xhrDraftMap.get(this)
    if (draft) {
      draft.requestHeaders = {
        ...(draft.requestHeaders ?? {}),
        [header]: value,
      }
    }

    return originalSetRequestHeader.call(this, header, value)
  }

  XMLHttpRequest.prototype.send = function patchedSend(body?: Document | XMLHttpRequestBodyInit | null) {
    const draft = xhrDraftMap.get(this)

    if (draft && state.isRecording) {
      draft.startedAt = Date.now()

      const serializedBody = serializeXhrBody(body)
      draft.requestBodyText = serializedBody.text
      draft.requestBodyJson = serializedBody.json
      draft.truncated = serializedBody.truncated

      this.addEventListener('loadend', () => {
        if (!state.isRecording)
          return

        const capturedDraft = xhrDraftMap.get(this)
        if (!capturedDraft)
          return

        const responsePayload = readXhrResponseInfo(this)

        void bufferCapturedRecord(state, {
          ...capturedDraft,
          status: Number.isFinite(this.status) ? this.status : undefined,
          durationMs: capturedDraft.startedAt ? Date.now() - capturedDraft.startedAt : undefined,
          responseBodyText: responsePayload.text,
          responseBodyJson: responsePayload.json,
          contentType: capturedDraft.contentType ?? responsePayload.contentType,
          truncated: capturedDraft.truncated || responsePayload.truncated,
        })
      }, { once: true })
    }

    return originalSend.call(this, body)
  }
}

async function bufferCapturedRecord(state: RecorderRuntimeState, draft: CapturedRecordDraft) {
  if (!state.isRecording)
    return

  const normalizedUrl = normalizeAbsoluteUrl(draft.url)
  if (!normalizedUrl || !shouldCaptureUrl(normalizedUrl))
    return

  const sessionId = normalizeText(state.sessionId)
  if (!sessionId) {
    state.failedCount += 1
    state.refreshOverlay()
    return
  }

  const now = Date.now()
  state.records.push({
    _id: createRuntimeId('request-record'),
    sessionId,
    url: normalizedUrl,
    method: normalizeMethod(draft.method),
    path: extractPathFromUrl(normalizedUrl),
    requestHeaders: draft.requestHeaders,
    requestQuery: draft.requestQuery,
    requestBodyText: draft.requestBodyText,
    requestBodyJson: draft.requestBodyJson,
    responseBodyText: draft.responseBodyText,
    responseBodyJson: draft.responseBodyJson,
    contentType: draft.contentType,
    status: draft.status,
    durationMs: draft.durationMs,
    sourceUrl: draft.sourceUrl ?? window.location.href,
    truncated: draft.truncated,
    createdAt: now,
    updatedAt: now,
  })

  state.sentCount = state.records.length
  state.refreshOverlay()
}

function buildRecordedBundle(state: RecorderRuntimeState): RequestRecorderBundle | null {
  const sessionId = normalizeText(state.sessionId)
  if (!sessionId)
    return null

  const exportedAt = Date.now()
  const startedAt = state.sessionStartedAt || exportedAt

  return {
    version: REQUEST_RECORDER_BUNDLE_VERSION,
    exportedAt,
    session: {
      _id: sessionId,
      name: normalizeText(state.sessionName) || buildSessionName(),
      status: 'stopped',
      sourceUrl: window.location.href,
      startedAt,
      stoppedAt: exportedAt,
      createdAt: startedAt,
      updatedAt: exportedAt,
    },
    items: state.records.map(item => ({
      ...item,
      sessionId,
      createdAt: item.createdAt ?? startedAt,
      updatedAt: item.updatedAt ?? exportedAt,
    })),
  }
}

async function savePendingRecordedBundle(bundle: RequestRecorderBundle) {
  await sendMessage('request-recorder-save-pending', { bundle }, 'background')
}

async function buildFetchRequestDraft(input: RequestInfo | URL, init?: RequestInit): Promise<CapturedRecordDraft | null> {
  try {
    const request = new Request(input, init)
    const normalizedUrl = normalizeAbsoluteUrl(request.url)

    if (!normalizedUrl || !shouldCaptureUrl(normalizedUrl))
      return null

    const requestHeaders = headersToRecord(request.headers)
    const requestQuery = extractQueryFromUrl(normalizedUrl)

    const bodyInfo = await readFetchRequestBodyInfo(request)

    return {
      url: normalizedUrl,
      method: normalizeMethod(request.method),
      requestHeaders,
      requestQuery,
      requestBodyText: bodyInfo.text,
      requestBodyJson: bodyInfo.json,
      contentType: requestHeaders['content-type'],
      sourceUrl: window.location.href,
      truncated: bodyInfo.truncated,
    }
  }
  catch {
    const fallbackUrl = extractUrlFromRequestInput(input)
    if (!fallbackUrl || !shouldCaptureUrl(fallbackUrl))
      return null

    return {
      url: fallbackUrl,
      method: normalizeMethod((init?.method as string) || 'GET'),
      requestHeaders: headersToRecord(init?.headers),
      requestQuery: extractQueryFromUrl(fallbackUrl),
      requestBodyText: normalizeBodyText(init?.body),
      requestBodyJson: tryParseJson(normalizeBodyText(init?.body)),
      sourceUrl: window.location.href,
    }
  }
}

async function readFetchRequestBodyInfo(request: Request) {
  if (request.method.toUpperCase() === 'GET' || request.method.toUpperCase() === 'HEAD')
    return { text: undefined, json: undefined, truncated: false }

  try {
    const rawText = await request.clone().text()
    const truncatedText = truncateText(rawText)
    return {
      text: truncatedText.value,
      json: tryParseJson(truncatedText.value),
      truncated: truncatedText.truncated,
    }
  }
  catch {
    return { text: undefined, json: undefined, truncated: false }
  }
}

async function readFetchResponseInfo(response: Response) {
  const contentType = normalizeText(response.headers.get('content-type')) || undefined

  try {
    const rawText = await response.clone().text()
    const truncatedText = truncateText(rawText)

    return {
      contentType,
      text: truncatedText.value,
      json: tryParseJson(truncatedText.value),
      truncated: truncatedText.truncated,
    }
  }
  catch {
    return {
      contentType,
      text: undefined,
      json: undefined,
      truncated: false,
    }
  }
}

function readXhrResponseInfo(xhr: XMLHttpRequest) {
  const contentType = normalizeText(xhr.getResponseHeader('content-type')) || undefined

  if (xhr.responseType === '' || xhr.responseType === 'text') {
    const truncatedText = truncateText(xhr.responseText)
    return {
      contentType,
      text: truncatedText.value,
      json: tryParseJson(truncatedText.value),
      truncated: truncatedText.truncated,
    }
  }

  if (xhr.responseType === 'json') {
    const text = safeStringify(xhr.response)
    const truncatedText = truncateText(text)

    return {
      contentType,
      text: truncatedText.value,
      json: xhr.response,
      truncated: truncatedText.truncated,
    }
  }

  return {
    contentType,
    text: undefined,
    json: undefined,
    truncated: false,
  }
}

function serializeXhrBody(input: Document | XMLHttpRequestBodyInit | null | undefined) {
  if (input === null || input === undefined)
    return { text: undefined, json: undefined, truncated: false }

  if (typeof input === 'string') {
    const truncatedText = truncateText(input)
    return {
      text: truncatedText.value,
      json: tryParseJson(truncatedText.value),
      truncated: truncatedText.truncated,
    }
  }

  if (input instanceof URLSearchParams) {
    const text = input.toString()
    const truncatedText = truncateText(text)
    return {
      text: truncatedText.value,
      json: undefined,
      truncated: truncatedText.truncated,
    }
  }

  return {
    text: undefined,
    json: undefined,
    truncated: false,
  }
}

function headersToRecord(input: HeadersInit | undefined | Headers) {
  if (!input)
    return {}

  const headers = input instanceof Headers ? input : new Headers(input)
  const output: Record<string, string> = {}

  headers.forEach((value, key) => {
    if (!key)
      return

    output[key.toLowerCase()] = value
  })

  return output
}

function shouldCaptureUrl(input: string) {
  const normalized = normalizeAbsoluteUrl(input)
  if (!normalized)
    return false

  return !EXTENSION_PROTOCOL_SET.has(new URL(normalized).protocol)
}

function extractUrlFromRequestInput(input: RequestInfo | URL) {
  if (typeof input === 'string')
    return normalizeAbsoluteUrl(input)

  if (input instanceof URL)
    return normalizeAbsoluteUrl(String(input))

  if (input instanceof Request)
    return normalizeAbsoluteUrl(input.url)

  return ''
}

function normalizeAbsoluteUrl(input: string) {
  const normalized = normalizeText(input)
  if (!normalized)
    return ''

  try {
    return new URL(normalized, window.location.href).toString()
  }
  catch {
    return ''
  }
}

function extractPathFromUrl(input: string) {
  try {
    const parsed = new URL(input)
    return parsed.pathname || '/'
  }
  catch {
    return '/'
  }
}

function extractQueryFromUrl(input: string) {
  try {
    const parsed = new URL(input)
    const output: Record<string, string> = {}

    parsed.searchParams.forEach((value, key) => {
      output[key] = value
    })

    return output
  }
  catch {
    return {}
  }
}

function buildSessionName() {
  const host = window.location.host || 'unknown-host'
  const now = new Date().toLocaleString('zh-CN', { hour12: false })
  return `录制会话 ${host} ${now}`
}

function createRuntimeId(prefix: string) {
  if (typeof globalThis.crypto?.randomUUID === 'function')
    return `${prefix}:${globalThis.crypto.randomUUID()}`

  return `${prefix}:${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function truncateText(input: unknown) {
  if (typeof input !== 'string' || !input)
    return { value: undefined, truncated: false }

  if (input.length <= BODY_TEXT_LIMIT)
    return { value: input, truncated: false }

  return {
    value: input.slice(0, BODY_TEXT_LIMIT),
    truncated: true,
  }
}

function normalizeBodyText(input: BodyInit | null | undefined) {
  if (typeof input === 'string')
    return truncateText(input).value

  if (input instanceof URLSearchParams)
    return truncateText(input.toString()).value

  return undefined
}

function tryParseJson(input: string | undefined) {
  const normalized = normalizeText(input)
  if (!normalized)
    return undefined

  try {
    return JSON.parse(normalized)
  }
  catch {
    return undefined
  }
}

function safeStringify(input: unknown) {
  if (typeof input === 'string')
    return input

  try {
    return JSON.stringify(input)
  }
  catch {
    return ''
  }
}

function normalizeMethod(input: string) {
  const normalized = normalizeText(input).toUpperCase()
  return normalized || 'GET'
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
