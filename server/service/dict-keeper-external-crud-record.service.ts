import type { RouterRequestTransaction } from '@/runtime/types'
import type { DictKeeperExternalCrudRecordSessionDocument } from '@/schema/dict-keeper/external-crud-record-session.schema'
import type {
  DictKeeperCrudAction,
  DictKeeperCrudSection,
  DictKeeperExternalCrudRecordDocument,
  DictKeeperExternalCrudRecordMappingDraft,
} from '@/schema/dict-keeper/external-crud-record.schema'
import type {
  DictKeeperEndpointMergeStrategy,
  DictKeeperRequestMethod,
} from '@/schema/dict-keeper/external-crud.schema'
import dictKeeperExternalCrudRecordSessionSchema from '@/schema/dict-keeper/external-crud-record-session.schema'
import dictKeeperExternalCrudRecordSchema, {
  DICT_KEEPER_CRUD_ACTIONS,
  DICT_KEEPER_CRUD_SECTIONS,
} from '@/schema/dict-keeper/external-crud-record.schema'
import {
  DICT_KEEPER_ENDPOINT_MERGE_STRATEGIES,
  DICT_KEEPER_REQUEST_METHODS,
} from '@/schema/dict-keeper/external-crud.schema'

const REQUEST_METHOD_SET = new Set<DictKeeperRequestMethod>(DICT_KEEPER_REQUEST_METHODS)
const MERGE_STRATEGY_SET = new Set<DictKeeperEndpointMergeStrategy>(DICT_KEEPER_ENDPOINT_MERGE_STRATEGIES)
const SECTION_SET = new Set<DictKeeperCrudSection>(DICT_KEEPER_CRUD_SECTIONS)
const ACTION_SET = new Set<DictKeeperCrudAction>(DICT_KEEPER_CRUD_ACTIONS)

const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
])

const MAX_BODY_TEXT_LENGTH = 50_000

interface DictKeeperOperator {
  module: string
  page: string
  traceId: string
}

interface DictKeeperExternalCrudRecordServiceOptions {
  transaction?: RouterRequestTransaction
}

interface DictKeeperExternalCrudRecordSessionStartInput {
  id?: string
  name?: string
  sourceUrl?: string
  createdBy: DictKeeperOperator
}

interface DictKeeperExternalCrudRecordSessionStopInput {
  id?: string
  updatedBy: DictKeeperOperator
}

interface DictKeeperExternalCrudRecordCreateInput {
  id?: string
  sessionId?: string
  url: string
  method?: string
  path?: string
  requestHeaders?: unknown
  requestQuery?: unknown
  requestBodyText?: unknown
  requestBodyJson?: unknown
  responseBodyText?: unknown
  responseBodyJson?: unknown
  contentType?: string
  status?: unknown
  durationMs?: unknown
  sourceTabId?: unknown
  sourceUrl?: string
  masked?: unknown
  truncated?: unknown
  mappingDraft?: Partial<DictKeeperExternalCrudRecordMappingDraft>
  createdBy: DictKeeperOperator
}

interface DictKeeperExternalCrudRecordListInput {
  sessionId?: string
  includeDeleted?: boolean
  limit?: number
}

interface DictKeeperExternalCrudRecordReadInput {
  id?: string
  includeDeleted?: boolean
}

interface DictKeeperExternalCrudRecordDeleteInput {
  id?: string
  deletedBy: DictKeeperOperator
}

interface DictKeeperExternalCrudRecordApplyMappingInput {
  id?: string
  section?: string
  action?: string
  patch?: Partial<DictKeeperExternalCrudRecordMappingDraft>
  updatedBy: DictKeeperOperator
}

interface DictKeeperExternalCrudRecordExportInput {
  sessionId?: string
  ids?: string[]
  includeDeleted?: boolean
}

interface DictKeeperExternalCrudRecordImportInput {
  bundle: unknown
  sessionId?: string
  createdBy: DictKeeperOperator
}

interface DictKeeperExternalCrudRecordImportPayload {
  session?: Partial<DictKeeperExternalCrudRecordSessionDocument> | null
  items: Array<Partial<DictKeeperExternalCrudRecordDocument>>
}

