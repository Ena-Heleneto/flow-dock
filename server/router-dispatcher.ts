import type { RouterMiddleware } from '@/driver/define-middleware-handle.driver'
import type { RuntimePlugin } from '@/driver/define-plugin-handle.driver'
import type {
  AnyRouterHandle,
  RouterError,
  RouterFailure,
  RouterRequestPayload,
  RouterSuccess,
} from '@/driver/define-router-handle.driver'
import { consola } from 'consola'
import { onMessage } from 'webext-bridge/background'
import browser from 'webextension-polyfill'
import { isMiddlewareHandle } from '@/driver/define-middleware-handle.driver'
import { isPluginHandle } from '@/driver/define-plugin-handle.driver'
import { isRouterHandle } from '@/driver/define-router-handle.driver'
import { buildRouterEvent, normalizeHeaders, normalizeMeta } from '@/runtime/context'
import { runMiddlewareChain } from '@/runtime/middleware'

interface RouterModuleExport {
  default?: unknown
}

interface RuntimeModuleExport {
  default?: unknown
}

interface RouterRouteRecord {
  key: string
  method: string
  path: string
  modulePath: string
  routeHandle: AnyRouterHandle
}

interface TraceContext {
  requestId: string
  traceId: string
}

const QUERY_AND_HASH_SUFFIX_RE = /[#?].*$/
const WINDOWS_PATH_SEPARATOR_RE = /\\+/g
const TRAILING_SLASH_RE = /\/+$/
const ROUTER_FILE_SUFFIX_RE = /\.router\.ts$/
const ROUTER_PATH_PREFIXES = [
  '/server/router/',
  './router/',
  '@/router/',
] as const

// NOTE:
// Keep glob patterns as string literals so Vite can statically analyze and include matched modules.
const routeModules = import.meta.glob('./router/**/*.router.ts', { eager: true }) as Record<string, RouterModuleExport>
const middlewareModules = import.meta.glob('./middleware/**/*.middleware.ts', { eager: true }) as Record<string, RuntimeModuleExport>
const pluginModules = import.meta.glob('./plugin/**/*.plugin.ts', { eager: true }) as Record<string, RuntimeModuleExport>
const routeTable = buildRouteTable(routeModules)
const runtimeMiddlewares = loadRuntimeMiddlewares(middlewareModules)
const runtimePlugins = loadRuntimePlugins(pluginModules)

onMessage('router-request', async (message) => {
  const payload = normalizeRequestPayload(message.data)
  const trace = resolveTrace(message.id, payload.meta?.traceId)
  const routePath = normalizeRoutePath(payload.path)
  const routeMethod = normalizeMethod(payload.method)
  const routeKey = createRouteKey(routeMethod, routePath)
  const routeRecord = routeTable.get(routeKey)

  if (!routeRecord) {
    return buildFailureResponse({
      message: `Route not found: ${routeMethod} ${routePath}`,
      code: 'ROUTE_NOT_FOUND',
      details: {
        path: routePath,
        method: routeMethod,
      },
    }, trace)
  }

  const senderUrl = await resolveSenderUrl(message.sender.tabId, payload.meta?.url)
  const event = buildRouterEvent({
    payload,
    path: routePath,
    method: routeMethod,
    message: {
      id: message.id,
      sender: message.sender,
      timestamp: message.timestamp,
    },
    trace,
    senderUrl,
  })

  await runRequestLifecycleHook('onContextCreated', runtimePlugins, event)
  await runRequestLifecycleHook('onRequest', runtimePlugins, event)

  try {
    const result = await runMiddlewareChain(event, runtimeMiddlewares, async () => {
      return routeRecord.routeHandle.handle(event)
    })

    const successResponse = buildSuccessResponse(result, trace)
    await runResponseHook(runtimePlugins, event, successResponse)

    return successResponse
  }
  catch (error) {
    const normalizedError = toSafeRouterError(error)
    consola.error(
      `[router] execution failed: ${routeRecord.method} ${routeRecord.path} (${routeRecord.modulePath})`,
      normalizedError,
    )

    const failureResponse = buildFailureResponse({
      ...normalizedError,
      code: normalizedError.code ?? 'ROUTE_EXECUTION_FAILED',
    }, trace)

    try {
      await runErrorHook(runtimePlugins, event, failureResponse.error)
    }
    catch (hookError) {
      consola.error(
        `[router] onError hook failed: ${routeRecord.method} ${routeRecord.path} (${routeRecord.modulePath})`,
        toSafeRouterError(hookError),
      )
    }

    return failureResponse
  }
})

function buildRouteTable(routeModuleMap: Record<string, RouterModuleExport>) {
  const table = new Map<string, RouterRouteRecord>()

  for (const [modulePath, moduleExport] of Object.entries(routeModuleMap)) {
    const routeHandle = moduleExport.default
    if (!isRouterHandle(routeHandle)) {
      consola.warn(`[router] ignored module without default router handle: ${modulePath}`)
      continue
    }

    const routePath = extractRoutePathFromModule(modulePath)
    const routeMethod = normalizeMethod(routeHandle.method)
    const routeKey = createRouteKey(routeMethod, routePath)

    if (table.has(routeKey)) {
      const firstMatch = table.get(routeKey)
      consola.warn(
        `[router] duplicate route key ${routeKey}, keeping ${firstMatch?.modulePath} and skipping ${modulePath}`,
      )
      continue
    }

    table.set(routeKey, {
      key: routeKey,
      method: routeMethod,
      path: routePath,
      modulePath,
      routeHandle,
    })
  }

  const routeKeys = [...table.keys()]
  if (routeKeys.length === 0)
    consola.warn('[router] no routes loaded, check import.meta.glob patterns and build target output')

  consola.log(`[router] loaded ${routeKeys.length} route(s): ${routeKeys.join(', ') || '(none)'}`)

  return table
}

function normalizeRequestPayload(input: RouterRequestPayload | undefined): RouterRequestPayload {
  if (!input || typeof input !== 'object') {
    return {
      path: '/',
      method: 'POST',
      body: undefined,
      headers: {},
      meta: {},
    }
  }

  return {
    path: typeof input.path === 'string' && input.path.trim().length > 0 ? input.path : '/',
    method: normalizeMethod(input.method),
    body: input.body,
    headers: normalizeHeaders(input.headers),
    meta: normalizeMeta(input.meta),
  }
}

function normalizeRoutePath(input: string) {
  const stripped = input
    .replace(QUERY_AND_HASH_SUFFIX_RE, '')
    .replace(WINDOWS_PATH_SEPARATOR_RE, '/')
    .trim()

  if (!stripped)
    return '/'

  const withPrefix = stripped.startsWith('/') ? stripped : `/${stripped}`
  const withoutTrailingSlash = withPrefix.replace(TRAILING_SLASH_RE, '')

  return withoutTrailingSlash || '/'
}

function normalizeMethod(input: string | undefined) {
  return (input ?? 'POST').toUpperCase()
}

function createRouteKey(method: string, path: string) {
  return `${method} ${normalizeRoutePath(path)}`
}

function extractRoutePathFromModule(modulePath: string) {
  const normalizedPath = modulePath.replace(WINDOWS_PATH_SEPARATOR_RE, '/')
  const sourcePath = resolveRouteSourcePath(normalizedPath)

  const noSuffix = sourcePath.replace(ROUTER_FILE_SUFFIX_RE, '')
  const segments = noSuffix
    .split('/')
    .filter(Boolean)
    .filter(segment => segment !== '.')
    .filter(segment => segment !== 'router')
    .filter(segment => segment !== 'index')

  return segments.length > 0
    ? `/${segments.join('/')}`
    : '/'
}

function resolveRouteSourcePath(modulePath: string) {
  for (const prefix of ROUTER_PATH_PREFIXES) {
    const prefixIndex = modulePath.lastIndexOf(prefix)
    if (prefixIndex >= 0)
      return modulePath.slice(prefixIndex + prefix.length)
  }

  return modulePath
}

function resolveTrace(messageId: string, incomingTraceId: string | undefined): TraceContext {
  const requestId = messageId || createFallbackId('request')
  const traceId = typeof incomingTraceId === 'string' && incomingTraceId.trim().length > 0
    ? incomingTraceId.trim()
    : requestId

  return {
    requestId,
    traceId,
  }
}

function createFallbackId(prefix: string) {
  if (typeof globalThis.crypto?.randomUUID === 'function')
    return `${prefix}:${globalThis.crypto.randomUUID()}`

  return `${prefix}:${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

async function resolveSenderUrl(tabId: number | undefined, fallbackUrl: string | undefined) {
  if (typeof tabId === 'number' && tabId >= 0) {
    try {
      const tab = await browser.tabs.get(tabId)
      if (typeof tab.url === 'string' && tab.url.length > 0)
        return tab.url
    }
    catch {
      // ignore lookup failure
    }
  }

  return fallbackUrl
}

function buildSuccessResponse<TData>(data: TData, trace: TraceContext): RouterSuccess<TData> {
  return {
    ok: true,
    data,
    requestId: trace.requestId,
    traceId: trace.traceId,
  }
}

function buildFailureResponse(error: RouterError, trace: TraceContext): RouterFailure {
  return {
    ok: false,
    error,
    requestId: trace.requestId,
    traceId: trace.traceId,
  }
}

function loadRuntimePlugins(modules: Record<string, RuntimeModuleExport>) {
  const plugins: RuntimePlugin[] = []
  const moduleEntries = Object.entries(modules)
    .sort(([leftModulePath], [rightModulePath]) => leftModulePath.localeCompare(rightModulePath))

  for (const [modulePath, moduleExport] of moduleEntries) {
    const runtimePlugin = moduleExport.default
    if (runtimePlugin === undefined)
      continue

    if (!isPluginHandle(runtimePlugin)) {
      consola.warn(`[router] ignored invalid plugin module: ${modulePath}`)
      continue
    }

    plugins.push(runtimePlugin)
  }

  const pluginNames = plugins.map(plugin => plugin.name ?? 'anonymous-plugin')
  consola.log(`[router] loaded ${plugins.length} plugin(s): ${pluginNames.join(', ') || '(none)'}`)

  return plugins
}

function loadRuntimeMiddlewares(modules: Record<string, RuntimeModuleExport>) {
  const middlewares: RouterMiddleware[] = []
  const loadedModulePaths: string[] = []
  const moduleEntries = Object.entries(modules)
    .sort(([leftModulePath], [rightModulePath]) => leftModulePath.localeCompare(rightModulePath))

  for (const [modulePath, moduleExport] of moduleEntries) {
    const runtimeMiddleware = moduleExport.default
    if (runtimeMiddleware === undefined)
      continue

    if (!isMiddlewareHandle(runtimeMiddleware)) {
      consola.warn(`[router] ignored invalid middleware module: ${modulePath}`)
      continue
    }

    middlewares.push(runtimeMiddleware)
    loadedModulePaths.push(modulePath)
  }

  consola.log(`[router] loaded ${middlewares.length} middleware(s): ${loadedModulePaths.join(', ') || '(none)'}`)

  return middlewares
}

async function runRequestLifecycleHook(
  hookName: 'onContextCreated' | 'onRequest',
  plugins: RuntimePlugin[],
  event: ReturnType<typeof buildRouterEvent>,
) {
  for (const plugin of plugins) {
    const hooks = plugin.hooks
    if (!hooks)
      continue

    const hook = hooks[hookName]
    if (!hook)
      continue

    await hook(event)
  }
}

async function runResponseHook(
  plugins: RuntimePlugin[],
  event: ReturnType<typeof buildRouterEvent>,
  response: RouterSuccess,
) {
  for (const plugin of plugins) {
    const hook = plugin.hooks?.onResponse
    if (!hook)
      continue

    await hook(event, response)
  }
}

async function runErrorHook(
  plugins: RuntimePlugin[],
  event: ReturnType<typeof buildRouterEvent>,
  error: RouterFailure['error'],
) {
  for (const plugin of plugins) {
    const hook = plugin.hooks?.onError
    if (!hook)
      continue

    await hook(event, error)
  }
}

function toRouterError(error: unknown): RouterError {
  if (error instanceof Error) {
    return {
      message: error.message,
      details: {
        name: error.name,
        stack: error.stack,
      },
    }
  }

  if (typeof error === 'string') {
    return {
      message: error,
    }
  }

  if (error && typeof error === 'object') {
    const payload = error as {
      message?: unknown
      code?: unknown
      details?: unknown
    }

    return {
      message: typeof payload.message === 'string' ? payload.message : 'Unknown router error',
      code: typeof payload.code === 'string' ? payload.code : undefined,
      details: payload.details ?? error,
    }
  }

  return {
    message: 'Unknown router error',
    details: error,
  }
}

function toSafeRouterError(error: unknown): RouterError {
  try {
    return toRouterError(error)
  }
  catch (normalizeError) {
    return {
      message: 'Failed to normalize router error',
      code: 'ROUTER_ERROR_NORMALIZE_FAILED',
      details: {
        error: toUnknownErrorDetails(error),
        normalizeError: toUnknownErrorDetails(normalizeError),
      },
    }
  }
}

function toUnknownErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  if (typeof error === 'string') {
    return {
      message: error,
    }
  }

  if (error && typeof error === 'object') {
    try {
      return JSON.parse(JSON.stringify(error))
    }
    catch {
      return {
        type: Object.prototype.toString.call(error),
      }
    }
  }

  return {
    value: error,
  }
}
