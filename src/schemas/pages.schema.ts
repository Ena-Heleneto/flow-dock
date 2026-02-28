/**
 * 页面存储的名称常量
 * @constant
 * @type {string}
 */
export const PAGES_STORE_NAME = 'pages'

/**
 * 页面标识符类型。
 *
 * `PageId` 用于表示页面的唯一 ID，底层类型为 `string`。
 */
export type PageId = string

/**
 * 页面集群的唯一标识符
 * @typedef {string} PageClusterId
 */
export type PageClusterId = string

/**
 * 页面指纹信息接口
 * 用于存储页面的结构哈希和视觉哈希值，用于页面变化检测和比较
 *
 * @interface PageFingerprints
 *
 * @property {string} [structHash] - 页面结构哈希值，用于检测页面DOM结构的变化
 * @property {string} [visualHash] - 页面视觉哈希值，用于检测页面视觉外观的变化
 */
export interface PageFingerprints {
  structHash?: string
  visualHash?: string
}

/**
 * 页面摘要信息接口
 * @interface PageSummary
 * @property {string[]} [parts] - 页面部分/组件列表，可选
 * @property {string[]} [texts] - 页面文本内容列表，可选
 * @property {string} [theme] - 页面主题配置，可选
 */
export interface PageSummary {
  parts?: string[]
  texts?: string[]
  theme?: string
}

/**
 * 页面差异信息
 * @interface PageDiff
 * @property {string} [text] - 差异的文本内容
 * @property {number} [score] - 差异的相似度评分
 */
export interface PageDiff {
  text?: string
  score?: number
}

/**
 * 页面记录接口
 * @interface PageRecord
 * @property {PageId} id - 页面唯一标识符
 * @property {number} ts - 页面记录的时间戳
 * @property {string} system - 所属系统名称
 * @property {string} module - 所属模块名称
 * @property {string} pageType - 页面类型
 * @property {string[]} tags - 页面标签数组
 * @property {string} url - 页面的URL地址
 * @property {string} title - 页面标题
 * @property {string} route - 页面路由路径
 * @property {string} routeSig - 路由签名
 * @property {PageClusterId} clusterId - 页面所属集群ID
 * @property {PageFingerprints} fingerprints - 页面指纹信息
 * @property {PageSummary} [summary] - 页面摘要信息（可选）
 * @property {PageDiff} [diff] - 页面差异信息（可选）
 * @property {number} [deletedAt] - 伪删除时间戳（毫秒）；未删除时为空
 * @property {string} [screenshotId] - 页面截图ID（可选）
 */
export interface PageRecord {
  id: PageId
  ts: number
  system: string
  module: string
  pageType: string
  tags: string[]
  url: string
  title: string
  route: string
  routeSig: string
  clusterId: PageClusterId
  fingerprints: PageFingerprints
  summary?: PageSummary
  diff?: PageDiff
  deletedAt?: number
  screenshotId?: string
}

/**
 * 创建页面的输入类型
 *
 * 基于 {@link PageRecord} 类型，排除了 `id` 和 `ts` 字段，并将它们设为可选属性
 *
 * @typedef {object} CreatePageInput
 * @property {PageId} [id] - 页面的唯一标识符，可选
 * @property {number} [ts] - 时间戳，可选
 */
export type CreatePageInput = Omit<PageRecord, 'id' | 'ts'> & {
  id?: PageId
  ts?: number
}

/**
 * 更新页面的输入类型
 *
 * 包含除了 `id` 之外的所有页面记录字段，且所有字段都是可选的。
 * 用于更新现有页面的部分或全部信息。
 *
 * @typedef {object} UpdatePageInput
 * @property {Partial<Omit<PageRecord, 'id'>>} patch - 页面更新补丁对象
 */
export type UpdatePageInput = Partial<Omit<PageRecord, 'id'>>

/**
 * 页面模式选项配置接口
 * 用于定义页面数据库模式的初始化参数
 *
 * @interface PagesSchemaOptions
 */
export interface PagesSchemaOptions {
  dbName?: string
  version?: number
}

