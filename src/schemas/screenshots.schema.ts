import { IdbTransactionUtil } from '../utils/transaction.util'
import type { IdbTransactionContext } from '../utils/transaction.util'

/**
 * 截图存储空间的名称常量
 * @constant
 * @type {string}
 * @default 'screenshots'
 */
export const SCREENSHOTS_STORE_NAME = 'screenshots'

/**
 * 截图的唯一标识符
 * @typedef {string} ScreenshotId
 */
export type ScreenshotId = string

/**
 * 截图类型
 * @typedef {('representative' | 'always' | 'never')} ScreenshotKind
 * @description 定义截图的显示方式
 * - `representative` - 代表性截图
 * - `always` - 总是显示截图
 * - `never` - 从不显示截图
 */
export type ScreenshotKind = 'representative' | 'always' | 'never'

/**
 * 截图记录的数据结构
 * @interface ScreenshotRecord
 * @property {ScreenshotId} id - 截图的唯一标识符
 * @property {number} ts - 截图的时间戳
 * @property {string} pageId - 所属页面的ID
 * @property {string} clusterId - 所属集群的ID
 * @property {string} mime - 截图的MIME类型
 * @property {Blob} blob - 截图的二进制数据
 * @property {number} [width] - 截图的宽度（可选）
 * @property {number} [height] - 截图的高度（可选）
 * @property {ScreenshotKind} kind - 截图的类型
 * @property {number} [downloadId] - 浏览器下载任务ID（可选）
 * @property {string} [localPath] - 图片在本地下载目录中的绝对路径（可选）
 * @property {number} [deletedAt] - 截图的删除时间戳（可选）
 */
export interface ScreenshotRecord {
  id: ScreenshotId
  ts: number
  pageId: string
  clusterId: string
  mime: string
  blob: Blob
  width?: number
  height?: number
  kind: ScreenshotKind
  downloadId?: number
  localPath?: string
  deletedAt?: number
}

/**
 * 创建截图输入类型
 *
 * 基于 {@link ScreenshotRecord} 类型，排除 `id` 和 `ts` 字段，
 * 并将这两个字段设为可选属性。
 *
 * @typedef {object} CreateScreenshotInput
 * @property {ScreenshotId} [id] - 截图的唯一标识符（可选）
 * @property {number} [ts] - 截图的时间戳，单位为毫秒（可选）
 */
export type CreateScreenshotInput = Omit<ScreenshotRecord, 'id' | 'ts'> & {
  id?: ScreenshotId
  ts?: number
}

/**
 * 更新截图的输入类型
 *
 * 该类型用于更新截图记录时的输入参数。它是 ScreenshotRecord 类型的部分属性集合，
 * 排除了 id 字段，因为 id 是不可更改的唯一标识符。
 *
 * @typedef {object} UpdateScreenshotInput
 * @property
 */
export type UpdateScreenshotInput = Partial<Omit<ScreenshotRecord, 'id'>>

/**
 * 截图架构的选项配置接口
 * @interface ScreenshotsSchemaOptions
 * @property {string} [dbName] - 数据库名称，可选
 * @property {number} [version] - 架构版本号，可选
 */
export interface ScreenshotsSchemaOptions {
  dbName?: string
  version?: number
}

/**
 * 截图存储定义
 *
 * 定义了IndexedDB中截图数据存储的配置，包括存储名称、主键和索引信息
 *
 * @constant
 * @type {IdbStoreDefinition}
 *
 * @property {string} name - 存储名称，使用 SCREENSHOTS_STORE_NAME 常量
 * @property {object} options - 存储配置选项
 * @property {string} options.keyPath - 主键路径，使用 'id' 作为唯一标识
 * @property {Array<object>} indexes - 索引列表，用于优化查询性能
 * @property {string} indexes[].name - 索引名称
 * @property {string} indexes[].keyPath - 索引的键路径
 *
 * @description
 * 包含三个查询索引：
 * - pageId: 按页面ID查询截图
 * - clusterId: 按集群ID查询截图
 * - ts: 按时间戳查询截图
 */
