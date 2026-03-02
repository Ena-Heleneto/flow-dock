export interface SchemaTransactionContext {
  transaction?: IDBTransaction
  getStore: (storeName: string) => IDBObjectStore
}

export type SchemaHandlerResult<TSchema extends IdbStoreDefinition> = TSchema & {
  create: <T = unknown>(transaction: SchemaTransactionContext, value: T, key?: IDBValidKey) => Promise<IDBValidKey>
  readById: <T = unknown>(transaction: SchemaTransactionContext, key: IDBValidKey) => Promise<T | undefined>
  update: <T = unknown>(transaction: SchemaTransactionContext, value: T, key?: IDBValidKey) => Promise<IDBValidKey>
  deleteById: (transaction: SchemaTransactionContext, key: IDBValidKey) => Promise<void>
  list: <T = unknown>(transaction: SchemaTransactionContext, query?: IDBValidKey | IDBKeyRange | null) => Promise<T[]>
}
