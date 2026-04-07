/**
 * 集群链接存储的名称常量
 * 用于标识集群链接数据在存储中的键名
 */
export const CLUSTER_LINKS_STORE_NAME = 'cluster_links'

/**
 * 集群链接的唯一标识符
 * @typedef {string} ClusterLinkId
 */
export type ClusterLinkId = string

/**
 * 集群实体类型
 * @typedef {string} ClusterEntityType
 * @description 表示流程中支持的集群实体类型
 */
export type ClusterEntityType = 'page' | 'component' | 'bundle' | 'screenshot'

/**
 * 集群链接记录接口
 *
 * @interface ClusterLinkRecord
 * @description 表示集群中实体之间的链接关系
 *
 * @property {ClusterLinkId} id - 链接的唯一标识符
 * @property {string} clusterId - 所属集群的ID
 * @property {ClusterEntityType} entityType - 实体类型
 * @property {string} entityId - 实体的唯一标识符
 * @property {string} [role] - 可选，实体在链接中的角色
 * @property {number} [score] - 可选，链接的评分或权重
 * @property {string} [sourcePageId] - 可选，链接的来源页面ID
 * @property {number} ts - 链接创建或更新的时间戳（毫秒）
 * @property {number} [deletedAt] - 可选，链接删除的时间戳（毫秒），若未设置则表示链接未被删除
 */
export interface ClusterLinkRecord {
  id: ClusterLinkId
  clusterId: string
  entityType: ClusterEntityType
  entityId: string
  role?: string
  score?: number
  sourcePageId?: string
  ts: number
  deletedAt?: number
}

/**
 * 创建集群链接的输入类型
 *
 * 基于 {@link ClusterLinkRecord} 类型，排除了 `id` 和 `ts` 字段，
 * 并将它们设置为可选字段。
 *
 * @typedef {object} CreateClusterLinkInput
 * @property {ClusterLinkId} [id] - 集群链接的唯一标识符，可选
 * @property {number} [ts] - 时间戳，可选
 */
export type CreateClusterLinkInput = Omit<ClusterLinkRecord, 'id' | 'ts'> & {
  id?: ClusterLinkId
  ts?: number
}

/**
 * 更新集群链接的输入类型
 *
 * 该类型继承自 {@link ClusterLinkRecord} 的部分属性，排除了 'id'、'clusterId'、'entityType' 和 'entityId' 字段。
 * 用于在更新集群链接时提供输入数据，只允许修改指定的可选字段。
 *
 * @typedef {Partial<Omit<ClusterLinkRecord, 'id' | 'clusterId' | 'entityType' | 'entityId'>>} UpdateClusterLinkInput
 */
export type UpdateClusterLinkInput = Partial<Omit<ClusterLinkRecord, 'id' | 'clusterId' | 'entityType' | 'entityId'>>

/**
 * 集群链接模式配置选项接口
 * @interface ClusterLinksSchemaOptions
 * @property {string} [dbName] - 数据库名称，可选参数
 * @property {number} [version] - 模式版本号，可选参数
 */
export interface ClusterLinksSchemaOptions {
  dbName?: string
  version?: number
}

/**
 * IndexedDB 存储定义，用于管理集群链接数据
 *
 * @typedef {IdbStoreDefinition} clusterLinksStoreDefinition
 * @property {string} name - 存储区名称
 * @property {IDBObjectStoreParameters} options - 存储区选项，指定 'id' 作为主键
 * @property {Array<IdbIndexDefinition>} indexes - 索引定义数组
 *
 * @description
 * 定义了集群链接存储的以下索引：
 * - clusterId: 用于按集群 ID 查询
 * - entityType: 用于按实体类型查询
 * - entityId: 用于按实体 ID 查询
 * - clusterEntity: 复合索引，按集群 ID 和实体类型联合查询
 * - entityLookup: 复合唯一索引，按实体类型和实体 ID 联合查询，确保不重复
 * - ts: 用于按时间戳查询
 */
