import { defineRouterHandle } from '@/driver/define-router-handle.driver'
import { getDocument, listDocuments } from '@/service/database-manager.service'

interface ReadBody {
  id?: string
}

export default defineRouterHandle<ReadBody>(async (event) => {
  const id = event.request.body?.id as string | undefined

  if (id) {
    const doc = await getDocument(id, { transaction: event.context.transaction })
    return { item: doc, context: event.context }
  }

  const docs = await listDocuments({ transaction: event.context.transaction })
  return { items: docs, context: event.context }
}, { method: 'GET' })
