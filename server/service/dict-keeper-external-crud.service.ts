import type { RouterRequestTransaction } from '@/runtime/types'
import type {
  DictKeeperCrudEndpointConfig,
  DictKeeperCrudEndpointNode,
  DictKeeperEndpointMergeStrategy,
  DictKeeperExternalCrudDocument,
  DictKeeperRequestMethod,
} from '@/schema/dict-keeper/external-crud.schema'
import dictKeeperExternalCrudSchema, {
  DICT_KEEPER_ENDPOINT_MERGE_STRATEGIES,
  DICT_KEEPER_REQUEST_METHODS,
} from '@/schema/dict-keeper/external-crud.schema'

export const DICT_KEEPER_GLOBAL_EXTERNAL_CRUD_ID = 'dict-keeper-global-external-crud'
const DEFAULT_GLOBAL_EXTERNAL_CRUD_NAME = '默认外部 CRUD'
const CRUD_ACTIONS = ['create', 'read', 'update', 'delete'] as const

type DictKeeperCrudAction = (typeof CRUD_ACTIONS)[number]
type DictKeeperEndpointSection = 'dictionary' | 'item'

const REQUEST_METHOD_SET = new Set<DictKeeperRequestMethod>(DICT_KEEPER_REQUEST_METHODS)
const ENDPOINT_MERGE_STRATEGY_SET = new Set<DictKeeperEndpointMergeStrategy>(DICT_KEEPER_ENDPOINT_MERGE_STRATEGIES)
const DEFAULT_LEGACY_ENDPOINT_METHOD: DictKeeperRequestMethod = 'GET'

interface DictKeeperOperator {
  module: string
  page: string
  traceId: string
}

export interface DictKeeperExternalCrudServiceOptions {
  transaction?: RouterRequestTransaction
}

export interface DictKeeperExternalCrudReadInput {
  id?: string
  includeDeleted?: boolean
}

export interface DictKeeperExternalCrudListInput {
  includeDeleted?: boolean
}

export interface DictKeeperCrudEndpointNodePatch extends Partial<DictKeeperCrudEndpointNode> {}

export type DictKeeperCrudEndpointPatch = Partial<Record<DictKeeperCrudAction, DictKeeperCrudEndpointNodePatch | string>>

export interface DictKeeperExternalCrudPatch {
  name?: string
  basePath?: string
  dictionary?: DictKeeperCrudEndpointPatch
  item?: DictKeeperCrudEndpointPatch
}

export interface DictKeeperExternalCrudCreateInput extends DictKeeperExternalCrudPatch {
  id?: string
  createdBy: DictKeeperOperator
}

export interface DictKeeperExternalCrudUpdateInput extends DictKeeperExternalCrudPatch {
  id?: string
  updatedBy: DictKeeperOperator
}

export interface DictKeeperExternalCrudDeleteInput {
  id?: string
  deletedBy: DictKeeperOperator
}

export interface DictKeeperExternalCrudSetDefaultInput {
  id?: string
  updatedBy: DictKeeperOperator
}

