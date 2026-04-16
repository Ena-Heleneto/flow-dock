import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_DYNAMIC_PARAMS_TEXT,
  DEFAULT_FIXED_PARAMS_TEXT,
  DEFAULT_HEADERS_TEXT,
  DEFAULT_INPUT_TEXT,
  DEFAULT_WRAPPER_KEY,
} from '~/import-pipeline/config/local.config'
import type { SavedImportPipelineConfig } from '~/import-pipeline/types'
import { useIdb } from '~/composables/useIdb'

const FLOW_DOCK_DB_NAME = 'flow-dock-dev'
const IMPORT_PIPELINE_CONFIG_STORE = 'import_pipeline_configs'

const idb = useIdb({
  dbName: FLOW_DOCK_DB_NAME,
  version: 1,
  stores: [{
    name: IMPORT_PIPELINE_CONFIG_STORE,
    options: { keyPath: 'id' },
    indexes: [{ name: 'updatedAt', keyPath: 'updatedAt' }],
  }],
})

function normalizeSavedConfig(raw: unknown): SavedImportPipelineConfig | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    return null

  const record = raw as Record<string, unknown>
  if (typeof record.id !== 'string' || record.id.length === 0)
    return null

  if (typeof record.endpoint !== 'string')
    return null
  if (record.method !== 'POST' && record.method !== 'PUT')
    return null
  if (record.requestMode !== 'raw-item' && record.requestMode !== 'wrapped-item')
    return null

  const createdAt = typeof record.createdAt === 'number' ? record.createdAt : Date.now()
  const updatedAt = typeof record.updatedAt === 'number' ? record.updatedAt : createdAt

  return {
    id: record.id,
    name: typeof record.name === 'string' && record.name.trim().length > 0 ? record.name : '未命名配置',
    endpoint: record.endpoint,
    method: record.method,
    batchSize: typeof record.batchSize === 'number' ? Math.max(1, Math.trunc(record.batchSize) || 1) : DEFAULT_BATCH_SIZE,
    requestMode: record.requestMode,
    wrapperKey: typeof record.wrapperKey === 'string' ? record.wrapperKey : DEFAULT_WRAPPER_KEY,
    autoExtractObjectField: typeof record.autoExtractObjectField === 'boolean' ? record.autoExtractObjectField : true,
    headersText: typeof record.headersText === 'string' ? record.headersText : DEFAULT_HEADERS_TEXT,
    fixedParamsText: typeof record.fixedParamsText === 'string' ? record.fixedParamsText : DEFAULT_FIXED_PARAMS_TEXT,
    dynamicParamsText: typeof record.dynamicParamsText === 'string' ? record.dynamicParamsText : DEFAULT_DYNAMIC_PARAMS_TEXT,
    inputText: typeof record.inputText === 'string' ? record.inputText : DEFAULT_INPUT_TEXT,
    createdAt,
    updatedAt,
  }
}

export async function listImportPipelineConfigs() {
  const rows = await idb.getAll<unknown>(IMPORT_PIPELINE_CONFIG_STORE)
  return rows
    .map(normalizeSavedConfig)
    .filter((row): row is SavedImportPipelineConfig => !!row)
    .sort((left, right) => right.updatedAt - left.updatedAt)
}

export async function getImportPipelineConfigById(id: string) {
  const row = await idb.get<unknown>(IMPORT_PIPELINE_CONFIG_STORE, id)
  return normalizeSavedConfig(row)
}

export async function saveImportPipelineConfig(payload: unknown) {
  const normalized = normalizeSavedConfig(payload)
  if (!normalized)
    throw new Error('Invalid import pipeline config payload')

  await idb.put(IMPORT_PIPELINE_CONFIG_STORE, normalized)
  return normalized
}

export async function deleteImportPipelineConfigById(id: string) {
  await idb.remove(IMPORT_PIPELINE_CONFIG_STORE, id)
}