export interface DictKeeperExternalCrudRecordExportBundle {
  version: '1.0'
  exportedAt: number
  session: DictKeeperExternalCrudRecordSessionDocument | null
  items: DictKeeperExternalCrudRecordDocument[]
}

export interface DictKeeperExternalCrudRecordImportResult {
  sessionId: string
  importedCount: number
  skippedCount: number
  items: DictKeeperExternalCrudRecordDocument[]
}

export interface DictKeeperExternalCrudRecordApplyMappingResult {
  item: DictKeeperExternalCrudRecordDocument
  suggestion: DictKeeperExternalCrudRecordMappingDraft
}

export async function startDictKeeperExternalCrudRecordSession(
  input: DictKeeperExternalCrudRecordSessionStartInput,
  options: DictKeeperExternalCrudRecordServiceOptions = {},
) {
  const id = normalizeOptionalText(input.id)
  const sourceUrl = normalizeOptionalText(input.sourceUrl)
  const now = Date.now()

  if (id) {
    const existing = await dictKeeperExternalCrudRecordSessionSchema.findOne(
      { _id: id },
      { transaction: options.transaction },
    )

    if (existing) {
      return dictKeeperExternalCrudRecordSessionSchema.updateById(
        id,
        {
          name: resolveSessionName(input.name),
          status: 'recording',
          sourceUrl,
          startedAt: now,
          stoppedAt: undefined,
          isDeleted: false,
          deletedAt: undefined,
          updatedBy: input.createdBy,
        },
        { transaction: options.transaction },
      )
    }
  }

  return dictKeeperExternalCrudRecordSessionSchema.create(
    {
      _id: id,
      name: resolveSessionName(input.name),
      status: 'recording',
      sourceUrl,
      startedAt: now,
      stoppedAt: undefined,
      isDeleted: false,
      deletedAt: undefined,
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
    },
    { transaction: options.transaction },
  )
}

export async function stopDictKeeperExternalCrudRecordSession(
  input: DictKeeperExternalCrudRecordSessionStopInput,
  options: DictKeeperExternalCrudRecordServiceOptions = {},
) {
  const id = normalizeOptionalText(input.id)
  const targetId = id ?? await findLatestRecordingSessionId(options)

  if (!targetId)
    return null

  return dictKeeperExternalCrudRecordSessionSchema.updateById(
    targetId,
    {
      status: 'stopped',
      stoppedAt: Date.now(),
      updatedBy: input.updatedBy,
    },
    { transaction: options.transaction },
  )
}

export async function createDictKeeperExternalCrudRecord(
  input: DictKeeperExternalCrudRecordCreateInput,
  options: DictKeeperExternalCrudRecordServiceOptions = {},
) {
  const sessionId = await resolveRecordSessionId(input.sessionId, input.createdBy, options)
  const url = normalizeRequiredText(input.url, 'Record url is required')
  const method = normalizeRequestMethod(input.method) ?? 'GET'
  const parsedUrl = parseUrlParts(url)
  const path = normalizeOptionalText(input.path) ?? parsedUrl.path
  const requestHeaders = normalizeStringMap(input.requestHeaders)
  const requestQuery = {
    ...parsedUrl.query,
    ...normalizeStringMap(input.requestQuery),
  }
  const requestBodyTextResult = normalizeLimitedText(input.requestBodyText, MAX_BODY_TEXT_LENGTH)
  const responseBodyTextResult = normalizeLimitedText(input.responseBodyText, MAX_BODY_TEXT_LENGTH)

  return dictKeeperExternalCrudRecordSchema.create(
    {
      _id: normalizeOptionalText(input.id),
      sessionId,
      url,
      method,
      path,
      requestHeaders,
      requestQuery,
      requestBodyText: requestBodyTextResult.value,
      requestBodyJson: cloneUnknown(input.requestBodyJson),
      responseBodyText: responseBodyTextResult.value,
      responseBodyJson: cloneUnknown(input.responseBodyJson),
      contentType: resolveContentType(input.contentType, requestHeaders),
      status: normalizeOptionalNumber(input.status),
      durationMs: normalizeOptionalNumber(input.durationMs),
      sourceTabId: normalizeOptionalNumber(input.sourceTabId),
      sourceUrl: normalizeOptionalText(input.sourceUrl),
      masked: normalizeOptionalBoolean(input.masked),
      truncated: input.truncated === true || requestBodyTextResult.truncated || responseBodyTextResult.truncated,
      mappingDraft: normalizeMappingDraft(input.mappingDraft),
      isDeleted: false,
      deletedAt: undefined,
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
    },
    { transaction: options.transaction },
  )
}

