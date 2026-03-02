export class IdbTransactionUtil {
  /**
   * 数据库名称
   * @type {number}
   * @private
   * @readonly
   */
  private readonly dbName: string

  /**
   * 版本号
   * @type {number}
   * @private
   * @readonly
   */
  private readonly version: number

  /**
   * IndexedDB 存储定义集合
   * @readonly
   * @type {IdbStoreDefinition[]}
   * @description 用于定义和管理 IndexedDB 数据库中的多个对象存储空间的配置
   */
  private readonly stores: IdbStoreDefinition[]

  /**
   * 数据库实例的Promise对象
   * @description 缓存IDBDatabase的Promise,用于异步获取数据库连接,避免重复初始化
   * @type {Promise<IDBDatabase> | null}
   */
  private dbPromise: Promise<IDBDatabase> | null = null

  /**
   * 当前活跃的 IndexedDB 事务上下文
   * 用于跟踪和管理数据库事务的生命周期
   * @type {IdbTransactionContext | null}
   */
  private activeContext: IdbTransactionContext | null = null

  /**
   * 当前活跃的异步操作完成时的Promise对象
   * 用于跟踪和管理正在进行的事务操作
   * 当没有活跃操作时为null
   */
  private activeDone: Promise<void> | null = null

  /**
   * 初始化 IdbTransactionUtil 实例
   * @param options - 事务工具配置选项
   * @param options.dbName - IndexedDB 数据库名称
   * @param options.version - 数据库版本号，默认为 1
   * @param options.stores - 数据库存储对象配置数组，默认为空数组
   */
  constructor(options: IdbTransactionUtilOptions) {
    this.dbName = options.dbName
    this.version = options.version ?? 1
    this.stores = options.stores ?? []
  }

  /**
   * 将 IndexedDB 请求转换为 Promise
   * @template T - 请求结果的类型，默认为 unknown
   * @param request - IDBRequest 对象
   * @returns 返回一个 Promise，当请求成功时 resolve 结果数据，失败时 reject 错误信息
   */
  static requestToPromise<T = unknown>(request: IDBRequest<T>) {
    return new Promise<T>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
    })
  }

  /**
   * 规范化对象存储名称
   * @param storeNames - 单个存储名称或存储名称数组
   * @returns 去重后的存储名称数组
   * @throws {Error} 当没有提供任何有效的存储名称时抛出错误
   */
  static normalizeStoreNames(storeNames: string | string[]) {
    const names = Array.isArray(storeNames) ? storeNames : [storeNames]
    const uniqueNames = [...new Set(names.filter(Boolean))]

    if (!uniqueNames.length)
      throw new Error('Transaction requires at least one object store')

    return uniqueNames
  }

  /**
   * 将 IndexedDB 事务转换为 Promise
   * @param transaction - IndexedDB 事务对象
   * @returns 返回一个 Promise，当事务完成时 resolve，当事务中止或出错时 reject
   * @throws 当事务中止时，抛出事务错误或默认的中止错误信息
   * @throws 当事务执行失败时，抛出事务错误或默认的失败错误信息
   */
  static done(transaction: IDBTransaction) {
    return new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    })
  }

  /**
   * 在 IndexedDB 事务中运行异步操作
   * @template T - 操作返回值的类型
   * @param {RunTransactionOptions<T>} options - 事务配置选项
   * @param {IDBDatabase} options.database - IndexedDB 数据库实例
   * @param {string | string[]} options.storeNames - 事务涉及的对象存储名称，可以是单个名称或数组
   * @param {IDBTransactionMode} options.mode - 事务模式，'readonly' 或 'readwrite'
   * @param {(context: IdbTransactionContext) => Promise<T>} options.action - 在事务上下文中执行的异步操作函数
   * @returns {Promise<T>} 操作的执行结果
   * @throws {Error} 当访问未在事务中注册的对象存储时抛出错误，或当操作失败时抛出原始错误
   * @description
   * 该方法提供了一个安全的 IndexedDB 事务执行框架，确保：
   * 1. 事务正确初始化和清理
   * 2. 在操作成功时等待事务完成
   * 3. 在操作失败时自动回滚事务
   */
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

  /**
   * 检查数据库是否包含所有配置的对象存储及其索引
   *
   * @param database - IndexedDB 数据库实例
   * @returns 返回 true 如果所有配置的存储及其索引都存在，否则返回 false
   *
   * @remarks
   * 此方法验证数据库中的每个已配置存储是否存在，以及该存储中的所有索引是否都已创建。
   * 对于每个存储定义，它会：
   * 1. 检查对象存储是否存在于数据库中
   * 2. 创建只读事务访问该存储
   * 3. 验证该存储中的所有配置索引是否存在
   */
  private hasAllConfiguredStores(database: IDBDatabase) {
    return this.stores.every((storeDefinition) => {
      if (!database.objectStoreNames.contains(storeDefinition.name))
        return false

      const transaction = database.transaction(storeDefinition.name, 'readonly')
      const store = transaction.objectStore(storeDefinition.name)
      const indexes = storeDefinition.indexes ?? []

      return indexes.every(index => store.indexNames.contains(index.name))
    })
  }

  /**
   * 打开或创建 IndexedDB 数据库连接
   *
   * @param targetVersion - 可选的目标数据库版本号。如果指定，将以该版本打开数据库；
   *                        如果未指定，将以当前版本打开数据库
   *
   * @returns 返回一个 Promise，解析为打开的 IDBDatabase 实例
   *
   * @remarks
   * - 当数据库版本升级时，会自动创建或更新对象存储和索引
   * - 如果对象存储已存在，则跳过创建步骤
   * - 当出现版本变更时，会自动关闭数据库连接
   *
   * @throws 如果打开数据库失败，将拒绝并返回相应的错误信息或通用错误对象
   * @throws 如果有其他连接阻止了数据库的打开，将拒绝并返回阻塞错误
   */
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
        database.onversionchange = () => database.close()
        resolve(database)
      }
      request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
      request.onblocked = () => reject(new Error('Open blocked by another open IndexedDB connection'))
    })
  }

  /**
   * 打开或获取 IndexedDB 数据库连接
   *
   * 该方法负责初始化与 IndexedDB 的连接，并确保所有配置的对象存储都已创建。
   * 如果连接已经存在，则直接返回缓存的 Promise。
   *
   * @returns {Promise<IDBDatabase>} 返回一个 Promise，解析为打开的 IDBDatabase 实例
   *
   * @throws {Error} 当 IndexedDB 在当前环境中不可用时抛出
   * @throws {Error} 经过多次升级尝试后，如果仍未能创建所有必需的对象存储时抛出
   * @throws {Error} 在打开数据库过程中发生非版本相关的错误时抛出
   *
   * @remarks
   * - 首先尝试使用当前版本打开数据库
   * - 如果遇到版本错误，则尝试以最新版本打开
   * - 进入循环以确保所有配置的对象存储都已创建
   * - 最多尝试 10 次升级，超过此限制则关闭数据库并抛出错误
   * - 结果会被缓存在 `dbPromise` 中，避免重复连接
   */
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

  /**
   * 启动一个新的 IndexedDB 事务
   * @param storeNames - 可选的对象存储名称，可以是单个名称字符串或名称数组。如果不提供，将使用所有已注册的存储
   * @param mode - 事务模式，默认为 'readwrite'。可选值为 'readonly'、'readwrite'
   * @returns 返回活跃事务上下文对象，包含当前事务和获取特定存储的方法
   * @throws {Error} 当请求的存储不在当前事务中时抛出错误
   */
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

  /**
   * 提交当前活跃的事务
   * @throws {Error} 当没有活跃的事务上下文时抛出错误
   */
  commit() {
    if (!this.activeContext)
      throw new Error('No active transaction')

    this.activeContext.transaction.commit?.()
  }

  /**
   * 中止当前活跃的事务
   * @throws {Error} 当没有活跃的事务时抛出错误
   */
  abort() {
    if (!this.activeContext)
      throw new Error('No active transaction')

    this.activeContext.transaction.abort()
  }

  /**
   * 获取当前活跃的事务上下文
   * @returns {IdbTransactionContext} 当前活跃的事务上下文
   * @throws {Error} 当没有活跃的事务时抛出错误
   */
  current(): IdbTransactionContext {
    if (!this.activeContext)
      throw new Error('No active transaction')

    return this.activeContext
  }

  /**
   * 获取当前的 IDB 事务上下文
   * @returns {IdbTransactionContext} 当前的事务上下文对象
   */
  getCurrent(): IdbTransactionContext {
    return this.current()
  }

  /**
   * 获取事务是否已完成的状态
   * @returns {boolean} 返回事务的完成状态
   */
  done() {
    return this.activeDone
  }
}