export async function createDictKeeperExternalCrud(
  input: DictKeeperExternalCrudCreateInput,
  options: DictKeeperExternalCrudServiceOptions = {},
): Promise<DictKeeperExternalCrudDocument> {
  await ensureNoLegacyExternalCrudRecords(options)

  const id = resolveExternalCrudId(input.id)
  const existing = await getRawExternalCrudById(id, options)
  const normalized = normalizeExternalCrudPatch(input, existing ?? undefined, id)
  const duplicatedByName = await findActiveExternalCrudByName(normalized.name, options)

  if (duplicatedByName && duplicatedByName._id !== id) {
    const overwritten = await dictKeeperExternalCrudSchema.updateById(duplicatedByName._id, {
      ...normalizeExternalCrudPatch(input, duplicatedByName, duplicatedByName._id),
      isDeleted: false,
      deletedAt: undefined,
      updatedBy: input.createdBy,
    }, { transaction: options.transaction })

    if (!overwritten) {
      throw Object.assign(new Error('Failed to overwrite duplicated Dict-Keeper external CRUD by name'), {
        code: 'DICT_KEEPER_EXTERNAL_CRUD_OVERWRITE_FAILED',
        details: {
          name: normalized.name,
          id: duplicatedByName._id,
        },
      })
    }

    return overwritten
  }

  if (existing && !isPseudoDeleted(existing)) {
    throw Object.assign(new Error('Dict-Keeper external CRUD already exists'), {
      code: 'DICT_KEEPER_EXTERNAL_CRUD_EXISTS',
      details: { id },
    })
  }

  if (existing && isPseudoDeleted(existing)) {
    const restored = await dictKeeperExternalCrudSchema.updateById(id, {
      ...normalized,
      isDeleted: false,
      deletedAt: undefined,
      updatedBy: input.createdBy,
    }, { transaction: options.transaction })

    if (!restored) {
      throw Object.assign(new Error('Failed to restore deleted Dict-Keeper external CRUD'), {
        code: 'DICT_KEEPER_EXTERNAL_CRUD_RESTORE_FAILED',
        details: { id },
      })
    }

    return restored
  }

  return dictKeeperExternalCrudSchema.create({
    _id: id,
    ...normalized,
    isDefault: false,
    isDeleted: false,
    deletedAt: undefined,
    createdBy: input.createdBy,
    updatedBy: input.createdBy,
  }, { transaction: options.transaction })
}

export async function readDictKeeperExternalCrud(
  input: DictKeeperExternalCrudReadInput = {},
  options: DictKeeperExternalCrudServiceOptions = {},
): Promise<DictKeeperExternalCrudDocument | null> {
  await ensureNoLegacyExternalCrudRecords(options)

  const includeDeleted = input.includeDeleted === true
  const requestedId = normalizeText(input.id)

  if (requestedId)
    return getVisibleExternalCrudById(requestedId, includeDeleted, options)

  const defaultRecord = await getDefaultExternalCrud(includeDeleted, options)
  if (defaultRecord)
    return defaultRecord

  const globalRecord = await getVisibleExternalCrudById(DICT_KEEPER_GLOBAL_EXTERNAL_CRUD_ID, includeDeleted, options)
  if (globalRecord)
    return globalRecord

  const [firstRecord] = await listDictKeeperExternalCruds({ includeDeleted }, options)
  return firstRecord ?? null
}

export async function listDictKeeperExternalCruds(
  input: DictKeeperExternalCrudListInput = {},
  options: DictKeeperExternalCrudServiceOptions = {},
): Promise<DictKeeperExternalCrudDocument[]> {
  await ensureNoLegacyExternalCrudRecords(options)

  const includeDeleted = input.includeDeleted === true
  const documents = await dictKeeperExternalCrudSchema.find(undefined, { transaction: options.transaction })

  return documents
    .filter((document) => {
      if (isLegacyExternalCrudDocument(document))
        return false

      if (includeDeleted)
        return true

      return !isPseudoDeleted(document)
    })
    .sort(compareByRecent)
}

export async function updateDictKeeperExternalCrud(
  input: DictKeeperExternalCrudUpdateInput,
  options: DictKeeperExternalCrudServiceOptions = {},
): Promise<DictKeeperExternalCrudDocument | null> {
  await ensureNoLegacyExternalCrudRecords(options)

  const id = normalizeText(input.id)
  if (!id) {
    throw Object.assign(new Error('External CRUD id is required for update'), {
      code: 'DICT_KEEPER_EXTERNAL_CRUD_ID_REQUIRED',
    })
  }

  const existing = await getRawExternalCrudById(id, options)

  if (!existing || isPseudoDeleted(existing))
    return null

  const normalized = normalizeExternalCrudPatch(input, existing, id)

  return dictKeeperExternalCrudSchema.updateById(id, {
    ...normalized,
    updatedBy: input.updatedBy,
  }, { transaction: options.transaction })
}

export async function deleteDictKeeperExternalCrud(
  input: DictKeeperExternalCrudDeleteInput,
  options: DictKeeperExternalCrudServiceOptions = {},
): Promise<DictKeeperExternalCrudDocument | null> {
  await ensureNoLegacyExternalCrudRecords(options)

  const id = resolveExternalCrudId(input.id)
  const existing = await getRawExternalCrudById(id, options)

  if (!existing || isPseudoDeleted(existing))
    return null

  return dictKeeperExternalCrudSchema.updateById(id, {
    isDefault: false,
    isDeleted: true,
    deletedAt: Date.now(),
    updatedBy: input.deletedBy,
  }, { transaction: options.transaction })
}

