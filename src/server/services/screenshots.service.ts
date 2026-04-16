export class ScreenshotsService<TSchema extends GenericSchemaReader> {
  constructor(
    private readonly transaction: Pick<IdbTransactionUtil, 'getCurrent'>,
    private readonly schema: TSchema,
  ) {}

  /**
   * 保存屏幕截图到数据库
   * @param payload - 屏幕截图的部分数据对象，包含pageId等字段
   * @returns 返回新创建的屏幕截图记录的ID
   */
  async saveScreenshot(payload: Partial<SchemaRecordType<TSchema>>) {
    const id = await this.schema.create(this.transaction.getCurrent(), payload)
    logger.debug(`Saved screenshot in screenshots table ${id}`, { payload })
    return id
  }
}
