/**
 * 组件存储的名称常量
 * @const
 * @type {string}
 * @description 用于标识和访问组件存储空间的唯一名称
 */
export const COMPONENTS_STORE_NAME = 'components'

/**
 * 组件唯一标识符
 * @typedef {string} ComponentId
 * @description 用于唯一识别和区分不同的组件实例
 */
export type ComponentId = string

/**
 * 组件类型
 * @typedef {string} ComponentKind
 * @description 表示组件的类型标识，用于区分不同的组件种类
 */
/**
 * 组件类型
 * @type {string}
 */
export type ComponentKind = string

/**
 * 组件记录接口
 *
 * 表示系统中的一个组件的核心数据结构，用于追踪组件的生命周期和元数据信息。
 *
 * @interface ComponentRecord
 * @property {ComponentId} id - 组件的唯一标识符
 * @property {ComponentKind} kind - 组件的类型/种类
 * @property {string} signature - 组件的签名，用于唯一标识组件的结构
 * @property {string} name - 组件的显示名称
 * @property {string[]} tokens - 与组件相关联的令牌数组
 * @property {number} firstSeen - 组件首次被发现的时间戳（毫秒）
 * @property {number} lastSeen - 组件最后一次被访问的时间戳（毫秒）
 * @property {number} [deletedAt] - 组件被删除的时间戳（毫秒），可选
 * @property {string} [examplePageId] - 示例页面的ID，可选
 */
export interface ComponentRecord {
  id: ComponentId
  kind: ComponentKind
  signature: string
  name: string
  tokens: string[]
  firstSeen: number
  lastSeen: number
  deletedAt?: number
  examplePageId?: string
}

/**
 * 创建组件的输入类型
 *
 * 基于 {@link ComponentRecord} 类型，排除了自动管理的字段，并将某些字段设为可选。
 *
 * @typedef {object} CreateComponentInput
 * @property {ComponentId} [id] - 组件的唯一标识符，可选
 * @property {number} [firstSeen] - 组件首次出现的时间戳（毫秒），可选
 * @property {number} [lastSeen] - 组件最后一次出现的时间戳（毫秒），可选
 *
 * @remarks
 * - 继承了 {@link ComponentRecord} 的所有属性，除了 `id`、`firstSeen` 和 `lastSeen`
 * - 如果未提供这些可选字段，系统将自动生成或计算它们
 */
export type CreateComponentInput = Omit<ComponentRecord, 'id' | 'firstSeen' | 'lastSeen'> & {
  id?: ComponentId
  firstSeen?: number
  lastSeen?: number
}

/**
 * 用于更新组件的输入类型
 *
 * 这是一个部分类型，包含 ComponentRecord 中除了 'id' 之外的所有属性
 * 允许在更新操作中选择性地提供这些属性
 *
 * @typedef {Partial<Omit<ComponentRecord, 'id'>>} UpdateComponentInput
 */
export type UpdateComponentInput = Partial<Omit<ComponentRecord, 'id'>>

/**
 * 组件schema的配置选项
 * @interface ComponentsSchemaOptions
 * @property {string} [dbName] - 数据库名称,可选
 * @property {number} [version] - 版本号,可选
 */
export interface ComponentsSchemaOptions {
  dbName?: string
  version?: number
}

/**
 * 组件存储定义
 *
 * @description 定义了IndexedDB中组件存储的结构和索引配置
 * @property {string} name - 存储名称，值为 COMPONENTS_STORE_NAME
 * @property {IDBObjectStoreParameters} options - 对象存储选项，使用 'id' 作为主键路径
 * @property {IdbIndexDefinition[]} indexes - 索引数组，包含两个索引：
 *   - kind: 按组件类型索引
 *   - signature: 按组件签名索引
 */
const componentsStoreDefinition: IdbStoreDefinition = {
  name: COMPONENTS_STORE_NAME,
  options: { keyPath: 'id' },
  indexes: [
    { name: 'kind', keyPath: 'kind' },
    { name: 'signature', keyPath: 'signature' },
  ],
}

