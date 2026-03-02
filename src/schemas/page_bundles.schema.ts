/**
 * 页面包的存储名称常量
 * 用于标识IndexedDB或其他存储机制中的页面包数据存储位置
 * @type {string}
 * @constant
 */
export const PAGE_BUNDLES_STORE_NAME = 'page_bundles'

/**
 * 页面包的唯一标识符
 * @typedef {string} PageBundleId
 */
export type PageBundleId = string

/**
 * 页面包裹记录接口
 * @interface PageBundleRecord
 * @description 表示页面与包裹之间的关系记录，包含两者的关联信息和元数据
 *
 * @property {PageBundleId} id - 页面包裹记录的唯一标识符
 * @property {string} pageId - 关联的页面ID
 * @property {string} bundleId - 关联的包裹ID
 * @property {string} [role] - 可选，页面在包裹中的角色或类型
 * @property {string} [pos] - 可选，页面在包裹中的位置或序号
 * @property {number} [confidence] - 可选，关联的置信度评分，范围通常为0-1或0-100
 * @property {number} createdAt - 记录创建时间戳（毫秒）
 * @property {number} updatedAt - 记录最后更新时间戳（毫秒）
 * @property {number} [deletedAt] - 可选，记录软删除时间戳（毫秒），若不存在则表示记录未被删除
 */
export interface PageBundleRecord {
  id: PageBundleId
  pageId: string
  bundleId: string
  role?: string
  pos?: string
  confidence?: number
  createdAt: number
  updatedAt: number
  deletedAt?: number
}

/**
 * 创建页面包的输入类型
 *
 * 基于 {@link PageBundleRecord} 类型，排除了必需的 `id`、`createdAt` 和 `updatedAt` 字段，
 * 然后将这些字段设置为可选的。
 *
 * @typedef {object} CreatePageBundleInput
 * @property {PageBundleId} [id] - 页面包的唯一标识符（可选）
 * @property {number} [createdAt] - 创建时间戳，单位为毫秒（可选）
 * @property {number} [updatedAt] - 更新时间戳，单位为毫秒（可选）
 * @extends {Omit<PageBundleRecord, 'id' | 'createdAt' | 'updatedAt'>}
 */
export type CreatePageBundleInput = Omit<PageBundleRecord, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: PageBundleId
  createdAt?: number
  updatedAt?: number
}

/**
 * 用于更新页面包的输入类型
 *
 * 该类型基于 {@link PageBundleRecord} 构建，排除了以下不可修改的字段：
 * - `id` - 页面包的唯一标识符
 * - `pageId` - 关联的页面ID
 * - `bundleId` - 关联的包ID
 * - `createdAt` - 创建时间戳
 *
 * 所有剩余字段都是可选的，允许进行部分更新。
 */
export type UpdatePageBundleInput = Partial<Omit<PageBundleRecord, 'id' | 'pageId' | 'bundleId' | 'createdAt'>>

/**
 * 页面包的模式选项配置接口
 * @interface PageBundlesSchemaOptions
 * @property {string} [dbName] - 可选，数据库名称
 * @property {number} [version] - 可选，版本号
 */
export interface PageBundlesSchemaOptions {
  dbName?: string
  version?: number
}

/**
 * 页面包裹存储定义
 *
 * 用于 IndexedDB 数据库中存储页面包裹数据的配置对象。
 *
 * @property {string} name - 存储名称，使用 PAGE_BUNDLES_STORE_NAME 常量
 * @property {IdbStoreOptions} options - 存储配置选项
 * @property {string} options.keyPath - 主键路径，设置为 'id'
 * @property {IdbIndex[]} indexes - 索引数组，包含以下三个索引：
 *   - pageId: 用于按页面 ID 快速查询
 *   - bundleId: 用于按包裹 ID 快速查询
 *   - role: 用于按角色快速查询
 */
