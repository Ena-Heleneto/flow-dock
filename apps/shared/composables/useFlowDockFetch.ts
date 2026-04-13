import type {
  BeforeFetchContext,
  CreateFetchOptions,
  UseFetchOptions,
} from '@vueuse/core'
import type { MaybeRefOrGetter } from '@vueuse/shared'

import { createFetch } from '@vueuse/core'
import { toValue } from '@vueuse/shared'
import defu from 'defu'

const ABSOLUTE_URL_RE = /^[a-z][a-z\d+\-.]*:\/\//i

const DEFAULT_BASE_URL = 'https://my-api.com'
const DEFAULT_TIMEOUT_MS = 0

type FlowDockNonHookUseFetchOptions = Omit<
  UseFetchOptions,
  'beforeFetch' | 'afterFetch' | 'onFetchError' | 'fetch'
>

export type FlowDockFetchHeaderValue = string | number | boolean | null | undefined
export type FlowDockFetchHeaders = Record<string, MaybeRefOrGetter<FlowDockFetchHeaderValue>>

export interface FlowDockFetchAuthOptions {
  enabled?: MaybeRefOrGetter<boolean>
  token?: MaybeRefOrGetter<string | null | undefined>
  scheme?: MaybeRefOrGetter<string>
  headerName?: MaybeRefOrGetter<string>
}

export interface FlowDockFetchFactoryOptions {
  baseUrl?: MaybeRefOrGetter<string>
  headers?: MaybeRefOrGetter<FlowDockFetchHeaders>
  auth?: MaybeRefOrGetter<FlowDockFetchAuthOptions>
  timeoutMs?: MaybeRefOrGetter<number | undefined>
  fetchOptions?: MaybeRefOrGetter<RequestInit>
  useFetchOptions?: MaybeRefOrGetter<FlowDockNonHookUseFetchOptions>
  beforeFetch?: MaybeRefOrGetter<UseFetchOptions['beforeFetch']>
  afterFetch?: MaybeRefOrGetter<UseFetchOptions['afterFetch']>
  onFetchError?: MaybeRefOrGetter<UseFetchOptions['onFetchError']>
  fetch?: MaybeRefOrGetter<UseFetchOptions['fetch']>
  combination?: CreateFetchOptions['combination']
}

interface ResolvedFlowDockFetchAuthOptions {
  enabled: boolean
  token: string
  scheme: string
  headerName: string
}

interface ResolvedFlowDockFetchOptions {
  baseUrl: string
  headers: FlowDockFetchHeaders
  auth: ResolvedFlowDockFetchAuthOptions
  timeoutMs: number
  fetchOptions: RequestInit
  useFetchOptions: FlowDockNonHookUseFetchOptions
  beforeFetch?: UseFetchOptions['beforeFetch']
  afterFetch?: UseFetchOptions['afterFetch']
  onFetchError?: UseFetchOptions['onFetchError']
  fetch?: UseFetchOptions['fetch']
}

const DEFAULT_AUTH_OPTIONS: ResolvedFlowDockFetchAuthOptions = {
  enabled: true,
  token: '',
  scheme: 'Bearer',
  headerName: 'Authorization',
}

interface TimeoutSignalContext {
  signal: AbortSignal
  cleanup: () => void
}

