import { defineRouterHandle } from '@/driver/define-router-handle.driver'
import { listDictKeeperConfigs } from '@/service/dict-keeper-config.service'

interface ListBody {
  includeDeleted?: boolean
}

export default defineRouterHandle<ListBody>(async (event) => {
  const body = event.request.body || {}

  const items = await listDictKeeperConfigs({
    includeDeleted: body.includeDeleted === true,
  }, {
    transaction: event.context.transaction,
  })

  return { items, context: event.context }
}, { method: 'GET' })
