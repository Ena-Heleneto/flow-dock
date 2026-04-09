import { defineRouterHandle } from '@/driver/define-router-handle.driver'
import {
  readDatabaseMangerCollection,
  writeDatabaseMangerCollection,
} from '@/service/database-manger.service'

interface DatabaseInsertBody {
  key?: string
  value?: unknown
}

export default defineRouterHandle<DatabaseInsertBody>(async (event) => {
  const key = normalizeKey(event.request.body?.key)
  if (!key) {
    throw Object.assign(
      new Error('`body.key` is required for insert route'),
      { code: 'INVALID_BODY_KEY' },
    )
  }

  const collection = await readDatabaseMangerCollection()
  collection[key] = {
    value: event.request.body?.value,
    updatedAt: Date.now(),
    updatedBy: {
      module: event.context.module,
      page: event.context.page,
      traceId: event.context.traceId,
    },
  }

  await writeDatabaseMangerCollection(collection)

  return {
    key,
    item: collection[key],
    context: event.context,
  }
})

function normalizeKey(input: unknown) {
  if (typeof input !== 'string')
    return ''

  return input.trim()
}
