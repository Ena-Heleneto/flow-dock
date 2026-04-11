import type { DictKeeperCrudEndpointConfig } from '@/schema/dict-keeper/config.schema'
import { defineRouterHandle } from '@/driver/define-router-handle.driver'
import { createDictKeeperConfig } from '@/service/dict-keeper-config.service'

interface CreateBody {
  id?: string
  name?: string
  basePath?: string
  dictionary?: Partial<DictKeeperCrudEndpointConfig>
  item?: Partial<DictKeeperCrudEndpointConfig>
}

export default defineRouterHandle<CreateBody>(async (event) => {
  const body = event.request.body || {}

  const item = await createDictKeeperConfig({
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
