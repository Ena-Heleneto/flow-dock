import type {
  RequestRecorderStreamChannel,
  RequestRecorderStreamEvent,
  RequestRecorderStreamEventType,
} from '~/shared/logic/request-recorder'
import { consola } from 'consola'
import browser from 'webextension-polyfill'
import {
  REQUEST_RECORDER_STREAM_PORT_NAME,
} from '~/shared/logic/request-recorder'

const ACK_RETRY_SWEEP_INTERVAL_MS = 300
const ACK_RETRY_BASE_DELAY_MS = 800
const ACK_RETRY_MAX_DELAY_MS = 5000
const ACK_RETRY_MAX_ATTEMPTS = 3
const HEARTBEAT_INTERVAL_MS = 15000

interface StreamConnectionState {
  id: string
  clientId: string
  port: browser.Runtime.Port
  subscribedChannels: Set<RequestRecorderStreamChannel>
  pendingAcks: Map<string, PendingAckDelivery>
  acknowledgedSeqByChannel: Map<RequestRecorderStreamChannel, number>
  lastSeenAt: number
  disposed: boolean
  messageListener: (message: unknown) => void
  disconnectListener: () => void
}

interface PendingAckDelivery {
  event: RequestRecorderStreamEvent
  attempts: number
  lastSentAt: number
  nextRetryAt: number
}

interface PublishRequestRecorderStreamEventInput {
  channel: RequestRecorderStreamChannel
  type: RequestRecorderStreamEventType
  payload: RequestRecorderStreamEvent['payload']
  requireAck?: boolean
}

const connectionMap = new Map<string, StreamConnectionState>()
const channelConnectionMap = new Map<RequestRecorderStreamChannel, Set<string>>()
const channelSequenceMap = new Map<RequestRecorderStreamChannel, number>()

let hasStarted = false
let ackRetryTimer: ReturnType<typeof setInterval> | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null

export function ensureRequestRecorderStreamServer() {
  if (hasStarted)
    return

  hasStarted = true
  browser.runtime.onConnect.addListener(handleRuntimeConnect)
  startBackgroundTimers()
  consola.info('[request-recorder-stream] realtime stream server started')
}

export function publishRequestRecorderStreamEvent(input: PublishRequestRecorderStreamEventInput) {
  ensureRequestRecorderStreamServer()

  const event: RequestRecorderStreamEvent = {
    id: createRuntimeId('request-recorder-stream-event'),
    channel: input.channel,
    seq: nextChannelSequence(input.channel),
    type: input.type,
    ts: Date.now(),
    requireAck: input.requireAck !== false,
    payload: input.payload,
  }

  publishEventToSubscribers(event)
  return event
}

function handleRuntimeConnect(port: browser.Runtime.Port) {
  if (port.name !== REQUEST_RECORDER_STREAM_PORT_NAME)
    return

  const connectionId = createRuntimeId('request-recorder-stream-connection')
  const state: StreamConnectionState = {
    id: connectionId,
    clientId: connectionId,
    port,
    subscribedChannels: new Set(),
    pendingAcks: new Map(),
    acknowledgedSeqByChannel: new Map(),
    lastSeenAt: Date.now(),
    disposed: false,
    messageListener: () => {},
    disconnectListener: () => {},
  }

  state.messageListener = (message) => {
    handleClientMessage(state, message)
  }

  state.disconnectListener = () => {
    disposeConnection(state.id)
  }

  connectionMap.set(state.id, state)
  port.onMessage.addListener(state.messageListener)
  port.onDisconnect.addListener(state.disconnectListener)

  sendServerMessage(state, {
    type: 'ready',
    connectionId: state.id,
    serverTs: Date.now(),
  })
}

function handleClientMessage(state: StreamConnectionState, message: unknown) {
  if (state.disposed)
    return

  state.lastSeenAt = Date.now()

  if (!isRecord(message)) {
    sendServerMessage(state, {
      type: 'error',
      code: 'INVALID_MESSAGE',
      message: 'Invalid stream message payload',
    })
    return
  }

  const messageType = normalizeText(message.type)

  if (messageType === 'subscribe') {
    handleSubscribeMessage(state, message)
    return
  }

  if (messageType === 'unsubscribe') {
    handleUnsubscribeMessage(state, message)
    return
  }

  if (messageType === 'ack') {
    handleAckMessage(state, message)
    return
  }

  if (messageType === 'heartbeat') {
    sendServerMessage(state, {
      type: 'heartbeat',
      serverTs: Date.now(),
    })
    return
  }

  sendServerMessage(state, {
    type: 'error',
    code: 'UNSUPPORTED_MESSAGE',
    message: `Unsupported stream message type: ${messageType || 'unknown'}`,
  })
}

