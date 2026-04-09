import type { Endpoint } from 'webext-bridge'
import type {
  RouterEvent,
  RouterMethod,
  RouterRequestMeta,
  RouterRequestPayload,
  RuntimeTraceContext,
} from './types'

const HTML_FILE_SUFFIX_RE = /\.html$/i

export interface BuildRouterEventInput {
  payload: RouterRequestPayload
  path: string
  method: string
  message: {
    id: string
    sender: Endpoint
    timestamp: number
  }
  trace: RuntimeTraceContext
  senderUrl?: string
}

export function buildRouterEvent(input: BuildRouterEventInput): RouterEvent {
  const normalizedMeta = normalizeMeta(input.payload.meta)
  const senderUrl = input.senderUrl ?? normalizedMeta.url
  const { module, page } = resolveModuleAndPage(normalizedMeta, senderUrl)

  return {
    request: {
      path: input.path,
      method: input.method as RouterMethod,
      body: input.payload.body,
      headers: normalizeHeaders(input.payload.headers),
    },
    context: {
      sender: {
        context: input.message.sender.context,
        tabId: normalizeNumber(input.message.sender.tabId),
        frameId: normalizeNumber(input.message.sender.frameId),
        url: senderUrl,
      },
      module,
      page,
      requestId: input.trace.requestId,
      traceId: input.trace.traceId,
      timestamp: input.message.timestamp,
    },
    meta: normalizedMeta,
    rawMessage: input.message,
  }
}

export function normalizeHeaders(input: RouterRequestPayload['headers']): Record<string, string> {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return {}

  const normalized: Record<string, string> = {}

  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = rawKey.trim()
    if (!key)
      continue

    normalized[key] = String(rawValue)
  }

  return normalized
}

export function normalizeMeta(input: RouterRequestPayload['meta']): RouterRequestMeta {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return {}

  return {
    ...input,
  }
}

export function resolveModuleAndPage(meta: RouterRequestMeta, senderUrl: string | undefined) {
  const fromMetaModule = toNonEmptyString(meta.module)
  const fromMetaPage = toNonEmptyString(meta.page)

  if (fromMetaModule && fromMetaPage) {
    return {
      module: fromMetaModule,
      page: fromMetaPage,
    }
  }

  if (senderUrl) {
    try {
      const parsed = new URL(senderUrl)
      const segments = parsed.pathname.split('/').filter(Boolean)
      const lastSegment = segments.at(-1) ?? ''
      const page = lastSegment.replace(HTML_FILE_SUFFIX_RE, '') || 'unknown'
      const module = segments.length > 1
        ? segments[segments.length - 2]
        : page

      return {
        module: fromMetaModule ?? module ?? 'unknown',
        page: fromMetaPage ?? page ?? 'unknown',
      }
    }
    catch {
      // ignore url parse errors
    }
  }

  return {
    module: fromMetaModule ?? 'unknown',
    page: fromMetaPage ?? fromMetaModule ?? 'unknown',
  }
}

function toNonEmptyString(value: unknown) {
  if (typeof value !== 'string')
    return undefined

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function normalizeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined
}
