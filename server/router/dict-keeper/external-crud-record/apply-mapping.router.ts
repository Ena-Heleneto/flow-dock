import type { RouterRequestPayload } from '@/runtime/types'
import type { DictKeeperExternalCrudRecordMappingDraft } from '@/schema/dict-keeper/external-crud-record.schema'
import { defineRouterHandle } from '@/driver/define-router-handle.driver'
import { applyDictKeeperExternalCrudRecordMapping } from '@/service/dict-keeper-external-crud-record.service'

interface ApplyMappingExternalCrudRecordBody {
  id?: string
  section?: string
  action?: string
  patch?: Partial<DictKeeperExternalCrudRecordMappingDraft>
}

const applyMappingExternalCrudRecordRouter = defineRouterHandle(async (event) => {
  const body = event.body as RouterRequestPayload<ApplyMappingExternalCrudRecordBody>['body'] | undefined

  const result = await applyDictKeeperExternalCrudRecordMapping(
    {
      id: body?.id,
      section: body?.section,
      action: body?.action,
      patch: body?.patch,
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
    item: result?.item ?? null,
    suggestion: result?.suggestion ?? null,
    context: {
      operator: event.context.operator,
      traceId: event.context.traceId,
    },
  }
}, {
  method: 'PUT',
})

export default applyMappingExternalCrudRecordRouter
