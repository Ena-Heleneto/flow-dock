import type { RuntimePlugin, RuntimePluginHooks } from '@/runtime/plugin'
import { definePlugin } from '@/runtime/plugin'

const PLUGIN_HOOK_KEYS: ReadonlyArray<keyof RuntimePluginHooks> = [
  'onContextCreated',
  'onRequest',
  'onResponse',
  'onError',
]

export type { RuntimePlugin, RuntimePluginHooks }

export function definePluginHandle(plugin: RuntimePlugin): RuntimePlugin {
  return definePlugin(plugin)
}

export function isPluginHandle(input: unknown): input is RuntimePlugin {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return false

  const plugin = input as RuntimePlugin

  if (plugin.name !== undefined && typeof plugin.name !== 'string')
    return false

  if (plugin.hooks === undefined)
    return true

  if (!plugin.hooks || typeof plugin.hooks !== 'object' || Array.isArray(plugin.hooks))
    return false

  for (const hookKey of PLUGIN_HOOK_KEYS) {
    const hook = plugin.hooks[hookKey]
    if (hook !== undefined && typeof hook !== 'function')
      return false
  }

  return true
}