const clusterLinksStoreDefinition: IdbStoreDefinition = {
  name: CLUSTER_LINKS_STORE_NAME,
  options: { keyPath: 'id' },
  indexes: [
    { name: 'clusterId', keyPath: 'clusterId' },
    { name: 'entityType', keyPath: 'entityType' },
    { name: 'entityId', keyPath: 'entityId' },
    { name: 'clusterEntity', keyPath: ['clusterId', 'entityType'] },
    { name: 'entityLookup', keyPath: ['entityType', 'entityId'], options: { unique: true } },
    { name: 'ts', keyPath: 'ts' },
  ],
}

/**
 * 创建集群链接ID
 * @param clusterId - 集群ID
 * @param entityType - 集群实体类型
 * @param entityId - 实体ID
 * @returns 格式为 `clusterId|entityType|entityId` 的集群链接ID
 */
function createLinkId(clusterId: string, entityType: ClusterEntityType, entityId: string): ClusterLinkId {
  return `${clusterId}|${entityType}|${entityId}`
}

/**
 * 检查集群链接记录是否为活跃状态
 * @param record - 集群链接记录对象
 * @returns 如果记录的 deletedAt 属性不是数字类型，则返回 true（表示该链接未被删除），否则返回 false
 */
function isActiveLink(record: ClusterLinkRecord) {
  return typeof record.deletedAt !== 'number'
}

/**
 * 过滤活跃的集群链接记录
 * @param records - 集群链接记录数组
 * @returns 包含活跃链接的记录数组
 */
function filterActiveLinks(records: ClusterLinkRecord[]) {
  return records.filter(isActiveLink)
}