/**
 * 页面存储定义
 *
 * 定义了 IndexedDB 中页面数据存储的结构和索引配置
 *
 * @remarks
 * - 存储名称: PAGES_STORE_NAME
 * - 主键路径: id
 *
 * @property {string} name - 存储名称
 * @property {IDBObjectStoreParameters} options - 存储配置选项，指定 id 为主键
 * @property {Array<{name: string, keyPath: string}>} indexes - 索引定义数组，包括：
 *   - routeSig: 路由签名索引
 *   - clusterId: 集群ID索引
 *   - system: 系统类型索引
 *   - pageType: 页面类型索引
 *   - ts: 时间戳索引
 */
const pagesStoreDefinition: IdbStoreDefinition = {
  name: PAGES_STORE_NAME,
  options: { keyPath: 'id' },
  indexes: [
    { name: 'routeSig', keyPath: 'routeSig' },
    { name: 'clusterId', keyPath: 'clusterId' },
    { name: 'system', keyPath: 'system' },
    { name: 'pageType', keyPath: 'pageType' },
    { name: 'ts', keyPath: 'ts' },
  ],
}

/**
 * 生成唯一的页面ID
 *
 * 优先使用浏览器原生的 `crypto.randomUUID()` 方法生成符合 RFC 4122 标准的 UUID。
 * 如果运行环境不支持该方法，则使用时间戳和随机数组合作为降级方案。
 *
 * @returns {string} 页面的唯一标识符。格式为 UUID 字符串（标准环境）或 `${timestamp}-${randomString}` 格式（降级方案）
 */
