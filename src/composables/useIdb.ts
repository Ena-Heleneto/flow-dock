import { IdbTransactionUtil } from '../utils/transaction.util'
import type { IdbTransactionContext } from '../utils/transaction.util'

/**
 * IndexedDB 索引定义接口
 * 用于定义 IndexedDB 数据库中对象存储的索引配置
 *
 * @interface IdbIndexDefinition
 * @property {string} name - 索引的名称，用于唯一标识该索引
 * @property {string | string[]} keyPath - 索引的关键路径，可以是单个属性名或属性名数组（用于复合索引）
 * @property {IDBIndexParameters} [options] - 可选的 IndexedDB 索引参数配置，如 unique、multiEntry 等
 */
export interface IdbIndexDefinition {
  name: string
  keyPath: string | string[]
  options?: IDBIndexParameters
}

/**
 * IndexedDB 操作的配置选项
 * @interface UseIdbOptions
 * @property {string} dbName - 数据库名称，用于标识 IndexedDB 数据库
 * @property {number} [version] - 数据库版本号，可选参数，用于版本控制和迁移
 * @property {IdbStoreDefinition[]} [stores] - 对象存储定义数组，可选参数，用于初始化数据库中的存储空间
 */
export interface UseIdbOptions {
  dbName: string
  version?: number
  stores?: IdbStoreDefinition[]
}

export interface BeganIdbTransaction {
  context: IdbTransactionContext
  done: Promise<void>
}

