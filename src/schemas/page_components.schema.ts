// import { createLogger, wrapAsyncApiWithLogger } from '~/utils/logger.util'

/**
 * 页面组件存储的名称常量
 * 用于标识和访问页面组件相关的数据存储
 */
export const PAGE_COMPONENTS_STORE_NAME = 'page_components'

/**
 * 页面组件的唯一标识符
 */
export type PageComponentId = string

/**
 * 页面组件记录接口
 *
 * @interface PageComponentRecord
 * @property {PageComponentId} id - 组件记录的唯一标识符
 * @property {string} pageId - 所属页面的ID
 * @property {string} componentId - 组件的ID
 * @property {string} role - 组件在页面中的角色
 * @property {string} [text] - 组件的文本内容（可选）
 * @property {number} [confidence] - 组件的置信度分数（可选）
 * @property {string} [pos] - 组件的位置信息（可选）
 * @property {number} createdAt - 记录创建时间的时间戳（毫秒）
 * @property {number} updatedAt - 记录最后更新时间的时间戳（毫秒）
 * @property {number} [deletedAt] - 记录删除时间的时间戳，若未删除则为undefined（可选）
 */
export interface PageComponentRecord {
  id: PageComponentId
  pageId: string
  componentId: string
  role: string
  text?: string
  confidence?: number
  pos?: string
  createdAt: number
  updatedAt: number
  deletedAt?: number
}

/**
 * 创建页面组件的输入类型
 *
 * 基于 {@link PageComponentRecord} 类型，排除了 `id`、`createdAt` 和 `updatedAt` 字段，
 * 但这些字段是可选的，允许在创建时指定它们。
 *
 * @typedef {object} CreatePageComponentInput
 * @property {PageComponentId} [id] - 页面组件的唯一标识符（可选）
 * @property {number} [createdAt] - 创建时间戳（可选）
 * @property {number} [updatedAt] - 更新时间戳（可选）
 */
export type CreatePageComponentInput = Omit<PageComponentRecord, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: PageComponentId
  createdAt?: number
  updatedAt?: number
}

/**
 * 页面组件更新输入类型
 *
 * 用于更新页面组件时的输入数据类型。
 * 排除了以下不可更新的字段：
 * - `id` - 组件唯一标识符
 * - `pageId` - 所属页面ID
 * - `componentId` - 组件ID
 * - `createdAt` - 创建时间
 *
 * 所有其他字段都是可选的，可以部分更新页面组件信息。
 */
export type UpdatePageComponentInput = Partial<Omit<PageComponentRecord, 'id' | 'pageId' | 'componentId' | 'createdAt'>>

/**
 * 页面组件模式选项配置接口
 * @interface PageComponentsSchemaOptions
 * @property {string} [dbName] - 数据库名称，可选参数
 * @property {number} [version] - 版本号，可选参数
 */
export interface PageComponentsSchemaOptions {
  dbName?: string
  version?: number
}

/**
 * 页面组件存储定义
 *
 * 用于配置IndexedDB中页面组件数据的存储结构。
 * 包含页面ID、组件ID和角色等索引，以支持高效的数据查询。
 *
 * @constant
 * @type {IdbStoreDefinition}
 *
 * @property {string} name - 存储名称，值为PAGE_COMPONENTS_STORE_NAME常量
 * @property {object} options - 存储配置选项
 * @property {string} options.keyPath - 主键路径，使用'id'字段作为唯一标识符
 * @property {Array<{name: string, keyPath: string}>} indexes - 索引配置数组
 * @property {string} indexes[0].name - 页面ID索引
 * @property {string} indexes[1].name - 组件ID索引
 * @property {string} indexes[2].name - 角色索引
 */
const pageComponentsStoreDefinition: IdbStoreDefinition = {
  name: PAGE_COMPONENTS_STORE_NAME,
  options: { keyPath: 'id' },
  indexes: [
    { name: 'pageId', keyPath: 'pageId' },
    { name: 'componentId', keyPath: 'componentId' },
    { name: 'role', keyPath: 'role' },
  ],
}

