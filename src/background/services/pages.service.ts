import type { IdbTransactionUtil } from '~/utils/transaction.util'

export class PagesService {
  constructor(private readonly transaction: Pick<IdbTransactionUtil, 'getCurrent'>) {}

  exists() {
    return PageSchema.readById(this.transaction.getCurrent(), 'pages')
  }
}
