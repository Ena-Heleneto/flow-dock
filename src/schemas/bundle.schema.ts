// import { createLogger, wrapAsyncApiWithLogger } from '~/utils/logger.util'
import { IdbTransactionUtil } from '../utils/transaction.util'
import type { IdbTransactionContext } from '../utils/transaction.util'

/**
 * 用于存储打包数据的存储区名称
 * @constant
 * @type {string}
 */
export const BUNDLES_STORE_NAME = 'bundles'

/**
 * 捆绑包的唯一标识符
 * @typedef {string} BundleId
 */
export type BundleId = string

/**
 * 包裹布局标志配置接口
 * @description 用于定义布局中各个组件的显隐状态
 * @interface BundleLayoutFlags
 * @property {boolean} [hasTabs] - 是否显示标签页组件
 * @property {boolean} [hasDrawer] - 是否显示抽屉组件
 * @property {boolean} [hasBreadcrumb] - 是否显示面包屑导航组件
 * @property {boolean | undefined} [key: string] - 其他布局标志配置项
 */
export interface BundleLayoutFlags {
  hasTabs?: boolean
  hasDrawer?: boolean
  hasBreadcrumb?: boolean
  [key: string]: boolean | undefined
}

/**
 * 捆绑包记录的数据结构
 *
 * @interface BundleRecord
 * @property {BundleId} id - 捆绑包的唯一标识符
 * @property {string} name - 捆绑包的名称
 * @property {string} pageType - 页面类型
 * @property {BundleLayoutFlags} layoutFlags - 布局标志位配置
 * @property {string[]} componentKinds - 包含的组件类型数组
 * @property {string} templateSig - 模板签名，用于标识模板版本或完整性
 * @property {number} createdAt - 创建时间戳（毫秒）
 * @property {number} updatedAt - 更新时间戳（毫秒）
 * @property {number} [deletedAt] - 删除时间戳（毫秒），可选字段，仅当记录被删除时存在
 */
export interface BundleRecord {
  id: BundleId
  name: string
  pageType: string
  layoutFlags: BundleLayoutFlags
  componentKinds: string[]
  templateSig: string
  createdAt: number
  updatedAt: number
  deletedAt?: number
}

/**
 * 创建Bundle的输入类型
 *
 * 从 {@link BundleRecord} 中排除 `id`、`createdAt` 和 `updatedAt` 字段，
 * 然后将这些字段设置为可选属性。
 *
 * @typedef {object} CreateBundleInput
 * @property {BundleId} [id] - Bundle的唯一标识符（可选）
 * @property {number} [createdAt] - Bundle的创建时间戳（可选）
 * @property {number} [updatedAt] - Bundle的最后更新时间戳（可选）
 * @extends Omit<BundleRecord, 'id' | 'createdAt' | 'updatedAt'>
 */
export type CreateBundleInput = Omit<BundleRecord, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: BundleId
  createdAt?: number
  updatedAt?: number
}

/**
 * 更新Bundle的输入类型
 *
 * 这是一个部分类型，包含BundleRecord中除了'id'和'createdAt'之外的所有字段
 * 用于更新操作时，允许用户选择性地更新Bundle的任何属性
 *
 * @typedef {Partial<Omit<BundleRecord, 'id' | 'createdAt'>>} UpdateBundleInput
 */
export type UpdateBundleInput = Partial<Omit<BundleRecord, 'id' | 'createdAt'>>

/**
 * Bundle 结构体的选项配置接口
 * @interface BundleSchemaOptions
 * @property {string} [dbName] - 数据库名称，可选参数
 * @property {number} [version] - 版本号，可选参数
 */
export interface BundleSchemaOptions {
  dbName?: string
  version?: number
}

/**
 * Bundle 存储定义
 *
 * 定义了 IndexedDB 中 Bundle 对象存储的配置，包括存储名称、主键和索引信息。
 *
 * @const
 * @type {IdbStoreDefinition}
 *
 * @property {string} name - 存储名称，使用 BUNDLES_STORE_NAME 常量
 * @property {object} options - 存储选项配置
 * @property {string} options.keyPath - 主键路径，使用 'id' 字段作为主键
 * @property {Array<object>} indexes - 索引数组
 * @property {string} indexes[0].name - 页面类型索引名称
 * @property {string} indexes[0].keyPath - 页面类型索引键路径
 * @property {string} indexes[1].name - 模板签名索引名称
 * @property {string} indexes[1].keyPath - 模板签名索引键路径
 */
