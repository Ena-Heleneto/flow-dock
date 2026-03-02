const schemaRegistry = new Map<string, IdbStoreDefinition>()

function requestToPromise<T = unknown>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

export function defineSchemaHandler<TSchema extends IdbStoreDefinition>(schema: TSchema): SchemaHandlerResult<TSchema> {
  schemaRegistry.set(schema.name, schema)
  const storeName = schema.name

  function create<T = unknown>(transaction: SchemaTransactionContext, value: T, key?: IDBValidKey) {
    const store = transaction.getStore(storeName)
    return requestToPromise<IDBValidKey>(store.add(value, key))
  }

  function readById<T = unknown>(transaction: SchemaTransactionContext, key: IDBValidKey) {
    const store = transaction.getStore(storeName)
    return requestToPromise<T | undefined>(store.get(key))
  }

  function update<T = unknown>(transaction: SchemaTransactionContext, value: T, key?: IDBValidKey) {
    const store = transaction.getStore(storeName)
    return requestToPromise<IDBValidKey>(store.put(value, key))
  }

  async function deleteById(transaction: SchemaTransactionContext, key: IDBValidKey) {
    const store = transaction.getStore(storeName)
    await requestToPromise(store.delete(key))
  }

  function list<T = unknown>(transaction: SchemaTransactionContext, query?: IDBValidKey | IDBKeyRange | null) {
    const store = transaction.getStore(storeName)
    return requestToPromise<T[]>(store.getAll(query))
  }

  return { ...schema, create, readById, update, deleteById, list }
}

export function getRegisteredSchemas() {
  return [...schemaRegistry.values()]
}
