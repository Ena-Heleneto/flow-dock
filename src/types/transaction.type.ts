export interface RunTransactionOptions<T> {
  database: IDBDatabase
  storeNames: string | string[]
  mode: IDBTransactionMode
  action: (context: IdbTransactionContext) => T | Promise<T>
}

export interface IdbTransactionUtilOptions {
  dbName: string
  version?: number
  stores?: IdbStoreDefinition[]
}