/**
 * 根据页面ID和组件ID创建关联ID
 * @param pageId - 页面的唯一标识符
 * @param componentId - 组件的唯一标识符
 * @returns 返回格式为 `pageId|componentId` 的页面组件关联ID
 */
function createRelationId(pageId: string, componentId: string): PageComponentId {
  return `${pageId}|${componentId}`
}

/**
 * 检查页面组件记录是否处于活跃状态
 * @param record - 页面组件记录对象
 * @returns 如果记录未被删除（deletedAt 不是数字类型），则返回 true；否则返回 false
 */
function isActiveRelation(record: PageComponentRecord): boolean {
  return typeof record.deletedAt !== 'number'
}

/**
 * 筛选活跃的关系记录
 * @param records - 页面组件记录数组
 * @returns 返回仅包含活跃关系的页面组件记录数组
 */
function filterActiveRelations(records: PageComponentRecord[]): PageComponentRecord[] {
  return records.filter(isActiveRelation)
}

export function pageComponentsSchema(options: PageComponentsSchemaOptions = {}) {
  const schemaLogger = createLogger('schema:page_components')

  /**
   * 初始化IndexedDB实例
   * @description 创建一个IndexedDB数据库连接，用于存储页面组件数据
   * @param {object} options - 配置选项
   * @param {string} [options.dbName='flow-dock'] - 数据库名称，默认为 'flow-dock'
   * @param {number} [options.version=1] - 数据库版本号，默认为 1
   * @param {Array} options.stores - 对象存储定义数组，包含 pageComponentsStoreDefinition
   * @returns {object} IndexedDB实例对象，提供数据库操作接口
   */
  const idb = useIdb({
    dbName: options.dbName ?? 'flow-dock',
    version: options.version ?? 1,
    stores: [pageComponentsStoreDefinition],
  })

  /**
   * 创建页面组件记录
   * @param input - 页面组件输入参数
   * @param input.id - 组件ID，如果未提供则根据pageId和componentId自动生成
   * @param input.pageId - 页面ID，用于生成自动ID
   * @param input.componentId - 组件ID，用于生成自动ID
   * @param input.createdAt - 创建时间戳，如果未提供则使用当前时间
   * @param input.updatedAt - 更新时间戳，如果未提供则使用当前时间
   * @returns 返回新创建的页面组件记录
   * @throws 当向IndexedDB添加记录失败时可能抛出错误
   */
  async function createPageComponent(input: CreatePageComponentInput): Promise<PageComponentRecord> {
    const now = Date.now()
    const record: PageComponentRecord = {
      ...input,
      id: input.id ?? createRelationId(input.pageId, input.componentId),
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    }

    await idb.add(PAGE_COMPONENTS_STORE_NAME, record)
    return record
  }

  /**
   * 获取页面组件记录
   * @param id - 页面组件的唯一标识符
   * @param includeDeleted - 是否包含已删除的记录，默认为 false
   * @returns 返回指定 ID 的页面组件记录，如果记录不存在或已被删除（未设置 includeDeleted）则返回 undefined
   */
  async function getPageComponent(id: PageComponentId, includeDeleted = false): Promise<PageComponentRecord | undefined> {
    const record = await idb.get<PageComponentRecord>(PAGE_COMPONENTS_STORE_NAME, id)
    if (!includeDeleted && record && !isActiveRelation(record))
      return undefined

    return record
  }

  /**
   * 根据页面ID和组件ID获取页面组件记录
   * @param pageId - 页面的唯一标识符
   * @param componentId - 组件的唯一标识符
   * @param includeDeleted - 是否包含已删除的记录，默认为false
   * @returns 返回页面组件记录，如果未找到则返回undefined
   */
  async function getByPageAndComponent(
    pageId: string,
    componentId: string,
    includeDeleted = false,
  ): Promise<PageComponentRecord | undefined> {
    return getPageComponent(createRelationId(pageId, componentId), includeDeleted)
  }

  /**
   * 获取所有页面组件记录列表
   *
   * 从 IndexedDB 中查询所有页面组件记录，过滤出活跃的关系数据，
   * 并按更新时间从新到旧进行排序
   *
   * @returns {Promise<PageComponentRecord[]>} 返回按更新时间降序排列的页面组件记录数组
   */
  async function listPageComponents(): Promise<PageComponentRecord[]> {
    const records = await idb.getAll<PageComponentRecord>(PAGE_COMPONENTS_STORE_NAME)
    return filterActiveRelations(records).sort((a, b) => b.updatedAt - a.updatedAt)
  }

  /**
   * 更新页面组件的信息
   * @param id - 页面组件的唯一标识符
   * @param patch - 包含要更新的页面组件属性的部分对象
   * @returns 返回更新后的页面组件记录，如果组件不存在则返回 undefined
   * @remarks
   * 此函数会保留组件的原始 id、pageId、componentId 和 createdAt 字段不变。
   * 如果 patch 中未提供 updatedAt，则自动设置为当前时间戳。
   * 更新后的记录会被保存到 IndexedDB 的 PAGE_COMPONENTS_STORE_NAME 存储中。
   */
  async function updatePageComponent(id: PageComponentId, patch: UpdatePageComponentInput): Promise<PageComponentRecord | undefined> {
    const current = await getPageComponent(id)
    if (!current)
      return undefined

    const updated: PageComponentRecord = {
      ...current,
      ...patch,
      id: current.id,
      pageId: current.pageId,
      componentId: current.componentId,
      createdAt: current.createdAt,
      updatedAt: patch.updatedAt ?? Date.now(),
    }

    await idb.put(PAGE_COMPONENTS_STORE_NAME, updated)
    return updated
  }

  /**
   * 插入或更新页面组件记录
   * @param record - 页面组件记录对象
   * @returns 返回规范化后的页面组件记录
   * @description
   * - 如果记录中没有 id，则根据 pageId 和 componentId 生成关系 id
   * - 如果记录中没有 createdAt，则设置为当前时间戳
   * - 如果记录中没有 updatedAt，则设置为当前时间戳
   * - 将规范化后的记录存储到 IndexedDB 中
   */
  async function upsertPageComponent(record: PageComponentRecord): Promise<PageComponentRecord> {
    const now = Date.now()
    const normalized: PageComponentRecord = {
      ...record,
      id: record.id ?? createRelationId(record.pageId, record.componentId),
      createdAt: record.createdAt ?? now,
      updatedAt: record.updatedAt ?? now,
    }

    await idb.put(PAGE_COMPONENTS_STORE_NAME, normalized)
    return normalized
  }

  /**
   * 软删除页面组件
   *
   * 通过设置 deletedAt 和 updatedAt 时间戳来标记页面组件为已删除状态，
   * 实现逻辑删除而非物理删除。
   *
   * @param id - 页面组件的唯一标识符
   * @returns Promise<PageComponentRecord | undefined> - 返回更新后的页面组件记录，
   *          如果组件不存在或删除失败则返回 undefined
   */
  async function softDeletePageComponent(id: PageComponentId): Promise<PageComponentRecord | undefined> {
    return updatePageComponent(id, { deletedAt: Date.now(), updatedAt: Date.now() })
  }

  /**
   * 恢复已删除的页面组件
   *
   * @param id - 页面组件的唯一标识符
   * @returns 返回更新后的页面组件记录，如果操作失败则返回 undefined
   */
  async function restorePageComponent(id: PageComponentId): Promise<PageComponentRecord | undefined> {
    return updatePageComponent(id, { deletedAt: undefined, updatedAt: Date.now() })
  }

  /**
   * 从页面组件存储中移除指定的页面组件
   * @param id - 要移除的页面组件的唯一标识符
   * @returns 返回一个Promise，当移除操作完成时resolve
   * @throws 如果移除操作失败，Promise将被reject
   */
  async function removePageComponent(id: PageComponentId): Promise<void> {
    await idb.remove(PAGE_COMPONENTS_STORE_NAME, id)
  }

  /**
   * 清空页面组件存储中的所有数据
   * @async
   * @function clearPageComponents
   * @returns {Promise<void>} 返回一个在清空操作完成时解决的Promise
   * @throws {Error} 如果数据库操作失败，可能抛出错误
   */
  async function clearPageComponents(): Promise<void> {
    await idb.clear(PAGE_COMPONENTS_STORE_NAME)
  }

  /**
   * 获取页面组件的总数量
   * @returns {Promise<number>} 返回一个Promise，resolved时为页面组件的总数
   */
  async function countPageComponents(): Promise<number> {
    return idb.count(PAGE_COMPONENTS_STORE_NAME)
  }

  /**
   * 根据页面ID查询该页面下的所有组件记录
   * @param pageId - 页面的唯一标识符
   * @returns 返回Promise，包含该页面下所有活跃的页面组件记录数组，按更新时间倒序排列
   * @throws 当查询失败时将抛出错误
   */
  async function listByPageId(pageId: string): Promise<PageComponentRecord[]> {
    return idb.withStore(PAGE_COMPONENTS_STORE_NAME, 'readonly', (store) => {
      return new Promise<PageComponentRecord[]>((resolve, reject) => {
        const request = store.index('pageId').getAll(pageId)
        request.onsuccess = () => {
          const records = filterActiveRelations(request.result as PageComponentRecord[])
          resolve(records.sort((a, b) => b.updatedAt - a.updatedAt))
        }
        request.onerror = () => reject(request.error ?? new Error('Query pageId failed'))
      })
    })
  }

  /**
   * 根据组件ID获取页面组件列表
   * @param componentId - 组件ID
   * @returns 返回按更新时间倒序排列的活跃页面组件记录数组
   * @throws 当查询失败时抛出错误
   */
  async function listByComponentId(componentId: string): Promise<PageComponentRecord[]> {
    return idb.withStore(PAGE_COMPONENTS_STORE_NAME, 'readonly', (store) => {
      return new Promise<PageComponentRecord[]>((resolve, reject) => {
        const request = store.index('componentId').getAll(componentId)
        request.onsuccess = () => {
          const records = filterActiveRelations(request.result as PageComponentRecord[])
          resolve(records.sort((a, b) => b.updatedAt - a.updatedAt))
        }
        request.onerror = () => reject(request.error ?? new Error('Query componentId failed'))
      })
    })
  }

  /**
   * 根据角色获取页面组件记录列表
   * @param role - 角色标识符
   * @returns 返回指定角色的活跃页面组件记录数组，按更新时间降序排列
   * @throws 如果数据库查询失败，则抛出错误
   */
  async function listByRole(role: string): Promise<PageComponentRecord[]> {
    return idb.withStore(PAGE_COMPONENTS_STORE_NAME, 'readonly', (store) => {
      return new Promise<PageComponentRecord[]>((resolve, reject) => {
        const request = store.index('role').getAll(role)
        request.onsuccess = () => {
          const records = filterActiveRelations(request.result as PageComponentRecord[])
          resolve(records.sort((a, b) => b.updatedAt - a.updatedAt))
        }
        request.onerror = () => reject(request.error ?? new Error('Query role failed'))
      })
    })
  }

  return wrapAsyncApiWithLogger(schemaLogger, {
    createPageComponent,
    getPageComponent,
    getByPageAndComponent,
    listPageComponents,
    updatePageComponent,
    upsertPageComponent,
    softDeletePageComponent,
    restorePageComponent,
    removePageComponent,
    clearPageComponents,
    countPageComponents,
    listByPageId,
    listByComponentId,
    listByRole,
  })
}

export const page_components = pageComponentsStoreDefinition
export const page_componentsSchema = pageComponentsSchema
