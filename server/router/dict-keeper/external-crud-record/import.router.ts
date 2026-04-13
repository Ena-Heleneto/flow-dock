import type { RouterRequestPayload } from '@/runtime/types'
import { defineRouterHandle } from '@/driver/define-router-handle.driver'
import { importDictKeeperExternalCrudRecordBundle } from '@/service/dict-keeper-external-crud-record.service'

interface ImportExternalCrudRecordBody {
  bundle?: unknown
  sessionId?: string
}

const importExternalCrudRecordRouter = defineRouterHandle(async (event) => {
  const body = event.body as RouterRequestPayload<ImportExternalCrudRecordBody>['body'] | undefined

  const result = await importDictKeeperExternalCrudRecordBundle(
    {
      bundle: body?.bundle,
      sessionId: body?.sessionId,
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
    ...result,
    context: {
      operator: event.context.operator,
      traceId: event.context.traceId,
    },
  }
}, {
  method: 'POST',
})

export default importExternalCrudRecordRouter