export async function setDefaultDictKeeperExternalCrud(
  input: DictKeeperExternalCrudSetDefaultInput,
  options: DictKeeperExternalCrudServiceOptions = {},
): Promise<DictKeeperExternalCrudDocument | null> {
  await ensureNoLegacyExternalCrudRecords(options)

  const id = normalizeText(input.id)
  if (!id) {
    throw Object.assign(new Error('External CRUD id is required for setting default'), {
      code: 'DICT_KEEPER_EXTERNAL_CRUD_ID_REQUIRED',
    })
  }

  const target = await getRawExternalCrudById(id, options)
  if (!target || isPseudoDeleted(target) || isLegacyExternalCrudDocument(target))
    return null

  const documents = await dictKeeperExternalCrudSchema.find(undefined, { transaction: options.transaction })

  let defaultRecord: DictKeeperExternalCrudDocument | null = null

  for (const document of documents) {
    if (isLegacyExternalCrudDocument(document) || isPseudoDeleted(document))
      continue

    const shouldBeDefault = document._id === id
    const alreadyDefault = document.isDefault === true
    if (alreadyDefault === shouldBeDefault) {
      if (shouldBeDefault)
        defaultRecord = document

      continue
    }

    const updated = await dictKeeperExternalCrudSchema.updateById(document._id, {
      isDefault: shouldBeDefault,
      updatedBy: input.updatedBy,
    }, { transaction: options.transaction })

    if (shouldBeDefault)
      defaultRecord = updated
  }

  if (defaultRecord)
    return defaultRecord

  return dictKeeperExternalCrudSchema.updateById(id, {
    isDefault: true,
    updatedBy: input.updatedBy,
  }, { transaction: options.transaction })
}

async function getRawExternalCrudById(
  id: string,
  options: DictKeeperExternalCrudServiceOptions,
): Promise<DictKeeperExternalCrudDocument | null> {
  return dictKeeperExternalCrudSchema.findOne({ _id: id }, { transaction: options.transaction })
}

async function findActiveExternalCrudByName(
  name: string,
  options: DictKeeperExternalCrudServiceOptions,
): Promise<DictKeeperExternalCrudDocument | null> {
  const normalizedName = normalizeText(name)
  if (!normalizedName)
    return null

  const documents = await dictKeeperExternalCrudSchema.find({ name: normalizedName }, { transaction: options.transaction })

  return documents
    .filter(document => !isPseudoDeleted(document))
    .sort(compareByRecent)[0] ?? null
}

function resolveExternalCrudId(id: string | undefined) {
  const normalized = normalizeText(id)
  if (!normalized)
    return DICT_KEEPER_GLOBAL_EXTERNAL_CRUD_ID

  return normalized
}

function normalizeExternalCrudPatch(
  patch: DictKeeperExternalCrudPatch,
  fallback: Pick<DictKeeperExternalCrudDocument, 'name' | 'basePath' | 'dictionary' | 'item'> | undefined,
  id: string,
) {
  const nextName = patch.name !== undefined
    ? normalizeExternalCrudName(patch.name, id)
    : normalizeExternalCrudName(fallback?.name, id)

  const nextBasePath = patch.basePath !== undefined
    ? normalizeText(patch.basePath)
    : normalizeText(fallback?.basePath)

  const nextDictionary = normalizeEndpoints(
    patch.dictionary,
    fallback?.dictionary,
    'dictionary',
  )

  const nextItem = normalizeEndpoints(
    patch.item,
    fallback?.item,
    'item',
  )

  return {
    name: nextName,
    basePath: nextBasePath,
    dictionary: nextDictionary,
    item: nextItem,
  }
}