const screenshotsStoreDefinition: IdbStoreDefinition = {
  name: SCREENSHOTS_STORE_NAME,
  options: { keyPath: 'id' },
  indexes: [
    { name: 'pageId', keyPath: 'pageId' },
    { name: 'clusterId', keyPath: 'clusterId' },
    { name: 'ts', keyPath: 'ts' },
  ],
}

/**
 * 生成唯一的截图ID。
 *
 * 如果环境支持 `crypto.randomUUID()`，则使用该方法生成符合 RFC 4122 标准的 UUID。
 * 否则，使用当前时间戳和随机数的组合生成一个伪唯一ID。
 *
 * @returns {ScreenshotId} 生成的截图ID
 */
function createScreenshotId(): ScreenshotId {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return crypto.randomUUID()

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * 判断截图记录是否处于活跃状态
 * @param record - 截图记录对象
 * @returns 如果记录未被删除（deletedAt不是数字类型）则返回true，否则返回false
 */
function isActiveScreenshot(record: ScreenshotRecord) {
  return typeof record.deletedAt !== 'number'
}

/**
 * 筛选活跃的截图记录
 * @param records - 截图记录数组
 * @returns 返回包含所有活跃截图的数组
 */
function filterActiveScreenshots(records: ScreenshotRecord[]) {
  return records.filter(isActiveScreenshot)
}

export function screenshotsSchema(options: ScreenshotsSchemaOptions = {}) {
  /**
   * 用于记录截图schema相关日志的日志记录器实例
   * @const
   * @type {Logger}
   */
  const schemaLogger = createLogger('schema:screenshots')

  /**
   * 初始化IndexedDB数据库实例
   * @param {object} options - 配置选项
   * @param {string} [options.dbName='flow-dock-dev'] - 数据库名称，默认为'flow-dock-dev'
   * @param {number} [options.version=1] - 数据库版本号，默认为1
   * @param {Array} options.stores - 数据库stores定义数组，包含screenshotsStoreDefinition
   * @returns {IdbInstance} 返回初始化后的IndexedDB实例，用于后续的数据库操作
   */
  const idb = useIdb({
    dbName: options.dbName ?? 'flow-dock-dev',
    version: options.version ?? 1,
    stores: [screenshotsStoreDefinition],
  })

  function getTxStore(transaction?: IdbTransactionContext) {
    return transaction?.getStore(SCREENSHOTS_STORE_NAME)
  }

  /**
   * 创建一个新的截图记录
   * @param input - 创建截图所需的输入参数
   * @returns 返回创建后的截图记录
   * @throws {Error} 当数据库操作失败时抛出错误
   *
   * @remarks
   * - 如果未提供 `id`，则会自动生成一个新的截图 ID
   * - 如果未提供 `ts`（时间戳），则使用当前时间
   * - 记录会被存储到 IndexedDB 的 SCREENSHOTS_STORE_NAME 存储空间中
   */
  async function createScreenshot(input: CreateScreenshotInput, transaction?: IdbTransactionContext): Promise<ScreenshotRecord> {
    const record: ScreenshotRecord = {
      ...input,
      id: input.id ?? createScreenshotId(),
      ts: input.ts ?? Date.now(),
    }

    const txStore = getTxStore(transaction)
    if (txStore)
      await IdbTransactionUtil.requestToPromise(txStore.add(record))
    else
      await idb.add(SCREENSHOTS_STORE_NAME, record)

    return record
  }

  /**
   * 获取指定ID的截图记录
   * @param id - 截图的唯一标识符
   * @param includeDeleted - 是否包含已删除的截图，默认为false
   * @returns 返回截图记录，如果不存在或已被删除（当includeDeleted为false时）则返回undefined
   * @remarks
   * 此函数从IndexedDB数据库的SCREENSHOTS_STORE_NAME存储中检索截图。
   * 如果includeDeleted设置为false，函数会检查截图的活跃状态，
   * 只有活跃的截图才会被返回。
   */
  async function getScreenshot(id: ScreenshotId, includeDeleted = false, transaction?: IdbTransactionContext): Promise<ScreenshotRecord | undefined> {
    const txStore = getTxStore(transaction)
    const record = txStore
      ? await IdbTransactionUtil.requestToPromise<ScreenshotRecord | undefined>(txStore.get(id))
      : await idb.get<ScreenshotRecord>(SCREENSHOTS_STORE_NAME, id)

    if (!includeDeleted && record && !isActiveScreenshot(record))
      return undefined

    return record
  }

  /**
   * 获取所有截图记录的列表
   * @returns 返回按时间戳从新到旧排序的活跃截图记录数组
   * @remarks 该函数从 IndexedDB 中检索所有截图记录，过滤出活跃的记录，并按时间戳降序排列
   */
  async function listScreenshots(): Promise<ScreenshotRecord[]> {
    const records = await idb.getAll<ScreenshotRecord>(SCREENSHOTS_STORE_NAME)
    return filterActiveScreenshots(records).sort((a, b) => b.ts - a.ts)
  }

  /**
   * 更新截图记录
   * @param id - 截图的唯一标识符
   * @param patch - 包含需要更新的字段的部分更新对象
   * @returns 返回更新后的截图记录，如果原记录不存在则返回undefined
   * @throws 当数据库操作失败时可能抛出异常
   */
  async function updateScreenshot(id: ScreenshotId, patch: UpdateScreenshotInput, transaction?: IdbTransactionContext): Promise<ScreenshotRecord | undefined> {
    const current = await getScreenshot(id, false, transaction)
    if (!current)
      return undefined

    const updated: ScreenshotRecord = {
      ...current,
      ...patch,
      id: current.id,
      ts: patch.ts ?? Date.now(),
    }

    const txStore = getTxStore(transaction)
    if (txStore)
      await IdbTransactionUtil.requestToPromise(txStore.put(updated))
    else
      await idb.put(SCREENSHOTS_STORE_NAME, updated)

    return updated
  }

  /**
   * 插入或更新截图记录
   * @param record - 截图记录对象
   * @returns 返回规范化后的截图记录
   * @remarks
   * 该函数会自动为缺失的字段填充默认值：
   * - 如果未提供 id，则生成新的截图 ID
   * - 如果未提供 ts，则使用当前时间戳
   *
   * 处理后的记录会被存储到 IndexedDB 的 SCREENSHOTS_STORE 中
   */
  async function upsertScreenshot(record: ScreenshotRecord): Promise<ScreenshotRecord> {
    const normalized: ScreenshotRecord = {
      ...record,
      id: record.id ?? createScreenshotId(),
      ts: record.ts ?? Date.now(),
    }

    await idb.put(SCREENSHOTS_STORE_NAME, normalized)
    return normalized
  }

  /**
   * 软删除截图记录
   * @param id - 截图的唯一标识符
   * @returns 返回更新后的截图记录，如果截图不存在则返回 undefined
   * @remarks
   * 该函数通过设置 deletedAt 和 ts 时间戳来实现软删除，
   * 不会真正删除数据库中的记录，而是标记为已删除状态
   */
  async function softDeleteScreenshot(id: ScreenshotId): Promise<ScreenshotRecord | undefined> {
    return updateScreenshot(id, { deletedAt: Date.now(), ts: Date.now() })
  }

  /**
   * 恢复已删除的截图记录
   * @param id - 截图的唯一标识符
   * @returns 返回更新后的截图记录，如果操作失败则返回 undefined
   */
  async function restoreScreenshot(id: ScreenshotId): Promise<ScreenshotRecord | undefined> {
    return updateScreenshot(id, { deletedAt: undefined, ts: Date.now() })
  }

  /**
   * 移除指定ID的截图记录
   * @param id - 截图的唯一标识符
   * @returns 返回一个Promise，当移除操作完成时resolve
   * @throws 如果数据库操作失败，将抛出错误
   */
  async function removeScreenshot(id: ScreenshotId): Promise<void> {
    await idb.remove(SCREENSHOTS_STORE_NAME, id)
  }

  /**
   * 清空所有截图数据
   *
   * 从 IndexedDB 中删除 SCREENSHOTS_STORE_NAME 存储中的所有数据。
   *
   * @returns {Promise<void>} 返回一个 Promise，当清空操作完成时 resolve
   */
  async function clearScreenshots(): Promise<void> {
    await idb.clear(SCREENSHOTS_STORE_NAME)
  }

  /**
   * 获取截图存储中的截图总数
   * @returns {Promise<number>} 返回一个Promise，解析为截图的总数
   */
  async function countScreenshots(): Promise<number> {
    return idb.count(SCREENSHOTS_STORE_NAME)
  }

  /**
   * 根据页面ID获取截图记录列表
   * @param pageId - 页面的唯一标识符
   * @returns 返回按时间戳降序排列的活跃截图记录数组
   * @throws 当数据库查询失败时抛出错误
   */
  async function listByPageId(pageId: string): Promise<ScreenshotRecord[]> {
    return idb.withStore(SCREENSHOTS_STORE_NAME, 'readonly', (store) => {
      return new Promise<ScreenshotRecord[]>((resolve, reject) => {
        const request = store.index('pageId').getAll(pageId)
        request.onsuccess = () => {
          const records = filterActiveScreenshots(request.result as ScreenshotRecord[])
          resolve(records.sort((a, b) => b.ts - a.ts))
        }
        request.onerror = () => reject(request.error ?? new Error('Query pageId failed'))
      })
    })
  }

  /**
   * 根据集群ID获取截图记录列表
   * @param clusterId - 集群的唯一标识符
   * @returns 返回按时间戳从新到旧排序的活跃截图记录数组的Promise
   * @throws 当数据库查询失败时抛出错误
   */
  async function listByClusterId(clusterId: string): Promise<ScreenshotRecord[]> {
    return idb.withStore(SCREENSHOTS_STORE_NAME, 'readonly', (store) => {
      return new Promise<ScreenshotRecord[]>((resolve, reject) => {
        const request = store.index('clusterId').getAll(clusterId)
        request.onsuccess = () => {
          const records = filterActiveScreenshots(request.result as ScreenshotRecord[])
          resolve(records.sort((a, b) => b.ts - a.ts))
        }
        request.onerror = () => reject(request.error ?? new Error('Query clusterId failed'))
      })
    })
  }

  /**
   * 根据时间范围查询截图记录
   * @param startTs - 开始时间戳（毫秒）
   * @param endTs - 结束时间戳（毫秒），可选。如果不提供，则查询从startTs开始的所有记录
   * @returns 返回时间范围内的活跃截图记录数组，按时间戳降序排列
   * @throws 当数据库查询失败时抛出错误
   */
  async function listByTsRange(startTs: number, endTs?: number): Promise<ScreenshotRecord[]> {
    const range = typeof endTs === 'number'
      ? IDBKeyRange.bound(startTs, endTs)
      : IDBKeyRange.lowerBound(startTs)

    return idb.withStore(SCREENSHOTS_STORE_NAME, 'readonly', (store) => {
      return new Promise<ScreenshotRecord[]>((resolve, reject) => {
        const request = store.index('ts').getAll(range)
        request.onsuccess = () => {
          const records = filterActiveScreenshots(request.result as ScreenshotRecord[])
          resolve(records.sort((a, b) => b.ts - a.ts))
        }
        request.onerror = () => reject(request.error ?? new Error('Query ts failed'))
      })
    })
  }

  return wrapAsyncApiWithLogger(schemaLogger, {
    createScreenshot,
    getScreenshot,
    listScreenshots,
    updateScreenshot,
    upsertScreenshot,
    softDeleteScreenshot,
    restoreScreenshot,
    removeScreenshot,
    clearScreenshots,
    countScreenshots,
    listByPageId,
    listByClusterId,
    listByTsRange,
  })
}

export const screenshots = screenshotsStoreDefinition
export const screenshotSchema = screenshotsSchema