function handleSubscribeMessage(state: StreamConnectionState, message: Record<string, unknown>) {
  const channels = normalizeChannelList(message.channels)
  if (channels.length === 0) {
    sendServerMessage(state, {
      type: 'error',
      code: 'EMPTY_CHANNELS',
      message: 'Subscribe requires at least one channel',
    })
    return
  }

  const clientId = normalizeText(message.clientId)
  if (clientId)
    state.clientId = clientId

  const resumeFromSeq = normalizeResumeFromSeq(message.resumeFromSeq)
  for (const [channel, seq] of resumeFromSeq.entries())
    state.acknowledgedSeqByChannel.set(channel, seq)

  for (const channel of channels)
    subscribeConnectionToChannel(state, channel)

  sendServerMessage(state, {
    type: 'heartbeat',
    serverTs: Date.now(),
  })
}

function handleUnsubscribeMessage(state: StreamConnectionState, message: Record<string, unknown>) {
  const channels = normalizeChannelList(message.channels)

  if (channels.length === 0) {
    for (const channel of state.subscribedChannels)
      unsubscribeConnectionFromChannel(state, channel)

    return
  }

  for (const channel of channels)
    unsubscribeConnectionFromChannel(state, channel)
}

function handleAckMessage(state: StreamConnectionState, message: Record<string, unknown>) {
  const eventId = normalizeText(message.eventId)
  if (!eventId)
    return

  const pending = state.pendingAcks.get(eventId)
  if (!pending)
    return

  state.pendingAcks.delete(eventId)

  const ackChannel = normalizeText(message.channel) || pending.event.channel
  const ackSeq = normalizeCount(message.seq)

  if (ackChannel && ackSeq > 0) {
    const currentAck = state.acknowledgedSeqByChannel.get(ackChannel as RequestRecorderStreamChannel) ?? 0
    if (ackSeq > currentAck)
      state.acknowledgedSeqByChannel.set(ackChannel as RequestRecorderStreamChannel, ackSeq)
  }
}

function subscribeConnectionToChannel(state: StreamConnectionState, channel: RequestRecorderStreamChannel) {
  state.subscribedChannels.add(channel)

  const connectionIds = channelConnectionMap.get(channel)
  if (connectionIds) {
    connectionIds.add(state.id)
    return
  }

  channelConnectionMap.set(channel, new Set([state.id]))
}

function unsubscribeConnectionFromChannel(state: StreamConnectionState, channel: RequestRecorderStreamChannel) {
  state.subscribedChannels.delete(channel)

  const connectionIds = channelConnectionMap.get(channel)
  if (!connectionIds)
    return

  connectionIds.delete(state.id)
  if (connectionIds.size === 0)
    channelConnectionMap.delete(channel)
}

function publishEventToSubscribers(event: RequestRecorderStreamEvent) {
  const connectionIds = channelConnectionMap.get(event.channel)
  if (!connectionIds || connectionIds.size === 0)
    return

  for (const connectionId of connectionIds) {
    const state = connectionMap.get(connectionId)
    if (!state || state.disposed)
      continue

    deliverEvent(state, event)
  }
}

function deliverEvent(state: StreamConnectionState, event: RequestRecorderStreamEvent) {
  const delivered = sendServerMessage(state, {
    type: 'event',
    event,
  })

  if (!delivered) {
    disposeConnection(state.id)
    return
  }

  if (!event.requireAck)
    return

  const now = Date.now()
  state.pendingAcks.set(event.id, {
    event,
    attempts: 1,
    lastSentAt: now,
    nextRetryAt: now + resolveRetryDelay(1),
  })
}

