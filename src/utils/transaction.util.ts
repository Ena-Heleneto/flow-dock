// import type { SchemaTransactionContext } from './define-schema-handler.util'
// import type { IdbStoreDefinition } from '~/types/idb.type'

export interface IdbTransactionContext extends SchemaTransactionContext {
  transaction: IDBTransaction
}

export class IdbTransactionUtil {
  private readonly dbName: string
  private readonly version: number
  private readonly stores: IdbStoreDefinition[]
  private dbPromise: Promise<IDBDatabase> | null = null
  private activeContext: IdbTransactionContext | null = null
  private activeDone: Promise<void> | null = null

  constructor(options: IdbTransactionUtilOptions) {
    this.dbName = options.dbName
    this.version = options.version ?? 1
    this.stores = options.stores ?? []
  }

  static requestToPromise<T = unknown>(request: IDBRequest<T>) {
    return new Promise<T>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
    })
  }

  static normalizeStoreNames(storeNames: string | string[]) {
    const names = Array.isArray(storeNames) ? storeNames : [storeNames]
    const uniqueNames = [...new Set(names.filter(Boolean))]

    if (!uniqueNames.length)
      throw new Error('Transaction requires at least one object store')

    return uniqueNames
  }

  static done(transaction: IDBTransaction) {
    return new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    })
  }

  static async run<T>({ database, storeNames, mode, action }: RunTransactionOptions<T>) {
    const names = IdbTransactionUtil.normalizeStoreNames(storeNames)
    const nameSet = new Set(names)
    const transaction = database.transaction(names, mode)
    const donePromise = IdbTransactionUtil.done(transaction)

    const context: IdbTransactionContext = {
      transaction,
      getStore(storeName: string) {
        if (!nameSet.has(storeName))
          throw new Error(`Store "${storeName}" is not part of current transaction`)
        return transaction.objectStore(storeName)
      },
    }

    try {
      const result = await action(context)
      await donePromise
      return result
    }
    catch (error) {
      try {
        transaction.abort()
      }
      catch {
      }

      await donePromise.catch(() => undefined)
      throw error
    }
  }

  private hasAllConfiguredStores(database: IDBDatabase) {
    return this.stores.every(storeDefinition => database.objectStoreNames.contains(storeDefinition.name))
  }

  private openWithVersion(targetVersion?: number) {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = typeof targetVersion === 'number'
        ? indexedDB.open(this.dbName, targetVersion)
        : indexedDB.open(this.dbName)

      request.onupgradeneeded = () => {
        const database = request.result

        for (const storeDefinition of this.stores) {
          const { name, options, indexes = [] } = storeDefinition
          const store = database.objectStoreNames.contains(name)
            ? request.transaction?.objectStore(name)
            : database.createObjectStore(name, options)

          if (!store)
            continue

          for (const index of indexes) {
            if (!store.indexNames.contains(index.name))
              store.createIndex(index.name, index.keyPath, index.options)
          }
        }
      }

      request.onsuccess = () => {
        const database = request.result
        database.onversionchange = () => {
          database.close()
        }
        resolve(database)
      }
      request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
      request.onblocked = () => reject(new Error('Open blocked by another open IndexedDB connection'))
    })
  }

  private async open() {
    if (typeof indexedDB === 'undefined')
      throw new Error('IndexedDB is not available in current environment')

    if (this.dbPromise)
      return this.dbPromise

    this.dbPromise = (async () => {
      let database: IDBDatabase

      try {
        database = await this.openWithVersion(this.version)
      }
      catch (error: unknown) {
        const isVersionError = error instanceof DOMException
          ? error.name === 'VersionError'
          : (typeof error === 'object' && error !== null && 'name' in error && (error as { name?: string }).name === 'VersionError')

        if (!isVersionError)
          throw error

        database = await this.openWithVersion()
      }

      let attempts = 0
      while (!this.hasAllConfiguredStores(database)) {
        if (attempts >= 10) {
          database.close()
          throw new Error(`Failed to ensure required object stores for DB "${this.dbName}" after multiple upgrade attempts`)
        }

        attempts += 1
        const nextVersion = database.version + 1
        database.close()

        try {
          database = await this.openWithVersion(nextVersion)
        }
        catch (error: unknown) {
          const isVersionError = error instanceof DOMException
            ? error.name === 'VersionError'
            : (typeof error === 'object' && error !== null && 'name' in error && (error as { name?: string }).name === 'VersionError')

          if (!isVersionError)
            throw error

          database = await this.openWithVersion()
        }
      }

      return database
    })().catch((error) => {
      this.dbPromise = null
      throw error
    })

    return this.dbPromise
  }

  async start(storeNames?: string | string[], mode: IDBTransactionMode = 'readwrite') {
    const database = await this.open()
    const names = storeNames
      ? IdbTransactionUtil.normalizeStoreNames(storeNames)
      : IdbTransactionUtil.normalizeStoreNames(this.stores.map(store => store.name))
    const nameSet = new Set(names)
    const transaction = database.transaction(names, mode)
    const donePromise = IdbTransactionUtil.done(transaction)

    this.activeContext = {
      transaction,
      getStore(storeName: string) {
        if (!nameSet.has(storeName))
          throw new Error(`Store "${storeName}" is not part of current transaction`)
        return transaction.objectStore(storeName)
      },
    }

    this.activeDone = donePromise.finally(() => {
      this.activeContext = null
      this.activeDone = null
    })

    return this.activeContext
  }

  commit() {
    if (!this.activeContext)
      throw new Error('No active transaction')

    this.activeContext.transaction.commit?.()
  }

  abort() {
    if (!this.activeContext)
      throw new Error('No active transaction')

    this.activeContext.transaction.abort()
  }

  current(): IdbTransactionContext {
    if (!this.activeContext)
      throw new Error('No active transaction')

    return this.activeContext
  }

  getCurrent(): IdbTransactionContext {
    return this.current()
  }

  done() {
    return this.activeDone
  }
}
