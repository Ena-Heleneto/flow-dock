import type { DictKeeperCrudEndpointConfig } from '@/schema/dict-keeper/config.schema'
import { defineRouterHandle } from '@/driver/define-router-handle.driver'
import { updateDictKeeperConfig } from '@/service/dict-keeper-config.service'

interface UpdateBody {
  id?: string
  name?: string
  basePath?: string
  dictionary?: Partial<DictKeeperCrudEndpointConfig>
  item?: Partial<DictKeeperCrudEndpointConfig>
}

export default defineRouterHandle<UpdateBody>(async (event) => {
  const body = event.request.body || {}
  const id = typeof body.id === 'string' ? body.id.trim() : ''
  if (!id) {
    throw Object.assign(new Error('`body.id` is required'), {
      code: 'INVALID_BODY_ID',
    })
  }

  const hasPatch = body.name !== undefined || body.basePath !== undefined || body.dictionary !== undefined || body.item !== undefined

  if (!hasPatch) {
    throw Object.assign(new Error('At least one config field is required for update'), {
      code: 'INVALID_BODY_PATCH',
    })
  }

  const item = await updateDictKeeperConfig({
    id,
    name: body.name,
    basePath: body.basePath,
    dictionary: body.dictionary,
    item: body.item,
    updatedBy: {
      module: event.context.module,
      page: event.context.page,
      traceId: event.context.traceId,
    },
  }, { transaction: event.context.transaction })

  return { item, context: event.context }
}, { method: 'PUT' })
