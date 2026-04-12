import { defineSchemaHandle } from '@/driver/define-schema-handle.driver'

export interface DictKeeperCrudEndpointConfig extends Record<string, unknown> {
  create: string
  read: string
  update: string
  delete: string
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
