import type { RouterRequestTransaction } from '@/runtime/types'
import itemsSchema from '@/schema/database-manager/document-items.schema'
import documentsSchema from '@/schema/database-manager/documents.schema'

export interface DocumentMeta {
  title?: string
  meta?: Record<string, unknown>
}

export interface DocumentRecord {
  _id: string
  title?: string
  meta?: Record<string, unknown>
  createdAt?: number
  updatedAt?: number
  createdBy?: { module: string, page: string, traceId: string }
  updatedBy?: { module: string, page: string, traceId: string }
}

export interface ItemRecord {
  _id: string
  documentId: string
  data: unknown
  createdAt?: number
  updatedAt?: number
  createdBy?: { module: string, page: string, traceId: string }
  updatedBy?: { module: string, page: string, traceId: string }
}

export interface DatabaseManagerServiceOptions {
  transaction?: RouterRequestTransaction
}

export async function createDocument(
  payload: DocumentMeta & { createdBy: DocumentRecord['createdBy'] },
  options: DatabaseManagerServiceOptions = {},
): Promise<DocumentRecord> {
  const created = await documentsSchema.create({
    title: payload.title,
    meta: payload.meta,
    createdBy: payload.createdBy,
    updatedBy: payload.createdBy,
  }, {
    transaction: options.transaction,
  })

  return created
}

export async function getDocument(
  id: string,
  options: DatabaseManagerServiceOptions = {},
): Promise<DocumentRecord | null> {
  if (!id)
    return null

  const doc = await documentsSchema.findOne({ _id: id }, { transaction: options.transaction })
  return doc
}

export async function listDocuments(options: DatabaseManagerServiceOptions = {}): Promise<DocumentRecord[]> {
  return documentsSchema.find(undefined, { transaction: options.transaction })
}

export async function updateDocument(
  id: string,
  patch: Partial<DocumentMeta & { updatedBy?: DocumentRecord['updatedBy'] }>,
  options: DatabaseManagerServiceOptions = {},
): Promise<DocumentRecord | null> {
  if (!id)
    return null

  const payload: Partial<DocumentRecord> = {}
  if (patch.title !== undefined)
    payload.title = patch.title
  if (patch.meta !== undefined)
    payload.meta = patch.meta
  if (patch.updatedBy !== undefined)
    payload.updatedBy = patch.updatedBy

  return documentsSchema.updateById(id, payload as any, { transaction: options.transaction })
}

export async function deleteDocument(
  id: string,
  options: DatabaseManagerServiceOptions = {},
): Promise<DocumentRecord | null> {
  if (!id)
    return null

  // delete items belonging to document in same transaction when possible
  if (options.transaction) {
    // remove items by scanning index
    const items = await itemsSchema.find(d => d.documentId === id, { transaction: options.transaction })
    for (const item of items) {
      await itemsSchema.deleteById(item._id, { transaction: options.transaction })
    }
    return documentsSchema.deleteById(id, { transaction: options.transaction })
  }

  // no transaction provided — perform in a scoped transaction
  return documentsSchema.transaction(async (tx) => {
    const items = await itemsSchema.find(d => d.documentId === id, { transaction: tx })
    for (const item of items) {
      await itemsSchema.deleteById(item._id, { transaction: tx })
    }
    return documentsSchema.deleteById(id, { transaction: tx })
  })
}

// Items
export async function createItem(
  documentId: string,
  data: unknown,
  createdBy: ItemRecord['createdBy'],
  options: DatabaseManagerServiceOptions = {},
): Promise<ItemRecord> {
  if (!documentId)
    throw Object.assign(new Error('documentId required'), { code: 'DOCUMENT_ID_REQUIRED' })

  const created = await itemsSchema.create({
    documentId,
    data,
    createdBy,
    updatedBy: createdBy,
  }, { transaction: options.transaction })

  return created
}

export async function listItems(documentId: string, options: DatabaseManagerServiceOptions = {}): Promise<ItemRecord[]> {
  if (!documentId)
    return []
  return itemsSchema.find(d => d.documentId === documentId, { transaction: options.transaction })
}

export async function updateItem(
  itemId: string,
  patch: Partial<{ data?: unknown, updatedBy?: ItemRecord['updatedBy'] }>,
  options: DatabaseManagerServiceOptions = {},
): Promise<ItemRecord | null> {
  if (!itemId)
    return null

  const payload: any = {}
  if (patch.data !== undefined)
    payload.data = patch.data
  if (patch.updatedBy !== undefined)
    payload.updatedBy = patch.updatedBy

  return itemsSchema.updateById(itemId, payload, { transaction: options.transaction })
}

export async function deleteItem(
  itemId: string,
  options: DatabaseManagerServiceOptions = {},
): Promise<ItemRecord | null> {
  if (!itemId)
    return null
  return itemsSchema.deleteById(itemId, { transaction: options.transaction })
}

export default {
  createDocument,
  getDocument,
  listDocuments,
  updateDocument,
  deleteDocument,
  createItem,
  listItems,
  updateItem,
  deleteItem,
}
