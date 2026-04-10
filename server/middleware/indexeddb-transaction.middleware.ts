import { defineMiddlewareHandle } from '@/driver/define-middleware-handle.driver'
import { beginTransaction } from '@/driver/transaction.manager'

const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export default defineMiddlewareHandle(async (event, next) => {
  const normalizedMethod = event.request.method.toUpperCase()
  const mode = READ_ONLY_METHODS.has(normalizedMethod)
    ? 'readonly'
    : 'readwrite'

  const transaction = await beginTransaction({ mode })
  event.context.transaction = transaction

  try {
    const result = await next()
    await transaction.commit()
    return result
  }
  catch (error) {
    await transaction.rollback()
    throw error
  }
  finally {
    event.context.transaction = undefined
  }
})
