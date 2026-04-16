import type { Plugin, ResolvedConfig, ViteDevServer } from 'vite'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import consola from 'consola'

export default function flowDockKit(_options: Record<string, unknown> = {}): Plugin {
  const PLUGIN_NAME = 'vite-plugin-flow-dock-kit'
  const DEFAULT_DIR_NAME = '.flow-dock'
  const pluginState: { server: ViteDevServer | null, config: ResolvedConfig | null } = {
    server: null,
    config: null,
  }

  async function ensureAtRoot(): Promise<void> {
    const root = pluginState.config?.root ?? process.cwd()
    const targetDir = join(root, DEFAULT_DIR_NAME)
    await mkdir(targetDir, { recursive: true })
  }

  return {
    name: PLUGIN_NAME,

    async configResolved(config) {
      pluginState.config = config

      try {
        await ensureAtRoot()
      }
      catch (error) {
        consola.error(`[${PLUGIN_NAME}] Error ensuring flow dock directory:`, error)
      }
    },

    async configureServer(server) {
      pluginState.server = server

      try {
        await ensureAtRoot()
      }
      catch (error) {
        consola.error(`[${PLUGIN_NAME}] Error ensuring flow dock directory:`, error)
      }
    },

    async buildStart() {
      try {
        await ensureAtRoot()
      }
      catch (error) {
        consola.error(`[${PLUGIN_NAME}] Error ensuring flow dock directory:`, error)
      }
    },

  }
}