/**
 * 创建一个唯一的组件ID
 *
 * 优先使用浏览器原生的 `crypto.randomUUID()` 方法生成标准的UUID格式。
 * 如果运行环境不支持该方法，则使用时间戳和随机数的组合作为备选方案。
 *
 * @returns {ComponentId} 生成的唯一组件标识符
 */
function createComponentId(): ComponentId {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return crypto.randomUUID()

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * 判断组件是否处于活跃状态
 * @param component - 组件记录对象
 * @returns 如果组件未被删除则返回 true，否则返回 false
 */
function isActiveComponent(component: ComponentRecord): boolean {
  return typeof component.deletedAt !== 'number'
}

/**
 * 过滤并返回所有活跃的组件
 * @param components - 要进行过滤的组件记录数组
 * @returns 包含所有活跃组件的数组
 */
function filterActiveComponents(components: ComponentRecord[]): ComponentRecord[] {
  return components.filter(isActiveComponent)
}

export function componentsSchema(options: ComponentsSchemaOptions = {}) {
  /**
   * 初始化 IndexedDB 实例用于存储组件数据
   * @param {object} options - 配置选项
   * @param {string} [options.dbName='flow-dock-dev'] - 数据库名称，默认为 'flow-dock-dev'
   * @param {number} [options.version=1] - 数据库版本号，默认为 1
   * @param {Array} options.stores - 数据库存储定义数组，包含 componentsStoreDefinition
   * @returns {object} IndexedDB 实例对象，用于执行数据库操作
   */
  const idb = useIdb({
    dbName: options.dbName ?? 'flow-dock-dev',
    version: options.version ?? 1,
    stores: [componentsStoreDefinition],
  })

  function getTxStore(transaction?: IdbTransactionContext) {
    return transaction?.getStore(COMPONENTS_STORE_NAME)
  }

  /**
   * 创建一个新的组件记录
   * @param input - 组件输入参数
   * @param input.id - 组件ID，如果未提供则自动生成
   * @param input.tokens - 组件令牌数组，默认为空数组
   * @param input.firstSeen - 首次发现时间戳，默认为当前时间
   * @param input.lastSeen - 最后发现时间戳，默认为当前时间
   * @returns 返回创建的组件记录
   */
  async function createComponent(input: CreateComponentInput, transaction?: IdbTransactionContext): Promise<ComponentRecord> {
    const now = Date.now()
    const component: ComponentRecord = {
      ...input,
      id: input.id ?? createComponentId(),
      tokens: input.tokens ?? [],
      firstSeen: input.firstSeen ?? now,
      lastSeen: input.lastSeen ?? now,
    }

    const txStore = getTxStore(transaction)
    if (txStore)
      await IdbTransactionUtil.requestToPromise(txStore.add(component))
    else
      await idb.add(COMPONENTS_STORE_NAME, component)

    return component
  }

  /**
   * 根据组件ID获取组件记录
   * @param id - 组件的唯一标识符
   * @param includeDeleted - 是否包含已删除的组件，默认为false。当为false时，只返回活跃的组件
   * @returns 返回匹配的组件记录，如果未找到或组件已被删除且includeDeleted为false时返回undefined
   * @async
   */
  async function getComponent(id: ComponentId, includeDeleted = false, transaction?: IdbTransactionContext): Promise<ComponentRecord | undefined> {
    const txStore = getTxStore(transaction)
    const component = txStore
      ? await IdbTransactionUtil.requestToPromise<ComponentRecord | undefined>(txStore.get(id))
      : await idb.get<ComponentRecord>(COMPONENTS_STORE_NAME, id)

    if (!includeDeleted && component && !isActiveComponent(component))
      return undefined

    return component
  }

  /**
   * 获取所有活跃的组件列表
   * @returns {Promise<ComponentRecord[]>} 按最后访问时间倒序排列的活跃组件记录数组
   */
  async function listComponents(transaction?: IdbTransactionContext): Promise<ComponentRecord[]> {
    const txStore = getTxStore(transaction)
    const components = txStore
      ? await IdbTransactionUtil.requestToPromise<ComponentRecord[]>(txStore.getAll())
      : await idb.getAll<ComponentRecord>(COMPONENTS_STORE_NAME)

    return filterActiveComponents(components).sort((a, b) => b.lastSeen - a.lastSeen)
  }

  /**
   * 更新指定ID的组件记录
   * @param id - 组件的唯一标识符
   * @param patch - 包含要更新的组件字段的部分对象
   * @returns 返回更新后的组件记录，如果组件不存在则返回undefined
   * @remarks
   * - 如果组件不存在，函数返回undefined
   * - 保留原始的组件ID，不允许修改
   * - tokens字段优先使用patch中的值，其次使用当前值，最后使用空数组作为默认值
   * - firstSeen字段保持不变（优先使用patch中的值，否则保持原值）
   * - lastSeen字段自动更新为当前时间戳
   * - 更新后的记录将被持久化到IndexedDB数据库中
   */
  async function updateComponent(id: ComponentId, patch: UpdateComponentInput, transaction?: IdbTransactionContext): Promise<ComponentRecord | undefined> {
    const current = await getComponent(id, false, transaction)
    if (!current)
      return undefined

    const updated: ComponentRecord = {
      ...current,
      ...patch,
      id: current.id,
      tokens: patch.tokens ?? current.tokens ?? [],
      firstSeen: patch.firstSeen ?? current.firstSeen,
      lastSeen: patch.lastSeen ?? Date.now(),
    }

    const txStore = getTxStore(transaction)
    if (txStore)
      await IdbTransactionUtil.requestToPromise(txStore.put(updated))
    else
      await idb.put(COMPONENTS_STORE_NAME, updated)

    return updated
  }

  /**
   * 向组件存储中插入或更新组件记录
   *
   * @param component - 要插入或更新的组件记录
   * @returns 返回标准化后的组件记录，包含自动填充的时间戳
   *
   * @remarks
   * - 如果组件缺少 `tokens` 数组，将初始化为空数组
   * - 如果组件缺少 `firstSeen` 时间戳，将设置为当前时间
   * - 如果组件缺少 `lastSeen` 时间戳，将设置为当前时间
   * - 该函数会将标准化后的记录异步保存到 IndexedDB 中
   */
  async function upsertComponent(component: ComponentRecord, transaction?: IdbTransactionContext): Promise<ComponentRecord> {
    const now = Date.now()
    const normalized: ComponentRecord = {
      ...component,
      tokens: component.tokens ?? [],
      firstSeen: component.firstSeen ?? now,
      lastSeen: component.lastSeen ?? now,
    }

    const txStore = getTxStore(transaction)
    if (txStore)
      await IdbTransactionUtil.requestToPromise(txStore.put(normalized))
    else
      await idb.put(COMPONENTS_STORE_NAME, normalized)

    return normalized
  }

  /**
   * 软删除组件
   * @param id - 组件ID
   * @returns 返回更新后的组件记录，如果组件不存在则返回undefined
   * @description 将组件标记为已删除，通过设置deletedAt和lastSeen时间戳来实现软删除
   */
  async function softDeleteComponent(id: ComponentId, transaction?: IdbTransactionContext): Promise<ComponentRecord | undefined> {
    return updateComponent(id, { deletedAt: Date.now(), lastSeen: Date.now() }, transaction)
  }

  /**
   * 恢复已删除的组件
   * @param id - 组件ID
   * @returns 返回恢复后的组件记录，如果组件不存在则返回undefined
   */
  async function restoreComponent(id: ComponentId, transaction?: IdbTransactionContext): Promise<ComponentRecord | undefined> {
    return updateComponent(id, { deletedAt: undefined, lastSeen: Date.now() }, transaction)
  }

  /**
   * 清空组件存储中的所有数据
   * @remarks
   * 使用 IndexedDB 的 clear 方法删除指定存储中的所有记录
   * @returns 返回一个 Promise，当清空操作完成时 resolve
   * @throws 如果数据库操作失败会抛出异常
   */
  async function clearComponents(transaction?: IdbTransactionContext): Promise<void> {
    const txStore = getTxStore(transaction)
    if (txStore)
      await IdbTransactionUtil.requestToPromise(txStore.clear())
    else
      await idb.clear(COMPONENTS_STORE_NAME)
  }

  /**
   * 获取组件存储中的组件总数
   * @returns {Promise<number>} 返回一个Promise，解析为组件的总数
   */
  async function countComponents(): Promise<number> {
    return idb.count(COMPONENTS_STORE_NAME)
  }

  /**
   * 根据组件类型获取组件列表
   * @param kind - 组件类型
   * @returns 按最后访问时间降序排列的活跃组件记录数组的Promise
   * @throws 当查询失败时抛出错误
   */
  async function listByKind(kind: ComponentKind): Promise<ComponentRecord[]> {
    return idb.withStore(COMPONENTS_STORE_NAME, 'readonly', (store) => {
      return new Promise<ComponentRecord[]>((resolve, reject) => {
        const request = store.index('kind').getAll(kind)
        request.onsuccess = () => resolve(filterActiveComponents(request.result as ComponentRecord[]).sort((a, b) => b.lastSeen - a.lastSeen))
        request.onerror = () => reject(request.error ?? new Error('Query kind failed'))
      })
    })
  }

  /**
   * 根据签名查询组件记录列表
   * @param signature - 组件签名，用于在索引中查询匹配的组件
   * @returns 返回一个Promise，解析为按最后查看时间倒序排列的活跃组件记录数组
   * @throws 当查询失败时抛出错误
   *
   * @remarks
   * - 从IndexedDB的COMPONENTS_STORE_NAME中查询
   * - 使用'signature'索引进行查询
   * - 返回的组件列表会被过滤为仅包含活跃的组件
   * - 结果按lastSeen时间戳倒序排列（最近查看的在前）
   */
  async function listBySignature(signature: string): Promise<ComponentRecord[]> {
    return idb.withStore(COMPONENTS_STORE_NAME, 'readonly', (store) => {
      return new Promise<ComponentRecord[]>((resolve, reject) => {
        const request = store.index('signature').getAll(signature)
        request.onsuccess = () => resolve(filterActiveComponents(request.result as ComponentRecord[]).sort((a, b) => b.lastSeen - a.lastSeen))
        request.onerror = () => reject(request.error ?? new Error('Query signature failed'))
      })
    })
  }

  /**
   * 根据签名获取单个组件记录
   * @param signature - 组件的签名标识
   * @returns 返回匹配的组件记录，如果不存在则返回 undefined
   */
  async function getBySignature(signature: string): Promise<ComponentRecord | undefined> {
    const matched = await listBySignature(signature)
    return matched[0]
  }

  /**
   * 更新组件的最后访问时间
   * @param id - 组件的唯一标识符
   * @returns 返回更新后的组件记录，如果组件不存在则返回 undefined
   */
  async function touchComponent(id: ComponentId, transaction?: IdbTransactionContext): Promise<ComponentRecord | undefined> {
    return updateComponent(id, { lastSeen: Date.now() }, transaction)
  }

  return {
    createComponent,
    getComponent,
    listComponents,
    updateComponent,
    upsertComponent,
    softDeleteComponent,
    restoreComponent,
    clearComponents,
    countComponents,
    listByKind,
    listBySignature,
    getBySignature,
    touchComponent,
  }
}

export const components = componentsStoreDefinition
