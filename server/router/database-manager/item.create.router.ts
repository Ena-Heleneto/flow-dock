import { defineRouterHandle } from '@/driver/define-router-handle.driver'
import { createItem } from '@/service/database-manager.service'

interface CreateBody {
  documentId?: string
  data?: unknown
}

export default defineRouterHandle<CreateBody>(async (event) => {
  const documentId = event.request.body?.documentId as string | undefined
  if (!documentId)
    throw Object.assign(new Error('`body.documentId` is required'), { code: 'INVALID_BODY_DOCUMENT_ID' })

  const item = await createItem(documentId, event.request.body?.data, {
    module: event.context.module,
    page: event.context.page,
    traceId: event.context.traceId,
  }, { transaction: event.context.transaction } as any)

  return { item, context: event.context }
}, { method: 'POST' })
