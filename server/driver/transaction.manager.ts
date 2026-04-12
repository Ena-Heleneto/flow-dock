import type {
  RouterRequestTransaction,
  RouterTransactionMode,
  RouterTransactionStatus,
} from '@/runtime/types'

const DATABASE_NAME = 'flow-dock-indexeddb'
const DEFAULT_STORE_NAME = '__flowdock_meta__'

interface IndexedDbDriverError extends Error {
  code: string
  details?: unknown
}

export interface IndexedDbStoreIndexDefinition {
  name: string
  keyPath: string | string[]
  options?: IDBIndexParameters
}

export interface IndexedDbStoreDefinition {
  name: string
  keyPath?: string
  autoIncrement?: boolean
  indexes?: IndexedDbStoreIndexDefinition[]
}

export interface BeginTransactionOptions {
  mode?: RouterTransactionMode
  storeNames?: string[]
}

interface RegisteredStoreDefinition {
  name: string
  keyPath?: string
  autoIncrement: boolean
  indexes: IndexedDbStoreIndexDefinition[]
}

const registeredStores = new Map<string, RegisteredStoreDefinition>()

let schemaVersion = 1
let databasePromise: Promise<IDBDatabase> | null = null
let openedDatabase: IDBDatabase | null = null
let openedDatabaseVersion: number | null = null

registerDefaultStore()

export function registerIndexedDbStore(input: IndexedDbStoreDefinition) {
  const normalized = normalizeStoreDefinition(input)
  const existing = registeredStores.get(normalized.name)

  if (!existing) {
    registeredStores.set(normalized.name, normalized)
    bumpSchemaVersion()
    return
  }

  if (existing.keyPath !== normalized.keyPath || existing.autoIncrement !== normalized.autoIncrement) {
    throw createIndexedDbDriverError(
      `Conflicting store definition for "${normalized.name}"`,
      'STORE_DEFINITION_CONFLICT',
      {
        existing,
        incoming: normalized,
      },
    )
  }

  const mergedIndexes = mergeStoreIndexes(existing.indexes, normalized.indexes)
  if (mergedIndexes.length === existing.indexes.length)
    return

  registeredStores.set(normalized.name, {
    ...existing,
    indexes: mergedIndexes,
  })
  bumpSchemaVersion()
}

export async function beginTransaction(options: BeginTransactionOptions = {}): Promise<RouterRequestTransaction> {
  const mode = options.mode ?? 'readwrite'
  const resolvedStoreNames = resolveStoreNames(options.storeNames)

  if (typeof indexedDB === 'undefined')
    return createUnavailableTransaction(mode)

  const database = await getDatabase()

  for (const storeName of resolvedStoreNames) {
    if (!database.objectStoreNames.contains(storeName)) {
      throw createIndexedDbDriverError(
        `Store "${storeName}" does not exist in IndexedDB`,
        'STORE_NOT_FOUND',
        {
          storeName,
          knownStores: [...database.objectStoreNames],
        },
      )
    }
  }

  const transaction = database.transaction(resolvedStoreNames, mode)
  return createManagedTransaction(transaction, mode)
}

function resolveStoreNames(input: string[] | undefined) {
  const normalizedInput = (input ?? [])
    .map(value => value.trim())
    .filter(Boolean)

  if (normalizedInput.length > 0)
    return [...new Set(normalizedInput)]

  const fallbackStoreNames = [...registeredStores.keys()]
  return fallbackStoreNames.length > 0
    ? fallbackStoreNames
    : [DEFAULT_STORE_NAME]
}

