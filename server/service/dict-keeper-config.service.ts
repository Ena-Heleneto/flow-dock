import type { RouterRequestTransaction } from 'playground/runtime/types'
import type {
  DictKeeperConfigDocument,
  DictKeeperCrudEndpointConfig,
} from '@/schema/dict-keeper/config.schema'
import dictKeeperConfigSchema from '@/schema/dict-keeper/config.schema'

export const DICT_KEEPER_GLOBAL_CONFIG_ID = 'dict-keeper-global-config'
const DEFAULT_GLOBAL_CONFIG_NAME = '默认配置'

interface DictKeeperOperator {
  module: string
  page: string
  traceId: string
}

export interface DictKeeperConfigServiceOptions {
  transaction?: RouterRequestTransaction
}

export interface DictKeeperConfigReadInput {
  id?: string
  includeDeleted?: boolean
}

export interface DictKeeperConfigListInput {
  includeDeleted?: boolean
}

export interface DictKeeperConfigPatch {
  name?: string
  basePath?: string
  dictionary?: Partial<DictKeeperCrudEndpointConfig>
  item?: Partial<DictKeeperCrudEndpointConfig>
}

export interface DictKeeperConfigCreateInput extends DictKeeperConfigPatch {
  id?: string
  createdBy: DictKeeperOperator
}

export interface DictKeeperConfigUpdateInput extends DictKeeperConfigPatch {
  id?: string
  updatedBy: DictKeeperOperator
}

export interface DictKeeperConfigDeleteInput {
  id?: string
  deletedBy: DictKeeperOperator
}

const EMPTY_ENDPOINTS: DictKeeperCrudEndpointConfig = {
  create: '',
  read: '',
  update: '',
  delete: '',
}

export async function createDictKeeperConfig(
  input: DictKeeperConfigCreateInput,
  options: DictKeeperConfigServiceOptions = {},
): Promise<DictKeeperConfigDocument> {
  const id = resolveConfigId(input.id)
  const existing = await getRawConfigById(id, options)
  const normalized = normalizeConfigPatch(input, existing ?? undefined, id)
  const duplicatedByName = await findActiveConfigByName(normalized.name, options)

  if (duplicatedByName && duplicatedByName._id !== id) {
    const overwritten = await dictKeeperConfigSchema.updateById(duplicatedByName._id, {
      ...normalizeConfigPatch(input, duplicatedByName, duplicatedByName._id),
      isDeleted: false,
      deletedAt: undefined,
      updatedBy: input.createdBy,
    }, { transaction: options.transaction })

    if (!overwritten) {
      throw Object.assign(new Error('Failed to overwrite duplicated Dict-Keeper config by name'), {
        code: 'DICT_KEEPER_CONFIG_OVERWRITE_FAILED',
        details: {
          name: normalized.name,
          id: duplicatedByName._id,
        },
      })
    }

    return overwritten
  }

  if (existing && !isPseudoDeleted(existing)) {
    throw Object.assign(new Error('Dict-Keeper config already exists'), {
      code: 'DICT_KEEPER_CONFIG_EXISTS',
      details: { id },
    })
  }

  if (existing && isPseudoDeleted(existing)) {
    const restored = await dictKeeperConfigSchema.updateById(id, {
      ...normalized,
      isDeleted: false,
      deletedAt: undefined,
      updatedBy: input.createdBy,
    }, { transaction: options.transaction })

    if (!restored) {
      throw Object.assign(new Error('Failed to restore deleted Dict-Keeper config'), {
        code: 'DICT_KEEPER_CONFIG_RESTORE_FAILED',
        details: { id },
      })
    }

    return restored
  }

  return dictKeeperConfigSchema.create({
    _id: id,
    ...normalized,
    isDeleted: false,
    deletedAt: undefined,
    createdBy: input.createdBy,
    updatedBy: input.createdBy,
  }, { transaction: options.transaction })
}

export async function readDictKeeperConfig(
  input: DictKeeperConfigReadInput = {},
  options: DictKeeperConfigServiceOptions = {},
): Promise<DictKeeperConfigDocument | null> {
  const includeDeleted = input.includeDeleted === true
  const requestedId = normalizeText(input.id)

  if (requestedId)
    return getVisibleConfigById(requestedId, includeDeleted, options)

  const globalRecord = await getVisibleConfigById(DICT_KEEPER_GLOBAL_CONFIG_ID, includeDeleted, options)
  if (globalRecord)
    return globalRecord

  const [firstRecord] = await listDictKeeperConfigs({ includeDeleted }, options)
  return firstRecord ?? null
}

export async function listDictKeeperConfigs(
  input: DictKeeperConfigListInput = {},
  options: DictKeeperConfigServiceOptions = {},
): Promise<DictKeeperConfigDocument[]> {
  const includeDeleted = input.includeDeleted === true
  const documents = await dictKeeperConfigSchema.find(undefined, { transaction: options.transaction })

  return documents
    .filter((document) => {
      if (includeDeleted)
        return true

      return !isPseudoDeleted(document)
    })
    .sort(compareByRecent)
}