async function getVisibleExternalCrudById(
  id: string,
  includeDeleted: boolean,
  options: DictKeeperExternalCrudServiceOptions,
) {
  const existing = await getRawExternalCrudById(id, options)
  if (!existing)
    return null

  if (isLegacyExternalCrudDocument(existing))
    return null

  if (!includeDeleted && isPseudoDeleted(existing))
    return null

  return existing
}

async function getDefaultExternalCrud(
  includeDeleted: boolean,
  options: DictKeeperExternalCrudServiceOptions,
) {
  const documents = await dictKeeperExternalCrudSchema.find({ isDefault: true }, { transaction: options.transaction })

  return documents
    .filter((document) => {
      if (isLegacyExternalCrudDocument(document))
        return false

      if (!includeDeleted && isPseudoDeleted(document))
        return false

      return true
    })
    .sort(compareByRecent)[0] ?? null
}

function normalizeEndpoints(
  patch: DictKeeperCrudEndpointPatch | undefined,
  fallback: DictKeeperCrudEndpointConfig | undefined,
  section: DictKeeperEndpointSection,
): DictKeeperCrudEndpointConfig {
  return {
    create: normalizeEndpointNode('create', section, patch?.create, fallback?.create),
    read: normalizeEndpointNode('read', section, patch?.read, fallback?.read),
    update: normalizeEndpointNode('update', section, patch?.update, fallback?.update),
    delete: normalizeEndpointNode('delete', section, patch?.delete, fallback?.delete),
  }
}

function normalizeEndpointNode(
  action: DictKeeperCrudAction,
  section: DictKeeperEndpointSection,
  patch: DictKeeperCrudEndpointNodePatch | string | undefined,
  fallback: DictKeeperCrudEndpointNode | undefined,
): DictKeeperCrudEndpointNode {
  const patchNode = normalizeEndpointNodeInput(patch)

  const path = patchNode?.path !== undefined
    ? normalizeText(patchNode.path)
    : normalizeText(fallback?.path)

  const method = patchNode?.method !== undefined
    ? normalizeRequestMethod(patchNode.method)
    : normalizeRequestMethod(fallback?.method)

  const pathTemplate = patchNode?.pathTemplate !== undefined
    ? normalizeOptionalText(patchNode.pathTemplate)
    : normalizeOptionalText(fallback?.pathTemplate)

  const queryTemplate = patchNode?.queryTemplate !== undefined
    ? normalizeEndpointTemplateRecord(patchNode.queryTemplate, `${section}.${action}.queryTemplate`)
    : normalizeEndpointTemplateRecord(fallback?.queryTemplate, `${section}.${action}.queryTemplate`)

  const headerTemplate = patchNode?.headerTemplate !== undefined
    ? normalizeEndpointTemplateRecord(patchNode.headerTemplate, `${section}.${action}.headerTemplate`)
    : normalizeEndpointTemplateRecord(fallback?.headerTemplate, `${section}.${action}.headerTemplate`)

  const bodyTemplate = patchNode?.bodyTemplate !== undefined
    ? normalizeEndpointBodyTemplate(patchNode.bodyTemplate, `${section}.${action}.bodyTemplate`)
    : normalizeEndpointBodyTemplate(fallback?.bodyTemplate, `${section}.${action}.bodyTemplate`)

  const contentType = patchNode?.contentType !== undefined
    ? normalizeOptionalText(patchNode.contentType)
    : normalizeOptionalText(fallback?.contentType)

  const timeoutMs = patchNode?.timeoutMs !== undefined
    ? normalizeEndpointTimeout(patchNode.timeoutMs, `${section}.${action}.timeoutMs`)
    : normalizeEndpointTimeout(fallback?.timeoutMs, `${section}.${action}.timeoutMs`)

  const mergeStrategy = patchNode?.mergeStrategy !== undefined
    ? normalizeEndpointMergeStrategy(patchNode.mergeStrategy, `${section}.${action}.mergeStrategy`)
    : normalizeEndpointMergeStrategy(fallback?.mergeStrategy, `${section}.${action}.mergeStrategy`)

  if (!path) {
    throw Object.assign(new Error(`\`${section}.${action}.path\` is required`), {
      code: 'DICT_KEEPER_EXTERNAL_CRUD_ENDPOINT_PATH_REQUIRED',
      details: {
        section,
        action,
      },
    })
  }

  if (!method) {
    throw Object.assign(new Error(`\`${section}.${action}.method\` is invalid`), {
      code: 'DICT_KEEPER_EXTERNAL_CRUD_ENDPOINT_METHOD_INVALID',
      details: {
        section,
        action,
        allowedMethods: [...DICT_KEEPER_REQUEST_METHODS],
      },
    })
  }

  const endpointNode: DictKeeperCrudEndpointNode = {
    path,
    method,
  }

  if (pathTemplate)
    endpointNode.pathTemplate = pathTemplate

  if (queryTemplate)
    endpointNode.queryTemplate = queryTemplate

  if (headerTemplate)
    endpointNode.headerTemplate = headerTemplate

  if (bodyTemplate !== undefined)
    endpointNode.bodyTemplate = bodyTemplate

  if (contentType)
    endpointNode.contentType = contentType

  if (timeoutMs !== undefined)
    endpointNode.timeoutMs = timeoutMs

  if (mergeStrategy)
    endpointNode.mergeStrategy = mergeStrategy

  return endpointNode
}

