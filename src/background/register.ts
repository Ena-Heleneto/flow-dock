import { onMessage } from 'webext-bridge/background'
import { isDefinedEventHandler } from '../utils/define-event-handler.util'

type ControllerMethod = (...args: unknown[]) => unknown
type ControllerInstance = Record<string, ControllerMethod>
type ControllerClass = new () => ControllerInstance

function toKebabCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase()
}

function toRouteCase(value: string) {
  return value
    .split('/')
    .map(segment => toKebabCase(segment))
    .join('/')
}

function toRouterMessageName(modulePath: string, exportName: string) {
  const baseName = modulePath
    .replace(/^\.\/routers\//, '')
    .replace(/\.router\.ts$/, '')

  if (exportName === 'default')
    return toRouteCase(baseName)

  return `${toRouteCase(baseName)}/${toKebabCase(exportName)}`
}

function isControllerClass(value: unknown): value is ControllerClass {
  if (typeof value !== 'function')
    return false

  const prototype = (value as { prototype?: Record<string, unknown> }).prototype
  if (!prototype)
    return false

  return Object.getOwnPropertyNames(prototype).some((methodName) => {
    if (methodName === 'constructor')
      return false

    return typeof prototype[methodName] === 'function'
  })
}

export function registerControllers() {
  const modules = import.meta.glob<Record<string, unknown>>('./controllers/**/*.controller.ts', { eager: true })

  Object.values(modules).forEach((moduleExports) => {
    Object.values(moduleExports).forEach((exportedMember) => {
      if (!isControllerClass(exportedMember))
        return

      const ControllerCtor = exportedMember
      let controller: ControllerInstance

      try {
        controller = new ControllerCtor()
      }
      catch (error) {
        console.error('[registerControllers] Failed to create controller instance', error)
        return
      }

      const methodNames = Object.getOwnPropertyNames(ControllerCtor.prototype)

      methodNames.forEach((methodName) => {
        if (methodName === 'constructor')
          return

        const method = controller[methodName]
        if (typeof method !== 'function')
          return

        const messageName = toKebabCase(methodName)
        const handler = method.bind(controller)

        onMessage(messageName as never, async (...args: unknown[]) => {
          return await handler(...args)
        })
      })
    })
  })
}

export function registerRouterEventHandlers() {
  const modules = import.meta.glob<Record<string, unknown>>('./routers/**/*.router.ts', { eager: true })
  const registeredEventNames = new Set<string>()

  Object.entries(modules).forEach(([modulePath, moduleExports]) => {
    Object.entries(moduleExports).forEach(([exportName, exportedMember]) => {
      if (!isDefinedEventHandler(exportedMember))
        return

      const messageName = toRouterMessageName(modulePath, exportName)
      if (registeredEventNames.has(messageName)) {
        console.warn(`[registerRouterEventHandlers] Duplicate handler ignored: ${messageName}`)
        return
      }

      registeredEventNames.add(messageName)

      onMessage(messageName as never, async (...args: unknown[]) => {
        return await exportedMember.handler(...args)
      })
    })
  })
}
