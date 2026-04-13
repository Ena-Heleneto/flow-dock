import { defineSchemaHandle } from '@/driver/define-schema-handle.driver'

export const DICT_KEEPER_REQUEST_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

export type DictKeeperRequestMethod = (typeof DICT_KEEPER_REQUEST_METHODS)[number]

export interface DictKeeperCrudEndpointNode extends Record<string, unknown> {
  path: string
  method: DictKeeperRequestMethod
}

export interface DictKeeperCrudEndpointConfig extends Record<string, unknown> {
  create: DictKeeperCrudEndpointNode
  read: DictKeeperCrudEndpointNode
  update: DictKeeperCrudEndpointNode
  delete: DictKeeperCrudEndpointNode
}

export interface DictKeeperExternalCrudDocument extends Record<string, unknown> {
  _id: string
  name: string
  basePath: string
  dictionary: DictKeeperCrudEndpointConfig
  item: DictKeeperCrudEndpointConfig
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

const dictKeeperExternalCrudSchema = defineSchemaHandle<DictKeeperExternalCrudDocument>({
  name: 'dict-keeper-external-crud',
  keyPath: '_id',
  timestamps: true,
  indexes: [
    { name: 'name', keyPath: 'name' },
    { name: 'updatedAt', keyPath: 'updatedAt' },
    { name: 'createdAt', keyPath: 'createdAt' },
    { name: 'isDeleted', keyPath: 'isDeleted' },
    { name: 'deletedAt', keyPath: 'deletedAt' },
  ],
})

export default dictKeeperExternalCrudSchema
