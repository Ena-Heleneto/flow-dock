import type { RouterRequestTransaction } from '@/runtime/types'
import type { DictKeeperCrudEndpointConfig, DictKeeperCrudEndpointNode, DictKeeperExternalCrudDocument, DictKeeperRequestMethod } from '@/schema/dict-keeper/external-crud.schema'
import dictKeeperExternalCrudSchema, {
  DICT_KEEPER_REQUEST_METHODS,

} from '@/schema/dict-keeper/external-crud.schema'

export const DICT_KEEPER_GLOBAL_EXTERNAL_CRUD_ID = 'dict-keeper-global-external-crud'
const DEFAULT_GLOBAL_EXTERNAL_CRUD_NAME = '默认外部 CRUD'
const CRUD_ACTIONS = ['create', 'read', 'update', 'delete'] as const

type DictKeeperCrudAction = (typeof CRUD_ACTIONS)[number]
type DictKeeperEndpointSection = 'dictionary' | 'item'

const REQUEST_METHOD_SET = new Set<DictKeeperRequestMethod>(DICT_KEEPER_REQUEST_METHODS)

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
    isDeleted: true,
    deletedAt: Date.now(),
    updatedBy: input.deletedBy,
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

  return {
    path,
    method,
  }
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

function normalizeRequestMethod(input: unknown): DictKeeperRequestMethod | null {
  if (typeof input !== 'string')
    return null

  const normalized = input.trim().toUpperCase()
  if (!REQUEST_METHOD_SET.has(normalized as DictKeeperRequestMethod))
    return null

  return normalized as DictKeeperRequestMethod
}

async function ensureNoLegacyExternalCrudRecords(options: DictKeeperExternalCrudServiceOptions = {}) {
  const transaction = options.transaction

  if (transaction && transaction.mode !== 'readwrite')
    return

  await purgeLegacyExternalCrudRecords(options)
}

async function purgeLegacyExternalCrudRecords(options: DictKeeperExternalCrudServiceOptions) {
  const schemaOptions = options.transaction
    ? { transaction: options.transaction }
    : undefined

  const documents = await dictKeeperExternalCrudSchema.find(undefined, schemaOptions)

  for (const document of documents) {
    if (!isLegacyExternalCrudDocument(document))
      continue

    await dictKeeperExternalCrudSchema.deleteById(document._id, schemaOptions)
  }
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
    if (typeof normalizedNode.path !== 'string' || typeof normalizedNode.method !== 'string')
      return true
  }

  return false
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
  updateDictKeeperExternalCrud,
  deleteDictKeeperExternalCrud,
}