function normalizeEndpointNodeInput(
  input: DictKeeperCrudEndpointNodePatch | string | undefined,
): DictKeeperCrudEndpointNodePatch | undefined {
  if (input === undefined || input === null)
    return undefined

  if (typeof input === 'string')
    return { path: input }

  if (typeof input !== 'object' || Array.isArray(input))
    return {}

  return input
}

function normalizeEndpointTemplateRecord(input: unknown, fieldPath: string) {
  if (input === undefined || input === null)
    return undefined

  if (typeof input !== 'object' || Array.isArray(input)) {
    throw Object.assign(new Error(`\`${fieldPath}\` 必须是对象。`), {
      code: 'DICT_KEEPER_EXTERNAL_CRUD_TEMPLATE_RECORD_INVALID',
      details: { fieldPath },
    })
  }

  const source = input as Record<string, unknown>
  const normalized: Record<string, string> = {}

  for (const [rawKey, rawValue] of Object.entries(source)) {
    const key = normalizeText(rawKey)
    if (!key)
      continue

    if (typeof rawValue !== 'string') {
      throw Object.assign(new Error(`\`${fieldPath}.${key}\` 必须是字符串模板。`), {
        code: 'DICT_KEEPER_EXTERNAL_CRUD_TEMPLATE_VALUE_INVALID',
        details: {
          fieldPath,
          key,
          valueType: typeof rawValue,
        },
      })
    }

    const value = rawValue.trim()
    if (!value)
      continue

    normalized[key] = value
  }

  if (Object.keys(normalized).length === 0)
    return undefined

  return normalized
}

function normalizeEndpointBodyTemplate(input: unknown, fieldPath: string): unknown {
  if (input === undefined)
    return undefined

  return cloneBodyTemplateValue(input, fieldPath)
}

function cloneBodyTemplateValue(input: unknown, fieldPath: string): unknown {
  if (input === null)
    return null

  if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean')
    return input

  if (Array.isArray(input))
    return input.map((item, index) => cloneBodyTemplateValue(item, `${fieldPath}[${index}]`))

  if (typeof input === 'object') {
    const source = input as Record<string, unknown>
    const normalized: Record<string, unknown> = {}

    for (const [rawKey, rawValue] of Object.entries(source)) {
      const key = normalizeText(rawKey)
      if (!key)
        continue

      normalized[key] = cloneBodyTemplateValue(rawValue, `${fieldPath}.${key}`)
    }

    return normalized
  }

  throw Object.assign(new Error(`\`${fieldPath}\` 包含不支持的模板值类型。`), {
    code: 'DICT_KEEPER_EXTERNAL_CRUD_BODY_TEMPLATE_INVALID',
    details: {
      fieldPath,
      valueType: typeof input,
    },
  })
}

