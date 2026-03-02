import type { FindByCriteriaOptions, SchemaHandlerResult, SchemaRecordType, SchemaTransactionContext } from '~/types/define-schema-handler.type'
import type { IdbFieldTypeConstructor, IdbRecordDefinition, IdbStoreDefinition } from '~/types/idb.type'

const schemaRegistry = new Map<string, IdbStoreDefinition>()

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function constructorTypeName(type: IdbFieldTypeConstructor) {
  if (type === String)
    return 'string'
  if (type === Number)
    return 'number'
  if (type === Boolean)
    return 'boolean'
  if (type === Array)
    return 'array'
  if (type === Object)
    return 'object'
  if (type === Date)
    return 'date'
  return 'unknown'
}

function isRecordDefinition(type: IdbFieldTypeConstructor | IdbRecordDefinition): type is IdbRecordDefinition {
  return typeof type === 'object' && type !== null
}

function assertValueType(
  value: unknown,
  type: IdbFieldTypeConstructor | IdbRecordDefinition,
  path: string,
  subType?: IdbFieldTypeConstructor | IdbRecordDefinition,
) {
  if (isRecordDefinition(type)) {
    assertRecordByDefinition(value, type, path)
    return
  }

  if (type === String) {
    if (typeof value !== 'string')
      throw new Error(`Field "${path}" should be ${constructorTypeName(type)}`)
    return
  }

  if (type === Number) {
    if (typeof value !== 'number' || Number.isNaN(value))
      throw new Error(`Field "${path}" should be ${constructorTypeName(type)}`)
    return
  }

  if (type === Boolean) {
    if (typeof value !== 'boolean')
      throw new Error(`Field "${path}" should be ${constructorTypeName(type)}`)
    return
  }

  if (type === Date) {
    if (!(value instanceof Date))
      throw new Error(`Field "${path}" should be ${constructorTypeName(type)}`)
    return
  }

  if (type === Object) {
    if (!isObjectLike(value))
      throw new Error(`Field "${path}" should be ${constructorTypeName(type)}`)
    return
  }

  if (type === Array) {
    if (!Array.isArray(value))
      throw new Error(`Field "${path}" should be ${constructorTypeName(type)}`)

    if (!subType)
      return

    value.forEach((item, index) => {
      assertValueType(item, subType, `${path}[${index}]`)
    })
  }
}

function assertRecordByDefinition(value: unknown, definition: IdbRecordDefinition, pathPrefix?: string) {
  if (!isObjectLike(value))
    throw new Error(`Record should be object${pathPrefix ? ` at "${pathPrefix}"` : ''}`)

  for (const [fieldName, fieldDefinition] of Object.entries(definition)) {
    const fieldValue = value[fieldName]

    if (fieldValue === undefined || fieldValue === null)
      continue

    const fieldPath = pathPrefix ? `${pathPrefix}.${fieldName}` : fieldName
    assertValueType(fieldValue, fieldDefinition.type, fieldPath, fieldDefinition.subType)
  }
}

export function validateRecordAgainstSchema(schema: Pick<IdbStoreDefinition, 'name' | 'record'>, value: unknown) {
  if (!schema.record)
    return

  assertRecordByDefinition(value, schema.record)
}

function requestToPromise<T = unknown>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

export function defineSchemaHandler<TSchema extends IdbStoreDefinition>(schema: TSchema): SchemaHandlerResult<TSchema> {
  schemaRegistry.set(schema.name, schema)
  const storeName = schema.name

  function assertRecordShape(value: unknown) {
    validateRecordAgainstSchema(schema, value)
  }

  function create<T extends SchemaRecordType<TSchema> = SchemaRecordType<TSchema>>(transaction: SchemaTransactionContext, value: T, key?: IDBValidKey) {
    assertRecordShape(value)
    const store = transaction.getStore(storeName)
    return requestToPromise<IDBValidKey>(store.add(value, key))
  }

  function readById<T = SchemaRecordType<TSchema>>(transaction: SchemaTransactionContext, key: IDBValidKey) {
    const store = transaction.getStore(storeName)
    return requestToPromise<T | undefined>(store.get(key))
  }

  function update<T extends SchemaRecordType<TSchema> = SchemaRecordType<TSchema>>(transaction: SchemaTransactionContext, value: T, key?: IDBValidKey) {
    assertRecordShape(value)
    const store = transaction.getStore(storeName)
    return requestToPromise<IDBValidKey>(store.put(value, key))
  }

  async function deleteById(transaction: SchemaTransactionContext, key: IDBValidKey) {
    const store = transaction.getStore(storeName)
    await requestToPromise(store.delete(key))
  }

  function list<T = SchemaRecordType<TSchema>>(transaction: SchemaTransactionContext, query?: IDBValidKey | IDBKeyRange | null) {
    const store = transaction.getStore(storeName)
    return requestToPromise<T[]>(store.getAll(query))
  }

  function findByCriteria<T = SchemaRecordType<TSchema>>(transaction: SchemaTransactionContext, options: FindByCriteriaOptions) {
    const store = transaction.getStore(storeName)
    const index = store.index(options.indexName)
    return requestToPromise<T[]>(index.getAll(options.query, options.count))
  }

  return { ...schema, create, readById, update, deleteById, list, findByCriteria }
}

export function getRegisteredSchemas() {
  return [...schemaRegistry.values()]
}
