import type { RouterRequestTransaction } from 'playground/runtime/types'
import databaseMangerRecordSchema from '@/schema/database-manger/records.shchema'

export interface DatabaseMangerRecord {
  value: unknown
  updatedAt: number
  updatedBy: {
    module: string
    page: string
    traceId: string
  }
}

export type DatabaseMangerCollection = Record<string, DatabaseMangerRecord>

export interface DatabaseMangerServiceOptions {
  transaction?: RouterRequestTransaction
}

export interface UpsertDatabaseMangerRecordInput {
  key: string
  value: unknown
  updatedBy: DatabaseMangerRecord['updatedBy']
}

export async function readDatabaseMangerRecord(
  key: string,
  options: DatabaseMangerServiceOptions = {},
): Promise<DatabaseMangerRecord | null> {
  const normalizedKey = normalizeKey(key)
  if (!normalizedKey)
    return null

  const document = await databaseMangerRecordSchema.findOne(
    { _id: normalizedKey },
    { transaction: options.transaction },
  )

  return document
    ? toDatabaseMangerRecord(document)
    : null
}

export async function readDatabaseMangerCollection(
  options: DatabaseMangerServiceOptions = {},
): Promise<DatabaseMangerCollection> {
  const documents = await databaseMangerRecordSchema.find(undefined, {
    transaction: options.transaction,
  })

  return documents.reduce<DatabaseMangerCollection>((collection, document) => {
    collection[document._id] = toDatabaseMangerRecord(document)
    return collection
  }, {})
}

export async function upsertDatabaseMangerRecord(
  input: UpsertDatabaseMangerRecordInput,
  options: DatabaseMangerServiceOptions = {},
): Promise<DatabaseMangerRecord> {
  const normalizedKey = normalizeKey(input.key)
  if (!normalizedKey) {
    throw Object.assign(new Error('Database key is required'), {
      code: 'DATABASE_KEY_REQUIRED',
    })
  }

  const payload = {
    value: input.value,
    updatedAt: Date.now(),
    updatedBy: {
      module: input.updatedBy.module,
      page: input.updatedBy.page,
      traceId: input.updatedBy.traceId,
    },
  }

  const updated = await databaseMangerRecordSchema.updateById(
    normalizedKey,
    payload,
    { transaction: options.transaction },
  )

  if (updated)
    return toDatabaseMangerRecord(updated)

  const created = await databaseMangerRecordSchema.create(
    {
      _id: normalizedKey,
      ...payload,
    },
    { transaction: options.transaction },
  )

  return toDatabaseMangerRecord(created)
}

export async function writeDatabaseMangerCollection(
  collection: DatabaseMangerCollection,
  options: DatabaseMangerServiceOptions = {},
) {
  const existingDocuments = await databaseMangerRecordSchema.find(undefined, {
    transaction: options.transaction,
  })

  const incomingEntries = Object.entries(collection)
  const incomingKeys = new Set(
    incomingEntries
      .map(([key]) => normalizeKey(key))
      .filter(Boolean),
  )

  for (const document of existingDocuments) {
    if (incomingKeys.has(document._id))
      continue

    await databaseMangerRecordSchema.deleteById(document._id, {
      transaction: options.transaction,
    })
  }

  for (const [rawKey, record] of incomingEntries) {
    const key = normalizeKey(rawKey)
    if (!key)
      continue

    await upsertDatabaseMangerRecord(
      {
        key,
        value: record.value,
        updatedBy: record.updatedBy,
      },
      options,
    )
  }
}

function toDatabaseMangerRecord(input: {
  value: unknown
  updatedAt: number
  updatedBy: DatabaseMangerRecord['updatedBy']
}) {
  return {
    value: input.value,
    updatedAt: input.updatedAt,
    updatedBy: {
      module: input.updatedBy.module,
      page: input.updatedBy.page,
      traceId: input.updatedBy.traceId,
    },
  }
}

function normalizeKey(input: unknown) {
  if (typeof input !== 'string')
    return ''

  return input.trim()
}
