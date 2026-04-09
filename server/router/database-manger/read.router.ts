import { defineRouterHandle } from '@/driver/define-router-handle.driver'
import { readDatabaseMangerCollection } from '@/service/database-manger.service'

interface DatabaseReadBody {
  key?: string
}

export default defineRouterHandle<DatabaseReadBody>(
  async (event) => {
    const collection = await readDatabaseMangerCollection()
    const key = normalizeKey(event.request.body?.key)

    if (key) {
      return {
        key,
        item: collection[key] ?? null,
        context: event.context,
      }
    }

    return {
      items: collection,
      context: event.context,
    }
  },
  {
    method: 'GET',
  },
)

function normalizeKey(input: unknown) {
  if (typeof input !== 'string')
    return ''

  return input.trim()
}