export async function listDictKeeperExternalCrudRecords(
  input: DictKeeperExternalCrudRecordListInput,
  options: DictKeeperExternalCrudRecordServiceOptions = {},
) {
  const sessionId = normalizeOptionalText(input.sessionId)
  const includeDeleted = input.includeDeleted === true
  const limit = normalizeOptionalNumber(input.limit)

  const records = await dictKeeperExternalCrudRecordSchema.find((document) => {
    if (!includeDeleted && document.isDeleted === true)
      return false

    if (sessionId && document.sessionId !== sessionId)
      return false

    return true
  }, { transaction: options.transaction })

  records.sort(compareRecordByLatest)

  if (!limit || limit <= 0)
    return records

  return records.slice(0, limit)
}

export async function readDictKeeperExternalCrudRecord(
  input: DictKeeperExternalCrudRecordReadInput,
  options: DictKeeperExternalCrudRecordServiceOptions = {},
) {
  const id = normalizeOptionalText(input.id)
  if (!id)
    return null

  const includeDeleted = input.includeDeleted === true
  const record = await dictKeeperExternalCrudRecordSchema.findOne(
    { _id: id },
    { transaction: options.transaction },
  )

  if (!record)
    return null

  if (!includeDeleted && record.isDeleted === true)
    return null

  return record
}

export async function deleteDictKeeperExternalCrudRecord(
  input: DictKeeperExternalCrudRecordDeleteInput,
  options: DictKeeperExternalCrudRecordServiceOptions = {},
) {
  const id = normalizeOptionalText(input.id)
  if (!id)
    return null

  return dictKeeperExternalCrudRecordSchema.updateById(
    id,
    {
      isDeleted: true,
      deletedAt: Date.now(),
      updatedBy: input.deletedBy,
    },
    { transaction: options.transaction },
  )
}

export async function applyDictKeeperExternalCrudRecordMapping(
  input: DictKeeperExternalCrudRecordApplyMappingInput,
  options: DictKeeperExternalCrudRecordServiceOptions = {},
): Promise<DictKeeperExternalCrudRecordApplyMappingResult | null> {
  const id = normalizeOptionalText(input.id)
  if (!id)
    return null

  const record = await readDictKeeperExternalCrudRecord(
    {
      id,
      includeDeleted: false,
    },
    options,
  )

  if (!record)
    return null

  const section = normalizeCrudSection(input.section)
  const action = normalizeCrudAction(input.action)
  if (!section || !action)
    return null

  const suggestion = buildRecordMappingSuggestion(record, section, action, input.patch)
  const updated = await dictKeeperExternalCrudRecordSchema.updateById(
    id,
    {
      mappingDraft: suggestion,
      updatedBy: input.updatedBy,
    },
    { transaction: options.transaction },
  )

  if (!updated)
    return null

  return {
    item: updated,
    suggestion,
  }
}

export async function exportDictKeeperExternalCrudRecordBundle(
  input: DictKeeperExternalCrudRecordExportInput,
  options: DictKeeperExternalCrudRecordServiceOptions = {},
): Promise<DictKeeperExternalCrudRecordExportBundle> {
  const sessionId = normalizeOptionalText(input.sessionId)
  const ids = normalizeStringArray(input.ids)
  const includeDeleted = input.includeDeleted === true

  const records = await listDictKeeperExternalCrudRecords(
    {
      sessionId,
      includeDeleted,
    },
    options,
  )

  const idSet = ids.length > 0 ? new Set(ids) : null
  let selectedItems = records

  if (idSet)
    selectedItems = records.filter(item => idSet.has(item._id))

  const session = sessionId
    ? await dictKeeperExternalCrudRecordSessionSchema.findOne(
        { _id: sessionId },
        { transaction: options.transaction },
      )
    : null

  return {
    version: '1.0',
    exportedAt: Date.now(),
    session,
    items: selectedItems,
  }
}

