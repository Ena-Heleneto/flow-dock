import type { RouterRequestPayload } from '@/runtime/types'
import { defineRouterHandle } from '@/driver/define-router-handle.driver'
import { createDictKeeperExternalCrudRecord } from '@/service/dict-keeper-external-crud-record.service'

interface CreateExternalCrudRecordBody {
  id?: string
  sessionId?: string
  url?: string
  method?: string
  path?: string
  requestHeaders?: unknown
  requestQuery?: unknown
  requestBodyText?: unknown
  requestBodyJson?: unknown
  responseBodyText?: unknown
  responseBodyJson?: unknown
  contentType?: string
  status?: unknown
  durationMs?: unknown
  sourceTabId?: unknown
  sourceUrl?: string
  masked?: unknown
  truncated?: unknown
  mappingDraft?: unknown
}

const createExternalCrudRecordRouter = defineRouterHandle(async (event) => {
  const body = event.body as RouterRequestPayload<CreateExternalCrudRecordBody>['body'] | undefined

  const item = await createDictKeeperExternalCrudRecord(
    {
      id: body?.id,
      sessionId: body?.sessionId,
      url: body?.url ?? '',
      method: body?.method,
      path: body?.path,
      requestHeaders: body?.requestHeaders,
      requestQuery: body?.requestQuery,
      requestBodyText: body?.requestBodyText,
      requestBodyJson: body?.requestBodyJson,
      responseBodyText: body?.responseBodyText,
      responseBodyJson: body?.responseBodyJson,
      contentType: body?.contentType,
      status: body?.status,
      durationMs: body?.durationMs,
      sourceTabId: body?.sourceTabId,
      sourceUrl: body?.sourceUrl,
      masked: body?.masked,
      truncated: body?.truncated,
      mappingDraft: body?.mappingDraft,
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
    item,
    context: {
      operator: event.context.operator,
      traceId: event.context.traceId,
    },
  }
}, {
  method: 'POST',
})

export default createExternalCrudRecordRouter
