// import { createLogger, wrapAsyncApiWithLogger } from '~/utils/logger.util'

/**
 * Bundle 组件的存储名称常量
 * 用于在数据库或缓存中识别和存储 Bundle 相关的组件数据
 * @constant
 * @type {string}
 */
export const BUNDLE_COMPONENTS_STORE_NAME = 'bundle_components'

/**
 * 捆绑组件的唯一标识符
 * @typedef {string} BundleComponentId
 */
export type BundleComponentId = string

/**
 * 捆绑组件记录
 * 表示一个组件在特定捆绑包中的关联信息和元数据
 *
 * @interface BundleComponentRecord
 * @property {BundleComponentId} id - 捆绑组件的唯一标识符
 * @property {string} bundleId - 所属捆绑包的ID
 * @property {string} componentId - 组件的唯一标识符
 * @property {string} [role] - 组件在捆绑包中的角色，可选
 * @property {string} [pos] - 组件在捆绑包中的位置，可选
 * @property {number} [confidence] - 组件匹配的置信度，0-1之间的数值，可选
 * @property {number} createdAt - 记录创建时间戳（毫秒）
 * @property {number} updatedAt - 记录最后更新时间戳（毫秒）
 * @property {number} [deletedAt] - 记录删除时间戳（毫秒），未删除时为undefined，可选
 */
export interface BundleComponentRecord {
  id: BundleComponentId
  bundleId: string
  componentId: string
  role?: string
  pos?: string
  confidence?: number
  createdAt: number
  updatedAt: number
  deletedAt?: number
}

/**
 * 创建捆绑组件的输入类型
 *
 * 基于 {@link BundleComponentRecord} 类型，排除了 `id`、`createdAt` 和 `updatedAt` 字段，
 * 但这些字段可以通过可选属性重新添加。
 *
 * @typedef {object} CreateBundleComponentInput
 * @property {BundleComponentId} [id] - 可选的捆绑组件唯一标识符
 * @property {number} [createdAt] - 可选的创建时间戳（毫秒）
 * @property {number} [updatedAt] - 可选的更新时间戳（毫秒）
 */
export type CreateBundleComponentInput = Omit<BundleComponentRecord, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: BundleComponentId
  createdAt?: number
  updatedAt?: number
}

/**
 * 更新捆绑包组件的输入类型
 *
 * 用于部分更新捆绑包组件记录，排除了以下不可更新的字段：
 * - `id` - 组件唯一标识符
 * - `bundleId` - 所属捆绑包ID
 * - `componentId` - 组件ID
 * - `createdAt` - 创建时间
 *
 * @typedef {object} UpdateBundleComponentInput
 * @property
 */
export type UpdateBundleComponentInput = Partial<Omit<BundleComponentRecord, 'id' | 'bundleId' | 'componentId' | 'createdAt'>>

/**
 * Bundle组件Schema的配置选项
 * @interface BundleComponentsSchemaOptions
 * @property {string} [dbName] - 数据库名称（可选）
 * @property {number} [version] - Schema版本号（可选）
 */
export interface BundleComponentsSchemaOptions {
  dbName?: string
  version?: number
}

/**
 * Bundle 组件存储定义
 *
 * @description 定义了 IndexedDB 中 bundle 组件的存储结构和索引配置
 *
 * @property {string} name - 存储名称
 * @property {IDBObjectStoreParameters} options - 存储选项配置，使用 'id' 作为主键
 * @property {IDBIndexParameters[]} indexes - 索引配置数组
 * @property {IDBIndexParameters} indexes[0] - bundleId 索引，用于快速查询特定 bundle 下的组件
 * @property {IDBIndexParameters} indexes[1] - componentId 索引，用于快速查询特定组件
 * @property {IDBIndexParameters} indexes[2] - role 索引，用于按角色快速查询组件
 */
const bundleComponentsStoreDefinition: IdbStoreDefinition = {
  name: BUNDLE_COMPONENTS_STORE_NAME,
  options: { keyPath: 'id' },
  indexes: [
    { name: 'bundleId', keyPath: 'bundleId' },
    { name: 'componentId', keyPath: 'componentId' },
    { name: 'role', keyPath: 'role' },
  ],
}

