// import { createLogger, wrapAsyncApiWithLogger } from '~/utils/logger.util'

/**
 * IndexedDB存储中键值对配置的存储名称常量
 * @constant
 * @type {string}
 * @default 'kv_configs'
 */
export const KV_CONFIGS_STORE_NAME = 'kv_configs'

/**
 * 键值配置的键类型
 * 用于标识和访问键值存储中的配置项
 */
export type KvConfigKey = string

/**
 * 键值配置记录接口
 *
 * @interface KvConfigRecord
 * @property {KvConfigKey} id - 配置的唯一标识键
 * @property {unknown} value - 配置值，可以是任意类型
 * @property {number} updatedAt - 配置最后更新时间戳（毫秒）
 * @property {number} createdAt - 配置创建时间戳（毫秒）
 * @property {number} [deletedAt] - 配置删除时间戳（毫秒），可选字段
 */
export interface KvConfigRecord {
  id: KvConfigKey
  value: unknown
  updatedAt: number
  createdAt: number
  deletedAt?: number
}

/**
 * 创建键值配置的输入类型
 *
 * 基于 {@link KvConfigRecord} 类型，排除了 `id`、`createdAt` 和 `updatedAt` 字段，
 * 并重新定义以下字段：
 *
 * @typedef {object} CreateKvConfigInput
 * @property {KvConfigKey} id - 配置的唯一标识键
 * @property {number} [createdAt] - 创建时间戳（毫秒），可选
 * @property {number} [updatedAt] - 更新时间戳（毫秒），可选
 * @property {...} [其他属性] - 继承自 KvConfigRecord 的其他属性（除了 id、createdAt、updatedAt）
 */
export type CreateKvConfigInput = Omit<KvConfigRecord, 'id' | 'createdAt' | 'updatedAt'> & {
  id: KvConfigKey
  createdAt?: number
  updatedAt?: number
}

/**
 * 更新键值配置的输入类型
 *
 * 这是 {@link KvConfigRecord} 的部分类型，用于更新操作。
 * 除了 `id` 和 `createdAt` 字段外，所有字段都是可选的。
 *
 * @typedef {Partial<Omit<KvConfigRecord, 'id' | 'createdAt'>>} UpdateKvConfigInput
 */
export type UpdateKvConfigInput = Partial<Omit<KvConfigRecord, 'id' | 'createdAt'>>

/**
 * 键值配置架构的选项接口
 * @interface KvConfigsSchemaOptions
 * @property {string} [dbName] - 数据库名称（可选）
 * @property {number} [version] - 配置版本号（可选）
 */
export interface KvConfigsSchemaOptions {
  dbName?: string
  version?: number
}

/**
 * 键值配置存储定义
 *
 * 定义了 IndexedDB 中存储键值配置数据的对象仓库结构。
 *
 * @remarks
 * - 存储名称: {@link KV_CONFIGS_STORE_NAME}
 * - 主键路径: `id` 字段
 * - 包含一个按照 `updatedAt` 字段的索引，用于快速查询最近更新的配置
 *
 * @type {IdbStoreDefinition}
 */
const kvConfigsStoreDefinition: IdbStoreDefinition = {
  name: KV_CONFIGS_STORE_NAME,
  options: { keyPath: 'id' },
  indexes: [
    { name: 'updatedAt', keyPath: 'updatedAt' },
  ],
}

/**
 * 判断配置记录是否处于活跃状态
 * @param record - 键值配置记录对象
 * @returns 如果记录未被删除（deletedAt 不是数字类型），则返回 true；否则返回 false
 */
function isActiveConfig(record: KvConfigRecord) {
  return typeof record.deletedAt !== 'number'
}

/**
 * 过滤活跃的配置记录
 * @param records - 键值配置记录数组
 * @returns 返回过滤后的活跃配置记录数组
 */
function filterActiveConfigs(records: KvConfigRecord[]) {
  return records.filter(isActiveConfig)
}

