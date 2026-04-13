import type {
  RequestRecorderBundle,
  RequestRecorderCapturedRecord,
  RequestRecorderPendingBundle,
  RequestRecorderSessionSnapshot,
} from '~/shared/logic/request-recorder'
import { consola } from 'consola'
import { onMessage } from 'webext-bridge/background'
import { storage } from 'webextension-polyfill'
import {
  REQUEST_RECORDER_BUNDLE_VERSION,
  REQUEST_RECORDER_STREAM_CHANNEL_PENDING,
} from '~/shared/logic/request-recorder'
import { publishRequestRecorderStreamEvent } from './request-recorder-stream'

const REQUEST_RECORDER_PENDING_STORAGE_KEY = 'flow-dock.request-recorder.pending-bundles'

onMessage('request-recorder-save-pending', async (message) => {
  const bundle = normalizeBundle(message.data?.bundle)
  const existingItems = await readStoredPendingBundles()
  const now = Date.now()

  const nextItem: RequestRecorderPendingBundle = {
    _id: createRuntimeId('pending-recorder'),
    status: 'pending',
    source: 'content-scripts',
    bundle,
    createdAt: now,
    updatedAt: now,
  }

  existingItems.unshift(nextItem)
  await writeStoredPendingBundles(existingItems)

  try {
    publishRequestRecorderStreamEvent({
      channel: REQUEST_RECORDER_STREAM_CHANNEL_PENDING,
      type: 'pending.saved',
      payload: {
        pendingId: nextItem._id,
        sessionId: normalizeText(nextItem.bundle.session?._id) || undefined,
        createdAt: nextItem.createdAt,
        updatedAt: nextItem.updatedAt,
      },
      requireAck: true,
    })
  }
  catch (error) {
    consola.warn('[request-recorder-pending] publish pending.saved failed', error)
  }

  return {
    item: nextItem,
  }
})

onMessage('request-recorder-read-pending', async () => {
  const items = await readStoredPendingBundles()
  return {
    items,
  }
})

onMessage('request-recorder-mark-pending-processed', async (message) => {
  const id = normalizeText(message.data?.id)
  if (!id) {
    return {
      item: null,
    }
  }

  const items = await readStoredPendingBundles()
  const targetIndex = items.findIndex(item => item._id === id)
  if (targetIndex < 0) {
    return {
      item: null,
    }
  }

  const now = Date.now()
  const nextItem: RequestRecorderPendingBundle = {
    ...items[targetIndex],
    status: 'processed',
    updatedAt: now,
    processedAt: now,
  }

  items[targetIndex] = nextItem
  await writeStoredPendingBundles(items)

  try {
    publishRequestRecorderStreamEvent({
      channel: REQUEST_RECORDER_STREAM_CHANNEL_PENDING,
      type: 'pending.processed',
      payload: {
        pendingId: nextItem._id,
        processedAt: nextItem.processedAt,
        updatedAt: nextItem.updatedAt,
      },
      requireAck: true,
    })
  }
  catch (error) {
    consola.warn('[request-recorder-pending] publish pending.processed failed', error)
  }

  return {
    item: nextItem,
  }
})

async function readStoredPendingBundles() {
  const data = await storage.local.get(REQUEST_RECORDER_PENDING_STORAGE_KEY)
  const source = data[REQUEST_RECORDER_PENDING_STORAGE_KEY]

  if (!Array.isArray(source))
    return []

  return source
    .map(item => normalizePendingBundle(item))
    .filter((item): item is RequestRecorderPendingBundle => Boolean(item))
    .sort(comparePendingBundleByLatest)
}

async function writeStoredPendingBundles(items: RequestRecorderPendingBundle[]) {
  await storage.local.set({
    [REQUEST_RECORDER_PENDING_STORAGE_KEY]: items,
  })
}

function normalizePendingBundle(input: unknown): RequestRecorderPendingBundle | null {
  if (!isRecord(input))
    return null

  const id = normalizeText(input._id)
  const bundle = normalizeBundle(input.bundle)
  if (!id)
    return null

  return {
    _id: id,
    status: input.status === 'processed' ? 'processed' : 'pending',
    source: normalizeText(input.source) || 'content-scripts',
    bundle,
    createdAt: normalizeNumber(input.createdAt) ?? Date.now(),
    updatedAt: normalizeNumber(input.updatedAt) ?? normalizeNumber(input.createdAt) ?? Date.now(),
    processedAt: normalizeNumber(input.processedAt),
  }
}