export function useIdb(options: UseIdbOptions) {
  /**
   * 确保 IndexedDB 在当前环境中可用
   *
   * 如果当前环境不支持 IndexedDB，将抛出一个错误。
   * 这个函数应在使用 IndexedDB 功能前调用，以确保环境兼容性。
   *
   * @throws {Error} 当 IndexedDB 在当前环境中不可用时抛出错误
   *
   */
  function ensureIdbAvailable() {
    if (typeof indexedDB === 'undefined')
      throw new Error('IndexedDB is not available in current environment')
  }

  /**
   * 将 IndexedDB 请求转换为 Promise
   * @template T - 请求返回结果的类型，默认为 unknown
   * @param request - IndexedDB 请求对象
   * @returns 返回一个 Promise，成功时解析为请求的结果，失败时拒绝并返回错误信息
   * @throws 当 IndexedDB 请求失败时抛出错误
   */
  function requestToPromise<T = unknown>(request: IDBRequest<T>) {
    return new Promise<T>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
    })
  }

  /**
   * IndexedDB 配置选项
   * @typedef {object} IdbOptions
   * @property {string} dbName - IndexedDB 数据库名称
   * @property {number} [version=1] - 数据库版本号，默认为 1
   * @property {Array} [stores=[]] - 对象存储空间配置数组，默认为空数组
   */
  const { dbName, version = 1, stores = [] } = options

  function hasAllConfiguredStores(database: IDBDatabase) {
    return stores.every(storeDefinition => database.objectStoreNames.contains(storeDefinition.name))
  }

  function openWithVersion(targetVersion?: number) {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = typeof targetVersion === 'number'
        ? indexedDB.open(dbName, targetVersion)
        : indexedDB.open(dbName)

      request.onupgradeneeded = () => {
        const database = request.result

        for (const storeDefinition of stores) {
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

  /**
   * IDB 数据库连接的 Promise 对象
   * 用于缓存数据库连接，避免重复创建
   * @type {Promise<IDBDatabase> | null}
   */
  let dbPromise: Promise<IDBDatabase> | null = null

  /**
   * 打开 IndexedDB 数据库连接
   * @returns {Promise<IDBDatabase>} 返回打开的 IndexedDB 数据库实例的 Promise
   * @throws {Error} 当 IndexedDB 不可用或打开失败时抛出错误
   *
   * @description
   * 该函数用于建立与 IndexedDB 的连接。如果数据库已经打开，则直接返回现有的 Promise。
   * 否则创建新的 Promise 来处理数据库打开过程。
   *
   * 在数据库升级时（`onupgradeneeded`），会根据预定义的存储配置创建对象存储和索引。
   * 如果对象存储已存在则复用，否则创建新的对象存储，并为其创建所有必要的索引。
   *
   */
  function open() {
    ensureIdbAvailable()
    if (dbPromise)
      return dbPromise

    dbPromise = (async () => {
      let database: IDBDatabase
      try {
        database = await openWithVersion(version)
      }
      catch (error: unknown) {
        const isVersionError = error instanceof DOMException
          ? error.name === 'VersionError'
          : (typeof error === 'object' && error !== null && 'name' in error && (error as { name?: string }).name === 'VersionError')

        if (!isVersionError)
          throw error

        database = await openWithVersion()
      }

      let attempts = 0
      while (!hasAllConfiguredStores(database)) {
        if (attempts >= 10) {
          database.close()
          throw new Error(`Failed to ensure required object stores for DB "${dbName}" after multiple upgrade attempts`)
        }

        attempts += 1
        const nextVersion = database.version + 1
        database.close()

        try {
          database = await openWithVersion(nextVersion)
        }
        catch (error: unknown) {
          const isVersionError = error instanceof DOMException
            ? error.name === 'VersionError'
            : (typeof error === 'object' && error !== null && 'name' in error && (error as { name?: string }).name === 'VersionError')

          if (!isVersionError)
            throw error

          database = await openWithVersion()
        }
      }

      return database
    })().catch((error) => {
      dbPromise = null
      throw error
    })

    return dbPromise
  }

  /**
   * 在指定的对象存储中执行一个操作
   * @template T - 操作返回值的类型
   * @param storeName - 对象存储的名称
   * @param mode - 事务模式，可为 'readonly' 或 'readwrite'
   * @param action - 在对象存储上执行的异步或同步操作函数
   * @returns 返回操作函数执行的结果
   * @throws 如果数据库打开失败或事务执行失败，将抛出错误
   */
  async function withStore<T>(
    storeName: string,
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => T | Promise<T>,
  ) {
    return transaction(storeName, mode, ({ getStore }) => action(getStore(storeName)))
  }

  /**
   * 在一个 IndexedDB 事务中执行多步操作
   *
   * @template T - 事务回调返回值类型
   * @param storeNames - 参与事务的对象存储名称（可单个或多个）
   * @param mode - 事务模式，可为 'readonly' 或 'readwrite'
   * @param action - 事务回调，可通过 getStore 获取已声明 store
   * @returns 返回事务回调结果，且仅在事务成功完成后 resolve
   * @throws 当回调抛错、事务中止或事务失败时抛出错误
   */
  async function transaction<T>(
    storeNames: string | string[],
    mode: IDBTransactionMode,
    action: (context: IdbTransactionContext) => T | Promise<T>,
  ) {
    const database = await open()
    return await IdbTransactionUtil.run({ database, storeNames, mode, action })
  }

  async function beginTransaction(
    storeNames: string | string[],
    mode: IDBTransactionMode,
  ): Promise<BeganIdbTransaction> {
    const database = await open()
    const names = IdbTransactionUtil.normalizeStoreNames(storeNames)
    const nameSet = new Set(names)
    const transaction = database.transaction(names, mode)

    return {
      context: {
        transaction,
        getStore(storeName: string) {
          if (!nameSet.has(storeName))
            throw new Error(`Store "${storeName}" is not part of current transaction`)
          return transaction.objectStore(storeName)
        },
      },
      done: IdbTransactionUtil.done(transaction),
    }
  }

  /**
   * 从 IndexedDB 存储中获取指定键的值
   * @template T - 返回值的类型，默认为 unknown
   * @param storeName - 要访问的对象存储的名称
   * @param key - 要检索的数据的键
   * @returns 返回一个 Promise，解析为类型 T 的值，如果键不存在则为 undefined
   */
  async function get<T = unknown>(storeName: string, key: IDBValidKey) {
    return withStore(storeName, 'readonly', store => requestToPromise<T | undefined>(store.get(key)))
  }

  /**
   * 从指定的对象存储中获取所有匹配的记录
   * @template T - 返回的记录类型，默认为 unknown
   * @param {string} storeName - 对象存储的名称
   * @param {IDBValidKey | IDBKeyRange | null} [query] - 可选的查询条件，可以是具体的键值或键范围
   * @returns {Promise<T[]>} 返回匹配查询条件的所有记录的数组
   */
  async function getAll<T = unknown>(storeName: string, query?: IDBValidKey | IDBKeyRange | null) {
    return withStore(storeName, 'readonly', store => requestToPromise<T[]>(store.getAll(query)))
  }

  /**
   * 将数据存储到指定的 IndexedDB 对象仓库中
   * @template T - 存储值的类型，默认为 unknown
   * @param storeName - 对象仓库的名称
   * @param value - 要存储的数据值
   * @param key - 可选的键值，如果不提供则使用对象仓库的键路径
   * @returns 返回一个 Promise，解析为插入或更新的键值
   */
  async function put<T = unknown>(storeName: string, value: T, key?: IDBValidKey) {
    return withStore(storeName, 'readwrite', store => requestToPromise<IDBValidKey>(store.put(value, key)))
  }

  /**
   * 向指定的对象存储中添加一个新项。
   * @template T - 要添加的值的类型，默认为 unknown
   * @param {string} storeName - 对象存储的名称
   * @param {T} value - 要添加到存储中的值
   * @param {IDBValidKey} [key] - 可选的键值。如果未提供，则使用对象存储定义的键路径
   * @returns {Promise<IDBValidKey>} 返回一个 Promise，解析为新添加项的键值
   * @throws {DOMException} 如果操作失败（例如约束冲突、配额超限等）
   */
  async function add<T = unknown>(storeName: string, value: T, key?: IDBValidKey) {
    return withStore(storeName, 'readwrite', store => requestToPromise<IDBValidKey>(store.add(value, key)))
  }

  /**
   * 从指定的对象存储中删除指定键的数据
   * @param storeName - 对象存储的名称
   * @param key - 要删除的数据的键值
   * @returns 返回一个 Promise，操作完成时 resolve
   */
  async function remove(storeName: string, key: IDBValidKey) {
    return withStore(storeName, 'readwrite', store => requestToPromise(store.delete(key)))
  }

  /**
   * 清空指定对象存储中的所有数据
   * @param storeName - IndexedDB 对象存储的名称
   * @returns 返回一个 Promise，在清空操作完成时 resolve
   */
  async function clear(storeName: string) {
    return withStore(storeName, 'readwrite', store => requestToPromise(store.clear()))
  }

  /**
   * 获取指定对象存储中符合条件的记录数量
   * @param storeName - 对象存储的名称
   * @param query - 可选的查询条件，可以是 IDB 有效键或键范围
   * @returns 返回一个 Promise，解析为记录的数量
   */
  async function count(storeName: string, query?: IDBValidKey | IDBKeyRange) {
    return withStore(storeName, 'readonly', store => requestToPromise<number>(store.count(query)))
  }

  /**
   * 关闭 IndexedDB 数据库连接
   *
   * 该函数会打开数据库连接，然后立即关闭它，并清空数据库 Promise 的缓存。
   * 调用此函数后，下次访问数据库需要重新初始化连接。
   *
   * @returns {Promise<void>}
   */
  async function close() {
    const database = await open()
    database.close()
    dbPromise = null
  }

  /**
   * 删除 IndexedDB 数据库
   *
   * 该函数会先关闭当前数据库连接，然后删除指定名称的 IndexedDB 数据库。
   * 如果删除过程中被其他打开的连接阻止，将抛出错误。
   *
   * @async
   * @function deleteDatabase
   * @returns {Promise<void>} 删除成功时返回 resolved Promise，失败时返回 rejected Promise
   * @throws {Error} 当数据库删除失败或被其他连接阻止时抛出错误
   *
   */
  async function deleteDatabase() {
    await close()
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error ?? new Error('Failed to delete IndexedDB database'))
      request.onblocked = () => reject(new Error('Delete blocked by another open connection'))
    })
  }

  return { open, close, deleteDatabase, withStore, transaction, beginTransaction, get, getAll, put, add, remove, clear, count }
}
