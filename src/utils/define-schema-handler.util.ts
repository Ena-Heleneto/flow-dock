/**
 * Schema注册表
 * 用于存储和管理IndexedDB store的定义信息
 * Key: store名称
 * Value: store的定义对象
 */
const schemaRegistry = new Map<string, IdbStoreDefinition>()

/**
 * 检查值是否为对象类型
 * @param value - 要检查的值
 * @returns 如果值是对象类型（非null、非数组）则返回true，否则返回false
 */
function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 将构造函数类型转换为字符串类型名称
 * @param type - IndexedDB字段的构造函数类型
 * @returns 对应的类型名称字符串，支持 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date' | 'unknown'
 */
function constructorTypeName(type: IdbFieldTypeConstructor) {
  if (type === String)
    return 'string'
  if (type === Number)
    return 'number'
  if (type === Boolean)
    return 'boolean'
  if (type === Blob)
    return 'blob'
  if (type === Array)
    return 'array'
  if (type === Object)
    return 'object'
  if (type === Date)
    return 'date'
  return 'unknown'
}

/**
 * 判断给定的类型是否为记录定义对象
 * @param type - 要检查的类型，可能是字段类型构造函数或记录定义对象
 * @returns 如果 type 是 IdbRecordDefinition 对象则返回 true，否则返回 false
 */
function isRecordDefinition(type: IdbFieldTypeConstructor | IdbRecordDefinition): type is IdbRecordDefinition {
  return typeof type === 'object' && type !== null
}

/**
 * 断言值的类型是否与指定的类型定义匹配
 * @param value - 需要验证的值
 * @param type - 期望的字段类型构造函数或记录定义
 * @param path - 字段的路径，用于错误消息中定位字段位置
 * @param subType - 可选，当类型为 Array 时指定数组元素的类型
 * @throws {Error} 当值的类型与期望类型不匹配时抛出错误
 */
function assertValueType(value: unknown, type: IdbFieldTypeConstructor | IdbRecordDefinition, path: string, subType?: IdbFieldTypeConstructor | IdbRecordDefinition) {
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

  if (type === Blob) {
    if (!(value instanceof Blob))
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

    value.forEach((item, index) => assertValueType(item, subType, `${path}[${index}]`))
  }
}

/**
 * 根据定义来断言记录对象的有效性
 * @param value - 要验证的值
 * @param definition - 记录定义对象，包含字段名和字段定义的映射
 * @param pathPrefix - 可选的路径前缀，用于在错误消息中提供更详细的位置信息
 * @throws {Error} 当值不是对象类型时抛出错误
 * @throws {Error} 当字段值类型不符合定义时抛出错误
 */
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

/**
 * 根据定义的模式验证记录值
 * @param schema - 包含存储名称和记录定义的模式对象
 * @param schema.name - IDB 存储的名称
 * @param schema.record - 记录的定义规则
 * @param value - 需要验证的值
 * @throws 当值不符合记录定义时，将抛出断言错误
 */
export function validateRecordAgainstSchema(schema: Pick<IdbStoreDefinition, 'name' | 'record'>, value: unknown) {
  if (!schema.record)
    return

  assertRecordByDefinition(value, schema.record)
}

/**
 * 将 IndexedDB 请求转换为 Promise
 * @template T - 请求结果的类型，默认为 unknown
 * @param request - IndexedDB 请求对象
 * @returns 返回一个 Promise，当请求成功时 resolve 结果数据，失败时 reject 错误信息
 * @throws 当 IndexedDB 请求失败时，reject 请求的错误或通用错误信息
 */
function requestToPromise<T = unknown>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

/**
 * 定义数据库模式处理器
 *
 * 为给定的数据库模式创建一个完整的CRUD操作处理器。该函数将模式注册到全局注册表中，
 * 并返回包含所有数据库操作方法的处理器对象。
 *
 * @template TSchema - 继承自IdbStoreDefinition的模式类型
 * @param {TSchema} schema - 数据库模式定义对象，包含存储名称和验证规则
 * @returns {SchemaHandlerResult<TSchema>} 返回包含CRUD操作方法的处理器对象
 *
 * @remarks
 * - 该函数会自动将模式注册到全局schemaRegistry中
 * - 所有数据库操作都需要提供SchemaTransactionContext事务上下文
 * - 所有记录在创建和更新时都会通过assertRecordShape进行验证
 */
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

  function findAll<T = SchemaRecordType<TSchema>>(transaction: SchemaTransactionContext) {
    const store = transaction.getStore(storeName)
    return requestToPromise<T[]>(store.getAll())
  }

  return { ...schema, create, readById, update, deleteById, list, findByCriteria, findAll }
}

/**
 * 获取所有已注册的模式
 * @returns {Array} 返回包含所有已注册模式的数组
 */
export function getRegisteredSchemas() {
  return [...schemaRegistry.values()]
}
