export default defineEventHandler(async (event: unknown) => {
  const FLOW_DOCK_DB_NAME = 'flow-dock-dev'
  readBody<ExistsPageMessage>(event)

  const pagesStore = { name: PageSchema.name, options: PageSchema.options, indexes: PageSchema.indexes, record: PageSchema.record }
  const transactionIdb = new IdbTransactionUtil({ dbName: FLOW_DOCK_DB_NAME, version: 1, stores: [pagesStore] })
  const pagesService = new PagesService(transactionIdb, { pages: PageSchema })
  try {
    const currentTab = await getCurrentTab()
    const currentUrl = currentTab?.url ?? ''
    const route = fallbackRoute(currentUrl)
    const routeSig = fallbackRouteSig(currentUrl, route)

    await transactionIdb.start('pages', 'readonly')
    const result = await pagesService.exists('pages', { indexName: 'routeSig', query: routeSig, count: 1 })

    logger.success('Page exists check completed', result)
    return { code: 0, data: result, message: 'success' }
  }
  catch (error) {
    logger.error('Page exists check failed', error)
    transactionIdb.abort()
    return { code: -1, data: null, message: 'failed to check if page exists' }
  }
})
