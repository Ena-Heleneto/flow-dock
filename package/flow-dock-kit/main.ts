// export { default } from './src'
// export { ensureFlowDockDir } from './src'
// export type { EnsureFlowDockDirOptions, FlowDockKitOptions } from './src'

// export interface EnsureFlowDockDirOptions {
//   dirName?: string
//   writePlaceholder?: boolean
//   placeholderName?: string
//   placeholderContent?: string
// }

// export interface FlowDockKitOptions extends EnsureFlowDockDirOptions {
//   root?: string
//   writeToRootOnBuild?: boolean
//   fallbackWriteToOutDir?: boolean
// }

export default function flowDockKit(_options = {}) {
  const pluginName = 'vite-plugin-flow-dock-kit'
  return {
    name: pluginName,
    description: '',
    filename: '',
    async configResolved() {},
    async configureServer() {},
    async buildStart() {},
    generateBundle() {},
    writeBundle() {},
  }
  // const normalizedOptions = toEnsureOptions(options)
  // const writeToRootOnBuild = options.writeToRootOnBuild ?? true
  // const fallbackWriteToOutDir = options.fallbackWriteToOutDir ?? true
  // const emittedAssetPath = `${normalizedOptions.dirName}/${normalizedOptions.placeholderName}`
  // let resolvedConfig: ResolvedConfig | undefined

  // function warn(message: string, error?: unknown): void {
  //   const detail = error instanceof Error ? `: ${error.message}` : ''
  //   const text = `[${pluginName}] ${message}${detail}`
  //   if (resolvedConfig?.logger)
  //     resolvedConfig.logger.warn(text)
  //   else
  //     console.warn(text)
  // }

  // async function ensureAtRoot(): Promise<void> {
  //   const root = resolveRoot(resolvedConfig?.root, options.root)
  //   await ensureDir(root, normalizedOptions)
  // }

  // async function ensureAtOutDir(outDir: string): Promise<void> {
  //   await ensureDir(outDir, normalizedOptions)
  // }

  // return {
  //   name: pluginName,

  //   async configResolved(config) {
  //     resolvedConfig = config
  //     const shouldEnsureRoot = config.command === 'serve' || writeToRootOnBuild
  //     if (!shouldEnsureRoot)
  //       return

  //     try {
  //       await ensureAtRoot()
  //     }
  //     catch (error) {
  //       warn('failed to ensure root .flow-dock directory', error)
  //     }
  //   },

  //   async configureServer() {
  //     try {
  //       await ensureAtRoot()
  //     }
  //     catch (error) {
  //       warn('failed to ensure .flow-dock directory in dev server', error)
  //     }
  //   },

  //   async buildStart() {
  //     if (!writeToRootOnBuild)
  //       return

  //     try {
  //       await ensureAtRoot()
  //     }
  //     catch (error) {
  //       warn('failed to ensure .flow-dock directory in buildStart', error)
  //     }
  //   },

  //   generateBundle() {
  //     if (!normalizedOptions.writePlaceholder)
  //       return

  //     this.emitFile({
  //       type: 'asset',
  //       fileName: emittedAssetPath,
  //       source: normalizedOptions.placeholderContent,
  //     })
  //   },

  //   async writeBundle(outputOptions) {
  //     if (!fallbackWriteToOutDir)
  //       return

  //     const outDir = resolveWriteOutDir(resolvedConfig, outputOptions)
  //     if (!outDir)
  //       return

  //     try {
  //       await ensureAtOutDir(outDir)
  //     }
  //     catch (error) {
  //       warn('failed to ensure .flow-dock directory in outDir', error)
  //     }
  //   },
  // }
}