function createPageId(): PageId {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return crypto.randomUUID()

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function isActivePage(page: PageRecord): boolean {
  return typeof page.deletedAt !== 'number'
}

/**
 * 筛选活跃页面
 * @param pages - 页面记录数组
 * @returns 返回包含所有活跃页面的新数组
 */
function filterActivePages(pages: PageRecord[]): PageRecord[] {
  return pages.filter(isActivePage)
}

export function pagesSchema(options: PagesSchemaOptions = {}) {
  /**
   * 初始化 IndexedDB 实例
   * @param {object} options - 配置选项
   * @param {string} [options.dbName='flow-dock'] - 数据库名称，默认为 'flow-dock'
   * @param {number} [options.version=1] - 数据库版本号，默认为 1
   * @param {Array} options.stores - 数据库存储对象定义数组，包含 pagesStoreDefinition
   * @returns {object} IndexedDB 实例，提供数据库操作接口
   */
  const idb = useIdb({ dbName: options.dbName ?? 'flow-dock', version: options.version ?? 1, stores: [pagesStoreDefinition] })

  /**
   * 创建一个新的页面记录
   * @param input - 创建页面的输入参数
   * @returns 返回创建后的页面记录对象
   * @throws 当数据库操作失败时抛出异常
   *
   * @remarks
   * 该函数会自动为页面生成以下默认值：
   * - id: 如果未提供则自动生成
   * - ts: 如果未提供则使用当前时间戳
   * - tags: 如果未提供则初始化为空数组
   * - fingerprints: 如果未提供则初始化为空对象
   */
  async function createPage(input: CreatePageInput): Promise<PageRecord> {
    const page: PageRecord = {
      ...input,
      id: input.id ?? createPageId(),
      ts: input.ts ?? Date.now(),
      tags: input.tags ?? [],
      fingerprints: input.fingerprints ?? {},
    }

    await idb.add(PAGES_STORE_NAME, page)
    return page
  }

  /**
   * 通过页面ID获取页面记录
   * @param id - 页面的唯一标识符
   * @returns 返回一个Promise，解析为PageRecord对象；如果页面不存在则返回undefined
   * @throws 当数据库操作失败时可能抛出错误
   */
  async function getPage(id: PageId, includeDeleted = false): Promise<PageRecord | undefined> {
    const page = await idb.get<PageRecord>(PAGES_STORE_NAME, id)
    if (!includeDeleted && page && !isActivePage(page))
      return undefined

    return page
  }

  /**
   * 获取所有页面记录并按时间戳倒序排列
   * @async
   * @function listPages
   * @returns {Promise<PageRecord[]>} 按修改时间从新到旧排序的页面记录数组
   */
  async function listPages(): Promise<PageRecord[]> {
    const pages = await idb.getAll<PageRecord>(PAGES_STORE_NAME)
    return filterActivePages(pages).sort((a, b) => b.ts - a.ts)
  }

  /**
   * 更新指定ID的页面记录
   * @param id - 页面的唯一标识符
   * @param patch - 页面的部分更新数据
   * @returns 返回更新后的页面记录，如果页面不存在则返回 undefined
   * @throws 当数据库操作失败时可能抛出错误
   *
   * @remarks
   * 此函数会保留原有的页面数据，并用提供的patch数据进行覆盖。
   * 时间戳(ts)、标签(tags)和指纹(fingerprints)字段有特殊处理逻辑：
   * - ts: 优先使用patch提供的值，否则使用当前系统时间戳
   * - tags: 优先使用patch提供的值，否则保留当前值，默认为空数组
   * - fingerprints: 优先使用patch提供的值，否则保留当前值，默认为空对象
   */
  async function updatePage(id: PageId, patch: UpdatePageInput): Promise<PageRecord | undefined> {
    const current = await getPage(id)
    if (!current)
      return undefined

    const updated: PageRecord = {
      ...current,
      ...patch,
      id: current.id,
      ts: patch.ts ?? Date.now(),
      tags: patch.tags ?? current.tags ?? [],
      fingerprints: patch.fingerprints ?? current.fingerprints ?? {},
    }

    await idb.put(PAGES_STORE_NAME, updated)
    return updated
  }

  /**
   * 插入或更新页面记录
   * @param page - 要插入或更新的页面记录
   * @returns 返回标准化后的页面记录，包含时间戳、标签和指纹信息
   * @remarks
   * 此函数会对输入的页面记录进行标准化处理：
   * - 如果未提供时间戳，则使用当前时间
   * - 如果未提供标签，则初始化为空数组
   * - 如果未提供指纹信息，则初始化为空对象
   * 标准化后的记录将被存储到 IndexedDB 的页面存储中
   */
  async function upsertPage(page: PageRecord): Promise<PageRecord> {
    const normalized: PageRecord = {
      ...page,
      ts: page.ts ?? Date.now(),
      tags: page.tags ?? [],
      fingerprints: page.fingerprints ?? {},
    }

    await idb.put(PAGES_STORE_NAME, normalized)
    return normalized
  }

  /**
   * 删除指定ID的页面
   * @param id - 要删除的页面ID
   * @returns Promise<void>
   */
  async function softDeletePage(id: PageId): Promise<PageRecord | undefined> {
    return updatePage(id, { deletedAt: Date.now(), ts: Date.now() })
  }

  /**
   * 恢复已删除的页面
   * @param id - 页面的唯一标识符
   * @returns 返回更新后的页面记录，如果页面不存在则返回 undefined
   */
  async function restorePage(id: PageId): Promise<PageRecord | undefined> {
    return updatePage(id, { deletedAt: undefined, ts: Date.now() })
  }

  /**
   * 清空页面存储中的所有数据
   *
   * 此函数会删除IndexedDB中PAGES_STORE_NAME存储空间内的所有页面记录。
   * 执行此操作是一个异步操作，需要等待完成。
   *
   * @async
   * @returns {Promise<void>} 返回一个在清空操作完成时resolve的Promise
   */
  async function clearPages(): Promise<void> {
    await idb.clear(PAGES_STORE_NAME)
  }

  /**
   * 获取页面存储中的页面总数
   * @returns {Promise<number>} 返回页面总数的Promise
   */
  async function countPages(): Promise<number> {
    return idb.count(PAGES_STORE_NAME)
  }

  /**
   * 通过路由签名查询页面记录
   * @param routeSig - 路由签名，用于识别特定的路由
   * @returns 返回一个Promise，解析为PageRecord数组
   * @throws 如果查询失败，将抛出Error对象
   */
  async function listByRouteSig(routeSig: string): Promise<PageRecord[]> {
    return idb.withStore(PAGES_STORE_NAME, 'readonly', (store) => {
      return new Promise<PageRecord[]>((resolve, reject) => {
        const request = store.index('routeSig').getAll(routeSig)
        request.onsuccess = () => resolve(filterActivePages(request.result as PageRecord[]))
        request.onerror = () => reject(request.error ?? new Error('Query routeSig failed'))
      })
    })
  }

  /**
   * 根据集群ID查询页面记录
   *
   * @param clusterId - 页面集群的唯一标识符
   * @returns 返回一个Promise，解析为匹配指定集群ID的PageRecord数组
   * @throws 当查询操作失败时抛出Error
   */
  async function listByClusterId(clusterId: PageClusterId): Promise<PageRecord[]> {
    return idb.withStore(PAGES_STORE_NAME, 'readonly', (store) => {
      return new Promise<PageRecord[]>((resolve, reject) => {
        const request = store.index('clusterId').getAll(clusterId)
        request.onsuccess = () => resolve(filterActivePages(request.result as PageRecord[]))
        request.onerror = () => reject(request.error ?? new Error('Query clusterId failed'))
      })
    })
  }

  /**
   * 根据系统标识符查询所有页面记录
   * @param system - 系统标识符，用于在IndexedDB中查询匹配的页面
   * @returns 返回一个Promise，解析为匹配该系统的PageRecord数组
   * @throws 当IndexedDB查询失败时，Promise会被拒绝并返回相应的错误信息
   */
  async function listBySystem(system: string): Promise<PageRecord[]> {
    return idb.withStore(PAGES_STORE_NAME, 'readonly', (store) => {
      return new Promise<PageRecord[]>((resolve, reject) => {
        const request = store.index('system').getAll(system)
        request.onsuccess = () => resolve(filterActivePages(request.result as PageRecord[]))
        request.onerror = () => reject(request.error ?? new Error('Query system failed'))
      })
    })
  }

  /**
   * 根据页面类型查询页面记录
   * @param pageType - 页面类型
   * @returns 返回指定类型的所有页面记录的 Promise
   * @throws 当查询失败时抛出错误
   */
  async function listByPageType(pageType: string): Promise<PageRecord[]> {
    return idb.withStore(PAGES_STORE_NAME, 'readonly', (store) => {
      return new Promise<PageRecord[]>((resolve, reject) => {
        const request = store.index('pageType').getAll(pageType)
        request.onsuccess = () => resolve(filterActivePages(request.result as PageRecord[]))
        request.onerror = () => reject(request.error ?? new Error('Query pageType failed'))
      })
    })
  }

  /**
   * 按时间戳范围查询页面记录
   * @param startTs 开始时间戳（毫秒）
   * @param endTs 结束时间戳（毫秒），可选。如果不提供，则查询大于等于startTs的所有记录
   * @returns 返回按时间戳降序排列的页面记录数组
   * @throws 如果查询失败，将抛出错误
   */
  async function listByTsRange(startTs: number, endTs?: number): Promise<PageRecord[]> {
    const range = typeof endTs === 'number'
      ? IDBKeyRange.bound(startTs, endTs)
      : IDBKeyRange.lowerBound(startTs)

    return idb.withStore(PAGES_STORE_NAME, 'readonly', (store) => {
      return new Promise<PageRecord[]>((resolve, reject) => {
        const request = store.index('ts').getAll(range)
        request.onsuccess = () => {
          const pages = filterActivePages(request.result as PageRecord[])
          resolve(pages.sort((a, b) => b.ts - a.ts))
        }
        request.onerror = () => reject(request.error ?? new Error('Query ts failed'))
      })
    })
  }

  return {
    createPage,
    getPage,
    listPages,
    updatePage,
    upsertPage,
    softDeletePage,
    restorePage,
    clearPages,
    countPages,
    listByRouteSig,
    listByClusterId,
    listBySystem,
    listByPageType,
    listByTsRange,
  }
}
