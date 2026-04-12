import type { DictKeeperCrudEndpointConfig } from '@/schema/dict-keeper/external-crud.schema'
import { defineRouterHandle } from '@/driver/define-router-handle.driver'
import { createDictKeeperExternalCrud } from '@/service/dict-keeper-external-crud.service'

interface CreateBody {
  id?: string
  name?: string
  basePath?: string
  dictionary?: Partial<DictKeeperCrudEndpointConfig>
  item?: Partial<DictKeeperCrudEndpointConfig>
}

export default defineRouterHandle<CreateBody>(async (event) => {
  const body = event.request.body || {}

  const item = await createDictKeeperExternalCrud({
    id: body.id,
    name: body.name,
    basePath: body.basePath,
    dictionary: body.dictionary,
    item: body.item,
    createdBy: {
      module: event.context.module,
      page: event.context.page,
      traceId: event.context.traceId,
    },
  }, { transaction: event.context.transaction })

  return { item, context: event.context }
}, { method: 'POST' })
