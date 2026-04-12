import type { RouterEvent, RouterResponse } from './types'

export type RouterNext = () => Promise<RouterResponse | unknown>

export type RouterMiddleware = (
  event: RouterEvent,
  next: RouterNext,
) => Promise<RouterResponse | unknown> | RouterResponse | unknown

export function defineMiddleware(middleware: RouterMiddleware): RouterMiddleware {
  return middleware
}

export async function runMiddlewareChain(
  event: RouterEvent,
  middlewares: RouterMiddleware[],
  finalHandler: RouterNext,
): Promise<RouterResponse | unknown> {
  let index = -1

  const dispatch = async (cursor: number): Promise<RouterResponse | unknown> => {
    if (cursor <= index)
      throw new Error('next() called multiple times')

    index = cursor

    const middleware = middlewares[cursor]
    if (!middleware)
      return finalHandler()

    return middleware(event, () => dispatch(cursor + 1))
  }

  return dispatch(0)
}
