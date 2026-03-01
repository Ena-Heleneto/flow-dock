import { PagesService } from '../services/pages.service'
import type { SavePageInput } from '../services/pages.service'
// // import logger from '~/utils/logger.util'

interface SavePageMessage {
  data?: SavePageInput
}

export class PagesController {
  private readonly pagesService: PagesService

  constructor() {
    this.pagesService = new PagesService()
  }

  async savePage(message: SavePageMessage = {}) {
    logger.log('Saving page...', message?.data)
    try {
      const result = await this.pagesService.savePage(message?.data)
      const { countPages } = pagesSchema()
      const total = await countPages()

      logger.success('save-page persisted', {
        id: result.page.id,
        url: result.page.url,
        address: result.page.address,
        duplicated: result.duplicated,
        total,
      })

      return {
        page: result.page,
        duplicated: result.duplicated,
        total,
      }
    }
    catch (error) {
      logger.error('save-page failed in background', error)
      throw error
    }
  }
}
