import type { RouterRequestPayload } from '@/runtime/types'
import { defineRouterHandle } from '@/driver/define-router-handle.driver'
import { deleteDictKeeperExternalCrudRecord } from '@/service/dict-keeper-external-crud-record.service'

interface DeleteExternalCrudRecordBody {
  id?: string
}

const deleteExternalCrudRecordRouter = defineRouterHandle(async (event) => {
  const body = event.body as RouterRequestPayload<DeleteExternalCrudRecordBody>['body'] | undefined

  const item = await deleteDictKeeperExternalCrudRecord(
    {
      id: body?.id,
      deletedBy: {
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
    item,
    context: {
      operator: event.context.operator,
      traceId: event.context.traceId,
    },
  }
}, {
  method: 'DELETE',
})

export default deleteExternalCrudRecordRouter
