import { defineRouterHandle } from '@/driver/define-router-handle.driver'
import { updateDocument } from '@/service/database-manager.service'

interface UpdateBody {
  id?: string
  title?: string
  meta?: Record<string, unknown>
}

export default defineRouterHandle<UpdateBody>(async (event) => {
  const id = event.request.body?.id as string | undefined
  if (!id)
    throw Object.assign(new Error('`body.id` is required'), { code: 'INVALID_BODY_ID' })

  const updated = await updateDocument(id, {
    title: event.request.body?.title,
    meta: event.request.body?.meta,
    updatedBy: {
      module: event.context.module,
      page: event.context.page,
      traceId: event.context.traceId,
    },
  }, { transaction: event.context.transaction })

  return { item: updated, context: event.context }
}, { method: 'PUT' })