export async function updateDictKeeperConfig(
  input: DictKeeperConfigUpdateInput,
  options: DictKeeperConfigServiceOptions = {},
): Promise<DictKeeperConfigDocument | null> {
  const id = normalizeText(input.id)
  if (!id) {
    throw Object.assign(new Error('Config id is required for update'), {
      code: 'DICT_KEEPER_CONFIG_ID_REQUIRED',
    })
  }

  const existing = await getRawConfigById(id, options)

  if (!existing || isPseudoDeleted(existing))
    return null

  const normalized = normalizeConfigPatch(input, existing, id)

  return dictKeeperConfigSchema.updateById(id, {
    ...normalized,
    updatedBy: input.updatedBy,
  }, { transaction: options.transaction })
}

export async function deleteDictKeeperConfig(
  input: DictKeeperConfigDeleteInput,
  options: DictKeeperConfigServiceOptions = {},
): Promise<DictKeeperConfigDocument | null> {
  const id = resolveConfigId(input.id)
  const existing = await getRawConfigById(id, options)

  if (!existing || isPseudoDeleted(existing))
    return null

  return dictKeeperConfigSchema.updateById(id, {
    isDeleted: true,
    deletedAt: Date.now(),
    updatedBy: input.deletedBy,
  }, { transaction: options.transaction })
}

async function getRawConfigById(
  id: string,
  options: DictKeeperConfigServiceOptions,
): Promise<DictKeeperConfigDocument | null> {
  return dictKeeperConfigSchema.findOne({ _id: id }, { transaction: options.transaction })
}

async function findActiveConfigByName(
  name: string,
  options: DictKeeperConfigServiceOptions,
): Promise<DictKeeperConfigDocument | null> {
  const normalizedName = normalizeText(name)
  if (!normalizedName)
    return null

  const documents = await dictKeeperConfigSchema.find({ name: normalizedName }, { transaction: options.transaction })

  return documents
    .filter(document => !isPseudoDeleted(document))
    .sort(compareByRecent)[0] ?? null
}

function resolveConfigId(id: string | undefined) {
  const normalized = normalizeText(id)
  if (!normalized)
    return DICT_KEEPER_GLOBAL_CONFIG_ID

  return normalized
}

function normalizeConfigPatch(
  patch: DictKeeperConfigPatch,
  fallback: Pick<DictKeeperConfigDocument, 'name' | 'basePath' | 'dictionary' | 'item'> | undefined,
  id: string,
) {
  const nextName = patch.name !== undefined
    ? normalizeConfigName(patch.name, id)
    : normalizeConfigName(fallback?.name, id)

  const nextBasePath = patch.basePath !== undefined
    ? normalizeText(patch.basePath)
    : normalizeText(fallback?.basePath)

  const nextDictionary = normalizeEndpoints(
    patch.dictionary,
    fallback?.dictionary,
  )

  const nextItem = normalizeEndpoints(
    patch.item,
    fallback?.item,
  )

  return {
    name: nextName,
    basePath: nextBasePath,
    dictionary: nextDictionary,
    item: nextItem,
  }
}

async function getVisibleConfigById(
  id: string,
  includeDeleted: boolean,
  options: DictKeeperConfigServiceOptions,
) {
  const existing = await getRawConfigById(id, options)
  if (!existing)
    return null

  if (!includeDeleted && isPseudoDeleted(existing))
    return null

  return existing
}

function normalizeEndpoints(
  patch: Partial<DictKeeperCrudEndpointConfig> | undefined,
  fallback: DictKeeperCrudEndpointConfig | undefined,
): DictKeeperCrudEndpointConfig {
  const baseline = fallback ?? EMPTY_ENDPOINTS

  return {
    create: patch?.create !== undefined ? normalizeText(patch.create) : normalizeText(baseline.create),
    read: patch?.read !== undefined ? normalizeText(patch.read) : normalizeText(baseline.read),
    update: patch?.update !== undefined ? normalizeText(patch.update) : normalizeText(baseline.update),
    delete: patch?.delete !== undefined ? normalizeText(patch.delete) : normalizeText(baseline.delete),
  }
}

function normalizeText(input: unknown) {
  if (typeof input !== 'string')
    return ''

  return input.trim()
}

function normalizeConfigName(input: unknown, id: string) {
  const normalized = normalizeText(input)
  if (normalized)
    return normalized

  if (id === DICT_KEEPER_GLOBAL_CONFIG_ID)
    return DEFAULT_GLOBAL_CONFIG_NAME

  return `配置-${id.slice(0, 8)}`
}

function compareByRecent(left: DictKeeperConfigDocument, right: DictKeeperConfigDocument) {
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

function isPseudoDeleted(document: DictKeeperConfigDocument) {
  return document.isDeleted === true
}

export default {
  createDictKeeperConfig,
  listDictKeeperConfigs,
  readDictKeeperConfig,
  updateDictKeeperConfig,
  deleteDictKeeperConfig,
}
