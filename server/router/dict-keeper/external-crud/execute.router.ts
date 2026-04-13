import { defineRouterHandle } from '@/driver/define-router-handle.driver'
import {
  executeDictKeeperExternalCrud,
} from '@/service/dict-keeper-external-crud-executor.service'

interface ExecuteBody {
  id?: string
  section?: 'dictionary' | 'item'
  action?: 'create' | 'read' | 'update' | 'delete'
  payload?: unknown
  authData?: Record<string, unknown>
  injectTarget?: 'header' | 'params' | 'data'
  successRule?: {
    fieldPath?: string
    expectedValue?: unknown
  }
  timeoutMs?: number
}

export default defineRouterHandle<ExecuteBody>(async (event) => {
  const body = event.request.body || {}

  if (!body.section) {
    throw Object.assign(new Error('`body.section` is required'), {
      code: 'INVALID_BODY_SECTION',
    })
  }

  if (!body.action) {
    throw Object.assign(new Error('`body.action` is required'), {
      code: 'INVALID_BODY_ACTION',
    })
  }

  const result = await executeDictKeeperExternalCrud({
    id: body.id,
    section: body.section,
    action: body.action,
    payload: body.payload,
    authData: body.authData,
    contextData: {
      module: event.context.module,
      page: event.context.page,
      traceId: event.context.traceId,
      nowTs: Date.now(),
    },
    injectTarget: body.injectTarget,
    successRule: body.successRule?.fieldPath
      ? {
          fieldPath: body.successRule.fieldPath,
          expectedValue: body.successRule.expectedValue,
        }
      : undefined,
    timeoutMs: body.timeoutMs,
  })

  return {
    result,
    context: event.context,
  }
}, { method: 'POST' })
