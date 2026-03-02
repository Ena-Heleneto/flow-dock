export class PagesService<TSchemas extends GenericSchemaMap<'pages'>> {
  constructor(
    private readonly transaction: Pick<IdbTransactionUtil, 'getCurrent'>,
    private readonly schemas: TSchemas,
  ) {}

  /**
   * 检查表中是否存在满足条件的记录
   * @template T - 查询结果的数据类型，默认为 unknown
   * @param tableName - 表名，必须是已注册的 schema 键
   * @param query - 查询条件选项
   * @returns Promise<boolean> - 如果存在匹配的记录返回 true，否则返回 false
   * @throws {Error} 当指定的表 schema 未在 PagesService 中注册时抛出错误
   */
  async exists<T = unknown>(tableName: keyof TSchemas, query: FindByCriteriaOptions) {
    const schema = this.schemas[tableName]
    if (!schema)
      throw new Error(`Schema for table "${String(tableName)}" is not registered in PagesService`)

    const result = await schema.findByCriteria<T>(this.transaction.getCurrent(), query)
    const exists = result.length > 0
    logger.debug(`Checking existence in table "${String(tableName)}"`, { indexName: query.indexName, query: query.query, exists, total: result.length })
    return exists
  }

  /**
   * 将数据保存到指定的表中
   * @template T - 要保存的数据类型，默认为 unknown
   * @param tableName - 表的名称，必须是已注册的 TSchemas 中的键
   * @param data - 要保存的数据对象
   * @returns 返回新创建记录的 ID
   * @throws 当指定的表名称未在 PagesService 中注册时，抛出错误
   */
  async save<T = unknown>(tableName: keyof TSchemas, data: T) {
    const schema = this.schemas[tableName]
    if (!schema)
      throw new Error(`Schema for table "${String(tableName)}" is not registered in PagesService`)

    const id = await schema.create(this.transaction.getCurrent(), data)
    logger.debug(`Saved record in table "${String(tableName)}" with id ${id}`, { data })
    return id
  }
}
