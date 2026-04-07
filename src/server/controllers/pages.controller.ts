// import { PagesService } from '../services/pages.service'
// import { ScreenshotsService } from '../services/screenshots.service'
// import type { SavePageInput, SavePageResult } from '../services/pages.service'
// import { PAGES_STORE_NAME, pages, pagesSchema } from '../schemas/pages.schema'
// import { SCREENSHOTS_STORE_NAME, screenshots } from '../schemas/screenshots.schema'
// import { SCREENSHOT_LINKS_STORE_NAME, screenshot_links } from '../schemas/screenshot_links.schema'
// import { useIdb } from '../../composables/useIdb'

// interface SavePageMessage {
//   data?: SavePageInput
//   sender?: {
//     tabId?: number
//   }
// }

// const FLOW_DOCK_DB_NAME = 'flow-dock-dev'

// export class PagesController {
//   private readonly pagesService: PagesService
//   private readonly screenshotsService: ScreenshotsService
//   private readonly transactionIdb = useIdb({
//     dbName: FLOW_DOCK_DB_NAME,
//     version: 1,
//     stores: [pages, screenshots, screenshot_links],
//   })

//   private readonly pagesApi = pagesSchema({ dbName: FLOW_DOCK_DB_NAME })

//   constructor() {
//     this.pagesService = new PagesService()
//     this.screenshotsService = new ScreenshotsService(undefined, FLOW_DOCK_DB_NAME)
//   }

//   async savePage(message: SavePageMessage = {}) {
//     try {
//       const preparedInput = await this.pagesService.prepareSavePageInput(message?.data)
//       const senderTabId = typeof message?.sender?.tabId === 'number' ? message.sender.tabId : undefined
//       const capturedScreenshot = await this.screenshotsService.captureScreenshot(senderTabId)
//       const { context: transaction, done } = await this.transactionIdb.beginTransaction([
//         PAGES_STORE_NAME,
//         SCREENSHOTS_STORE_NAME,
//         SCREENSHOT_LINKS_STORE_NAME,
//       ], 'readwrite')

//       const transactionalPagesService = new PagesService(transaction)
//       const transactionalScreenshotsService = new ScreenshotsService(transaction, FLOW_DOCK_DB_NAME)

//       let shouldCommit = false
//       let duplicated = false
//       let total = 0
//       let page: PageRecord | undefined
//       let screenshot: ScreenshotRecord | undefined

//       try {
//         const result: SavePageResult = await transactionalPagesService.savePage(preparedInput)
//         duplicated = result.duplicated

//         page = result.page

//         const saved = await transactionalScreenshotsService.persistScreenshot(page, capturedScreenshot)
//         screenshot = saved.screenshot

//         const { updatePage, countPages } = this.pagesApi
//         const updatedPage = await updatePage(page.id, { screenshotId: screenshot.id }, transaction)
//         if (updatedPage)
//           page = updatedPage

//         total = await countPages()

//         shouldCommit = true
//       }
//       catch (error) {
//         try {
//           transaction.transaction.abort()
//         }
//         catch (abortError) {
//         }
//         throw error
//       }
//       finally {
//         if (shouldCommit) {
//           try {
//             transaction.transaction.commit?.()
//           }
//           catch (commitError) {
//             const isFinishedError = commitError instanceof DOMException
//               ? commitError.name === 'InvalidStateError'
//               : String(commitError).includes('InvalidStateError')

//             if (isFinishedError)
//             else
//           }
//         }

//         await done.catch(() => undefined)
//       }

//       if (screenshot) {
//         const updatedScreenshot = await this.screenshotsService.persistScreenshotDownloadMetadata(screenshot.id, capturedScreenshot.blob)
//         if (updatedScreenshot)
//           screenshot = updatedScreenshot
//       }

//       if (!page)
//         throw new Error('save-page transaction completed without page result')

//       return { page, duplicated, screenshot, total }
//     }
//     catch (error) {
//       throw error
//     }
//   }
// }
