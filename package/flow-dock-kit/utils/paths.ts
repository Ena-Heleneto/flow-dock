import type { ResolvedConfig } from 'vite'
import type { FlowDockKitOptions } from '../types.ts'
import { join, resolve } from 'node:path'
import process from 'node:process'

export const DEFAULT_FLOW_DOCK_DIR_NAME = '.flow-dock'

export function resolvePluginRoot(
  config: ResolvedConfig | null,
  options: FlowDockKitOptions = {},
) {
  return resolve(options.root ?? config?.root ?? process.cwd())
}

export function resolveFlowDockDirName(options: FlowDockKitOptions = {}) {
  const value = options.dirName?.trim()
  return value && value.length > 0
    ? value
    : DEFAULT_FLOW_DOCK_DIR_NAME
}

export function resolveFlowDockDir(
  config: ResolvedConfig | null,
  options: FlowDockKitOptions = {},
) {
  return join(
    resolvePluginRoot(config, options),
    resolveFlowDockDirName(options),
  )
}