function createManagedTransaction(
  transaction: IDBTransaction,
  mode: RouterTransactionMode,
): RouterRequestTransaction {
  const transactionId = createTransactionId()
  let status: RouterTransactionStatus = 'active'

  let settled = false
  const done = new Promise<void>((resolve, reject) => {
    const resolveOnce = () => {
      if (settled)
        return

      settled = true
      resolve()
    }

    const rejectOnce = (error: unknown) => {
      if (settled)
        return

      settled = true
      reject(toError(error, 'IndexedDB transaction failed', 'TRANSACTION_FAILED'))
    }

    transaction.addEventListener('complete', () => {
      if (status === 'active')
        status = 'committed'

      resolveOnce()
    })

    transaction.addEventListener('abort', () => {
      status = 'rolled-back'
      rejectOnce(
        transaction.error
        ?? createIndexedDbDriverError('IndexedDB transaction aborted', 'TRANSACTION_ABORTED'),
      )
    })

    transaction.addEventListener('error', () => {
      rejectOnce(
        transaction.error
        ?? createIndexedDbDriverError('IndexedDB transaction error', 'TRANSACTION_ERROR'),
      )
    })
  })

  return {
    id: transactionId,
    mode,
    done,
    async commit() {
      if (status === 'rolled-back') {
        throw createIndexedDbDriverError(
          `Transaction "${transactionId}" has been rolled back`,
          'TRANSACTION_ALREADY_ROLLED_BACK',
        )
      }

      if (status !== 'active') {
        await done
        return
      }

      if (typeof transaction.commit === 'function') {
        try {
          transaction.commit()
        }
        catch (error) {
          if (!isInvalidTransactionStateError(error))
            throw toError(error, 'Failed to commit transaction', 'TRANSACTION_COMMIT_FAILED')
        }
      }

      await done
    },
    async rollback() {
      if (status === 'rolled-back')
        return

      if (status === 'committed')
        return

      if (status === 'active') {
        try {
          transaction.abort()
        }
        catch (error) {
          if (!isInvalidTransactionStateError(error)) {
            throw toError(error, 'Failed to rollback transaction', 'TRANSACTION_ROLLBACK_FAILED')
          }
        }
      }

      try {
        await done
      }
      catch {
        // rollback should not rethrow abort errors
      }
    },
    isActive() {
      return status === 'active'
    },
    getStatus() {
      return status
    },
    async useStore<TResult>(
      storeName: string,
      handler: (store: IDBObjectStore) => Promise<TResult> | TResult,
    ): Promise<TResult> {
      if (status !== 'active') {
        throw createIndexedDbDriverError(
          `Transaction "${transactionId}" is no longer active`,
          'TRANSACTION_NOT_ACTIVE',
        )
      }

      if (!transaction.objectStoreNames.contains(storeName)) {
        throw createIndexedDbDriverError(
          `Store "${storeName}" is not part of transaction "${transactionId}"`,
          'STORE_NOT_IN_TRANSACTION',
          {
            storeName,
            transactionId,
            stores: [...transaction.objectStoreNames],
          },
        )
      }

      return handler(transaction.objectStore(storeName))
    },
  }
}

function createUnavailableTransaction(mode: RouterTransactionMode): RouterRequestTransaction {
  const transactionId = createTransactionId()
  let status: RouterTransactionStatus = 'active'

  const done = Promise.resolve()

  return {
    id: transactionId,
    mode,
    done,
    async commit() {
      status = 'committed'
    },
    async rollback() {
      status = 'rolled-back'
    },
    isActive() {
      return status === 'active'
    },
    getStatus() {
      return status
    },
    async useStore<TResult>(
      _storeName: string,
      _handler: (store: IDBObjectStore) => Promise<TResult> | TResult,
    ): Promise<TResult> {
      throw createIndexedDbDriverError(
        'IndexedDB is not available in current runtime',
        'INDEXED_DB_UNAVAILABLE',
      )
    },
  }
}

async function getDatabase() {
  if (typeof indexedDB === 'undefined') {
    throw createIndexedDbDriverError(
      'IndexedDB is not available in current runtime',
      'INDEXED_DB_UNAVAILABLE',
    )
  }

  if (databasePromise && openedDatabaseVersion === schemaVersion)
    return databasePromise

  if (openedDatabase) {
    openedDatabase.close()
    openedDatabase = null
    openedDatabaseVersion = null
    databasePromise = null
  }

  const targetVersion = schemaVersion
  const pending = openDatabase(targetVersion)
  databasePromise = pending

  try {
    const database = await pending
    openedDatabase = database
    openedDatabaseVersion = targetVersion
    return database
  }
  catch (error) {
    if (databasePromise === pending)
      databasePromise = null

    throw error
  }
}