export async function importDictKeeperExternalCrudRecordBundle(
  input: DictKeeperExternalCrudRecordImportInput,
  options: DictKeeperExternalCrudRecordServiceOptions = {},
): Promise<DictKeeperExternalCrudRecordImportResult> {
  const payload = normalizeImportPayload(input.bundle)
  const sessionId = await ensureImportSessionId(
    input.sessionId,
    payload.session,
    input.createdBy,
    options,
  )

  const items: DictKeeperExternalCrudRecordDocument[] = []
  let skippedCount = 0

  for (const item of payload.items) {
    const url = normalizeOptionalText(item.url)

    if (!url) {
      skippedCount += 1
      continue
    }

    const normalizedInput: DictKeeperExternalCrudRecordCreateInput = {
      id: normalizeOptionalText(item._id),
      sessionId,
      url,
      method: normalizeOptionalText(item.method),
      path: normalizeOptionalText(item.path),
      requestHeaders: item.requestHeaders,
      requestQuery: item.requestQuery,
      requestBodyText: item.requestBodyText,
      requestBodyJson: item.requestBodyJson,
      responseBodyText: item.responseBodyText,
      responseBodyJson: item.responseBodyJson,
      contentType: normalizeOptionalText(item.contentType),
      status: item.status,
      durationMs: item.durationMs,
      sourceTabId: item.sourceTabId,
      sourceUrl: normalizeOptionalText(item.sourceUrl),
      masked: item.masked,
      truncated: item.truncated,
      mappingDraft: normalizeMappingDraft(item.mappingDraft),
      createdBy: input.createdBy,
    }

    try {
      const created = await createDictKeeperExternalCrudRecord(normalizedInput, options)
      items.push(created)
    }
    catch {
      if (!normalizedInput.id) {
        skippedCount += 1
        continue
      }

      try {
        const created = await createDictKeeperExternalCrudRecord(
          {
            ...normalizedInput,
            id: undefined,
          },
          options,
        )
        items.push(created)
      }
      catch {
        skippedCount += 1
      }
    }
  }

  return {
    sessionId,
    importedCount: items.length,
    skippedCount,
    items,
  }
}

async function resolveRecordSessionId(
  inputSessionId: string | undefined,
  createdBy: DictKeeperOperator,
  options: DictKeeperExternalCrudRecordServiceOptions,
) {
  const sessionId = normalizeOptionalText(inputSessionId)

  if (sessionId) {
    const session = await dictKeeperExternalCrudRecordSessionSchema.findOne(
      { _id: sessionId },
      { transaction: options.transaction },
    )

    if (session)
      return sessionId

    const created = await startDictKeeperExternalCrudRecordSession(
      {
        id: sessionId,
        name: resolveSessionName(undefined),
        createdBy,
      },
      options,
    )

    return created?._id ?? sessionId
  }

  const latestRecording = await findLatestRecordingSessionId(options)
  if (latestRecording)
    return latestRecording

  const created = await startDictKeeperExternalCrudRecordSession(
    {
      name: resolveSessionName(undefined),
      createdBy,
    },
    options,
  )

  return created?._id ?? ''
}

async function findLatestRecordingSessionId(options: DictKeeperExternalCrudRecordServiceOptions) {
  const sessions = await dictKeeperExternalCrudRecordSessionSchema.find((document) => {
    if (document.isDeleted === true)
      return false

    return document.status === 'recording'
  }, { transaction: options.transaction })

  sessions.sort((left, right) => (right.startedAt ?? 0) - (left.startedAt ?? 0))
  return sessions.at(0)?._id ?? null
}

