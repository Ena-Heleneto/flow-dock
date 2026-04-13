import type { RouterRequestPayload } from '@/runtime/types'
import { defineRouterHandle } from '@/driver/define-router-handle.driver'
import { startDictKeeperExternalCrudRecordSession } from '@/service/dict-keeper-external-crud-record.service'

interface StartExternalCrudRecordSessionBody {
  id?: string
  name?: string
  sourceUrl?: string
}

const startExternalCrudRecordSessionRouter = defineRouterHandle(async (event) => {
  const body = event.body as RouterRequestPayload<StartExternalCrudRecordSessionBody>['body'] | undefined

  const session = await startDictKeeperExternalCrudRecordSession(
    {
      id: body?.id,
      name: body?.name,
      sourceUrl: body?.sourceUrl,
      createdBy: {
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
  method: 'POST',
})

export default startExternalCrudRecordSessionRouter