function normalizeBundle(input: unknown): RequestRecorderBundle {
  if (!isRecord(input))
    return createEmptyBundle()

  const session = normalizeSessionSnapshot(input.session)
  const items = Array.isArray(input.items)
    ? input.items
        .map(item => normalizeCapturedRecord(item, session?._id))
        .filter((item): item is RequestRecorderCapturedRecord => Boolean(item))
    : []

  return {
    version: REQUEST_RECORDER_BUNDLE_VERSION,
    exportedAt: normalizeNumber(input.exportedAt) ?? Date.now(),
    session,
    items,
  }
}

function createEmptyBundle(): RequestRecorderBundle {
  return {
    version: REQUEST_RECORDER_BUNDLE_VERSION,
    exportedAt: Date.now(),
    session: null,
    items: [],
  }
}

function normalizeSessionSnapshot(input: unknown): RequestRecorderSessionSnapshot | null {
  if (!isRecord(input))
    return null

  const id = normalizeText(input._id)
  const name = normalizeText(input.name)
  if (!id || !name)
    return null

  return {
    _id: id,
    name,
    status: input.status === 'recording' ? 'recording' : 'stopped',
    sourceUrl: normalizeOptionalText(input.sourceUrl),
    startedAt: normalizeNumber(input.startedAt),
    stoppedAt: normalizeNumber(input.stoppedAt),
    createdAt: normalizeNumber(input.createdAt),
    updatedAt: normalizeNumber(input.updatedAt),
  }
}

function normalizeCapturedRecord(input: unknown, sessionIdFallback: string | undefined): RequestRecorderCapturedRecord | null {
  if (!isRecord(input))
    return null

  const url = normalizeText(input.url)
  if (!url)
    return null

  const sessionId = normalizeText(input.sessionId) || sessionIdFallback || ''
  if (!sessionId)
    return null

  return {
    _id: normalizeOptionalText(input._id),
    sessionId,
    url,
    method: normalizeText(input.method).toUpperCase() || 'GET',
    path: normalizeOptionalText(input.path),
    requestHeaders: normalizeStringMap(input.requestHeaders),
    requestQuery: normalizeStringMap(input.requestQuery),
    requestBodyText: normalizeOptionalText(input.requestBodyText),
    requestBodyJson: cloneUnknown(input.requestBodyJson),
    responseBodyText: normalizeOptionalText(input.responseBodyText),
    responseBodyJson: cloneUnknown(input.responseBodyJson),
    contentType: normalizeOptionalText(input.contentType),
    status: normalizeNumber(input.status),
    durationMs: normalizeNumber(input.durationMs),
    sourceUrl: normalizeOptionalText(input.sourceUrl),
    truncated: input.truncated === true,
    createdAt: normalizeNumber(input.createdAt),
    updatedAt: normalizeNumber(input.updatedAt),
  }
}

function comparePendingBundleByLatest(left: RequestRecorderPendingBundle, right: RequestRecorderPendingBundle) {
  if (left.updatedAt !== right.updatedAt)
    return right.updatedAt - left.updatedAt

  return right._id.localeCompare(left._id)
}

function normalizeStringMap(input: unknown) {
  if (!isRecord(input))
    return undefined

  const output: Record<string, string> = {}

  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = normalizeText(rawKey)
    if (!key)
      continue

    if (typeof rawValue === 'string' || typeof rawValue === 'number' || typeof rawValue === 'boolean')
      output[key] = String(rawValue)
  }

  return Object.keys(output).length > 0 ? output : undefined
}

function createRuntimeId(prefix: string) {
  if (typeof globalThis.crypto?.randomUUID === 'function')
    return `${prefix}:${globalThis.crypto.randomUUID()}`

  return `${prefix}:${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function cloneUnknown<T>(input: T): T {
  if (Array.isArray(input))
    return input.map(item => cloneUnknown(item)) as T

  if (isRecord(input)) {
    const output: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(input))
      output[key] = cloneUnknown(value)

    return output as T
  }

  return input
}

function normalizeNumber(input: unknown) {
  if (typeof input === 'number' && Number.isFinite(input))
    return input

  if (typeof input === 'string' && input.trim()) {
    const parsed = Number(input)
    if (Number.isFinite(parsed))
      return parsed
  }

  return undefined
}

function normalizeOptionalText(input: unknown) {
  const normalized = normalizeText(input)
  return normalized || undefined
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
