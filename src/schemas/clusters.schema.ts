/**
 * 集群存储的名称常量
 * @constant
 * @type {string}
 * @default 'clusters'
 */
export const CLUSTERS_STORE_NAME = 'clusters'

/**
 * 集群的唯一标识符
 * @typedef {string} ClusterId
 */
export type ClusterId = string

/**
 * 集群记录接口
 * @interface ClusterRecord
 * @property {ClusterId} id - 集群唯一标识符
 * @property {number} ts - 时间戳，表示集群创建或更新时间
 * @property {string} signature - 集群的签名，用于验证集群完整性
 * @property {string} [name] - 集群名称，可选
 * @property {number} componentCount - 集群中包含的组件数量
 * @property {number} bundleCount - 集群中包含的包数量
 * @property {number} pageCount - 集群中包含的页面数量
 * @property {string} [representativePageId] - 代表性页面的ID，可选
 * @property {string} [representativeScreenshotId] - 代表性页面的截图ID，可选
 * @property {number} [exportedAt] - 集群导出时间戳，可选
 * @property {number} [deletedAt] - 集群删除时间戳，可选
 */
export interface ClusterRecord {
  id: ClusterId
  ts: number
  signature: string
  name?: string
  componentCount: number
  bundleCount: number
  pageCount: number
  representativePageId?: string
  representativeScreenshotId?: string
  exportedAt?: number
  deletedAt?: number
}

/**
 * 创建集群的输入类型
 *
 * 基于 {@link ClusterRecord} 类型，移除了必填的 id、ts、componentCount、bundleCount 和 pageCount 字段，
 * 并将它们设置为可选字段。
 *
 * @typedef {object} CreateClusterInput
 * @property {ClusterId} [id] - 集群的唯一标识符（可选）
 * @property {number} [ts] - 时间戳（可选）
 * @property {number} [componentCount] - 组件数量（可选）
 * @property {number} [bundleCount] - 包数量（可选）
 * @property {number} [pageCount] - 页面数量（可选）
 */
export type CreateClusterInput = Omit<ClusterRecord, 'id' | 'ts' | 'componentCount' | 'bundleCount' | 'pageCount'> & {
  id?: ClusterId
  ts?: number
  componentCount?: number
  bundleCount?: number
  pageCount?: number
}

/**
 * 集群更新输入类型
 *
 * 用于更新集群信息的输入数据类型。
 * 包含 ClusterRecord 中除 id 外的所有字段，且所有字段都是可选的。
 *
 * @typedef {object} UpdateClusterInput
 * @property {string} [name] - 集群名称（可选）
 */
export type UpdateClusterInput = Partial<Omit<ClusterRecord, 'id'>>

/**
 * 集群模式选项配置接口
 * @interface ClustersSchemaOptions
 * @property {string} [dbName] - 数据库名称，可选参数
 * @property {number} [version] - 版本号，可选参数
 */
export interface ClustersSchemaOptions {
  dbName?: string
  version?: number
}

/**
 * 集群存储定义
 * @description 定义IndexedDB中集群数据的存储结构和索引配置
 * @property {string} name - 存储名称，值为CLUSTERS_STORE_NAME常量
 * @property {object} options - 存储配置选项
 * @property {string} options.keyPath - 主键路径，使用'id'作为主键
 * @property {Array<object>} indexes - 索引数组配置
 * @property {string} indexes[].name - 索引名称
 * @property {string} indexes[].keyPath - 索引对应的字段路径
 * @property {object} indexes[].options - 索引选项
 * @property {boolean} [indexes[].options.unique] - 索引是否唯一
 */
const clustersStoreDefinition: IdbStoreDefinition = {
  name: CLUSTERS_STORE_NAME,
  options: { keyPath: 'id' },
  indexes: [
    { name: 'signature', keyPath: 'signature', options: { unique: true } },
    { name: 'ts', keyPath: 'ts' },
    { name: 'representativePageId', keyPath: 'representativePageId' },
    { name: 'representativeScreenshotId', keyPath: 'representativeScreenshotId' },
    { name: 'exportedAt', keyPath: 'exportedAt' },
  ],
}

/**
 * 生成一个唯一的集群ID。
 *
 * 优先使用原生的 `crypto.randomUUID()` 方法生成标准的 UUID v4 格式的ID。
 * 如果运行环境不支持该方法（如某些旧版Node.js或浏览器环境），
 * 则降级使用时间戳和随机数的组合作为备选方案。
 *
 * @returns {ClusterId} 生成的唯一集群ID
 */
