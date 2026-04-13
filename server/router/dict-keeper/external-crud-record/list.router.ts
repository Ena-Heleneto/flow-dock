import type { RouterRequestPayload } from '@/runtime/types'
import { defineRouterHandle } from '@/driver/define-router-handle.driver'
import { listDictKeeperExternalCrudRecords } from '@/service/dict-keeper-external-crud-record.service'

interface ListExternalCrudRecordBody {
  sessionId?: string
  includeDeleted?: boolean
  limit?: number
}

const listExternalCrudRecordRouter = defineRouterHandle(async (event) => {
  const body = event.body as RouterRequestPayload<ListExternalCrudRecordBody>['body'] | undefined

  const items = await listDictKeeperExternalCrudRecords(
    {
      sessionId: body?.sessionId,
      includeDeleted: body?.includeDeleted,
      limit: body?.limit,
    },
    {
      transaction: event.context.transaction,
    },
  )

  return {
    items,
    context: {
      operator: event.context.operator,
      traceId: event.context.traceId,
    },
  }
}, {
  method: 'GET',
})

export default listExternalCrudRecordRouter
