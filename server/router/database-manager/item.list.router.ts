import { defineRouterHandle } from '@/driver/define-router-handle.driver'
import { listItems } from '@/service/database-manager.service'

interface ListBody {
  documentId?: string
}

export default defineRouterHandle<ListBody>(async (event) => {
  const documentId = event.request.body?.documentId as string | undefined
  if (!documentId)
    return { items: [], context: event.context }

  const items = await listItems(documentId, { transaction: event.context.transaction })
  return { items, context: event.context }
}, { method: 'GET' })