const bundlesStoreDefinition: IdbStoreDefinition = {
  name: BUNDLES_STORE_NAME,
  options: { keyPath: 'id' },
  indexes: [
    { name: 'pageType', keyPath: 'pageType' },
    { name: 'templateSig', keyPath: 'templateSig' },
  ],
}

/**
 * 创建一个唯一的 Bundle ID
 * @returns {BundleId} 返回一个唯一的 Bundle ID 字符串
 * @description
 * 该函数优先使用原生的 `crypto.randomUUID()` 方法生成 UUID。
 * 如果当前环境不支持 `crypto.randomUUID()`（例如在某些旧版浏览器中），
 * 则使用时间戳和随机数的组合作为备选方案。
 */
function createBundleId(): BundleId {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return crypto.randomUUID()

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * 检查指定的捆绑包是否处于活跃状态
 * @param bundle - 要检查的捆绑包记录
 * @returns 如果捆绑包未被删除（deletedAt 不是数字类型），则返回 true；否则返回 false
 */
function isActiveBundle(bundle: BundleRecord): boolean {
  return typeof bundle.deletedAt !== 'number'
}

/**
 * 过滤活跃的包记录
 * @param bundles - 包记录数组
 * @returns 返回包含所有活跃包的数组
 */
function filterActiveBundles(bundles: BundleRecord[]): BundleRecord[] {
  return bundles.filter(isActiveBundle)
}

export function bundleSchema(options: BundleSchemaOptions = {}) {
  const schemaLogger = createLogger('schema:bundle')

  /**
   * 初始化 IndexedDB 数据库实例
   * @description 创建一个 IndexedDB 数据库连接，用于存储和管理 bundle 数据的持久化
   * @param {object} options - 配置选项
   * @param {string} [options.dbName='flow-dock-dev'] - 数据库名称，默认为 'flow-dock-dev'
   * @param {number} [options.version=1] - 数据库版本号，默认为 1
   * @param {Array} options.stores - 数据库存储对象定义数组，包含 bundlesStoreDefinition
   * @returns {IdbInstance} 返回 IndexedDB 数据库实例，可用于数据的增删改查操作
   */
  const idb = useIdb({
    dbName: options.dbName ?? 'flow-dock-dev',
    version: options.version ?? 1,
    stores: [bundlesStoreDefinition],
  })

  function getTxStore(transaction?: IdbTransactionContext) {
    return transaction?.getStore(BUNDLES_STORE_NAME)
  }

  /**
   * 创建一个新的Bundle记录
   * @param input - Bundle的创建输入参数
   * @returns 返回创建后的Bundle记录
   * @throws 如果数据库操作失败，将抛出异常
   */
  async function createBundle(input: CreateBundleInput, transaction?: IdbTransactionContext): Promise<BundleRecord> {
    const now = Date.now()
    const bundle: BundleRecord = {
      ...input,
      id: input.id ?? createBundleId(),
      layoutFlags: input.layoutFlags ?? {},
      componentKinds: input.componentKinds ?? [],
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    }

    const txStore = getTxStore(transaction)
    if (txStore)
      await IdbTransactionUtil.requestToPromise(txStore.add(bundle))
    else
      await idb.add(BUNDLES_STORE_NAME, bundle)

    return bundle
  }

  /**
   * 获取指定ID的数据包记录
   * @param id - 数据包的唯一标识符
   * @param includeDeleted - 是否包含已删除的数据包，默认为false
   * @returns 返回匹配的数据包记录，如果未找到或被排除则返回undefined
   * @remarks 当includeDeleted为false时，如果数据包已被删除（非活跃状态），将返回undefined
   */
  async function getBundle(id: BundleId, includeDeleted = false, transaction?: IdbTransactionContext): Promise<BundleRecord | undefined> {
    const txStore = getTxStore(transaction)
    const bundle = txStore
      ? await IdbTransactionUtil.requestToPromise<BundleRecord | undefined>(txStore.get(id))
      : await idb.get<BundleRecord>(BUNDLES_STORE_NAME, id)

    if (!includeDeleted && bundle && !isActiveBundle(bundle))
      return undefined

    return bundle
  }

  /**
   * 获取所有活跃的 Bundle 记录列表
   *
   * 从 IndexedDB 中查询所有 Bundle 记录，过滤出活跃的 Bundle，
   * 并按照更新时间从新到旧排序。
   *
   * @returns {Promise<BundleRecord[]>} 活跃 Bundle 记录数组，按更新时间降序排列
   */
  async function listBundles(transaction?: IdbTransactionContext): Promise<BundleRecord[]> {
    const txStore = getTxStore(transaction)
    const bundles = txStore
      ? await IdbTransactionUtil.requestToPromise<BundleRecord[]>(txStore.getAll())
      : await idb.getAll<BundleRecord>(BUNDLES_STORE_NAME)

    return filterActiveBundles(bundles).sort((a, b) => b.updatedAt - a.updatedAt)
  }

  /**
   * 更新指定ID的Bundle记录
   * @param id - Bundle的唯一标识符
   * @param patch - 包含要更新字段的部分Bundle数据
   * @returns 返回更新后的BundleRecord，如果Bundle不存在则返回undefined
   * @remarks
   * - 如果Bundle不存在，函数将返回undefined
   * - 保留原有的id和createdAt字段不变
   * - layoutFlags和componentKinds如果在patch中未提供，则保留现有值，默认为空对象和空数组
   * - updatedAt字段自动设置为当前时间戳（除非patch中明确指定）
   * - 更新后的记录会被保存到IndexedDB的BUNDLES_STORE_NAME存储区
   */
  async function updateBundle(id: BundleId, patch: UpdateBundleInput, transaction?: IdbTransactionContext): Promise<BundleRecord | undefined> {
    const current = await getBundle(id, false, transaction)
    if (!current)
      return undefined

    const updated: BundleRecord = {
      ...current,
      ...patch,
      id: current.id,
      createdAt: current.createdAt,
      layoutFlags: patch.layoutFlags ?? current.layoutFlags ?? {},
      componentKinds: patch.componentKinds ?? current.componentKinds ?? [],
      updatedAt: patch.updatedAt ?? Date.now(),
    }

    const txStore = getTxStore(transaction)
    if (txStore)
      await IdbTransactionUtil.requestToPromise(txStore.put(updated))
    else
      await idb.put(BUNDLES_STORE_NAME, updated)

    return updated
  }

  /**
   * 创建或更新一个 Bundle 记录
   * @param bundle - 要创建或更新的 Bundle 记录对象
   * @returns 返回规范化后的 Bundle 记录
   * @remarks
   * 该函数会对输入的 Bundle 记录进行规范化处理：
   * - layoutFlags 默认为空对象
   * - componentKinds 默认为空数组
   * - createdAt 和 updatedAt 默认为当前时间戳
   * 规范化后的记录会被存储到 IndexedDB 的 BUNDLES_STORE_NAME 存储中
   */
  async function upsertBundle(bundle: BundleRecord, transaction?: IdbTransactionContext): Promise<BundleRecord> {
    const now = Date.now()
    const normalized: BundleRecord = {
      ...bundle,
      layoutFlags: bundle.layoutFlags ?? {},
      componentKinds: bundle.componentKinds ?? [],
      createdAt: bundle.createdAt ?? now,
      updatedAt: bundle.updatedAt ?? now,
    }

    const txStore = getTxStore(transaction)
    if (txStore)
      await IdbTransactionUtil.requestToPromise(txStore.put(normalized))
    else
      await idb.put(BUNDLES_STORE_NAME, normalized)

    return normalized
  }

  /**
   * 软删除一个Bundle记录
   *
   * 通过设置deletedAt和updatedAt时间戳来标记Bundle为已删除状态，实现逻辑删除
   *
   * @param id - 要删除的Bundle的唯一标识符
   * @returns 返回更新后的Bundle记录，如果Bundle不存在则返回undefined
   */
  async function softDeleteBundle(id: BundleId, transaction?: IdbTransactionContext): Promise<BundleRecord | undefined> {
    return updateBundle(id, { deletedAt: Date.now(), updatedAt: Date.now() }, transaction)
  }

  /**
   * 恢复已删除的数据包
   * @param id - 数据包的唯一标识符
   * @returns 返回恢复后的数据包记录，如果恢复失败则返回 undefined
   * @remarks 此函数通过清除 deletedAt 字段和更新 updatedAt 时间戳来恢复已删除的数据包
   */
  async function restoreBundle(id: BundleId, transaction?: IdbTransactionContext): Promise<BundleRecord | undefined> {
    return updateBundle(id, { deletedAt: undefined, updatedAt: Date.now() }, transaction)
  }

  /**
   * 清空所有bundle数据
   *
   * 从IndexedDB中删除bundles存储空间中的所有数据。
   * 此操作是异步的，会等待清空操作完成后才返回。
   *
   * @returns {Promise<void>} 返回一个Promise，当清空操作完成时resolve
   */
  async function clearBundles(transaction?: IdbTransactionContext): Promise<void> {
    const txStore = getTxStore(transaction)
    if (txStore)
      await IdbTransactionUtil.requestToPromise(txStore.clear())
    else
      await idb.clear(BUNDLES_STORE_NAME)
  }

  /**
   * 获取 bundle 存储中的总数量
   * @returns {Promise<number>} 返回 bundle 的总数量
   */
  async function countBundles(): Promise<number> {
    return idb.count(BUNDLES_STORE_NAME)
  }

  /**
   * 根据页面类型查询Bundle记录列表
   * @param pageType - 页面类型标识符
   * @returns 返回Promise，解析为按更新时间倒序排列的活跃Bundle记录数组
   * @throws 当查询操作失败时，拒绝Promise并返回错误信息
   * @remarks
   * - 从IndexedDB的BUNDLES_STORE_NAME存储空间中查询数据
   * - 使用pageType索引进行查询
   * - 自动过滤非活跃的Bundle记录
   * - 结果按updatedAt字段降序排列（最新的在前）
   */
  async function listByPageType(pageType: string): Promise<BundleRecord[]> {
    return idb.withStore(BUNDLES_STORE_NAME, 'readonly', (store) => {
      return new Promise<BundleRecord[]>((resolve, reject) => {
        const request = store.index('pageType').getAll(pageType)
        request.onsuccess = () => resolve(filterActiveBundles(request.result as BundleRecord[]).sort((a, b) => b.updatedAt - a.updatedAt))
        request.onerror = () => reject(request.error ?? new Error('Query pageType failed'))
      })
    })
  }

  /**
   * 根据模板签名查询Bundle记录
   * @param templateSig - 模板签名标识
   * @returns 返回Promise，包含按更新时间倒序排列的活跃Bundle记录数组
   * @throws 当数据库查询失败时抛出错误
   *
   * @remarks
   * - 仅返回状态为活跃的Bundle记录
   * - 结果按updatedAt字段倒序排列（最新的在前）
   * - 使用IndexedDB的templateSig索引进行查询
   */
  async function listByTemplateSig(templateSig: string): Promise<BundleRecord[]> {
    return idb.withStore(BUNDLES_STORE_NAME, 'readonly', (store) => {
      return new Promise<BundleRecord[]>((resolve, reject) => {
        const request = store.index('templateSig').getAll(templateSig)
        request.onsuccess = () => resolve(filterActiveBundles(request.result as BundleRecord[]).sort((a, b) => b.updatedAt - a.updatedAt))
        request.onerror = () => reject(request.error ?? new Error('Query templateSig failed'))
      })
    })
  }

  /**
   * 根据模板签名获取单个Bundle记录
   * @param templateSig - 模板的签名标识符
   * @returns 返回匹配的第一个Bundle记录，如果不存在则返回undefined
   */
  async function getByTemplateSig(templateSig: string): Promise<BundleRecord | undefined> {
    const matched = await listByTemplateSig(templateSig)
    return matched[0]
  }

  /**
   * 更新指定Bundle的最后修改时间为当前时间
   * @param id - Bundle的唯一标识符
   * @returns 返回更新后的Bundle记录，如果Bundle不存在则返回undefined
   */
  async function touchBundle(id: BundleId, transaction?: IdbTransactionContext): Promise<BundleRecord | undefined> {
    return updateBundle(id, { updatedAt: Date.now() }, transaction)
  }

  return wrapAsyncApiWithLogger(schemaLogger, {
    createBundle,
    getBundle,
    listBundles,
    updateBundle,
    upsertBundle,
    softDeleteBundle,
    restoreBundle,
    clearBundles,
    countBundles,
    listByPageType,
    listByTemplateSig,
    getByTemplateSig,
    touchBundle,
  })
}

export const bundle = bundlesStoreDefinition

export const BLOCKS_STORE_NAME = BUNDLES_STORE_NAME
export type BlockId = BundleId
export type BlockLayoutFlags = BundleLayoutFlags
export type BlockRecord = BundleRecord
export type CreateBlockInput = CreateBundleInput
export type UpdateBlockInput = UpdateBundleInput
export type BlockSchemaOptions = BundleSchemaOptions
export const blockSchema = bundleSchema
export const block = bundle
