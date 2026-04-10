import { defineSchemaHandle } from '@/driver/define-schema-handle.driver'

export interface DatabaseManagerDocumentItem extends Record<string, unknown> {
  _id: string
  documentId: string
  data: unknown
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

const databaseManagerDocumentItemsSchema = defineSchemaHandle<DatabaseManagerDocumentItem>({
  name: 'database-manager-document-items',
  keyPath: '_id',
  timestamps: true,
  indexes: [
    { name: 'documentId', keyPath: 'documentId' },
    { name: 'updatedAt', keyPath: 'updatedAt' },
  ],
})

export default databaseManagerDocumentItemsSchema