function openDatabase(version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, version)
    let settled = false

    const resolveOnce = (database: IDBDatabase) => {
      if (settled)
        return

      settled = true
      resolve(database)
    }

    const rejectOnce = (error: unknown) => {
      if (settled)
        return

      settled = true
      reject(toError(error, 'Failed to open IndexedDB', 'INDEXED_DB_OPEN_FAILED'))
    }

    request.onupgradeneeded = () => {
      try {
        const database = request.result
        const upgradeTransaction = request.transaction
        if (!upgradeTransaction) {
          throw createIndexedDbDriverError(
            'Upgrade transaction is unavailable',
            'INDEXED_DB_UPGRADE_TRANSACTION_MISSING',
          )
        }

        applyStoreDefinitions(database, upgradeTransaction)
      }
      catch (error) {
        rejectOnce(error)
      }
    }

    request.onerror = () => {
      rejectOnce(
        request.error
        ?? createIndexedDbDriverError('Unknown IndexedDB open error', 'INDEXED_DB_OPEN_FAILED'),
      )
    }

    request.onblocked = () => {
      rejectOnce(
        createIndexedDbDriverError('IndexedDB open request blocked', 'INDEXED_DB_OPEN_BLOCKED', {
          databaseName: DATABASE_NAME,
          version,
        }),
      )
    }

    request.onsuccess = () => {
      const database = request.result

      database.addEventListener('versionchange', () => {
        database.close()
        if (openedDatabase === database) {
          openedDatabase = null
          openedDatabaseVersion = null
          databasePromise = null
        }
      })

      resolveOnce(database)
    }
  })
}

function applyStoreDefinitions(database: IDBDatabase, upgradeTransaction: IDBTransaction) {
  const storeDefinitions = [...registeredStores.values()]
    .sort((leftStore, rightStore) => leftStore.name.localeCompare(rightStore.name))

  for (const storeDefinition of storeDefinitions) {
    const storeName = storeDefinition.name
    const objectStore = database.objectStoreNames.contains(storeName)
      ? upgradeTransaction.objectStore(storeName)
      : database.createObjectStore(storeName, createObjectStoreOptions(storeDefinition))

    ensureIndexes(objectStore, storeDefinition.indexes)
  }
}

function createObjectStoreOptions(storeDefinition: RegisteredStoreDefinition) {
  const hasKeyPath = typeof storeDefinition.keyPath === 'string'
  if (!hasKeyPath && !storeDefinition.autoIncrement)
    return undefined

  return {
    keyPath: storeDefinition.keyPath,
    autoIncrement: storeDefinition.autoIncrement,
  }
}

function ensureIndexes(
  objectStore: IDBObjectStore,
  indexes: IndexedDbStoreIndexDefinition[],
) {
  for (const index of indexes) {
    if (objectStore.indexNames.contains(index.name))
      continue

    objectStore.createIndex(index.name, index.keyPath, index.options)
  }
}

function registerDefaultStore() {
  registeredStores.set(DEFAULT_STORE_NAME, {
    name: DEFAULT_STORE_NAME,
    autoIncrement: true,
    indexes: [],
  })
}

function bumpSchemaVersion() {
  schemaVersion += 1

  if (openedDatabase) {
    openedDatabase.close()
    openedDatabase = null
  }

  openedDatabaseVersion = null
  databasePromise = null
}

function normalizeStoreDefinition(input: IndexedDbStoreDefinition): RegisteredStoreDefinition {
  const normalizedName = input.name.trim()
  if (!normalizedName) {
    throw createIndexedDbDriverError(
      'Store name is required',
      'STORE_NAME_REQUIRED',
      input,
    )
  }

  const normalizedKeyPath = typeof input.keyPath === 'string' && input.keyPath.trim()
    ? input.keyPath.trim()
    : undefined

  const normalizedAutoIncrement = Boolean(input.autoIncrement)
  const normalizedIndexes = normalizeIndexDefinitions(input.indexes)

  return {
    name: normalizedName,
    keyPath: normalizedKeyPath,
    autoIncrement: normalizedAutoIncrement,
    indexes: normalizedIndexes,
  }
}