function createClusterId(): ClusterId {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return crypto.randomUUID()

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * 检查集群记录是否处于活跃状态
 * @param record - 集群记录对象
 * @returns 如果集群未被删除则返回 true，否则返回 false
 */
function isActiveCluster(record: ClusterRecord) {
  return typeof record.deletedAt !== 'number'
}

/**
 * 过滤活跃的集群记录
 * @param records - 集群记录数组
 * @returns 包含所有活跃集群的过滤后的数组
 */
function filterActiveClusters(records: ClusterRecord[]) {
  return records.filter(isActiveCluster)
}

export function clustersSchema(options: ClustersSchemaOptions = {}) {
  /**
   * 初始化 IndexedDB 数据库实例
   * @param {object} options - 配置选项
   * @param {string} [options.dbName='flow-dock'] - 数据库名称，默认为 'flow-dock'
   * @param {number} [options.version=1] - 数据库版本号，默认为 1
   * @param {Array} options.stores - 数据库存储对象定义数组，包含集群相关的存储定义
   * @returns {IDB} IndexedDB 数据库实例对象，用于后续的数据库操作
   */
  const idb = useIdb({
    dbName: options.dbName ?? 'flow-dock',
    version: options.version ?? 1,
    stores: [clustersStoreDefinition],
  })

  /**
   * 创建一个新的集群记录
   * @param input - 创建集群所需的输入参数
   * @param input.id - 集群的唯一标识符，如果未提供则自动生成
   * @param input.ts - 集群的时间戳，如果未提供则使用当前时间
   * @param input.componentCount - 集群中的组件数量，默认为0
   * @param input.bundleCount - 集群中的包数量，默认为0
   * @param input.pageCount - 集群中的页面数量，默认为0
   * @returns Promise<ClusterRecord> - 返回创建后的集群记录对象
   */
  async function createCluster(input: CreateClusterInput): Promise<ClusterRecord> {
    const record: ClusterRecord = {
      ...input,
      id: input.id ?? createClusterId(),
      ts: input.ts ?? Date.now(),
      componentCount: input.componentCount ?? 0,
      bundleCount: input.bundleCount ?? 0,
      pageCount: input.pageCount ?? 0,
    }

    await idb.add(CLUSTERS_STORE_NAME, record)
    return record
  }

  /**
   * 获取集群记录
   * @param id - 集群ID
   * @param includeDeleted - 是否包含已删除的集群，默认为false
   * @returns 返回集群记录，如果集群不存在或已删除（当includeDeleted为false时）则返回undefined
   */
  async function getCluster(id: ClusterId, includeDeleted = false): Promise<ClusterRecord | undefined> {
    const record = await idb.get<ClusterRecord>(CLUSTERS_STORE_NAME, id)
    if (!includeDeleted && record && !isActiveCluster(record))
      return undefined

    return record
  }

  /**
   * 获取所有活跃的集群记录列表
   * @returns 返回按时间戳倒序排列的活跃集群记录数组
   * @throws 如果数据库查询失败，会抛出异常
   */
  async function listClusters(): Promise<ClusterRecord[]> {
    const records = await idb.getAll<ClusterRecord>(CLUSTERS_STORE_NAME)
    return filterActiveClusters(records).sort((a, b) => b.ts - a.ts)
  }

  /**
   * 更新集群记录
   * @param id - 集群ID
   * @param patch - 集群更新数据
   * @returns 更新后的集群记录，如果集群不存在则返回 undefined
   */
  async function updateCluster(id: ClusterId, patch: UpdateClusterInput): Promise<ClusterRecord | undefined> {
    const current = await getCluster(id)
    if (!current)
      return undefined

    const updated: ClusterRecord = {
      ...current,
      ...patch,
      id: current.id,
      ts: patch.ts ?? Date.now(),
    }

    await idb.put(CLUSTERS_STORE_NAME, updated)
    return updated
  }

  /**
   * 插入或更新集群记录
   * @param record - 要插入或更新的集群记录
   * @returns 规范化后的集群记录
   * @remarks
   * 此函数会对传入的记录进行规范化处理：
   * - 如果未提供 id，则自动生成一个新的集群 ID
   * - 如果未提供 ts，则使用当前时间戳
   * - 如果未提供 componentCount、bundleCount 或 pageCount，则默认设置为 0
   * 然后将规范化后的记录存储到 IndexedDB 中
   */
  async function upsertCluster(record: ClusterRecord): Promise<ClusterRecord> {
    const normalized: ClusterRecord = {
      ...record,
      id: record.id ?? createClusterId(),
      ts: record.ts ?? Date.now(),
      componentCount: record.componentCount ?? 0,
      bundleCount: record.bundleCount ?? 0,
      pageCount: record.pageCount ?? 0,
    }

    await idb.put(CLUSTERS_STORE_NAME, normalized)
    return normalized
  }

  /**
   * 软删除集群记录
   *
   * 通过设置 deletedAt 和 ts 时间戳来标记集群为已删除状态，而不是物理删除数据。
   *
   * @param id - 集群的唯一标识符
   * @returns 返回更新后的集群记录，如果更新失败则返回 undefined
   */
  async function softDeleteCluster(id: ClusterId): Promise<ClusterRecord | undefined> {
    return updateCluster(id, { deletedAt: Date.now(), ts: Date.now() })
  }

  /**
   * 恢复已删除的集群
   * @param id - 集群ID
   * @returns 返回更新后的集群记录，如果集群不存在则返回 undefined
   */
  async function restoreCluster(id: ClusterId): Promise<ClusterRecord | undefined> {
    return updateCluster(id, { deletedAt: undefined, ts: Date.now() })
  }

  /**
   * 从数据库中删除指定的集群
   * @param id - 要删除的集群ID
   * @returns 返回一个Promise，当集群删除完成时resolve
   */
  async function removeCluster(id: ClusterId): Promise<void> {
    await idb.remove(CLUSTERS_STORE_NAME, id)
  }

  /**
   * 清空集群存储中的所有数据
   * @returns 返回一个在清空操作完成时解决的Promise
   */
  async function clearClusters(): Promise<void> {
    await idb.clear(CLUSTERS_STORE_NAME)
  }

  /**
   * 获取集群总数
   * @returns {Promise<number>} 返回集群的总数量
   */
  async function countClusters(): Promise<number> {
    return idb.count(CLUSTERS_STORE_NAME)
  }

  /**
   * 根据签名查询集群记录
   * @param signature - 集群的签名标识
   * @returns 返回按时间戳倒序排列的活跃集群记录数组
   * @throws 当查询失败时抛出错误
   */
  async function listBySignature(signature: string): Promise<ClusterRecord[]> {
    return idb.withStore(CLUSTERS_STORE_NAME, 'readonly', (store) => {
      return new Promise<ClusterRecord[]>((resolve, reject) => {
        const request = store.index('signature').getAll(signature)
        request.onsuccess = () => {
          const records = filterActiveClusters(request.result as ClusterRecord[])
          resolve(records.sort((a, b) => b.ts - a.ts))
        }
        request.onerror = () => reject(request.error ?? new Error('Query signature failed'))
      })
    })
  }

  /**
   * 根据签名获取集群记录
   * @param signature - 集群的签名标识
   * @returns 返回匹配的第一个集群记录，如果不存在则返回 undefined
   */
  async function getBySignature(signature: string): Promise<ClusterRecord | undefined> {
    const matched = await listBySignature(signature)
    return matched[0]
  }

  /**
   * 根据时间戳范围查询集群记录
   * @param startTs - 开始时间戳（毫秒），必需
   * @param endTs - 结束时间戳（毫秒），可选。如果不提供，则查询从 startTs 开始的所有记录
   * @returns 返回按时间戳倒序排列的活跃集群记录数组
   * @throws 当数据库查询失败时抛出错误
   */
  async function listByTsRange(startTs: number, endTs?: number): Promise<ClusterRecord[]> {
    const range = typeof endTs === 'number'
      ? IDBKeyRange.bound(startTs, endTs)
      : IDBKeyRange.lowerBound(startTs)

    return idb.withStore(CLUSTERS_STORE_NAME, 'readonly', (store) => {
      return new Promise<ClusterRecord[]>((resolve, reject) => {
        const request = store.index('ts').getAll(range)
        request.onsuccess = () => {
          const records = filterActiveClusters(request.result as ClusterRecord[])
          resolve(records.sort((a, b) => b.ts - a.ts))
        }
        request.onerror = () => reject(request.error ?? new Error('Query ts failed'))
      })
    })
  }

  /**
   * 标记集群为已导出状态
   * @param id - 集群ID
   * @returns 返回更新后的集群记录，如果集群不存在则返回undefined
   */
  async function markExported(id: ClusterId): Promise<ClusterRecord | undefined> {
    return updateCluster(id, { exportedAt: Date.now(), ts: Date.now() })
  }

  return {
    createCluster,
    getCluster,
    listClusters,
    updateCluster,
    upsertCluster,
    softDeleteCluster,
    restoreCluster,
    removeCluster,
    clearClusters,
    countClusters,
    listBySignature,
    getBySignature,
    listByTsRange,
    markExported,
  }
}

export const clusters = clustersStoreDefinition
export const clusterSchema = clustersSchema