function buildRecordMappingSuggestion(
  record: DictKeeperExternalCrudRecordDocument,
  section: DictKeeperCrudSection,
  action: DictKeeperCrudAction,
  patch: Partial<DictKeeperExternalCrudRecordMappingDraft> | undefined,
): DictKeeperExternalCrudRecordMappingDraft {
  const patchMethod = normalizeRequestMethod(patch?.method)
  const patchMergeStrategy = normalizeMergeStrategy(patch?.mergeStrategy)
  const queryTemplate = normalizeStringMap(patch?.queryTemplate)
  const headerTemplate = normalizeStringMap(patch?.headerTemplate)

  return {
    section,
    action,
    path: normalizeOptionalText(patch?.path)
      ?? normalizeOptionalText(record.path)
      ?? '/',
    method: patchMethod ?? normalizeRequestMethod(record.method) ?? inferRequestMethodFromAction(action),
    pathTemplate: normalizeOptionalText(patch?.pathTemplate),
    queryTemplate: hasValues(queryTemplate)
      ? queryTemplate
      : buildQueryTemplate(record.requestQuery),
    headerTemplate: hasValues(headerTemplate)
      ? headerTemplate
      : buildHeaderTemplate(record.requestHeaders),
    bodyTemplate: patch?.bodyTemplate === undefined
      ? buildBodyTemplate(record.requestBodyJson)
      : cloneUnknown(patch.bodyTemplate),
    contentType: normalizeOptionalText(patch?.contentType)
      ?? normalizeOptionalText(record.contentType),
    timeoutMs: normalizeOptionalNumber(patch?.timeoutMs),
    mergeStrategy: patchMergeStrategy,
  }
}

async function ensureImportSessionId(
  inputSessionId: string | undefined,
  session: Partial<DictKeeperExternalCrudRecordSessionDocument> | null | undefined,
  createdBy: DictKeeperOperator,
  options: DictKeeperExternalCrudRecordServiceOptions,
) {
  const preferredId = normalizeOptionalText(inputSessionId)
    ?? normalizeOptionalText(session?._id)

  if (preferredId) {
    const existing = await dictKeeperExternalCrudRecordSessionSchema.findOne(
      { _id: preferredId },
      { transaction: options.transaction },
    )

    if (existing)
      return preferredId

    const created = await startDictKeeperExternalCrudRecordSession(
      {
        id: preferredId,
        name: normalizeOptionalText(session?.name) ?? resolveSessionName('导入会话'),
        sourceUrl: normalizeOptionalText(session?.sourceUrl),
        createdBy,
      },
      options,
    )

    await stopDictKeeperExternalCrudRecordSession(
      {
        id: created?._id,
        updatedBy: createdBy,
      },
      options,
    )

    return created?._id ?? preferredId
  }

  const created = await startDictKeeperExternalCrudRecordSession(
    {
      name: resolveSessionName('导入会话'),
      sourceUrl: normalizeOptionalText(session?.sourceUrl),
      createdBy,
    },
    options,
  )

  await stopDictKeeperExternalCrudRecordSession(
    {
      id: created?._id,
      updatedBy: createdBy,
    },
    options,
  )

  return created?._id ?? ''
}

function normalizeImportPayload(bundle: unknown): DictKeeperExternalCrudRecordImportPayload {
  if (!isRecord(bundle)) {
    throw createDictKeeperExternalCrudRecordServiceError(
      'Invalid record import bundle',
      'DICT_KEEPER_EXTERNAL_CRUD_RECORD_IMPORT_BUNDLE_INVALID',
      {
        bundle,
      },
    )
  }

  const maybeItems = bundle.items
  const maybeSession = bundle.session

  if (!Array.isArray(maybeItems)) {
    throw createDictKeeperExternalCrudRecordServiceError(
      'Record import bundle must contain an items array',
      'DICT_KEEPER_EXTERNAL_CRUD_RECORD_IMPORT_ITEMS_REQUIRED',
      {
        bundle,
      },
    )
  }

  const items = maybeItems.filter(isRecord)
  const session = isRecord(maybeSession) ? maybeSession : null

  return {
    session,
    items,
  }
}