export function clusterLinksSchema(options: ClusterLinksSchemaOptions = {}) {
  /**
   * 初始化 IndexedDB 实例
   * @description 使用 useIdb 钩子创建一个 IndexedDB 数据库连接，用于存储集群链接数据
   * @param {object} options - 配置选项
   * @param {string} [options.dbName='flow-dock-dev'] - 数据库名称，默认为 'flow-dock-dev'
   * @param {number} [options.version=1] - 数据库版本号，默认为 1
   * @param {Array} options.stores - 数据库存储配置，包含 clusterLinksStoreDefinition
   * @returns {IDBDatabase} IndexedDB 数据库实例
   */
  const idb = useIdb({
    dbName: options.dbName ?? 'flow-dock-dev',
    version: options.version ?? 1,
    stores: [clusterLinksStoreDefinition],
  })

  /**
   * 创建集群链接记录
   * @param input - 创建集群链接的输入参数
   * @param input.id - 可选的链接ID，如果未提供则自动生成
   * @param input.clusterId - 集群ID
   * @param input.entityType - 实体类型
   * @param input.entityId - 实体ID
   * @param input.ts - 可选的时间戳，如果未提供则使用当前时间
   * @returns 返回创建成功的集群链接记录
   * @throws 如果数据库操作失败可能抛出异常
   */
  async function createClusterLink(input: CreateClusterLinkInput): Promise<ClusterLinkRecord> {
    const record: ClusterLinkRecord = {
      ...input,
      id: input.id ?? createLinkId(input.clusterId, input.entityType, input.entityId),
      ts: input.ts ?? Date.now(),
    }

    await idb.add(CLUSTER_LINKS_STORE_NAME, record)
    return record
  }

  /**
   * 获取集群链接记录
   * @param id - 集群链接的唯一标识符
   * @param includeDeleted - 是否包含已删除的链接，默认为 false
   * @returns 返回集群链接记录，如果不存在或被删除则返回 undefined
   */
  async function getClusterLink(id: ClusterLinkId, includeDeleted = false): Promise<ClusterLinkRecord | undefined> {
    const record = await idb.get<ClusterLinkRecord>(CLUSTER_LINKS_STORE_NAME, id)
    if (!includeDeleted && record && !isActiveLink(record))
      return undefined

    return record
  }

  /**
   * 根据实体类型和实体ID查询集群链接记录
   * @param entityType - 集群实体类型
   * @param entityId - 实体ID
   * @param includeDeleted - 是否包含已删除的记录，默认为false
   * @returns 返回匹配的集群链接记录，如果不存在或被过滤则返回undefined
   * @throws 当数据库查询失败时抛出错误
   */
  async function getByEntity(entityType: ClusterEntityType, entityId: string, includeDeleted = false): Promise<ClusterLinkRecord | undefined> {
    return idb.withStore(CLUSTER_LINKS_STORE_NAME, 'readonly', (store) => {
      return new Promise<ClusterLinkRecord | undefined>((resolve, reject) => {
        const request = store.index('entityLookup').get([entityType, entityId])
        request.onsuccess = () => {
          const record = request.result as ClusterLinkRecord | undefined
          if (!includeDeleted && record && !isActiveLink(record)) {
            resolve(undefined)
            return
          }
          resolve(record)
        }
        request.onerror = () => reject(request.error ?? new Error('Query entityLookup failed'))
      })
    })
  }

  /**
   * 获取所有活跃的集群链接记录
   * @returns 按时间戳降序排列的活跃集群链接记录数组
   */
  async function listClusterLinks(): Promise<ClusterLinkRecord[]> {
    const records = await idb.getAll<ClusterLinkRecord>(CLUSTER_LINKS_STORE_NAME)
    return filterActiveLinks(records).sort((a, b) => b.ts - a.ts)
  }

  /**
   * 更新集群链接记录
   * @param id - 集群链接的唯一标识符
   * @param patch - 包含要更新的字段的更新输入对象
   * @returns 返回更新后的集群链接记录，如果记录不存在则返回 undefined
   * @remarks
   * 此函数会保留原始记录中的不可变字段（id、clusterId、entityType、entityId），
   * 只允许更新其他字段。如果 patch 中未提供 ts 字段，则会自动设置为当前时间戳。
   */
  async function updateClusterLink(id: ClusterLinkId, patch: UpdateClusterLinkInput): Promise<ClusterLinkRecord | undefined> {
    const current = await getClusterLink(id)
    if (!current)
      return undefined

    const updated: ClusterLinkRecord = {
      ...current,
      ...patch,
      id: current.id,
      clusterId: current.clusterId,
      entityType: current.entityType,
      entityId: current.entityId,
      ts: patch.ts ?? Date.now(),
    }

    await idb.put(CLUSTER_LINKS_STORE_NAME, updated)
    return updated
  }

  /**
   * 插入或更新集群链接记录
   *
   * 如果记录不存在则插入，如果存在则更新。自动生成缺失的ID和时间戳字段。
   *
   * @param record - 集群链接记录对象
   * @param record.id - 记录ID，如果未提供则自动生成
   * @param record.clusterId - 集群ID
   * @param record.entityType - 实体类型
   * @param record.entityId - 实体ID
   * @param record.ts - 时间戳，如果未提供则使用当前时间
   * @returns 返回规范化后的集群链接记录，包含自动生成的ID和时间戳
   * @throws 当数据库操作失败时抛出异常
   */
  async function upsertClusterLink(record: ClusterLinkRecord): Promise<ClusterLinkRecord> {
    const normalized: ClusterLinkRecord = {
      ...record,
      id: record.id ?? createLinkId(record.clusterId, record.entityType, record.entityId),
      ts: record.ts ?? Date.now(),
    }

    await idb.put(CLUSTER_LINKS_STORE_NAME, normalized)
    return normalized
  }

  /**
   * 软删除集群链接记录
   * @param id - 集群链接的唯一标识符
   * @returns 返回更新后的集群链接记录，如果不存在则返回 undefined
   */
  async function softDeleteClusterLink(id: ClusterLinkId): Promise<ClusterLinkRecord | undefined> {
    return updateClusterLink(id, { deletedAt: Date.now(), ts: Date.now() })
  }

  /**
   * 恢复已删除的集群链接
   * @param id - 集群链接的唯一标识符
   * @returns 返回恢复后的集群链接记录，如果恢复失败则返回 undefined
   * @remarks
   * 该函数通过清除 deletedAt 字段并更新时间戳来恢复被软删除的集群链接记录。
   */
  async function restoreClusterLink(id: ClusterLinkId): Promise<ClusterLinkRecord | undefined> {
    return updateClusterLink(id, { deletedAt: undefined, ts: Date.now() })
  }

  /**
   * 移除集群链接
   * @param id - 集群链接的唯一标识符
   * @returns 返回一个Promise，当移除操作完成时解决
   */
  async function removeClusterLink(id: ClusterLinkId): Promise<void> {
    await idb.remove(CLUSTER_LINKS_STORE_NAME, id)
  }

  /**
   * 清除所有集群链接数据
   *
   * 从IndexedDB的集群链接存储中删除所有记录。
   * 这是一个异步操作，会等待清除操作完成后才返回。
   *
   * @returns {Promise<void>} 返回一个Promise，当清除操作完成时resolve
   */
  async function clearClusterLinks(): Promise<void> {
    await idb.clear(CLUSTER_LINKS_STORE_NAME)
  }

  /**
   * 获取集群链接的总数量
   * @returns {Promise<number>} 返回集群链接记录的总数
   */
  async function countClusterLinks(): Promise<number> {
    return idb.count(CLUSTER_LINKS_STORE_NAME)
  }

  /**
   * 根据集群ID获取所有活跃的集群链接记录
   * @param clusterId - 集群ID
   * @returns 返回按时间戳降序排列的活跃集群链接记录数组的Promise
   * @throws 当查询失败时抛出错误
   */
  async function listByClusterId(clusterId: string): Promise<ClusterLinkRecord[]> {
    return idb.withStore(CLUSTER_LINKS_STORE_NAME, 'readonly', (store) => {
      return new Promise<ClusterLinkRecord[]>((resolve, reject) => {
        const request = store.index('clusterId').getAll(clusterId)
        request.onsuccess = () => {
          const records = filterActiveLinks(request.result as ClusterLinkRecord[])
          resolve(records.sort((a, b) => b.ts - a.ts))
        }
        request.onerror = () => reject(request.error ?? new Error('Query clusterId failed'))
      })
    })
  }

  /**
   * 根据实体类型获取集群链接记录列表
   * @param entityType - 集群实体类型
   * @returns 返回按时间戳倒序排列的活跃集群链接记录数组
   * @throws 当数据库查询失败时抛出错误
   */
  async function listByEntityType(entityType: ClusterEntityType): Promise<ClusterLinkRecord[]> {
    return idb.withStore(CLUSTER_LINKS_STORE_NAME, 'readonly', (store) => {
      return new Promise<ClusterLinkRecord[]>((resolve, reject) => {
        const request = store.index('entityType').getAll(entityType)
        request.onsuccess = () => {
          const records = filterActiveLinks(request.result as ClusterLinkRecord[])
          resolve(records.sort((a, b) => b.ts - a.ts))
        }
        request.onerror = () => reject(request.error ?? new Error('Query entityType failed'))
      })
    })
  }

  /**
   * 根据集群ID和实体类型查询集群链接记录
   * @param clusterId - 集群ID
   * @param entityType - 集群实体类型
   * @returns 返回按时间戳降序排列的活跃集群链接记录列表
   * @throws 当数据库查询失败时抛出错误
   */
  async function listByClusterAndType(clusterId: string, entityType: ClusterEntityType): Promise<ClusterLinkRecord[]> {
    return idb.withStore(CLUSTER_LINKS_STORE_NAME, 'readonly', (store) => {
      return new Promise<ClusterLinkRecord[]>((resolve, reject) => {
        const request = store.index('clusterEntity').getAll([clusterId, entityType])
        request.onsuccess = () => {
          const records = filterActiveLinks(request.result as ClusterLinkRecord[])
          resolve(records.sort((a, b) => b.ts - a.ts))
        }
        request.onerror = () => reject(request.error ?? new Error('Query clusterEntity failed'))
      })
    })
  }

  /**
   * 根据时间戳范围查询集群链接记录
   * @param startTs - 开始时间戳（毫秒）
   * @param endTs - 结束时间戳（毫秒），可选。如果不提供则查询从 startTs 开始的所有记录
   * @returns 返回符合时间戳范围的活跃集群链接记录数组，按时间戳降序排列
   * @throws 当数据库查询失败时抛出错误
   * @example
   * // 查询指定时间段内的记录
   * const records = await listByTsRange(1000, 2000);
   *
   * @example
   * // 查询从某个时间戳开始的所有记录
   * const records = await listByTsRange(1000);
   */
  async function listByTsRange(startTs: number, endTs?: number): Promise<ClusterLinkRecord[]> {
    const range = typeof endTs === 'number'
      ? IDBKeyRange.bound(startTs, endTs)
      : IDBKeyRange.lowerBound(startTs)

    return idb.withStore(CLUSTER_LINKS_STORE_NAME, 'readonly', (store) => {
      return new Promise<ClusterLinkRecord[]>((resolve, reject) => {
        const request = store.index('ts').getAll(range)
        request.onsuccess = () => {
          const records = filterActiveLinks(request.result as ClusterLinkRecord[])
          resolve(records.sort((a, b) => b.ts - a.ts))
        }
        request.onerror = () => reject(request.error ?? new Error('Query ts failed'))
      })
    })
  }

  /**
   * 链接页面到集群
   * @param clusterId - 集群ID
   * @param pageId - 页面ID
   * @param role - 可选，页面在集群中的角色
   * @param score - 可选，页面的评分
   * @param sourcePageId - 可选，源页面ID
   * @returns 返回创建的集群链接结果
   */
  async function linkPage(clusterId: string, pageId: string, role?: string, score?: number, sourcePageId?: string) {
    return createClusterLink({ clusterId, entityType: 'page', entityId: pageId, role, score, sourcePageId })
  }

  /**
   * 将组件链接到集群
   * @param clusterId - 集群ID
   * @param componentId - 组件ID
   * @param role - 可选，组件在集群中的角色
   * @param score - 可选，链接的评分
   * @param sourcePageId - 可选，源页面ID
   * @returns 返回创建的集群链接
   */
  async function linkComponent(clusterId: string, componentId: string, role?: string, score?: number, sourcePageId?: string) {
    return createClusterLink({ clusterId, entityType: 'component', entityId: componentId, role, score, sourcePageId })
  }

  /**
   * 链接一个bundle到集群
   * @param clusterId - 集群的唯一标识符
   * @param bundleId - 要链接的bundle的唯一标识符
   * @param role - 可选，bundle在集群中的角色
   * @param score - 可选，链接的相关性评分
   * @param sourcePageId - 可选，链接的源页面ID
   * @returns 返回创建的集群链接对象
   */
  async function linkBundle(clusterId: string, bundleId: string, role?: string, score?: number, sourcePageId?: string) {
    return createClusterLink({ clusterId, entityType: 'bundle', entityId: bundleId, role, score, sourcePageId })
  }

  /**
   * 将截图链接到集群
   * @param clusterId - 集群ID
   * @param screenshotId - 截图ID
   * @param role - 可选，角色标识
   * @param score - 可选，评分
   * @param sourcePageId - 可选，源页面ID
   * @returns 返回创建的集群链接结果
   */
  async function linkScreenshot(clusterId: string, screenshotId: string, role?: string, score?: number, sourcePageId?: string) {
    return createClusterLink({ clusterId, entityType: 'screenshot', entityId: screenshotId, role, score, sourcePageId })
  }

  return {
    createClusterLink,
    getClusterLink,
    getByEntity,
    listClusterLinks,
    updateClusterLink,
    upsertClusterLink,
    softDeleteClusterLink,
    restoreClusterLink,
    removeClusterLink,
    clearClusterLinks,
    countClusterLinks,
    listByClusterId,
    listByEntityType,
    listByClusterAndType,
    listByTsRange,
    linkPage,
    linkComponent,
    linkBundle,
    linkScreenshot,
  }
}

export const cluster_links = clusterLinksStoreDefinition
export const cluster_linksSchema = clusterLinksSchema
