import { defineSchemaHandle } from '@/driver/define-schema-handle.driver'

export interface DatabaseManagerDocument extends Record<string, unknown> {
  _id: string
  title?: string
  meta?: Record<string, unknown>
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

const databaseManagerDocumentsSchema = defineSchemaHandle<DatabaseManagerDocument>({
  name: 'database-manager-documents',
  keyPath: '_id',
  timestamps: true,
  indexes: [
    { name: 'updatedAt', keyPath: 'updatedAt' },
    { name: 'createdAt', keyPath: 'createdAt' },
  ],
})

export default databaseManagerDocumentsSchema
