import type {
  RouterMethod,
  RouterRequestMeta,
  RouterRequestPayload,
  RouterResponse,
} from '@/runtime/types'
import { sendMessage } from 'webext-bridge/options'

const QUERY_AND_HASH_SUFFIX_RE = /[#?].*$/
const WINDOWS_PATH_SEPARATOR_RE = /\\+/g
const TRAILING_SLASH_RE = /\/+$/
const HTML_FILE_SUFFIX_RE = /\.html$/i

export interface RouterRequestOptions<
  TBody = unknown,
  TMeta extends RouterRequestMeta = RouterRequestMeta,
> {
  method?: RouterMethod
  body?: TBody
  headers?: Record<string, string>
  meta?: TMeta
}

export async function request<
  TData = unknown,
  TBody = unknown,
  TMeta extends RouterRequestMeta = RouterRequestMeta,
>(
  path: string,
  options: RouterRequestOptions<TBody, TMeta> = {},
): Promise<RouterResponse<TData>> {
  const payload: RouterRequestPayload<TBody, RouterRequestMeta> = {
    path: normalizePath(path),
    method: normalizeMethod(options.method),
    body: options.body,
    headers: normalizeHeaders(options.headers),
    meta: {
      ...buildDefaultMeta(),
      ...(options.meta ?? {}),
    },
  }

  const response = await sendMessage('router-request', payload)
  return response as RouterResponse<TData>
}

export async function requestOrThrow<
  TData = unknown,
  TBody = unknown,
  TMeta extends RouterRequestMeta = RouterRequestMeta,
>(
  path: string,
  options: RouterRequestOptions<TBody, TMeta> = {},
): Promise<TData> {
  const response = await request<TData, TBody, TMeta>(path, options)
  if (response.ok)
    return response.data

  const errorCode = response.error.code ? `[${response.error.code}] ` : ''
  throw new Error(`${errorCode}${response.error.message} (traceId=${response.traceId})`)
}

function normalizePath(path: string) {
  const normalized = path
    .replace(QUERY_AND_HASH_SUFFIX_RE, '')
    .replace(WINDOWS_PATH_SEPARATOR_RE, '/')
    .trim()

  if (!normalized)
    return '/'

  const withPrefix = normalized.startsWith('/') ? normalized : `/${normalized}`
  const withoutTrailingSlash = withPrefix.replace(TRAILING_SLASH_RE, '')

  return withoutTrailingSlash || '/'
}

function normalizeMethod(method: RouterMethod | undefined) {
  return (method ?? 'POST').toUpperCase() as RouterMethod
}

function normalizeHeaders(input: Record<string, string> | undefined): Record<string, string> {
  if (!input)
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

function buildDefaultMeta(): RouterRequestMeta {
  if (typeof globalThis.location === 'undefined')
    return {}

  const pathnameSegments = globalThis.location.pathname.split('/').filter(Boolean)
  const fileName = pathnameSegments.at(-1) ?? ''
  const inferredPage = fileName.replace(HTML_FILE_SUFFIX_RE, '') || 'unknown'
  const inferredModule = pathnameSegments.length > 1
    ? pathnameSegments[pathnameSegments.length - 2]
    : inferredPage

  return {
    url: globalThis.location.href,
    module: inferredModule,
    page: inferredPage,
  }
}