function compareRecordByLatest(
  left: DictKeeperExternalCrudRecordDocument,
  right: DictKeeperExternalCrudRecordDocument,
) {
  const leftTime = left.updatedAt ?? left.createdAt ?? 0
  const rightTime = right.updatedAt ?? right.createdAt ?? 0

  if (leftTime !== rightTime)
    return rightTime - leftTime

  return right._id.localeCompare(left._id)
}

function parseUrlParts(url: string) {
  try {
    const parsed = new URL(url)
    const query: Record<string, string> = {}
    parsed.searchParams.forEach((value, key) => {
      query[key] = value
    })

    return {
      path: parsed.pathname || '/',
      query,
    }
  }
  catch {
    const hashRemoved = url.split('#').at(0) ?? url
    const [pathPart, searchPart = ''] = hashRemoved.split('?')
    const query = parseSearchQuery(searchPart)

    return {
      path: pathPart || '/',
      query,
    }
  }
}

function parseSearchQuery(search: string) {
  const query: Record<string, string> = {}

  for (const part of search.split('&')) {
    if (!part)
      continue

    const [keyPart, valuePart = ''] = part.split('=')
    const key = safeDecodeURIComponent(keyPart)
    if (!key)
      continue

    query[key] = safeDecodeURIComponent(valuePart)
  }

  return query
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value)
  }
  catch {
    return value
  }
}

function buildQueryTemplate(input: unknown) {
  const source = normalizeStringMap(input)
  const entries = Object.keys(source)

  if (entries.length === 0)
    return undefined

  const template: Record<string, string> = {}

  for (const key of entries)
    template[key] = `{{payload.${key}}}`

  return template
}

function buildHeaderTemplate(input: unknown) {
  const source = normalizeStringMap(input)
  const template: Record<string, string> = {}

  for (const [key, value] of Object.entries(source)) {
    const normalizedKey = key.trim()
    if (!normalizedKey)
      continue

    const lowerKey = normalizedKey.toLowerCase()
    if (SENSITIVE_HEADER_NAMES.has(lowerKey)) {
      template[normalizedKey] = `{{header.${normalizedKey}}}`
      continue
    }

    if (!value)
      continue

    template[normalizedKey] = value
  }

  return hasValues(template) ? template : undefined
}

function buildBodyTemplate(input: unknown, path: string[] = []): unknown {
  if (Array.isArray(input))
    return input.map(item => buildBodyTemplate(item, path))

  if (isRecord(input)) {
    const output: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(input))
      output[key] = buildBodyTemplate(value, [...path, key])

    return output
  }

  if (input === undefined)
    return undefined

  if (input === null)
    return null

  if (path.length === 0)
    return cloneUnknown(input)

  return `{{payload.${path.join('.')}}}`
}

function resolveSessionName(name: string | undefined) {
  const normalized = normalizeOptionalText(name)
  if (normalized)
    return normalized

  return `录制会话 ${new Date().toLocaleString('zh-CN', { hour12: false })}`
}

function normalizeRequestMethod(input: unknown): DictKeeperRequestMethod | undefined {
  if (typeof input !== 'string')
    return undefined

  const normalized = input.trim().toUpperCase() as DictKeeperRequestMethod
  if (!REQUEST_METHOD_SET.has(normalized))
    return undefined

  return normalized
}

function inferRequestMethodFromAction(action: DictKeeperCrudAction): DictKeeperRequestMethod {
  if (action === 'create')
    return 'POST'

  if (action === 'read')
    return 'GET'

  if (action === 'update')
    return 'PUT'

  return 'DELETE'
}

function normalizeMergeStrategy(input: unknown): DictKeeperEndpointMergeStrategy | undefined {
  if (typeof input !== 'string')
    return undefined

  const normalized = input.trim() as DictKeeperEndpointMergeStrategy
  if (!MERGE_STRATEGY_SET.has(normalized))
    return undefined

  return normalized
}

