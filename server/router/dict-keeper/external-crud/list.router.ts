import { defineRouterHandle } from '@/driver/define-router-handle.driver'
import { listDictKeeperExternalCruds } from '@/service/dict-keeper-external-crud.service'

interface ListBody {
  includeDeleted?: boolean
}

export default defineRouterHandle<ListBody>(async (event) => {
  const body = event.request.body || {}

  const items = await listDictKeeperExternalCruds({
    includeDeleted: body.includeDeleted === true,
  }, {
    transaction: event.context.transaction,
  })

  return { items, context: event.context }
}, { method: 'GET' })
