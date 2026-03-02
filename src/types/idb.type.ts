/**
 * IndexedDB 对象存储的定义接口
 * @interface IdbStoreDefinition
 * @property {string} name - 对象存储的名称
 * @property {IDBObjectStoreParameters} [options] - 创建对象存储时的可选参数配置
 * @property {IdbIndexDefinition[]} [indexes] - 该对象存储中包含的索引定义数组
 * @property {IdbRecordDefinition} [record] - 该对象存储记录字段定义
 */
export type IdbFieldTypeConstructor =
  | StringConstructor
  | NumberConstructor
  | BooleanConstructor
  | ObjectConstructor
  | ArrayConstructor
  | DateConstructor

export interface IdbRecordFieldDefinition {
  type: IdbFieldTypeConstructor | IdbRecordDefinition
  subType?: IdbFieldTypeConstructor | IdbRecordDefinition
}

export type IdbRecordDefinition = Record<string, IdbRecordFieldDefinition>

type InferConstructorType<T> =
  T extends StringConstructor ? string
    : T extends NumberConstructor ? number
      : T extends BooleanConstructor ? boolean
        : T extends DateConstructor ? Date
          : T extends ArrayConstructor ? unknown[]
            : T extends ObjectConstructor ? Record<string, unknown>
              : unknown

type InferArraySubType<T> =
  T extends IdbRecordDefinition ? InferRecordType<T>
    : InferConstructorType<T>

export type InferRecordFieldType<TField extends IdbRecordFieldDefinition> =
  TField['type'] extends ArrayConstructor
    ? TField extends { subType: infer TSub }
      ? InferArraySubType<TSub>[]
      : unknown[]
    : TField['type'] extends IdbRecordDefinition
      ? InferRecordType<TField['type']>
      : InferConstructorType<TField['type']>

export type InferRecordType<TRecord extends IdbRecordDefinition> = {
  [K in keyof TRecord]?: InferRecordFieldType<TRecord[K]>
}

export interface IdbStoreDefinition {
  name: string
  options?: IDBObjectStoreParameters
  indexes?: IdbIndexDefinition[]
  record?: IdbRecordDefinition
}

export interface IdbBaseRecord {
  deletedAt?: number
}
