/**
 * 构建页面文档对象
 *
 * @param payload - 页面schema记录的部分数据，包含url、route、routeSig等可选字段
 * @param currentTab - 当前标签页信息，包含url和title
 * @returns 完整的页面文档对象，包含所有必需字段和routeSig（默认为空字符串）
 *
 * @remarks
 * 此函数会根据传入的payload和当前标签页信息构建完整的页面文档。
 * 如果payload中缺少url，会尝试从currentTab中获取；
 * 如果缺少route，会根据url调用fallbackRoute生成；
 * 如果缺少routeSig，会根据url和route调用fallbackRouteSig生成。
 * 如果最终routeSig仍为undefined，则设置为空字符串。
 */
function buildPageDocument(payload: Partial<SchemaRecordType<typeof PageSchema>>, currentTab: { url?: string, title?: string } | undefined) {
  const url = payload.url ?? currentTab?.url
  const route = payload.route ?? (url ? fallbackRoute(url) : undefined)
  const routeSig = payload.routeSig ?? (url && route ? fallbackRouteSig(url, route) : undefined)

  const pageDocument = buildDocument(PageSchema, {
    ...payload,
    ...(url ? { url } : {}),
    ...(route ? { route } : {}),
    routeSig,
  }, {
    strict: true,
  }) as SchemaRecordType<typeof PageSchema> & { routeSig?: string }

  return {
    ...pageDocument,
    routeSig: pageDocument.routeSig ?? '',
  }
}

export default defineEventHandler(async (event: unknown) => {
  const FLOW_DOCK_DB_NAME = 'flow-dock-dev'

  const pagesStore = { name: PageSchema.name, options: PageSchema.options, indexes: PageSchema.indexes, record: PageSchema.record }
  const transactionIdb = new IdbTransactionUtil({ dbName: FLOW_DOCK_DB_NAME, version: 1, stores: [pagesStore] })
  const pagesService = new PagesService(transactionIdb, { pages: PageSchema })
  try {
    const payload = readBody<Partial<SchemaRecordType<typeof PageSchema>>>(event) ?? {}
    const currentTab = await getCurrentTab()
    const pageDocument = buildPageDocument(payload, currentTab)
    const pageRouteSig = pageDocument.routeSig

    await transactionIdb.start('pages', 'readwrite')

    if (pageRouteSig) {
      const _exists = await pagesService.exists('pages', { indexName: 'routeSig', query: pageRouteSig, count: 1 })
      if (_exists) {
        logger.info('Page already exists, skipping save', { routeSig: pageRouteSig })
        return { code: 0, data: null, message: 'page already exists' }
      }
    }

    const id = await pagesService.save('pages', pageDocument)
    logger.success('Page document saved', { id, routeSig: pageRouteSig })
    return { code: 0, data: { id, page: pageDocument }, message: 'success' }
  }
  catch (error: unknown) {
    logger.error('Failed to save page data', error)
    transactionIdb.abort()
    return { code: -1, data: null, message: 'failed to save page data' }
  }
})
