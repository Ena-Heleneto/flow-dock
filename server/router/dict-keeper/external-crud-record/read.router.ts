import type { RouterRequestPayload } from '@/runtime/types'
import { defineRouterHandle } from '@/driver/define-router-handle.driver'
import { readDictKeeperExternalCrudRecord } from '@/service/dict-keeper-external-crud-record.service'

interface ReadExternalCrudRecordBody {
  id?: string
  includeDeleted?: boolean
}

const readExternalCrudRecordRouter = defineRouterHandle(async (event) => {
  const body = event.body as RouterRequestPayload<ReadExternalCrudRecordBody>['body'] | undefined

  const item = await readDictKeeperExternalCrudRecord(
    {
      id: body?.id,
      includeDeleted: body?.includeDeleted,
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
  method: 'GET',
})

export default readExternalCrudRecordRouter