function normalizeIndexDefinitions(input: IndexedDbStoreDefinition['indexes']) {
  if (!input || input.length === 0)
    return []

  const normalizedIndexes = new Map<string, IndexedDbStoreIndexDefinition>()

  for (const indexDefinition of input) {
    const normalizedName = indexDefinition.name.trim()
    if (!normalizedName) {
      throw createIndexedDbDriverError(
        'Index name is required',
        'STORE_INDEX_NAME_REQUIRED',
        indexDefinition,
      )
    }

    normalizedIndexes.set(normalizedName, {
      name: normalizedName,
      keyPath: indexDefinition.keyPath,
      options: indexDefinition.options,
    })
  }

  return [...normalizedIndexes.values()]
}

function mergeStoreIndexes(
  baseIndexes: IndexedDbStoreIndexDefinition[],
  incomingIndexes: IndexedDbStoreIndexDefinition[],
) {
  const mergedIndexes = new Map<string, IndexedDbStoreIndexDefinition>()

  for (const baseIndex of baseIndexes)
    mergedIndexes.set(baseIndex.name, baseIndex)

  for (const incomingIndex of incomingIndexes) {
    const existingIndex = mergedIndexes.get(incomingIndex.name)
    if (!existingIndex) {
      mergedIndexes.set(incomingIndex.name, incomingIndex)
      continue
    }

    if (!areIndexesEqual(existingIndex, incomingIndex)) {
      throw createIndexedDbDriverError(
        `Conflicting index definition "${incomingIndex.name}"`,
        'STORE_INDEX_DEFINITION_CONFLICT',
        {
          existing: existingIndex,
          incoming: incomingIndex,
        },
      )
    }
  }

  return [...mergedIndexes.values()]
}

function areIndexesEqual(leftIndex: IndexedDbStoreIndexDefinition, rightIndex: IndexedDbStoreIndexDefinition) {
  return leftIndex.name === rightIndex.name
    && compareKeyPaths(leftIndex.keyPath, rightIndex.keyPath)
    && compareIndexOptions(leftIndex.options, rightIndex.options)
}

function compareKeyPaths(leftKeyPath: string | string[], rightKeyPath: string | string[]) {
  if (typeof leftKeyPath === 'string' || typeof rightKeyPath === 'string')
    return leftKeyPath === rightKeyPath

  if (leftKeyPath.length !== rightKeyPath.length)
    return false

  return leftKeyPath.every((keyPathSegment, index) => keyPathSegment === rightKeyPath[index])
}

function compareIndexOptions(
  leftOptions: IDBIndexParameters | undefined,
  rightOptions: IDBIndexParameters | undefined,
) {
  const leftUnique = Boolean(leftOptions?.unique)
  const rightUnique = Boolean(rightOptions?.unique)
  if (leftUnique !== rightUnique)
    return false

  const leftEntry = Boolean(leftOptions?.multiEntry)
  const rightEntry = Boolean(rightOptions?.multiEntry)
  return leftEntry === rightEntry
}

function isInvalidTransactionStateError(error: unknown) {
  return error instanceof DOMException
    && (error.name === 'InvalidStateError' || error.name === 'TransactionInactiveError')
}

function createTransactionId() {
  if (typeof globalThis.crypto?.randomUUID === 'function')
    return `tx:${globalThis.crypto.randomUUID()}`

  return `tx:${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function createIndexedDbDriverError(message: string, code: string, details?: unknown): IndexedDbDriverError {
  return Object.assign(new Error(message), {
    code,
    details,
  })
}

function toError(error: unknown, fallbackMessage: string, fallbackCode: string) {
  if (error instanceof Error) {
    return Object.assign(error, {
      code: (error as IndexedDbDriverError).code ?? fallbackCode,
    })
  }

  return createIndexedDbDriverError(fallbackMessage, fallbackCode, error)
}
