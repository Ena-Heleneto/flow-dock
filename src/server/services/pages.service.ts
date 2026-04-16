export class PagesService<TSchema extends GenericSchemaReader> {
  constructor(
    private readonly transaction: Pick<IdbTransactionUtil, 'getCurrent'>,
    private readonly schema: TSchema,
  ) {}

  /**
   * 检查表中是否存在满足条件的记录
   * @template T - 查询结果的数据类型，默认为 unknown
   * @param query - 查询条件选项
   * @returns Promise<boolean> - 如果存在匹配的记录返回 true，否则返回 false
   */
  async exists<T = unknown>(query: FindByCriteriaOptions) {
    const result = await this.schema.findByCriteria<T>(this.transaction.getCurrent(), query)
    const exists = result.length > 0
    logger.debug('Checking existence in pages table', { indexName: query.indexName, query: query.query, exists, total: result.length })
    return exists
  }

  /**
   * 将数据保存到指定的表中
   * @template T - 要保存的数据类型，默认为 unknown
   * @param data - 要保存的数据对象
   * @returns 返回新创建记录的 ID
   */
  async save<T = Partial<SchemaRecordType<typeof PageSchema>>>(data: T) {
    const id = await this.schema.create(this.transaction.getCurrent(), data)
    logger.debug(`Saved record in pages table with id ${id}`, { data })
    return id
  }

  /**
   * 根据指定条件查询页面记录
   * @param query - 查询条件选项，包含索引名称和查询参数
   * @param query.indexName - 要查询的索引名称
   * @param query.query - 具体的查询条件
   * @returns 返回匹配查询条件的页面记录数组
   */
  async find(query: FindByCriteriaOptions) {
    const result = await this.schema.findByCriteria(this.transaction.getCurrent(), query)
    logger.debug('Finding records in pages table', { indexName: query.indexName, query: query.query, total: result.length })
    return result
  }
}