function normalizeEndpointTimeout(input: unknown, fieldPath: string) {
  if (input === undefined || input === null)
    return undefined

  if (typeof input !== 'number' || !Number.isFinite(input)) {
    throw Object.assign(new Error(`\`${fieldPath}\` 必须是正整数。`), {
      code: 'DICT_KEEPER_EXTERNAL_CRUD_ENDPOINT_TIMEOUT_INVALID',
      details: {
        fieldPath,
      },
    })
  }

  const normalizedTimeout = Math.trunc(input)
  if (normalizedTimeout <= 0) {
    throw Object.assign(new Error(`\`${fieldPath}\` 必须大于 0。`), {
      code: 'DICT_KEEPER_EXTERNAL_CRUD_ENDPOINT_TIMEOUT_INVALID',
      details: {
        fieldPath,
        timeout: input,
      },
    })
  }

  return normalizedTimeout
}

function normalizeEndpointMergeStrategy(input: unknown, fieldPath: string) {
  if (input === undefined || input === null)
    return undefined

  if (typeof input !== 'string') {
    throw Object.assign(new Error(`\`${fieldPath}\` 仅支持字符串。`), {
      code: 'DICT_KEEPER_EXTERNAL_CRUD_ENDPOINT_MERGE_STRATEGY_INVALID',
      details: {
        fieldPath,
      },
    })
  }

  const normalizedStrategy = normalizeText(input)
  if (!normalizedStrategy)
    return undefined

  if (!ENDPOINT_MERGE_STRATEGY_SET.has(normalizedStrategy as DictKeeperEndpointMergeStrategy)) {
    throw Object.assign(new Error(`\`${fieldPath}\` 不在允许范围内。`), {
      code: 'DICT_KEEPER_EXTERNAL_CRUD_ENDPOINT_MERGE_STRATEGY_INVALID',
      details: {
        fieldPath,
        mergeStrategy: normalizedStrategy,
        allowedStrategies: [...DICT_KEEPER_ENDPOINT_MERGE_STRATEGIES],
      },
    })
  }

  return normalizedStrategy as DictKeeperEndpointMergeStrategy
}

function normalizeRequestMethod(input: unknown): DictKeeperRequestMethod | null {
  if (typeof input !== 'string')
    return null

  const normalized = input.trim().toUpperCase()
  if (!REQUEST_METHOD_SET.has(normalized as DictKeeperRequestMethod))
    return null

  return normalized as DictKeeperRequestMethod
}

async function ensureNoLegacyExternalCrudRecords(options: DictKeeperExternalCrudServiceOptions = {}) {
  const legacyDocuments = await getLegacyExternalCrudDocuments(options)
  if (legacyDocuments.length === 0)
    return

  const transaction = options.transaction

  if (transaction && transaction.mode !== 'readwrite') {
    throw Object.assign(new Error('检测到旧版外部 CRUD 配置，请先完成迁移后再读取。'), {
      code: 'DICT_KEEPER_EXTERNAL_CRUD_LEGACY_MIGRATION_REQUIRED',
      details: {
        ids: legacyDocuments.map(document => document._id),
      },
    })
  }

  await migrateLegacyExternalCrudRecords(legacyDocuments, options)
}

async function getLegacyExternalCrudDocuments(options: DictKeeperExternalCrudServiceOptions) {
  const schemaOptions = options.transaction
    ? { transaction: options.transaction }
    : undefined

  const documents = await dictKeeperExternalCrudSchema.find(undefined, schemaOptions)

  return documents.filter(isLegacyExternalCrudDocument)
}

async function migrateLegacyExternalCrudRecords(
  legacyDocuments: DictKeeperExternalCrudDocument[],
  options: DictKeeperExternalCrudServiceOptions,
) {
  const schemaOptions = options.transaction
    ? { transaction: options.transaction }
    : undefined

  for (const document of legacyDocuments) {
    const normalized = normalizeLegacyExternalCrudDocument(document)

    const updated = await dictKeeperExternalCrudSchema.updateById(document._id, {
      ...normalized,
    }, schemaOptions)

    if (!updated) {
      throw Object.assign(new Error('外部 CRUD 旧版配置迁移失败。'), {
        code: 'DICT_KEEPER_EXTERNAL_CRUD_LEGACY_MIGRATION_FAILED',
        details: {
          id: document._id,
        },
      })
    }
  }
}

