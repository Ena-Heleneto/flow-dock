import { defineRouterHandle } from '@/driver/define-router-handle.driver'
import { deleteDictKeeperConfig } from '@/service/dict-keeper-config.service'

interface DeleteBody {
  id?: string
}

export default defineRouterHandle<DeleteBody>(async (event) => {
  const body = event.request.body || {}

  const item = await deleteDictKeeperConfig({
    id: body.id,
    deletedBy: {
      module: event.context.module,
      page: event.context.page,
      traceId: event.context.traceId,
    },
  }, { transaction: event.context.transaction })

  return { item, context: event.context }
}, { method: 'DELETE' })
