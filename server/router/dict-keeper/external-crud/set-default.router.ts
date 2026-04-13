import { defineRouterHandle } from '@/driver/define-router-handle.driver'
import { setDefaultDictKeeperExternalCrud } from '@/service/dict-keeper-external-crud.service'

interface SetDefaultBody {
  id?: string
}

export default defineRouterHandle<SetDefaultBody>(async (event) => {
  const body = event.request.body || {}

  const item = await setDefaultDictKeeperExternalCrud({
    id: body.id,
    updatedBy: {
      module: event.context.module,
      page: event.context.page,
      traceId: event.context.traceId,
    },
  }, { transaction: event.context.transaction })

  return { item, context: event.context }
}, { method: 'PUT' })
