/**
 * 模式事务上下文接口
 * @interface SchemaTransactionContext
 * @description 用于管理 IndexedDB 事务和对象存储的上下文信息
 *
 * @property {IDBTransaction} [transaction] - 可选的 IndexedDB 事务对象，用于执行数据库操作
 * @property {Function} getStore - 根据存储名称获取对应的 IDBObjectStore 的方法
 * @param {string} storeName - 对象存储的名称
 * @returns {IDBObjectStore} 返回指定名称的对象存储实例
 */
export interface SchemaTransactionContext {
  transaction?: IDBTransaction
  getStore: (storeName: string) => IDBObjectStore
}

/**
 * 按条件查询的选项配置接口
 * @interface FindByCriteriaOptions
 * @property {string} indexName - 索引名称，用于指定查询所使用的数据库索引
 * @property {IDBValidKey | IDBKeyRange} query - 查询条件，可以是单个键值或键值范围
 * @property {number} [count] - 可选，查询返回结果的最大数量限制
 */
export interface FindByCriteriaOptions {
  indexName: string
  query: IDBValidKey | IDBKeyRange
  count?: number
}

/**
 * 从 IndexedDB 存储定义中推断出记录的具体类型。
 *
 * 这是一个条件类型，用于从给定的 {@link IdbStoreDefinition} 中提取和推断记录类型。
 * 如果提供的模式包含 `record` 属性，它将使用 {@link InferRecordType} 来推断该记录的具体类型。
 * 否则返回 `unknown` 类型。
 *
 * @template TSchema - 必须满足 {@link IdbStoreDefinition} 的存储定义类型
 * @returns 推断出的记录类型，如果无法确定则返回 `unknown`
 *
 */
export type SchemaRecordType<TSchema extends IdbStoreDefinition> =
  TSchema extends { record: infer TRecord extends IdbRecordDefinition }
    ? InferRecordType<TRecord>
    : unknown

/**
 * IndexedDB 存储模式处理器结果类型
 *
 * 扩展了基础的存储定义，并提供了一套完整的 CRUD 和查询操作方法
 *
 * @template TSchema - 继承自 IdbStoreDefinition 的存储模式类型
 *
 * @property create - 创建新记录
 * @param transaction - 数据库事务上下文
 * @param value - 要创建的记录值
 * @param key - 可选的主键值
 * @returns 返回创建的记录的主键
 *
 * @property readById - 根据主键读取单条记录
 * @param transaction - 数据库事务上下文
 * @param key - 记录的主键
 * @returns 返回查询到的记录，如果不存在则返回 undefined
 *
 * @property update - 更新现有记录
 * @param transaction - 数据库事务上下文
 * @param value - 要更新的记录值
 * @param key - 可选的主键值
 * @returns 返回更新的记录的主键
 *
 * @property deleteById - 根据主键删除记录
 * @param transaction - 数据库事务上下文
 * @param key - 要删除的记录主键
 * @returns 返回空 Promise
 *
 * @property list - 列出所有或满足条件的记录
 * @param transaction - 数据库事务上下文
 * @param query - 可选的查询条件（主键值或主键范围）
 * @returns 返回匹配条件的记录数组
 *
 * @property findByCriteria - 根据复杂条件查询记录
 * @param transaction - 数据库事务上下文
 * @param options - 查询选项配置
 * @returns 返回匹配条件的记录数组
 */
export type SchemaHandlerResult<TSchema extends IdbStoreDefinition> = TSchema & {
  create: <T extends SchemaRecordType<TSchema> = SchemaRecordType<TSchema>>(transaction: SchemaTransactionContext, value: T, key?: IDBValidKey) => Promise<IDBValidKey>
  readById: <T = SchemaRecordType<TSchema>>(transaction: SchemaTransactionContext, key: IDBValidKey) => Promise<T | undefined>
  update: <T extends SchemaRecordType<TSchema> = SchemaRecordType<TSchema>>(transaction: SchemaTransactionContext, value: T, key?: IDBValidKey) => Promise<IDBValidKey>
  deleteById: (transaction: SchemaTransactionContext, key: IDBValidKey) => Promise<void>
  list: <T = SchemaRecordType<TSchema>>(transaction: SchemaTransactionContext, query?: IDBValidKey | IDBKeyRange | null) => Promise<T[]>
  findByCriteria: <T = SchemaRecordType<TSchema>>(transaction: SchemaTransactionContext, options: FindByCriteriaOptions) => Promise<T[]>
  findAll: <T = SchemaRecordType<TSchema>>(transaction: SchemaTransactionContext) => Promise<T[]>
}

/**
 * 通用模式读取器类型
 * @description 用于读取和处理 IndexedDB 存储定义的模式处理结果类型
 * @typedef {SchemaHandlerResult<IdbStoreDefinition>} GenericSchemaReader
 */
export type GenericSchemaReader = SchemaHandlerResult<IdbStoreDefinition>

/**
 * 通用schema映射类型定义
 *
 * @template TRequiredKey - 必需键的字符串类型，默认为never
 *
 * @description
 * 这是一个通用的schema读取器映射对象类型。它结合了两个类型约束：
 * 1. 允许任意字符串键映射到GenericSchemaReader
 * 2. 对于指定的TRequiredKey类型参数，这些键必须存在且不能为可选
 *
 */
export type GenericSchemaMap<TRequiredKey extends string = never> = Record<string, GenericSchemaReader>
  & { [K in TRequiredKey]-?: GenericSchemaReader }
