import { defineRouterHandle } from '@/driver/define-router-handle.driver'
import { deleteDocument } from '@/service/database-manager.service'

interface DeleteBody {
  id?: string
}

export default defineRouterHandle<DeleteBody>(async (event) => {
  const id = event.request.body?.id as string | undefined
  if (!id)
    throw Object.assign(new Error('`body.id` is required'), { code: 'INVALID_BODY_ID' })

  const deleted = await deleteDocument(id, { transaction: event.context.transaction })
  return { item: deleted, context: event.context }
}, { method: 'DELETE' })
