import type { ResolvedConfig } from 'vite'
import type {
  FlowDockGeneratorContext,
  FlowDockKitOptions,
} from '../types.ts'
import {
  resolveFlowDockDir,
  resolveFlowDockDirName,
  resolvePluginRoot,
} from '../utils/paths.ts'

const PLUGIN_NAME = 'vite-plugin-flow-dock-kit'

export function createFlowDockContext(
  config: ResolvedConfig | null,
  options: FlowDockKitOptions = {},
): FlowDockGeneratorContext {
  return {
    pluginName: PLUGIN_NAME,
    root: resolvePluginRoot(config, options),
    flowDockDirName: resolveFlowDockDirName(options),
    flowDockDir: resolveFlowDockDir(config, options),
    config,
    command: config?.command ?? 'build',
    options,
    // logger: config?.logger ?? consola,
  }
}
