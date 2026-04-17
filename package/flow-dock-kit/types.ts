import type { ResolvedConfig } from 'vite'

export interface FlowDockKitOptions {
  root?: string
  dirName?: string
}

export interface FlowDockLogger {
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

export interface FlowDockGeneratorContext {
  pluginName: string
  root: string
  flowDockDirName: string
  flowDockDir: string
  config: ResolvedConfig | null
  command: 'serve' | 'build'
  options: FlowDockKitOptions
  // logger: FlowDockLogger
}
