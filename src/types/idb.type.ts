/**
 * IndexedDB 对象存储的定义接口
 * @interface IdbStoreDefinition
 * @property {string} name - 对象存储的名称
 * @property {IDBObjectStoreParameters} [options] - 创建对象存储时的可选参数配置
 * @property {IdbIndexDefinition[]} [indexes] - 该对象存储中包含的索引定义数组
 */
export interface IdbStoreDefinition {
  name: string
  options?: IDBObjectStoreParameters
  indexes?: IdbIndexDefinition[]
}

export interface IdbBaseRecord {
  deletedAt?: number
}
