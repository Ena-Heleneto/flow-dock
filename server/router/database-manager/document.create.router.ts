import { defineRouterHandle } from '@/driver/define-router-handle.driver'
import { createDocument } from '@/service/database-manager.service'

interface CreateBody {
  title?: string
  meta?: Record<string, unknown>
}

export default defineRouterHandle<CreateBody>(async (event) => {
  const body = event.request.body || {}

  const item = await createDocument({
    title: body.title,
    meta: body.meta,
    createdBy: {
      module: event.context.module,
      page: event.context.page,
      traceId: event.context.traceId,
    },
  }, { transaction: event.context.transaction })

  return { item, context: event.context }
}, { method: 'POST' })