function normalizeCrudSection(input: unknown): DictKeeperCrudSection | undefined {
  if (typeof input !== 'string')
    return undefined

  const normalized = input.trim() as DictKeeperCrudSection
  if (!SECTION_SET.has(normalized))
    return undefined

  return normalized
}

function normalizeCrudAction(input: unknown): DictKeeperCrudAction | undefined {
  if (typeof input !== 'string')
    return undefined

  const normalized = input.trim() as DictKeeperCrudAction
  if (!ACTION_SET.has(normalized))
    return undefined

  return normalized
}

function normalizeMappingDraft(input: unknown): DictKeeperExternalCrudRecordMappingDraft | undefined {
  if (!isRecord(input))
    return undefined

  const section = normalizeCrudSection(input.section)
  const action = normalizeCrudAction(input.action)
  const path = normalizeOptionalText(input.path)
  const method = normalizeRequestMethod(input.method)

  if (!section || !action || !path || !method)
    return undefined

  const queryTemplate = normalizeStringMap(input.queryTemplate)
  const headerTemplate = normalizeStringMap(input.headerTemplate)

  return {
    section,
    action,
    path,
    method,
    pathTemplate: normalizeOptionalText(input.pathTemplate),
    queryTemplate: hasValues(queryTemplate) ? queryTemplate : undefined,
    headerTemplate: hasValues(headerTemplate) ? headerTemplate : undefined,
    bodyTemplate: cloneUnknown(input.bodyTemplate),
    contentType: normalizeOptionalText(input.contentType),
    timeoutMs: normalizeOptionalNumber(input.timeoutMs),
    mergeStrategy: normalizeMergeStrategy(input.mergeStrategy),
  }
}

function resolveContentType(contentType: unknown, requestHeaders: Record<string, string>) {
  const normalized = normalizeOptionalText(contentType)
  if (normalized)
    return normalized

  for (const [key, value] of Object.entries(requestHeaders)) {
    if (key.toLowerCase() === 'content-type')
      return value
  }

  return undefined
}

function normalizeLimitedText(input: unknown, maxLength: number) {
  const value = normalizeOptionalText(input)
  if (!value)
    return { value: undefined, truncated: false }

  if (value.length <= maxLength)
    return { value, truncated: false }

  return {
    value: value.slice(0, maxLength),
    truncated: true,
  }
}

function normalizeStringMap(input: unknown) {
  if (!isRecord(input))
    return {}

  const output: Record<string, string> = {}

  for (const [key, value] of Object.entries(input)) {
    const normalizedKey = key.trim()
    if (!normalizedKey)
      continue

    if (typeof value === 'string') {
      output[normalizedKey] = value
      continue
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      output[normalizedKey] = String(value)
      continue
    }
  }

  return output
}

function normalizeOptionalBoolean(input: unknown) {
  if (typeof input === 'boolean')
    return input

  return undefined
}

function normalizeOptionalNumber(input: unknown) {
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
  if (typeof input !== 'string')
    return undefined

  const normalized = input.trim()
  return normalized || undefined
}

function normalizeRequiredText(input: unknown, errorMessage: string) {
  const normalized = normalizeOptionalText(input)
  if (normalized)
    return normalized

  throw createDictKeeperExternalCrudRecordServiceError(
    errorMessage,
    'DICT_KEEPER_EXTERNAL_CRUD_RECORD_REQUIRED_TEXT_MISSING',
    { input },
  )
}

function normalizeStringArray(input: unknown) {
  if (!Array.isArray(input))
    return []

  const normalized = input
    .map(item => normalizeOptionalText(item))
    .filter((item): item is string => Boolean(item))

  return [...new Set(normalized)]
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

function isRecord(input: unknown): input is Record<string, any> {
  return Boolean(input)
    && typeof input === 'object'
    && !Array.isArray(input)
}

function hasValues(input: Record<string, string>) {
  return Object.keys(input).length > 0
}

function createDictKeeperExternalCrudRecordServiceError(message: string, code: string, details?: unknown) {
  return Object.assign(new Error(message), {
    code,
    details,
  })
}
