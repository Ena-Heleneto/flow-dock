export const REQUEST_RECORDER_BUNDLE_VERSION = '1.0' as const

export type RequestRecorderBundleVersion = typeof REQUEST_RECORDER_BUNDLE_VERSION
export type RequestRecorderSessionStatus = 'recording' | 'stopped'
export type RequestRecorderPendingStatus = 'pending' | 'processed'

export interface RequestRecorderSessionSnapshot extends Record<string, unknown> {
  _id: string
  name: string
  status: RequestRecorderSessionStatus
  sourceUrl?: string
  startedAt?: number
  stoppedAt?: number
  createdAt?: number
  updatedAt?: number
}

export interface RequestRecorderCapturedRecord extends Record<string, unknown> {
  _id?: string
  sessionId: string
  url: string
  method: string
  path?: string
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
  createdAt?: number
  updatedAt?: number
}

export interface RequestRecorderBundle extends Record<string, unknown> {
  version: RequestRecorderBundleVersion
  exportedAt: number
  session: RequestRecorderSessionSnapshot | null
  items: RequestRecorderCapturedRecord[]
}

export interface RequestRecorderPendingBundle extends Record<string, unknown> {
  _id: string
  status: RequestRecorderPendingStatus
  source: string
  bundle: RequestRecorderBundle
  createdAt: number
  updatedAt: number
  processedAt?: number
}

export interface RequestRecorderSavePendingInput {
  bundle: RequestRecorderBundle
}

export interface RequestRecorderSavePendingResponse {
  item: RequestRecorderPendingBundle
}

export interface RequestRecorderReadPendingResponse {
  items: RequestRecorderPendingBundle[]
}

export interface RequestRecorderMarkPendingProcessedInput {
  id: string
}

export interface RequestRecorderMarkPendingProcessedResponse {
  item: RequestRecorderPendingBundle | null
}
