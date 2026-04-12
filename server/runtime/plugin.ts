import type { RouterEvent, RouterFailure, RouterSuccess } from './types'

export interface RuntimePluginHooks {
  onContextCreated?: (event: RouterEvent) => void | Promise<void>
  onRequest?: (event: RouterEvent) => void | Promise<void>
  onResponse?: (event: RouterEvent, response: RouterSuccess) => void | Promise<void>
  onError?: (event: RouterEvent | null, error: RouterFailure['error']) => void | Promise<void>
}

export interface RuntimePlugin {
  name?: string
  hooks?: RuntimePluginHooks
}

export function definePlugin(plugin: RuntimePlugin): RuntimePlugin {
  return plugin
}
