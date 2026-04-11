import { defineRouterHandle } from '@/driver/define-router-handle.driver'
import { readDictKeeperConfig } from '@/service/dict-keeper-config.service'

interface ReadBody {
  id?: string
  includeDeleted?: boolean
}

export default defineRouterHandle<ReadBody>(async (event) => {
  const body = event.request.body || {}

  const item = await readDictKeeperConfig({
    id: body.id,
    includeDeleted: body.includeDeleted === true,
  }, {
    transaction: event.context.transaction,
  })

  return { item, context: event.context }
}, { method: 'GET' })
