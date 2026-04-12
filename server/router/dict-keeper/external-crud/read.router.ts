import { defineRouterHandle } from '@/driver/define-router-handle.driver'
import { readDictKeeperExternalCrud } from '@/service/dict-keeper-external-crud.service'

interface ReadBody {
  id?: string
  includeDeleted?: boolean
}

export default defineRouterHandle<ReadBody>(async (event) => {
  const body = event.request.body || {}

  const item = await readDictKeeperExternalCrud({
    id: body.id,
    includeDeleted: body.includeDeleted === true,
  }, {
    transaction: event.context.transaction,
  })

  return { item, context: event.context }
}, { method: 'GET' })
