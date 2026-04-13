import type { RouterRequestPayload } from '@/runtime/types'
import { defineRouterHandle } from '@/driver/define-router-handle.driver'
import { stopDictKeeperExternalCrudRecordSession } from '@/service/dict-keeper-external-crud-record.service'

interface StopExternalCrudRecordSessionBody {
  id?: string
}

const stopExternalCrudRecordSessionRouter = defineRouterHandle(async (event) => {
  const body = event.body as RouterRequestPayload<StopExternalCrudRecordSessionBody>['body'] | undefined

  const session = await stopDictKeeperExternalCrudRecordSession(
    {
      id: body?.id,
      updatedBy: {
        module: event.context.module,
        page: event.context.page,
        traceId: event.context.traceId,
      },
    },
    {
      transaction: event.context.transaction,
    },
  )

  return {
    session,
    context: {
      operator: event.context.operator,
      traceId: event.context.traceId,
    },
  }
}, {
  method: 'PUT',
})

export default stopExternalCrudRecordSessionRouter
