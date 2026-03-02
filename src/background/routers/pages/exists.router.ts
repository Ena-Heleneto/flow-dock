import { PagesService } from '../../services/pages.service'

export default defineEventHandler(async () => {
  const FLOW_DOCK_DB_NAME = 'flow-dock-dev'

  const transactionIdb = new IdbTransactionUtil({
    dbName: FLOW_DOCK_DB_NAME,
    version: 1,
    stores: [pages, screenshots, screenshot_links],
  })

  const pagesService = new PagesService(transactionIdb)
  try {
    await transactionIdb.start()
    const result = await pagesService.exists()
    logger.success('Page exists check completed')
    return { code: 0, data: result, message: 'success' }
  }
  catch (error) {
    logger.error('Page exists check failed', error)
    return { code: -1, data: null, message: 'failed to check if page exists' }
  }
})
