/**
 * 运行数据库事务的配置选项
 * @template T - 事务执行结果的类型
 * @property {IDBDatabase} database - IndexedDB 数据库实例
 * @property {string | string[]} storeNames - 事务涉及的对象存储区名称，可以是单个名称或多个名称的数组
 * @property {IDBTransactionMode} mode - 事务的模式，可以是 'readonly' 或 'readwrite'
 * @property {(context: IdbTransactionContext) => T | Promise<T>} action - 事务执行的操作函数，接收事务上下文，返回结果或 Promise 结果
 */
export interface RunTransactionOptions<T> {
  database: IDBDatabase
  storeNames: string | string[]
  mode: IDBTransactionMode
  action: (context: IdbTransactionContext) => T | Promise<T>
}

export type IdbTransactionStoreInput = IdbStoreDefinition | SchemaHandlerResult<IdbStoreDefinition>

/**
 * IndexedDB 事务工具配置选项接口
 * @interface IdbTransactionUtilOptions
 * @property {string} dbName - 数据库名称，用于标识 IndexedDB 实例
 * @property {number} [version] - 可选，数据库版本号，用于数据库升级和迁移
 * @property {IdbTransactionStoreInput[]} [stores] - 可选，对象存储空间定义数组，可直接传入 defineSchemaHandler 返回实例
 */
export interface IdbTransactionUtilOptions {
  dbName: string
  version?: number
  stores?: IdbTransactionStoreInput[]
}

/**
 * IndexedDB 事务上下文接口
 * @interface IdbTransactionContext
 * @extends {SchemaTransactionContext}
 *
 * @property {IDBTransaction} transaction - IndexedDB 原生事务对象，用于执行数据库操作
 *
 * @description
 * 扩展自 SchemaTransactionContext，结合 IndexedDB 的原生 IDBTransaction 对象，
 * 用于在数据库事务中管理和执行数据库操作。
 */
export interface IdbTransactionContext extends SchemaTransactionContext {
  transaction: IDBTransaction
}
