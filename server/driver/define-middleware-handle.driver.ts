import type { RouterMiddleware, RouterNext } from '@/runtime/middleware'
import { defineMiddleware } from '@/runtime/middleware'

export type { RouterMiddleware, RouterNext }

export function defineMiddlewareHandle(middleware: RouterMiddleware): RouterMiddleware {
  return defineMiddleware(middleware)
}

export function isMiddlewareHandle(input: unknown): input is RouterMiddleware {
  return typeof input === 'function'
}
