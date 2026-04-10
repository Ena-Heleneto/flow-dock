import type { RouterRequestTransaction, RouterTransactionMode } from 'playground/runtime/types'
import { beginTransaction, registerIndexedDbStore } from '@/driver/transaction.manager'

type AnyDocument = Record<string, unknown>

export type SchemaQuery<TDocument extends AnyDocument>
  = Partial<TDocument>
    | ((document: TDocument) => boolean)

export interface SchemaIndexDefinition<TDocument extends AnyDocument = AnyDocument> {
  name: string
  keyPath: Extract<keyof TDocument, string> | string | string[]
  options?: IDBIndexParameters
}

export interface SchemaOperationOptions {
  transaction?: RouterRequestTransaction
}

export interface SchemaTransactionOptions {
  mode?: RouterTransactionMode
}

export interface SchemaHandleOptions<TDocument extends AnyDocument = AnyDocument> {
  name?: string
  keyPath?: Extract<keyof TDocument, string>
  autoIncrement?: boolean
  timestamps?: boolean
  indexes?: SchemaIndexDefinition<TDocument>[]
  idFactory?: () => IDBValidKey
}

export interface SchemaHandle<TDocument extends AnyDocument = AnyDocument> {
  readonly storeName: string
  readonly keyPath: string
  readonly create: (document: Partial<TDocument>, options?: SchemaOperationOptions) => Promise<TDocument>
  readonly find: (query?: SchemaQuery<TDocument>, options?: SchemaOperationOptions) => Promise<TDocument[]>
  readonly findOne: (query?: SchemaQuery<TDocument>, options?: SchemaOperationOptions) => Promise<TDocument | null>
  readonly updateById: (
    id: IDBValidKey,
    patch: Partial<TDocument>,
    options?: SchemaOperationOptions,
  ) => Promise<TDocument | null>
  readonly deleteById: (id: IDBValidKey, options?: SchemaOperationOptions) => Promise<TDocument | null>
  readonly count: (query?: SchemaQuery<TDocument>, options?: SchemaOperationOptions) => Promise<number>
  readonly transaction: <TResult>(
    handler: (transaction: RouterRequestTransaction) => Promise<TResult> | TResult,
    options?: SchemaTransactionOptions,
  ) => Promise<TResult>
}

interface NormalizedSchemaHandleOptions<TDocument extends AnyDocument = AnyDocument> {
  storeName: string
  keyPath: string
  autoIncrement: boolean
  timestamps: boolean
  indexes: SchemaIndexDefinition<TDocument>[]
  idFactory: () => IDBValidKey
}

export function defineSchemaHandle<TDocument extends AnyDocument = AnyDocument>(
  options: SchemaHandleOptions<TDocument> = {},
): SchemaHandle<TDocument> {
  const normalizedOptions = normalizeSchemaOptions(options)

  registerIndexedDbStore({
    name: normalizedOptions.storeName,
    keyPath: normalizedOptions.keyPath,
    autoIncrement: normalizedOptions.autoIncrement,
    indexes: normalizedOptions.indexes.map(index => ({
      name: index.name,
      keyPath: index.keyPath,
      options: index.options,
    })),
  })

  const model: SchemaHandle<TDocument> = {
    storeName: normalizedOptions.storeName,
    keyPath: normalizedOptions.keyPath,
    async create(document, operationOptions = {}) {
      const draft = normalizeDocument(document)
      const keyPath = normalizedOptions.keyPath
      const now = Date.now()

      if (normalizedOptions.timestamps) {
        if (draft.createdAt === undefined)
          draft.createdAt = now

        draft.updatedAt = now
      }

      if (draft[keyPath] === undefined && !normalizedOptions.autoIncrement)
        draft[keyPath] = normalizedOptions.idFactory()

      return withStore('readwrite', normalizedOptions, operationOptions, async (store) => {
        const generatedKey = await requestToPromise(store.add(draft as TDocument))

        if (draft[keyPath] === undefined)
          draft[keyPath] = generatedKey

        return cloneDocument(draft as TDocument)
      })
    },
    async find(query, operationOptions = {}) {
      const match = createDocumentMatcher(query)

      return withStore('readonly', normalizedOptions, operationOptions, async (store) => {
        const documents = await requestToPromise(store.getAll()) as TDocument[]
        return documents
          .filter(match)
          .map(document => cloneDocument(document))
      })
    },
    async findOne(query, operationOptions = {}) {
      const documents = await model.find(query, operationOptions)
      return documents.at(0) ?? null
    },
    async updateById(id, patch, operationOptions = {}) {
      const keyPath = normalizedOptions.keyPath
      const normalizedPatch = normalizeDocument(patch)

      if (normalizedPatch[keyPath] !== undefined && normalizedPatch[keyPath] !== id) {
        throw createSchemaDriverError(
          `Patch contains mismatched key path "${keyPath}"`,
          'SCHEMA_UPDATE_ID_MISMATCH',
          {
            id,
            keyPath,
            patchValue: normalizedPatch[keyPath],
          },
        )
      }

      return withStore('readwrite', normalizedOptions, operationOptions, async (store) => {
        const existing = await requestToPromise(store.get(id)) as TDocument | undefined
        if (!existing)
          return null

        const merged = {
          ...normalizeDocument(existing),
          ...normalizedPatch,
        }

        merged[keyPath] = id

        if (normalizedOptions.timestamps)
          merged.updatedAt = Date.now()

        await requestToPromise(store.put(merged as TDocument))
        return cloneDocument(merged as TDocument)
      })
    },
    async deleteById(id, operationOptions = {}) {
      return withStore('readwrite', normalizedOptions, operationOptions, async (store) => {
        const existing = await requestToPromise(store.get(id)) as TDocument | undefined
        if (!existing)
          return null

        await requestToPromise(store.delete(id))
        return cloneDocument(existing)
      })
    },
    async count(query, operationOptions = {}) {
      return withStore('readonly', normalizedOptions, operationOptions, async (store) => {
        if (query === undefined)
          return requestToPromise(store.count())

        const match = createDocumentMatcher(query)
        const documents = await requestToPromise(store.getAll()) as TDocument[]
        return documents.filter(match).length
      })
    },
    async transaction(handler, transactionOptions = {}) {
      const transaction = await beginTransaction({
        mode: transactionOptions.mode ?? 'readwrite',
        storeNames: [normalizedOptions.storeName],
      })

      try {
        const result = await handler(transaction)
        await transaction.commit()
        return result
      }
      catch (error) {
        await transaction.rollback()
        throw error
      }
    },
  }

  return model
}