export function useFlowDockFetch(option: MaybeRefOrGetter<FlowDockFetchFactoryOptions> = {}) {
  const timeoutCleanupMap = new WeakMap<AbortSignal, () => void>()

  const createFetchOption = toValue(option) ?? {}
  const initialResolvedOption = resolveFlowDockFetchOptions(option)

  const fetchWithTimeoutCleanup: NonNullable<UseFetchOptions['fetch']> = async (input, init = {}) => {
    const resolvedOption = resolveFlowDockFetchOptions(option)
    const runtimeFetch = resolvedOption.fetch ?? globalThis.fetch?.bind(globalThis)

    if (!runtimeFetch)
      throw new Error('FlowDockFetch: 当前运行环境未提供 fetch。')

    try {
      return await runtimeFetch(input, init)
    }
    finally {
      cleanupTimeout(init.signal)
    }
  }

  const beforeFetch: NonNullable<UseFetchOptions['beforeFetch']> = async (ctx) => {
    const resolvedOption = resolveFlowDockFetchOptions(option)

    const mergedOptions = mergeRequestInit(resolvedOption.fetchOptions, ctx.options)
    const mergedHeaders = toHeaders(mergedOptions.headers)

    appendRecordHeaders(mergedHeaders, resolvedOption.headers)
    appendAuthHeader(mergedHeaders, resolvedOption.auth)

    mergedOptions.headers = mergedHeaders

    const timeoutSignalContext = createTimeoutSignal(mergedOptions.signal, resolvedOption.timeoutMs)
    if (timeoutSignalContext) {
      mergedOptions.signal = timeoutSignalContext.signal
      timeoutCleanupMap.set(timeoutSignalContext.signal, timeoutSignalContext.cleanup)
    }

    let nextContext: BeforeFetchContext = {
      ...ctx,
      url: composeRequestUrl(resolvedOption.baseUrl, ctx.url),
      options: mergedOptions,
    }

    const userBeforeFetch = resolvedOption.beforeFetch
    if (userBeforeFetch) {
      const patchedContext = await userBeforeFetch(nextContext)
      if (patchedContext)
        nextContext = mergeBeforeFetchContext(nextContext, patchedContext)
    }

    if (timeoutSignalContext && nextContext.options.signal !== timeoutSignalContext.signal)
      cleanupTimeout(timeoutSignalContext.signal)

    return nextContext
  }

  const afterFetch: NonNullable<UseFetchOptions['afterFetch']> = async (ctx) => {
    const resolvedOption = resolveFlowDockFetchOptions(option)
    const userAfterFetch = resolvedOption.afterFetch

    if (!userAfterFetch)
      return ctx

    const patchedContext = await userAfterFetch(ctx)
    if (!patchedContext)
      return ctx

    return {
      ...ctx,
      ...patchedContext,
    }
  }

  const onFetchError: NonNullable<UseFetchOptions['onFetchError']> = async (ctx) => {
    const resolvedOption = resolveFlowDockFetchOptions(option)
    const userOnFetchError = resolvedOption.onFetchError

    if (!userOnFetchError)
      return { data: ctx.data, error: ctx.error }

    const patchedContext = await userOnFetchError(ctx)
    if (!patchedContext)
      return { data: ctx.data, error: ctx.error }

    return {
      data: patchedContext.data ?? ctx.data,
      error: patchedContext.error ?? ctx.error,
    }
  }

  return createFetch({
    baseUrl: '',
    combination: createFetchOption.combination ?? 'chain',
    options: {
      ...initialResolvedOption.useFetchOptions,
      fetch: fetchWithTimeoutCleanup,
      beforeFetch,
      afterFetch,
      onFetchError,
    },
  })

  function cleanupTimeout(signal: AbortSignal | null | undefined) {
    if (!signal)
      return

    const cleanup = timeoutCleanupMap.get(signal)
    if (!cleanup)
      return

    cleanup()
    timeoutCleanupMap.delete(signal)
  }
}

function resolveFlowDockFetchOptions(
  option: MaybeRefOrGetter<FlowDockFetchFactoryOptions | undefined>,
): ResolvedFlowDockFetchOptions {
  const sourceOption = defu(toValue(option) ?? {}, {
    baseUrl: DEFAULT_BASE_URL,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    fetchOptions: {},
    useFetchOptions: {},
  })

  const rawAuth = toValue(sourceOption.auth) ?? {}

  return {
    baseUrl: normalizeText(toValue(sourceOption.baseUrl)),
    headers: toValue(sourceOption.headers) ?? {},
    auth: {
      enabled: toValue(rawAuth.enabled) ?? DEFAULT_AUTH_OPTIONS.enabled,
      token: normalizeText(toValue(rawAuth.token)),
      scheme: normalizeText(toValue(rawAuth.scheme)) || DEFAULT_AUTH_OPTIONS.scheme,
      headerName: normalizeText(toValue(rawAuth.headerName)) || DEFAULT_AUTH_OPTIONS.headerName,
    },
    timeoutMs: normalizeTimeout(toValue(sourceOption.timeoutMs)),
    fetchOptions: toValue(sourceOption.fetchOptions) ?? {},
    useFetchOptions: toValue(sourceOption.useFetchOptions) ?? {},
    beforeFetch: toValue(sourceOption.beforeFetch),
    afterFetch: toValue(sourceOption.afterFetch),
    onFetchError: toValue(sourceOption.onFetchError),
    fetch: toValue(sourceOption.fetch),
  }
}

