import type {
  AnyRouterHandle,
  RouterError,
  RouterEvent,
  RouterFailure,
  RouterHandle,
  RouterHandleOptions,
  RouterHandler,
  RouterMethod,
  RouterRequestMeta,
  RouterRequestPayload,
  RouterResponse,
  RouterSuccess,
} from '@/runtime/types'

export type {
  AnyRouterHandle,
  RouterError,
  RouterEvent,
  RouterFailure,
  RouterHandle,
  RouterHandleOptions,
  RouterHandler,
  RouterMethod,
  RouterRequestMeta,
  RouterRequestPayload,
  RouterResponse,
  RouterSuccess,
}

export function defineRouterHandle<
  TBody = unknown,
  TResult = unknown,
  TMeta extends RouterRequestMeta = RouterRequestMeta,
>(
  handler: RouterHandler<TBody, TResult, TMeta>,
  options: RouterHandleOptions = {},
): RouterHandle<TBody, TResult, TMeta> {
  const normalizedMethod = (options.method ?? 'POST').toUpperCase() as RouterMethod

  return { method: normalizedMethod, handle: handler }
}

export function isRouterHandle(input: unknown): input is AnyRouterHandle {
  if (!input || typeof input !== 'object')
    return false

  const maybeHandle = input as Partial<AnyRouterHandle>
  return typeof maybeHandle.method === 'string' && typeof maybeHandle.handle === 'function'
}
