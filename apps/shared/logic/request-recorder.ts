export const REQUEST_RECORDER_BUNDLE_VERSION = '1.0' as const
export const REQUEST_RECORDER_STREAM_PORT_NAME = 'flow-dock.request-recorder.stream' as const
export const REQUEST_RECORDER_STREAM_CHANNEL_PENDING = 'request-recorder.pending' as const

export type RequestRecorderBundleVersion = typeof REQUEST_RECORDER_BUNDLE_VERSION
export type RequestRecorderStreamPortName = typeof REQUEST_RECORDER_STREAM_PORT_NAME
export type RequestRecorderStreamChannel = typeof REQUEST_RECORDER_STREAM_CHANNEL_PENDING | (string & {})
export type RequestRecorderSessionStatus = 'recording' | 'stopped'
export type RequestRecorderPendingStatus = 'pending' | 'processed'
export type RequestRecorderStreamEventType
  = 'pending.saved'
    | 'pending.processed'
    | (string & {})

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

export interface RequestRecorderPendingSavedEventPayload {
  pendingId: string
  sessionId?: string
  createdAt: number
  updatedAt: number
}

export interface RequestRecorderPendingProcessedEventPayload {
  pendingId: string
  processedAt?: number
  updatedAt: number
}

export interface RequestRecorderStreamEventEnvelope<TPayload = unknown> {
  id: string
  channel: RequestRecorderStreamChannel
  seq: number
  type: RequestRecorderStreamEventType
  ts: number
  requireAck?: boolean
  payload: TPayload
}

export type RequestRecorderStreamEvent
  = RequestRecorderStreamEventEnvelope<RequestRecorderPendingSavedEventPayload>
    | RequestRecorderStreamEventEnvelope<RequestRecorderPendingProcessedEventPayload>

export interface RequestRecorderStreamSubscribeMessage {
  type: 'subscribe'
  clientId?: string
  channels: RequestRecorderStreamChannel[]
  resumeFromSeq?: Record<string, number>
}

export interface RequestRecorderStreamUnsubscribeMessage {
  type: 'unsubscribe'
  clientId?: string
  channels?: RequestRecorderStreamChannel[]
}

export interface RequestRecorderStreamAckMessage {
  type: 'ack'
  clientId?: string
  eventId: string
  channel: RequestRecorderStreamChannel
  seq: number
  receivedAt?: number
}

export interface RequestRecorderStreamHeartbeatClientMessage {
  type: 'heartbeat'
  clientId?: string
  ts?: number
}

export type RequestRecorderStreamClientMessage
  = RequestRecorderStreamSubscribeMessage
    | RequestRecorderStreamUnsubscribeMessage
    | RequestRecorderStreamAckMessage
    | RequestRecorderStreamHeartbeatClientMessage

export interface RequestRecorderStreamReadyMessage {
  type: 'ready'
  connectionId: string
  serverTs: number
}

export interface RequestRecorderStreamEventServerMessage {
  type: 'event'
  event: RequestRecorderStreamEvent
}

export interface RequestRecorderStreamHeartbeatServerMessage {
  type: 'heartbeat'
  serverTs: number
}

export interface RequestRecorderStreamErrorServerMessage {
  type: 'error'
  message: string
  code?: string
}

export type RequestRecorderStreamServerMessage
  = RequestRecorderStreamReadyMessage
    | RequestRecorderStreamEventServerMessage
    | RequestRecorderStreamHeartbeatServerMessage
    | RequestRecorderStreamErrorServerMessage
