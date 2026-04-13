import type {
  DictKeeperEndpointMergeStrategy,
  DictKeeperRequestMethod,
} from '@/schema/dict-keeper/external-crud.schema'
import { defineSchemaHandle } from '@/driver/define-schema-handle.driver'

export const DICT_KEEPER_CRUD_SECTIONS = ['dictionary', 'item'] as const
export const DICT_KEEPER_CRUD_ACTIONS = ['create', 'read', 'update', 'delete'] as const

export type DictKeeperCrudSection = (typeof DICT_KEEPER_CRUD_SECTIONS)[number]
export type DictKeeperCrudAction = (typeof DICT_KEEPER_CRUD_ACTIONS)[number]

export interface DictKeeperExternalCrudRecordMappingDraft extends Record<string, unknown> {
  section: DictKeeperCrudSection
  action: DictKeeperCrudAction
  path: string
  method: DictKeeperRequestMethod
  pathTemplate?: string
  queryTemplate?: Record<string, string>
  headerTemplate?: Record<string, string>
  bodyTemplate?: unknown
  contentType?: string
  timeoutMs?: number
  mergeStrategy?: DictKeeperEndpointMergeStrategy
}

export interface DictKeeperExternalCrudRecordDocument extends Record<string, unknown> {
  _id: string
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
  sourceTabId?: number
  sourceUrl?: string
  mappingDraft?: DictKeeperExternalCrudRecordMappingDraft
  masked?: boolean
  truncated?: boolean
  isDeleted?: boolean
  deletedAt?: number
  createdAt?: number
  updatedAt?: number
  createdBy?: {
    module: string
    page: string
    traceId: string
  }
  updatedBy?: {
    module: string
    page: string
    traceId: string
  }
}

const dictKeeperExternalCrudRecordSchema = defineSchemaHandle<DictKeeperExternalCrudRecordDocument>({
  name: 'dict-keeper-external-crud-record',
  keyPath: '_id',
  timestamps: true,
  indexes: [
    { name: 'sessionId', keyPath: 'sessionId' },
    { name: 'method', keyPath: 'method' },
    { name: 'status', keyPath: 'status' },
    { name: 'sourceTabId', keyPath: 'sourceTabId' },
    { name: 'createdAt', keyPath: 'createdAt' },
    { name: 'updatedAt', keyPath: 'updatedAt' },
    { name: 'isDeleted', keyPath: 'isDeleted' },
    { name: 'deletedAt', keyPath: 'deletedAt' },
  ],
})

export default dictKeeperExternalCrudRecordSchema
