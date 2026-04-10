export type RouterMethod
  = 'GET'
    | 'POST'
    | 'PUT'
    | 'PATCH'
    | 'DELETE'
    | 'OPTIONS'
    | 'HEAD'
    | (string & {})

export interface RouterRequestMeta {
  module?: string
  page?: string
  url?: string
  traceId?: string
  [key: string]: unknown
}

export interface RouterRequestPayload<
  TBody = unknown,
  TMeta extends RouterRequestMeta = RouterRequestMeta,
> {
  path: string
  method?: RouterMethod
  body?: TBody
  headers?: Record<string, string>
  meta?: TMeta
}

export interface RouterSender {
  context: string
  tabId?: number
  frameId?: number
  url?: string
}

export type RouterTransactionMode = 'readonly' | 'readwrite'

export type RouterTransactionStatus = 'active' | 'committed' | 'rolled-back'

export interface RouterRequestTransaction {
  readonly id: string
  readonly mode: RouterTransactionMode
  readonly done: Promise<void>
  readonly commit: () => Promise<void>
  readonly rollback: () => Promise<void>
  readonly isActive: () => boolean
  readonly getStatus: () => RouterTransactionStatus
  readonly useStore: <TResult>(
    storeName: string,
    handler: (store: IDBObjectStore) => Promise<TResult> | TResult,
  ) => Promise<TResult>
}

export interface RouterContext {
  sender: RouterSender
  module: string
  page: string
  requestId: string
  traceId: string
  timestamp: number
  transaction?: RouterRequestTransaction
}

export interface RouterEvent<
  TBody = unknown,
  TMeta extends RouterRequestMeta = RouterRequestMeta,
> {
  request: {
    path: string
    method: RouterMethod
    body?: TBody
    headers: Record<string, string>
  }
  context: RouterContext
  meta: TMeta
  rawMessage: unknown
}

export interface RouterError {
  message: string
  code?: string
  details?: unknown
}

export interface RouterSuccess<TData = unknown> {
  ok: true
  data: TData
  requestId: string
  traceId: string
}

export interface RouterFailure {
  ok: false
  error: RouterError
  requestId: string
  traceId: string
}

export type RouterResponse<TData = unknown> = RouterSuccess<TData> | RouterFailure

export type RouterHandler<
  TBody = unknown,
  TResult = unknown,
  TMeta extends RouterRequestMeta = RouterRequestMeta,
> = (event: RouterEvent<TBody, TMeta>) => Promise<TResult> | TResult

export interface RouterHandleOptions {
  method?: RouterMethod
}

export interface RouterHandle<
  TBody = unknown,
  TResult = unknown,
  TMeta extends RouterRequestMeta = RouterRequestMeta,
> {
  readonly method: RouterMethod
  readonly handle: RouterHandler<TBody, TResult, TMeta>
}

export type AnyRouterHandle = RouterHandle<unknown, unknown, RouterRequestMeta>

export interface RuntimeTraceContext {
  requestId: string
  traceId: string
}
