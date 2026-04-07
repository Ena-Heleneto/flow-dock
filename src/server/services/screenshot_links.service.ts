export class ScreenshotLinksService<TSchema extends GenericSchemaReader> {
  constructor(
    private readonly transaction: Pick<IdbTransactionUtil, 'getCurrent'>,
    private readonly schema: TSchema,
  ) {}

  /**
   * 根据指定条件查询截图链接记录
   * @param query - 查询条件选项，包含索引名称和查询参数
   * @param query.indexName - 要查询的索引名称
   * @param query.query - 具体的查询条件
   * @returns 返回匹配查询条件的截图链接记录数组
   */
  async find(query: FindByCriteriaOptions) {
    const result = await this.schema.findByCriteria(this.transaction.getCurrent(), query)
    return result
  }

  /**
   * 保存截图链接到数据库
   * @param payload - 截图链接的部分数据，符合 TSchema 的结构
   * @returns 返回包含新创建记录 ID 的对象
   * @throws 如果数据库操作失败会抛出异常
   */
  async saveScreenshotLinks(payload: Partial<SchemaRecordType<TSchema>>) {
    const id = await this.schema.create(this.transaction.getCurrent(), payload)
    return { id }
  }
}