function retryPendingAckDeliveries() {
  if (connectionMap.size === 0)
    return

  const now = Date.now()

  for (const state of connectionMap.values()) {
    if (state.disposed || state.pendingAcks.size === 0)
      continue

    for (const [eventId, pending] of state.pendingAcks.entries()) {
      if (pending.nextRetryAt > now)
        continue

      if (pending.attempts >= ACK_RETRY_MAX_ATTEMPTS) {
        state.pendingAcks.delete(eventId)
        consola.warn('[request-recorder-stream] ack timeout, drop event', {
          connectionId: state.id,
          clientId: state.clientId,
          eventId,
          channel: pending.event.channel,
          seq: pending.event.seq,
          attempts: pending.attempts,
        })
        continue
      }

      const delivered = sendServerMessage(state, {
        type: 'event',
        event: pending.event,
      })

      if (!delivered) {
        disposeConnection(state.id)
        break
      }

      pending.attempts += 1
      pending.lastSentAt = now
      pending.nextRetryAt = now + resolveRetryDelay(pending.attempts)
    }
  }
}

function sendHeartbeatToConnections() {
  for (const state of connectionMap.values()) {
    if (state.disposed)
      continue

    const delivered = sendServerMessage(state, {
      type: 'heartbeat',
      serverTs: Date.now(),
    })

    if (!delivered)
      disposeConnection(state.id)
  }
}

function sendServerMessage(state: StreamConnectionState, message: unknown) {
  if (state.disposed)
    return false

  try {
    state.port.postMessage(message)
    return true
  }
  catch (error) {
    consola.warn('[request-recorder-stream] failed to post message', {
      connectionId: state.id,
      clientId: state.clientId,
      error,
    })
    return false
  }
}

function disposeConnection(connectionId: string) {
  const state = connectionMap.get(connectionId)
  if (!state || state.disposed)
    return

  state.disposed = true

  state.port.onMessage.removeListener(state.messageListener)
  state.port.onDisconnect.removeListener(state.disconnectListener)

  for (const channel of state.subscribedChannels)
    unsubscribeConnectionFromChannel(state, channel)

  state.pendingAcks.clear()
  connectionMap.delete(connectionId)
}

function startBackgroundTimers() {
  if (!ackRetryTimer) {
    ackRetryTimer = setInterval(() => {
      retryPendingAckDeliveries()
    }, ACK_RETRY_SWEEP_INTERVAL_MS)
  }

  if (!heartbeatTimer) {
    heartbeatTimer = setInterval(() => {
      sendHeartbeatToConnections()
    }, HEARTBEAT_INTERVAL_MS)
  }
}

function nextChannelSequence(channel: RequestRecorderStreamChannel) {
  const current = channelSequenceMap.get(channel) ?? 0
  const next = current + 1
  channelSequenceMap.set(channel, next)
  return next
}

function normalizeChannelList(input: unknown) {
  if (!Array.isArray(input))
    return []

  return input
    .map(channel => normalizeText(channel))
    .filter((channel): channel is RequestRecorderStreamChannel => Boolean(channel))
}

function normalizeResumeFromSeq(input: unknown) {
  const output = new Map<RequestRecorderStreamChannel, number>()

  if (!isRecord(input))
    return output

  for (const [rawChannel, rawSeq] of Object.entries(input)) {
    const channel = normalizeText(rawChannel)
    const seq = normalizeCount(rawSeq)

    if (!channel || seq <= 0)
      continue

    output.set(channel as RequestRecorderStreamChannel, seq)
  }

  return output
}

function resolveRetryDelay(attempt: number) {
  const boundedAttempt = Math.max(1, Math.min(8, Math.trunc(attempt)))
  const delay = ACK_RETRY_BASE_DELAY_MS * 2 ** (boundedAttempt - 1)
  return Math.min(ACK_RETRY_MAX_DELAY_MS, delay)
}

function createRuntimeId(prefix: string) {
  if (typeof globalThis.crypto?.randomUUID === 'function')
    return `${prefix}:${globalThis.crypto.randomUUID()}`

  return `${prefix}:${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
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

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input)
    && typeof input === 'object'
    && !Array.isArray(input)
}

ensureRequestRecorderStreamServer()

export type {
  PublishRequestRecorderStreamEventInput,
  StreamConnectionState,
}