function mergeBeforeFetchContext(current: BeforeFetchContext, patch: Partial<BeforeFetchContext>): BeforeFetchContext {
  return {
    ...current,
    ...patch,
    url: patch.url ?? current.url,
    cancel: patch.cancel ?? current.cancel,
    options: patch.options
      ? mergeRequestInit(current.options, patch.options)
      : current.options,
  }
}

function mergeRequestInit(base: RequestInit, override: RequestInit): RequestInit {
  return {
    ...base,
    ...override,
    headers: mergeHeaders(base.headers, override.headers),
  }
}

function mergeHeaders(base: HeadersInit | undefined, override: HeadersInit | undefined) {
  const headers = new Headers(base)
  if (!override)
    return headers

  const nextHeaders = new Headers(override)
  for (const [key, value] of nextHeaders.entries())
    headers.set(key, value)

  return headers
}

function toHeaders(input: HeadersInit | undefined) {
  return new Headers(input)
}

function appendRecordHeaders(headers: Headers, record: FlowDockFetchHeaders) {
  for (const [rawKey, rawValue] of Object.entries(record)) {
    const key = normalizeText(rawKey)
    if (!key)
      continue

    const value = toValue(rawValue)
    if (value === undefined || value === null)
      continue

    headers.set(key, String(value))
  }
}

function appendAuthHeader(headers: Headers, auth: ResolvedFlowDockFetchAuthOptions) {
  if (!auth.enabled)
    return

  const token = normalizeText(auth.token)
  if (!token)
    return

  const scheme = normalizeText(auth.scheme)
  const value = scheme ? `${scheme} ${token}` : token
  headers.set(auth.headerName, value)
}

function createTimeoutSignal(signal: AbortSignal | null | undefined, timeoutMs: number): TimeoutSignalContext | null {
  if (timeoutMs <= 0)
    return null

  const controller = new AbortController()
  const cleanupList: Array<() => void> = []

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason)
    }
    else {
      const onAbort = () => controller.abort(signal.reason)
      signal.addEventListener('abort', onAbort, { once: true })
      cleanupList.push(() => signal.removeEventListener('abort', onAbort))
    }
  }

  const timer = setTimeout(() => {
    controller.abort(new Error(`FlowDockFetch timeout after ${timeoutMs}ms`))
  }, timeoutMs)

  cleanupList.push(() => clearTimeout(timer))

  return {
    signal: controller.signal,
    cleanup: () => {
      for (const cleanup of cleanupList)
        cleanup()
    },
  }
}

function composeRequestUrl(baseUrl: string, url: string) {
  const normalizedUrl = normalizeText(url)
  if (!normalizedUrl)
    return normalizeText(baseUrl)

  if (isAbsoluteUrl(normalizedUrl))
    return normalizedUrl

  const normalizedBaseUrl = normalizeText(baseUrl)
  if (!normalizedBaseUrl)
    return normalizedUrl

  if (normalizedUrl.startsWith('?') || normalizedUrl.startsWith('#'))
    return `${normalizedBaseUrl}${normalizedUrl}`

  const trimmedBase = normalizedBaseUrl.replace(/\/+$/g, '')
  const normalizedPath = normalizedUrl.startsWith('/') ? normalizedUrl : `/${normalizedUrl}`

  return `${trimmedBase}${normalizedPath}`
}

function isAbsoluteUrl(url: string) {
  return ABSOLUTE_URL_RE.test(url) || url.startsWith('//')
}

function normalizeTimeout(input: unknown) {
  if (typeof input !== 'number' || !Number.isFinite(input))
    return DEFAULT_TIMEOUT_MS

  const normalizedTimeout = Math.trunc(input)
  if (normalizedTimeout <= 0)
    return DEFAULT_TIMEOUT_MS

  return normalizedTimeout
}

function normalizeText(input: unknown) {
  if (typeof input !== 'string')
    return ''

  return input.trim()
}