export function kvConfigsSchema(options: KvConfigsSchemaOptions = {}) {
  const schemaLogger = createLogger('schema:kv_configs')

  /**
   * 初始化IndexedDB实例用于管理键值配置存储
   * @param {object} options - 配置选项
   * @param {string} [options.dbName='flow-dock-dev'] - 数据库名称，默认为'flow-dock-dev'
   * @param {number} [options.version=1] - 数据库版本号，默认为1
   * @param {Array} options.stores - 存储对象定义数组，包含kvConfigsStoreDefinition
   * @returns {object} IndexedDB实例，用于执行数据库操作
   */
  const idb = useIdb({
    dbName: options.dbName ?? 'flow-dock-dev',
    version: options.version ?? 1,
    stores: [kvConfigsStoreDefinition],
  })

  /**
   * 创建一个键值配置记录
   * @param input - 创建键值配置的输入参数
   * @returns 返回创建后的键值配置记录
   * @remarks 如果输入中未提供 createdAt 或 updatedAt，将使用当前时间戳
   */
  async function createConfig(input: CreateKvConfigInput): Promise<KvConfigRecord> {
    const now = Date.now()
    const record: KvConfigRecord = {
      ...input,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    }

    await idb.add(KV_CONFIGS_STORE_NAME, record)
    return record
  }

  /**
   * 从IndexedDB中获取指定键的配置记录
   * @param key - 配置的键名
   * @param includeDeleted - 是否包含已删除的配置，默认为false
   * @returns 返回匹配的KvConfigRecord记录，如果记录不存在或已被删除（当includeDeleted为false时）则返回undefined
   */
  async function getConfig(key: KvConfigKey, includeDeleted = false): Promise<KvConfigRecord | undefined> {
    const record = await idb.get<KvConfigRecord>(KV_CONFIGS_STORE_NAME, key)
    if (!includeDeleted && record && !isActiveConfig(record))
      return undefined

    return record
  }

  /**
   * 根据键获取配置值
   * @template T - 配置值的类型，默认为 unknown
   * @param key - 配置键
   * @param includeDeleted - 是否包含已删除的配置，默认为 false
   * @returns 返回指定类型的配置值，如果不存在则返回 undefined
   */
  async function getValue<T = unknown>(key: KvConfigKey, includeDeleted = false): Promise<T | undefined> {
    const record = await getConfig(key, includeDeleted)
    return record?.value as T | undefined
  }

  /**
   * 获取所有活跃的键值配置记录
   * @returns 返回按更新时间从新到旧排序的活跃配置记录数组
   * @remarks
   * - 从 IndexedDB 的 KV_CONFIGS_STORE_NAME 存储中检索所有配置
   * - 使用 filterActiveConfigs 过滤得到活跃的配置
   * - 结果按 updatedAt 字段降序排列（最新的在前）
   */
  async function listConfigs(): Promise<KvConfigRecord[]> {
    const records = await idb.getAll<KvConfigRecord>(KV_CONFIGS_STORE_NAME)
    return filterActiveConfigs(records).sort((a, b) => b.updatedAt - a.updatedAt)
  }

  /**
   * 更新键值配置记录
   * @param key - 配置的键名
   * @param patch - 包含要更新的字段的部分配置对象
   * @returns 返回更新后的完整配置记录，如果原记录不存在则返回 undefined
   * @remarks
   * 此函数会保留原记录的 id 和 createdAt 字段不变，
   * 如果 patch 中未指定 updatedAt，则自动设置为当前时间戳
   */
  async function updateConfig(key: KvConfigKey, patch: UpdateKvConfigInput): Promise<KvConfigRecord | undefined> {
    const current = await getConfig(key)
    if (!current)
      return undefined

    const updated: KvConfigRecord = {
      ...current,
      ...patch,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: patch.updatedAt ?? Date.now(),
    }

    await idb.put(KV_CONFIGS_STORE_NAME, updated)
    return updated
  }

  /**
   * 将键值配置记录插入或更新到数据库中
   * @param record - 要插入或更新的键值配置记录
   * @returns 返回包含时间戳的规范化配置记录
   * @remarks
   * 如果记录中不包含 `createdAt` 时间戳，则使用当前时间戳
   * 如果记录中不包含 `updatedAt` 时间戳，则使用当前时间戳
   */
  async function upsertConfig(record: KvConfigRecord): Promise<KvConfigRecord> {
    const now = Date.now()
    const normalized: KvConfigRecord = {
      ...record,
      createdAt: record.createdAt ?? now,
      updatedAt: record.updatedAt ?? now,
    }

    await idb.put(KV_CONFIGS_STORE_NAME, normalized)
    return normalized
  }

  /**
   * 设置键值配置的值
   * @template T - 配置值的类型，默认为 unknown
   * @param key - 配置的键名
   * @param value - 要设置的配置值
   * @returns 返回更新后的配置记录
   * @throws 当数据库操作失败时抛出异常
   * @remarks
   * - 如果键不存在，会创建新的配置记录，createdAt 为当前时间
   * - 如果键已存在，会保留原有的 createdAt，仅更新 updatedAt
   * - deletedAt 字段始终设为 undefined
   */
  async function setValue<T = unknown>(key: KvConfigKey, value: T): Promise<KvConfigRecord> {
    const current = await idb.get<KvConfigRecord>(KV_CONFIGS_STORE_NAME, key)
    const now = Date.now()

    const nextRecord: KvConfigRecord = {
      id: key,
      value,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
      deletedAt: undefined,
    }

    await idb.put(KV_CONFIGS_STORE_NAME, nextRecord)
    return nextRecord
  }

  /**
   * 软删除配置记录
   *
   * 将指定的配置记录标记为已删除，通过设置 `deletedAt` 时间戳来实现逻辑删除。
   * 同时更新 `updatedAt` 时间戳以记录最后修改时间。
   *
   * @param key - 配置的键名，用于唯一标识配置记录
   * @returns 返回更新后的配置记录，如果更新失败则返回 undefined
   */
  async function softDeleteConfig(key: KvConfigKey): Promise<KvConfigRecord | undefined> {
    return updateConfig(key, { deletedAt: Date.now(), updatedAt: Date.now() })
  }

  /**
   * 恢复已删除的配置
   * @param key - 配置的键名
   * @returns 返回更新后的配置记录，如果配置不存在则返回 undefined
   */
  async function restoreConfig(key: KvConfigKey): Promise<KvConfigRecord | undefined> {
    return updateConfig(key, { deletedAt: undefined, updatedAt: Date.now() })
  }

  /**
   * 从配置存储中移除指定的配置项
   * @param key - 要移除的配置项的键名
   * @returns 返回一个Promise，当配置项移除完成时resolve
   */
  async function removeConfig(key: KvConfigKey): Promise<void> {
    await idb.remove(KV_CONFIGS_STORE_NAME, key)
  }

  /**
   * 清除所有配置数据
   * @description 从 IndexedDB 的配置存储中删除所有键值对配置数据
   * @returns {Promise<void>} 返回一个 Promise，在清除操作完成时 resolve
   */
  async function clearConfigs(): Promise<void> {
    await idb.clear(KV_CONFIGS_STORE_NAME)
  }

  /**
   * 获取配置的总数量
   * @returns {Promise<number>} 返回包含配置总数的Promise对象
   */
  async function countConfigs(): Promise<number> {
    return idb.count(KV_CONFIGS_STORE_NAME)
  }

  /**
   * 按更新时间范围查询配置记录
   * @param startTs - 开始时间戳（毫秒），包含此值
   * @param endTs - 结束时间戳（毫秒），可选，包含此值。如果不提供，则查询从 startTs 到现在的所有记录
   * @returns 返回按更新时间从新到旧排序的活跃配置记录数组
   * @throws 当数据库查询失败时抛出错误
   */
  async function listByUpdatedAtRange(startTs: number, endTs?: number): Promise<KvConfigRecord[]> {
    const range = typeof endTs === 'number'
      ? IDBKeyRange.bound(startTs, endTs)
      : IDBKeyRange.lowerBound(startTs)

    return idb.withStore(KV_CONFIGS_STORE_NAME, 'readonly', (store) => {
      return new Promise<KvConfigRecord[]>((resolve, reject) => {
        const request = store.index('updatedAt').getAll(range)
        request.onsuccess = () => {
          const records = filterActiveConfigs(request.result as KvConfigRecord[])
          resolve(records.sort((a, b) => b.updatedAt - a.updatedAt))
        }
        request.onerror = () => reject(request.error ?? new Error('Query updatedAt failed'))
      })
    })
  }

  return wrapAsyncApiWithLogger(schemaLogger, {
    createConfig,
    getConfig,
    getValue,
    listConfigs,
    updateConfig,
    upsertConfig,
    setValue,
    softDeleteConfig,
    restoreConfig,
    removeConfig,
    clearConfigs,
    countConfigs,
    listByUpdatedAtRange,
  })
}

export const kv_configs = kvConfigsStoreDefinition
export const kv_configsSchema = kvConfigsSchema
