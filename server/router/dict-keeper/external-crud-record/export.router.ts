import type { RouterRequestPayload } from '@/runtime/types'
import { defineRouterHandle } from '@/driver/define-router-handle.driver'
import { exportDictKeeperExternalCrudRecordBundle } from '@/service/dict-keeper-external-crud-record.service'

interface ExportExternalCrudRecordBody {
  sessionId?: string
  ids?: string[]
  includeDeleted?: boolean
}

const exportExternalCrudRecordRouter = defineRouterHandle(async (event) => {
  const body = event.body as RouterRequestPayload<ExportExternalCrudRecordBody>['body'] | undefined

  const bundle = await exportDictKeeperExternalCrudRecordBundle(
    {
      sessionId: body?.sessionId,
      ids: body?.ids,
      includeDeleted: body?.includeDeleted,
    },
    {
      transaction: event.context.transaction,
    },
  )

  return {
    bundle,
    context: {
      operator: event.context.operator,
      traceId: event.context.traceId,
    },
  }
}, {
  method: 'POST',
})

export default exportExternalCrudRecordRouter