export function isSchemaHandle(input: unknown): input is SchemaHandle {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return false

  const schemaHandle = input as Partial<SchemaHandle>

  return typeof schemaHandle.storeName === 'string'
    && typeof schemaHandle.keyPath === 'string'
    && typeof schemaHandle.create === 'function'
    && typeof schemaHandle.find === 'function'
    && typeof schemaHandle.findOne === 'function'
    && typeof schemaHandle.updateById === 'function'
    && typeof schemaHandle.deleteById === 'function'
    && typeof schemaHandle.count === 'function'
    && typeof schemaHandle.transaction === 'function'
}

async function withStore<TDocument extends AnyDocument, TResult>(
  requiredMode: RouterTransactionMode,
  schemaOptions: NormalizedSchemaHandleOptions<TDocument>,
  operationOptions: SchemaOperationOptions,
  handler: (store: IDBObjectStore) => Promise<TResult>,
): Promise<TResult> {
  const transaction = operationOptions.transaction

  if (transaction) {
    ensureTransactionMode(transaction, requiredMode)
    return transaction.useStore(schemaOptions.storeName, handler)
  }

  const scopedTransaction = await beginTransaction({
    mode: requiredMode,
    storeNames: [schemaOptions.storeName],
  })

  try {
    const result = await scopedTransaction.useStore(schemaOptions.storeName, handler)
    await scopedTransaction.commit()
    return result
  }
  catch (error) {
    await scopedTransaction.rollback()
    throw error
  }
}

function ensureTransactionMode(transaction: RouterRequestTransaction, requiredMode: RouterTransactionMode) {
  if (requiredMode === 'readonly')
    return

  if (transaction.mode !== 'readwrite') {
    throw createSchemaDriverError(
      `Operation requires readwrite transaction but received "${transaction.mode}"`,
      'SCHEMA_TRANSACTION_MODE_MISMATCH',
      {
        requiredMode,
        actualMode: transaction.mode,
        transactionId: transaction.id,
      },
    )
  }
}

function createDocumentMatcher<TDocument extends AnyDocument>(query: SchemaQuery<TDocument> | undefined) {
  if (!query)
    return () => true

  if (typeof query === 'function')
    return query

  const entries = Object.entries(query)
  return (document: TDocument) => {
    const comparable = normalizeDocument(document)

    for (const [queryKey, queryValue] of entries) {
      if (!Object.is(comparable[queryKey], queryValue))
        return false
    }

    return true
  }
}

function normalizeSchemaOptions<TDocument extends AnyDocument>(
  input: SchemaHandleOptions<TDocument>,
): NormalizedSchemaHandleOptions<TDocument> {
  const normalizedStoreName = typeof input.name === 'string' && input.name.trim()
    ? input.name.trim()
    : 'default-schema-store'

  const normalizedKeyPath = typeof input.keyPath === 'string' && input.keyPath.trim()
    ? input.keyPath.trim()
    : '_id'

  return {
    storeName: normalizedStoreName,
    keyPath: normalizedKeyPath,
    autoIncrement: Boolean(input.autoIncrement),
    timestamps: input.timestamps ?? true,
    indexes: normalizeIndexes(input.indexes),
    idFactory: input.idFactory ?? createDocumentId,
  }
}

function normalizeIndexes<TDocument extends AnyDocument>(indexes: SchemaHandleOptions<TDocument>['indexes']) {
  if (!indexes || indexes.length === 0)
    return []

  const normalizedIndexes = new Map<string, SchemaIndexDefinition<TDocument>>()

  for (const index of indexes) {
    const normalizedName = index.name.trim()
    if (!normalizedName) {
      throw createSchemaDriverError(
        'Schema index name is required',
        'SCHEMA_INDEX_NAME_REQUIRED',
        index,
      )
    }

    normalizedIndexes.set(normalizedName, {
      ...index,
      name: normalizedName,
    })
  }

  return [...normalizedIndexes.values()]
}

function normalizeDocument<TDocument extends AnyDocument>(input: Partial<TDocument> | TDocument) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return {} as AnyDocument

  return {
    ...(input as AnyDocument),
  }
}

function cloneDocument<TDocument extends AnyDocument>(input: TDocument) {
  return {
    ...normalizeDocument(input),
  } as TDocument
}

function requestToPromise<TResult>(request: IDBRequest<TResult>): Promise<TResult> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      reject(
        request.error
        ?? createSchemaDriverError('IndexedDB request failed', 'SCHEMA_IDB_REQUEST_FAILED'),
      )
    }
  })
}

function createSchemaDriverError(message: string, code: string, details?: unknown) {
  return Object.assign(new Error(message), {
    code,
    details,
  })
}

function createDocumentId() {
  if (typeof globalThis.crypto?.randomUUID === 'function')
    return globalThis.crypto.randomUUID()

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