const pageBundlesStoreDefinition: IdbStoreDefinition = {
  name: PAGE_BUNDLES_STORE_NAME,
  options: { keyPath: 'id' },
  indexes: [
    { name: 'pageId', keyPath: 'pageId' },
    { name: 'bundleId', keyPath: 'bundleId' },
    { name: 'role', keyPath: 'role' },
  ],
}

/**
 * 创建页面包的关系ID
 * @param pageId - 页面的唯一标识符
 * @param bundleId - 包的唯一标识符
 * @returns 格式为 `pageId|bundleId` 的关系ID
 */
function createRelationId(pageId: string, bundleId: string): PageBundleId {
  return `${pageId}|${bundleId}`
}

/**
 * 判断页面束记录是否处于活跃状态
 * @param record - 页面束记录对象
 * @returns 如果记录未被删除（deletedAt 不是数字类型），则返回 true；否则返回 false
 */
function isActiveRelation(record: PageBundleRecord) {
  return typeof record.deletedAt !== 'number'
}

/**
 * 过滤活跃的页面包记录关系
 * @param records - 页面包记录数组
 * @returns 返回过滤后的活跃关系记录数组
 */
function filterActiveRelations(records: PageBundleRecord[]) {
  return records.filter(isActiveRelation)
}

export function pageBundlesSchema(options: PageBundlesSchemaOptions = {}) {
  const schemaLogger = createLogger('schema:page_bundles')

  /**
   * 初始化 IndexedDB 实例
   * @param {object} options - 配置选项
   * @param {string} [options.dbName='flow-dock-dev'] - 数据库名称，默认为 'flow-dock-dev'
   * @param {number} [options.version=1] - 数据库版本号，默认为 1
   * @param {Array} options.stores - 数据库存储空间定义数组，包含页面包裹存储定义
   * @returns {IdbInstance} 返回初始化后的 IndexedDB 实例
   */
  const idb = useIdb({
    dbName: options.dbName ?? 'flow-dock-dev',
    version: options.version ?? 1,
    stores: [pageBundlesStoreDefinition],
  })

  /**
   * 创建页面包记录
   *
   * @param input - 创建页面包的输入参数
   * @param input.pageId - 页面ID
   * @param input.bundleId - 包ID
   * @param input.id - 可选，页面包的唯一标识符，如果未提供则自动生成
   * @param input.createdAt - 可选，创建时间戳，如果未提供则使用当前时间
   * @param input.updatedAt - 可选，更新时间戳，如果未提供则使用当前时间
   * @returns 返回创建后的页面包记录对象
   * @throws 当数据库操作失败时抛出异常
   */
  async function createPageBundle(input: CreatePageBundleInput): Promise<PageBundleRecord> {
    const now = Date.now()
    const record: PageBundleRecord = {
      ...input,
      id: input.id ?? createRelationId(input.pageId, input.bundleId),
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    }

    await idb.add(PAGE_BUNDLES_STORE_NAME, record)
    return record
  }

  /**
   * 获取页面包记录
   * @param id - 页面包的ID
   * @param includeDeleted - 是否包含已删除的记录，默认为false
   * @returns 返回页面包记录，如果不存在或已删除（不包含已删除时）则返回undefined
   */
  async function getPageBundle(id: PageBundleId, includeDeleted = false): Promise<PageBundleRecord | undefined> {
    const record = await idb.get<PageBundleRecord>(PAGE_BUNDLES_STORE_NAME, id)
    if (!includeDeleted && record && !isActiveRelation(record))
      return undefined

    return record
  }

  /**
   * 根据页面ID和捆绑ID获取页面捆绑记录
   * @param pageId - 页面的唯一标识符
   * @param bundleId - 捆绑的唯一标识符
   * @param includeDeleted - 是否包含已删除的记录，默认为 false
   * @returns 返回匹配的页面捆绑记录，如果未找到则返回 undefined
   */
  async function getByPageAndBundle(
    pageId: string,
    bundleId: string,
    includeDeleted = false,
  ): Promise<PageBundleRecord | undefined> {
    return getPageBundle(createRelationId(pageId, bundleId), includeDeleted)
  }

  /**
   * 获取所有页面包的列表
   * @returns {Promise<PageBundleRecord[]>} 返回按更新时间倒序排列的活跃页面包记录数组
   * @description 从IndexedDB中获取所有页面包记录，过滤出活跃的关联记录，
   * 并按照更新时间从新到旧进行排序
   */
  async function listPageBundles(): Promise<PageBundleRecord[]> {
    const records = await idb.getAll<PageBundleRecord>(PAGE_BUNDLES_STORE_NAME)
    return filterActiveRelations(records).sort((a, b) => b.updatedAt - a.updatedAt)
  }

  /**
   * 更新页面包信息
   * @param id - 页面包的唯一标识符
   * @param patch - 包含要更新的页面包字段的对象
   * @returns 返回更新后的页面包记录，如果页面包不存在则返回 undefined
   * @remarks
   * 此函数会保留原始的 id、pageId、bundleId 和 createdAt 字段不变，
   * 同时更新 updatedAt 时间戳（如果 patch 中未提供则使用当前时间）。
   * 更新后的记录会存储到 IndexedDB 的 PAGE_BUNDLES_STORE_NAME 库中。
   */
  async function updatePageBundle(id: PageBundleId, patch: UpdatePageBundleInput): Promise<PageBundleRecord | undefined> {
    const current = await getPageBundle(id)
    if (!current)
      return undefined

    const updated: PageBundleRecord = {
      ...current,
      ...patch,
      id: current.id,
      pageId: current.pageId,
      bundleId: current.bundleId,
      createdAt: current.createdAt,
      updatedAt: patch.updatedAt ?? Date.now(),
    }

    await idb.put(PAGE_BUNDLES_STORE_NAME, updated)
    return updated
  }

  /**
   * 创建或更新页面包记录
   * @param record - 页面包记录对象
   * @returns 返回处理后的页面包记录
   * @throws 如果数据库操作失败，将抛出错误
   *
   * @remarks
   * 该函数会执行以下操作：
   * - 如果未提供 id，则根据 pageId 和 bundleId 生成唯一标识
   * - 如果未提供 createdAt，则设置为当前时间戳
   * - 如果未提供 updatedAt，则设置为当前时间戳
   * - 将规范化后的记录存储到 IndexedDB
   */
  async function upsertPageBundle(record: PageBundleRecord): Promise<PageBundleRecord> {
    const now = Date.now()
    const normalized: PageBundleRecord = {
      ...record,
      id: record.id ?? createRelationId(record.pageId, record.bundleId),
      createdAt: record.createdAt ?? now,
      updatedAt: record.updatedAt ?? now,
    }

    await idb.put(PAGE_BUNDLES_STORE_NAME, normalized)
    return normalized
  }

  /**
   * 软删除页面包
   *
   * @param id - 页面包的唯一标识符
   * @returns 返回更新后的页面包记录，如果页面包不存在则返回 undefined
   */
  async function softDeletePageBundle(id: PageBundleId): Promise<PageBundleRecord | undefined> {
    return updatePageBundle(id, { deletedAt: Date.now(), updatedAt: Date.now() })
  }

  /**
   * 恢复已删除的页面包
   * @param id - 页面包的唯一标识符
   * @returns 返回更新后的页面包记录，如果不存在则返回 undefined
   */
  async function restorePageBundle(id: PageBundleId): Promise<PageBundleRecord | undefined> {
    return updatePageBundle(id, { deletedAt: undefined, updatedAt: Date.now() })
  }

  /**
   * 删除页面包
   * @param id - 要删除的页面包的唯一标识符
   * @returns 返回一个Promise，删除操作完成时resolve
   */
  async function removePageBundle(id: PageBundleId): Promise<void> {
    await idb.remove(PAGE_BUNDLES_STORE_NAME, id)
  }

  /**
   * 清空页面包集合存储中的所有数据
   *
   * @async
   * @function clearPageBundles
   * @returns {Promise<void>} 返回一个在清空操作完成后resolve的Promise
   * @throws {Error} 当IndexedDB操作失败时可能抛出错误
   */
  async function clearPageBundles(): Promise<void> {
    await idb.clear(PAGE_BUNDLES_STORE_NAME)
  }

  /**
   * 获取页面包的总数量
   * @returns {Promise<number>} 返回页面包存储中的总数量
   */
  async function countPageBundles(): Promise<number> {
    return idb.count(PAGE_BUNDLES_STORE_NAME)
  }

  /**
   * 根据页面ID查询页面包数据
   *
   * @param pageId - 页面ID
   * @returns 返回按更新时间降序排列的活跃页面包记录数组
   *
   * @remarks
   * - 从IndexedDB的PAGE_BUNDLES_STORE_NAME存储中查询数据
   * - 使用pageId索引进行查询
   * - 自动过滤出活跃的关系记录
   * - 结果按updatedAt降序排列（最新优先）
   *
   * @throws 当查询失败时抛出错误
   */
  async function listByPageId(pageId: string): Promise<PageBundleRecord[]> {
    return idb.withStore(PAGE_BUNDLES_STORE_NAME, 'readonly', (store) => {
      return new Promise<PageBundleRecord[]>((resolve, reject) => {
        const request = store.index('pageId').getAll(pageId)
        request.onsuccess = () => {
          const records = filterActiveRelations(request.result as PageBundleRecord[])
          resolve(records.sort((a, b) => b.updatedAt - a.updatedAt))
        }
        request.onerror = () => reject(request.error ?? new Error('Query pageId failed'))
      })
    })
  }

  /**
   * 根据bundleId查询页面包记录列表
   * @param bundleId - 页面包的ID
   * @returns 返回与bundleId关联的活跃PageBundleRecord数组，按更新时间倒序排列
   * @throws 如果查询失败，将抛出错误
   */
  async function listByBundleId(bundleId: string): Promise<PageBundleRecord[]> {
    return idb.withStore(PAGE_BUNDLES_STORE_NAME, 'readonly', (store) => {
      return new Promise<PageBundleRecord[]>((resolve, reject) => {
        const request = store.index('bundleId').getAll(bundleId)
        request.onsuccess = () => {
          const records = filterActiveRelations(request.result as PageBundleRecord[])
          resolve(records.sort((a, b) => b.updatedAt - a.updatedAt))
        }
        request.onerror = () => reject(request.error ?? new Error('Query bundleId failed'))
      })
    })
  }

  /**
   * 根据角色获取页面包列表
   * @param role - 角色标识符
   * @returns 返回Promise，包含按更新时间倒序排列的活跃页面包记录数组
   * @throws 如果查询失败，将抛出错误
   */
  async function listByRole(role: string): Promise<PageBundleRecord[]> {
    return idb.withStore(PAGE_BUNDLES_STORE_NAME, 'readonly', (store) => {
      return new Promise<PageBundleRecord[]>((resolve, reject) => {
        const request = store.index('role').getAll(role)
        request.onsuccess = () => {
          const records = filterActiveRelations(request.result as PageBundleRecord[])
          resolve(records.sort((a, b) => b.updatedAt - a.updatedAt))
        }
        request.onerror = () => reject(request.error ?? new Error('Query role failed'))
      })
    })
  }

  return wrapAsyncApiWithLogger(schemaLogger, {
    createPageBundle,
    getPageBundle,
    getByPageAndBundle,
    listPageBundles,
    updatePageBundle,
    upsertPageBundle,
    softDeletePageBundle,
    restorePageBundle,
    removePageBundle,
    clearPageBundles,
    countPageBundles,
    listByPageId,
    listByBundleId,
    listByRole,
  })
}

export const page_bundles = pageBundlesStoreDefinition
export const page_bundlesSchema = pageBundlesSchema