/**
 * 创建Bundle组件关系ID
 *
 * @param bundleId - Bundle的唯一标识符
 * @param componentId - 组件的唯一标识符
 * @returns 返回格式为 `${bundleId}|${componentId}` 的关系ID
 */
function createRelationId(bundleId: string, componentId: string): BundleComponentId {
  return `${bundleId}|${componentId}`
}

/**
 * 检查捆绑组件记录是否处于活跃状态
 * @param record - 待检查的捆绑组件记录
 * @returns 如果记录未被删除（deletedAt 不是数字类型）则返回 true，否则返回 false
 */
function isActiveRelation(record: BundleComponentRecord) {
  return typeof record.deletedAt !== 'number'
}

/**
 * 过滤活跃的关系记录
 * @param records - 要过滤的包组件记录数组
 * @returns 返回所有活跃关系的记录
 */
function filterActiveRelations(records: BundleComponentRecord[]) {
  return records.filter(isActiveRelation)
}

export function bundleComponentsSchema(options: BundleComponentsSchemaOptions = {}) {
  const schemaLogger = createLogger('schema:bundle_components')

  /**
   * 初始化 IndexedDB 数据库实例
   * @param {object} options - 配置选项
   * @param {string} [options.dbName='flow-dock-dev'] - 数据库名称，默认为 'flow-dock-dev'
   * @param {number} [options.version=1] - 数据库版本号，默认为 1
   * @param {Array} options.stores - 存储对象定义数组，包含 bundleComponentsStoreDefinition
   * @returns {IdbInstance} 返回 IndexedDB 实例，用于执行数据库操作
   */
  const idb = useIdb({
    dbName: options.dbName ?? 'flow-dock-dev',
    version: options.version ?? 1,
    stores: [bundleComponentsStoreDefinition],
  })

  /**
   * 创建束组件记录
   * @param input - 创建束组件的输入参数
   * @param input.id - 束组件的唯一标识符，如未提供则根据 bundleId 和 componentId 自动生成
   * @param input.bundleId - 所属束的标识符
   * @param input.componentId - 组件的标识符
   * @param input.createdAt - 创建时间戳，如未提供则使用当前时间
   * @param input.updatedAt - 更新时间戳，如未提供则使用当前时间
   * @returns 返回创建后的束组件记录对象，包含完整的元数据信息
   * @throws 当数据库操作失败时抛出异常
   */
  async function createBundleComponent(input: CreateBundleComponentInput): Promise<BundleComponentRecord> {
    const now = Date.now()
    const record: BundleComponentRecord = {
      ...input,
      id: input.id ?? createRelationId(input.bundleId, input.componentId),
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    }

    await idb.add(BUNDLE_COMPONENTS_STORE_NAME, record)
    return record
  }

  /**
   * 获取指定ID的Bundle组件记录
   * @param id - Bundle组件的唯一标识符
   * @param includeDeleted - 是否包含已删除的记录，默认为false。当为false时，只返回活跃的关联记录
   * @returns 返回Bundle组件记录，如果记录不存在或被排除则返回undefined
   * @remarks
   * 当includeDeleted为false且记录已被标记为删除状态时，该函数将返回undefined
   */
  async function getBundleComponent(id: BundleComponentId, includeDeleted = false): Promise<BundleComponentRecord | undefined> {
    const record = await idb.get<BundleComponentRecord>(BUNDLE_COMPONENTS_STORE_NAME, id)
    if (!includeDeleted && record && !isActiveRelation(record))
      return undefined

    return record
  }

  /**
   * 根据bundle ID和component ID获取bundle component记录
   * @param bundleId - Bundle的唯一标识符
   * @param componentId - Component的唯一标识符
   * @param includeDeleted - 是否包含已删除的记录，默认为false
   * @returns 返回Promise，resolved值为BundleComponentRecord或undefined
   */
  async function getByBundleAndComponent(
    bundleId: string,
    componentId: string,
    includeDeleted = false,
  ): Promise<BundleComponentRecord | undefined> {
    return getBundleComponent(createRelationId(bundleId, componentId), includeDeleted)
  }

  /**
   * 获取所有活跃的捆绑组件记录
   * @returns 返回按更新时间降序排列的活跃捆绑组件记录数组
   */
  async function listBundleComponents(): Promise<BundleComponentRecord[]> {
    const records = await idb.getAll<BundleComponentRecord>(BUNDLE_COMPONENTS_STORE_NAME)
    return filterActiveRelations(records).sort((a, b) => b.updatedAt - a.updatedAt)
  }

  /**
   * 更新指定ID的Bundle组件
   * @param id - Bundle组件的ID
   * @param patch - 包含要更新的字段的对象
   * @returns 返回更新后的BundleComponentRecord对象，如果原记录不存在则返回undefined
   * @remarks
   * - 如果指定ID的Bundle组件不存在，函数返回undefined
   * - 更新操作会保留原记录的id、bundleId、componentId和createdAt字段不变
   * - updatedAt字段会更新为patch中提供的值，如果未提供则使用当前时间戳
   * - 更新后的记录会被持久化到IndexedDB存储中
   */
  async function updateBundleComponent(id: BundleComponentId, patch: UpdateBundleComponentInput): Promise<BundleComponentRecord | undefined> {
    const current = await getBundleComponent(id)
    if (!current)
      return undefined

    const updated: BundleComponentRecord = {
      ...current,
      ...patch,
      id: current.id,
      bundleId: current.bundleId,
      componentId: current.componentId,
      createdAt: current.createdAt,
      updatedAt: patch.updatedAt ?? Date.now(),
    }

    await idb.put(BUNDLE_COMPONENTS_STORE_NAME, updated)
    return updated
  }

  /**
   * 更新或插入一个bundle组件记录
   * @param record - Bundle组件记录对象，包含bundle ID和组件ID等信息
   * @returns Promise<BundleComponentRecord> - 返回规范化后的bundle组件记录
   * @description
   * 此函数执行以下操作：
   * - 如果记录中没有id，则根据bundleId和componentId生成关系ID
   * - 如果记录中没有createdAt，则使用当前时间戳
   * - 如果记录中没有updatedAt，则使用当前时间戳
   * - 将规范化后的记录保存到IndexedDB
   */
  async function upsertBundleComponent(record: BundleComponentRecord): Promise<BundleComponentRecord> {
    const now = Date.now()
    const normalized: BundleComponentRecord = {
      ...record,
      id: record.id ?? createRelationId(record.bundleId, record.componentId),
      createdAt: record.createdAt ?? now,
      updatedAt: record.updatedAt ?? now,
    }

    await idb.put(BUNDLE_COMPONENTS_STORE_NAME, normalized)
    return normalized
  }

  /**
   * 软删除指定的捆绑组件
   * @param id - 要软删除的捆绑组件的唯一标识符
   * @returns 返回更新后的捆绑组件记录，如果组件不存在则返回 undefined
   * @remarks
   * 此函数通过设置 deletedAt 和 updatedAt 时间戳来进行软删除操作，
   * 而不是从数据库中永久删除记录。这样可以保留数据历史记录。
   */
  async function softDeleteBundleComponent(id: BundleComponentId): Promise<BundleComponentRecord | undefined> {
    return updateBundleComponent(id, { deletedAt: Date.now(), updatedAt: Date.now() })
  }

  /**
   * 恢复已删除的组件包
   * @param id - 组件包的唯一标识符
   * @returns 返回恢复后的组件包记录，如果操作失败则返回 undefined
   */
  async function restoreBundleComponent(id: BundleComponentId): Promise<BundleComponentRecord | undefined> {
    return updateBundleComponent(id, { deletedAt: undefined, updatedAt: Date.now() })
  }

  /**
   * 从IndexedDB中移除指定ID的Bundle组件
   * @param id - 要删除的Bundle组件的ID
   * @returns 返回一个Promise，当删除操作完成时resolve
   * @throws 当IndexedDB操作失败时可能抛出错误
   */
  async function removeBundleComponent(id: BundleComponentId): Promise<void> {
    await idb.remove(BUNDLE_COMPONENTS_STORE_NAME, id)
  }

  /**
   * 清除所有捆绑组件数据
   *
   * 该函数会清空IndexedDB中存储的所有捆绑组件记录。
   *
   * @returns {Promise<void>} 返回一个Promise，当清除操作完成时resolve
   */
  async function clearBundleComponents(): Promise<void> {
    await idb.clear(BUNDLE_COMPONENTS_STORE_NAME)
  }

  /**
   * 获取 Bundle 组件的总数量
   * @returns {Promise<number>} 返回 Bundle 组件的数量
   */
  async function countBundleComponents(): Promise<number> {
    return idb.count(BUNDLE_COMPONENTS_STORE_NAME)
  }

  /**
   * 根据bundleId获取所有相关的bundle组件记录
   * @param bundleId - bundle的唯一标识符
   * @returns 返回Promise，解析为按更新时间倒序排列的活跃BundleComponentRecord数组
   * @throws 当查询失败时会抛出错误
   */
  async function listByBundleId(bundleId: string): Promise<BundleComponentRecord[]> {
    return idb.withStore(BUNDLE_COMPONENTS_STORE_NAME, 'readonly', (store) => {
      return new Promise<BundleComponentRecord[]>((resolve, reject) => {
        const request = store.index('bundleId').getAll(bundleId)
        request.onsuccess = () => {
          const records = filterActiveRelations(request.result as BundleComponentRecord[])
          resolve(records.sort((a, b) => b.updatedAt - a.updatedAt))
        }
        request.onerror = () => reject(request.error ?? new Error('Query bundleId failed'))
      })
    })
  }

  /**
   * 通过组件ID查询Bundle组件记录
   * @param componentId - 组件ID
   * @returns 返回Promise，resolve时为按更新时间倒序排列的活跃Bundle组件记录数组
   * @throws 当查询失败时，reject包含错误信息
   */
  async function listByComponentId(componentId: string): Promise<BundleComponentRecord[]> {
    return idb.withStore(BUNDLE_COMPONENTS_STORE_NAME, 'readonly', (store) => {
      return new Promise<BundleComponentRecord[]>((resolve, reject) => {
        const request = store.index('componentId').getAll(componentId)
        request.onsuccess = () => {
          const records = filterActiveRelations(request.result as BundleComponentRecord[])
          resolve(records.sort((a, b) => b.updatedAt - a.updatedAt))
        }
        request.onerror = () => reject(request.error ?? new Error('Query componentId failed'))
      })
    })
  }

  /**
   * 根据角色获取捆绑组件列表
   *
   * @param role - 要查询的角色名称
   * @returns 返回Promise，解析为按更新时间倒序排列的活跃BundleComponentRecord数组
   * @throws 当IndexedDB查询失败时抛出错误
   *
   * @remarks
   * - 从IndexedDB的BUNDLE_COMPONENTS_STORE_NAME存储中查询
   * - 使用'role'索引进行查询
   * - 自动过滤非活跃的关联记录
   * - 结果按updatedAt字段降序排序（最新的在前）
   */
  async function listByRole(role: string): Promise<BundleComponentRecord[]> {
    return idb.withStore(BUNDLE_COMPONENTS_STORE_NAME, 'readonly', (store) => {
      return new Promise<BundleComponentRecord[]>((resolve, reject) => {
        const request = store.index('role').getAll(role)
        request.onsuccess = () => {
          const records = filterActiveRelations(request.result as BundleComponentRecord[])
          resolve(records.sort((a, b) => b.updatedAt - a.updatedAt))
        }
        request.onerror = () => reject(request.error ?? new Error('Query role failed'))
      })
    })
  }

  return wrapAsyncApiWithLogger(schemaLogger, {
    createBundleComponent,
    getBundleComponent,
    getByBundleAndComponent,
    listBundleComponents,
    updateBundleComponent,
    upsertBundleComponent,
    softDeleteBundleComponent,
    restoreBundleComponent,
    removeBundleComponent,
    clearBundleComponents,
    countBundleComponents,
    listByBundleId,
    listByComponentId,
    listByRole,
  })
}

export const bundle_components = bundleComponentsStoreDefinition
export const bundle_componentsSchema = bundleComponentsSchema
