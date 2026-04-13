import { defineSchemaHandle } from '@/driver/define-schema-handle.driver'

export type DictKeeperExternalCrudRecordSessionStatus = 'recording' | 'stopped'

export interface DictKeeperExternalCrudRecordSessionDocument extends Record<string, unknown> {
  _id: string
  name: string
  status: DictKeeperExternalCrudRecordSessionStatus
  sourceUrl?: string
  startedAt: number
  stoppedAt?: number
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

const dictKeeperExternalCrudRecordSessionSchema = defineSchemaHandle<DictKeeperExternalCrudRecordSessionDocument>({
  name: 'dict-keeper-external-crud-record-session',
  keyPath: '_id',
  timestamps: true,
  indexes: [
    { name: 'status', keyPath: 'status' },
    { name: 'startedAt', keyPath: 'startedAt' },
    { name: 'stoppedAt', keyPath: 'stoppedAt' },
    { name: 'isDeleted', keyPath: 'isDeleted' },
    { name: 'deletedAt', keyPath: 'deletedAt' },
    { name: 'createdAt', keyPath: 'createdAt' },
    { name: 'updatedAt', keyPath: 'updatedAt' },
  ],
})

export default dictKeeperExternalCrudRecordSessionSchema
