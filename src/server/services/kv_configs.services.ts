export class KvConfigsService<TSchema extends GenericSchemaReader> {
  constructor(
    private readonly transaction: Pick<IdbTransactionUtil, 'getCurrent'>,
    private readonly schema: TSchema,
  ) {}

  /**
   * 从数据库中读取所有配置项
   *
   * 该方法会从 kv_configs 表中查询并返回所有配置记录。
   *
   * @returns {Promise<any[]>} 返回包含所有配置项的数组
   * @throws 如果数据库查询失败则抛出错误
   *
   */
  async readConfig() {
    const configs = await this.schema.findAll(this.transaction.getCurrent())
    return configs
  }
}