function normalizeLegacyExternalCrudDocument(document: DictKeeperExternalCrudDocument) {
  const normalizedId = resolveExternalCrudId(document._id)

  return normalizeExternalCrudPatch(
    {
      name: document.name,
      basePath: document.basePath,
      dictionary: normalizeLegacyEndpointPatch(document.dictionary),
      item: normalizeLegacyEndpointPatch(document.item),
    },
    undefined,
    normalizedId,
  )
}

function normalizeLegacyEndpointPatch(config: unknown): DictKeeperCrudEndpointPatch {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw Object.assign(new Error('旧版 endpoint 配置格式无效，无法自动迁移。'), {
      code: 'DICT_KEEPER_EXTERNAL_CRUD_LEGACY_ENDPOINT_INVALID',
    })
  }

  const source = config as Record<string, unknown>

  return {
    create: normalizeLegacyEndpointNodeInput(source.create),
    read: normalizeLegacyEndpointNodeInput(source.read),
    update: normalizeLegacyEndpointNodeInput(source.update),
    delete: normalizeLegacyEndpointNodeInput(source.delete),
  }
}

function normalizeLegacyEndpointNodeInput(input: unknown): DictKeeperCrudEndpointNodePatch {
  if (typeof input === 'string') {
    return {
      path: input,
      method: DEFAULT_LEGACY_ENDPOINT_METHOD,
    }
  }

  if (!input || typeof input !== 'object' || Array.isArray(input))
    return {}

  const source = input as Record<string, unknown>
  const normalizedPath = normalizeText(source.path)
  const normalizedMethod = normalizeRequestMethod(source.method)

  const patch: DictKeeperCrudEndpointNodePatch = {
    ...source,
  }

  if (normalizedPath)
    patch.path = normalizedPath

  patch.method = normalizedMethod ?? DEFAULT_LEGACY_ENDPOINT_METHOD

  return patch
}

function isLegacyExternalCrudDocument(document: DictKeeperExternalCrudDocument) {
  return isLegacyEndpointConfig(document.dictionary)
    || isLegacyEndpointConfig(document.item)
}

function isLegacyEndpointConfig(config: unknown) {
  if (!config || typeof config !== 'object' || Array.isArray(config))
    return true

  const source = config as Record<string, unknown>

  for (const action of CRUD_ACTIONS) {
    const endpointNode = source[action]

    if (typeof endpointNode === 'string')
      return true

    if (!endpointNode || typeof endpointNode !== 'object' || Array.isArray(endpointNode))
      return true

    const normalizedNode = endpointNode as Record<string, unknown>
    const path = normalizeText(normalizedNode.path)
    const method = normalizeRequestMethod(normalizedNode.method)

    if (!path || !method)
      return true
  }

  return false
}

function normalizeOptionalText(input: unknown) {
  const normalized = normalizeText(input)
  if (!normalized)
    return undefined

  return normalized
}

function normalizeText(input: unknown) {
  if (typeof input !== 'string')
    return ''

  return input.trim()
}

function normalizeExternalCrudName(input: unknown, id: string) {
  const normalized = normalizeText(input)
  if (normalized)
    return normalized

  if (id === DICT_KEEPER_GLOBAL_EXTERNAL_CRUD_ID)
    return DEFAULT_GLOBAL_EXTERNAL_CRUD_NAME

  return `外部CRUD-${id.slice(0, 8)}`
}

function compareByRecent(left: DictKeeperExternalCrudDocument, right: DictKeeperExternalCrudDocument) {
  const updatedGap = toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt)
  if (updatedGap !== 0)
    return updatedGap

  const createdGap = toTimestamp(right.createdAt) - toTimestamp(left.createdAt)
  if (createdGap !== 0)
    return createdGap

  return left._id.localeCompare(right._id)
}

function toTimestamp(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value))
    return 0

  return value
}

function isPseudoDeleted(document: DictKeeperExternalCrudDocument) {
  return document.isDeleted === true
}

export default {
  createDictKeeperExternalCrud,
  listDictKeeperExternalCruds,
  readDictKeeperExternalCrud,
  setDefaultDictKeeperExternalCrud,
  updateDictKeeperExternalCrud,
  deleteDictKeeperExternalCrud,
}
