import type { UserConfig } from 'vite'
import { resolve } from 'node:path'
import process from 'node:process'
// import packageJson from './package.json'
// import { discoverModules } from './scripts/module-registry'

const watchEnabled = process.env.WATCH === 'true'
const browserTarget = process.env.EXTENSION === 'firefox' ? 'firefox' : 'chrome'
const isDev = process.env.NODE_ENV !== 'production'
const outputMode = isDev ? 'dev' : 'build'
// const pageName = process.env.PAGE_NAME
// const buildTarget = process.env.BUILD_TARGET

// type BundleTarget = 'background' | 'content' | 'page' | 'app'
// const r = (...args: string[]) => resolve(__dirname, ...args)
// const discoveredModules = discoverModules({ appsRoot: r('apps') })

function resolveOutDir(...parts: string[]) {
  return resolve(__dirname, 'dist', outputMode, browserTarget, ...parts)
}

// function resolveModuleByKind(kind: 'background' | 'content') {
//   const module = discoveredModules.find(item => item.kind === kind)
//   if (!module)
//     throw new Error(`[vite] missing module config for kind: ${kind}`)

//   return module
// }

// function resolveBackgroundBuildMeta() {
//   const module = resolveModuleByKind('background')

//   return {
//     entryFile: r('apps', module.dirName, module.entry),
//     outDir: module.outDir,
//   }
// }

// function resolveContentBuildMeta() {
//   const module = resolveModuleByKind('content')

//   return {
//     entryFile: r('apps', module.dirName, module.entry),
//     outDir: module.outDir,
//   }
// }

// function resolvePageName() {
//   if (pageName)
//     return pageName

//   if (buildTarget === 'navigation')
//     return 'navigation'

//   const preferredNavigationModule = discoveredModules
//     .find(item => item.kind === 'page' && (item.dirName === 'navigation' || item.id === 'navigation'))

//   if (preferredNavigationModule)
//     return preferredNavigationModule.dirName

//   return discoveredModules.find(item => item.kind === 'page')?.dirName
// }

// function resolvePageModule(name: string | undefined) {
//   const module = name
//     ? discoveredModules.find(item => item.kind === 'page' && (item.dirName === name || item.id === name))
//     : discoveredModules.find(item => item.kind === 'page')

//   if (!module)
//     throw new Error(`[vite] missing page module${name ? `: ${name}` : ''}`)

//   return module
// }

// function resolvePageBuildMeta(name: string | undefined) {
//   const module = resolvePageModule(name)
//   const rootDir = r('apps', module.dirName)

//   return {
//     rootDir,
//     entryFile: r('apps', module.dirName, module.entry),
//     outDir: module.outDir,
//   }
// }

// function resolvePageManualChunk(id: string) {
//   if (!id.includes('/node_modules/'))
//     return undefined

//   if (id.includes('/node_modules/xlsx/'))
//     return 'vendor-xlsx'

//   if (id.includes('/node_modules/webext-bridge/'))
//     return 'vendor-webext-bridge'

//   if (id.includes('/node_modules/webextension-polyfill/'))
//     return 'vendor-webextension-polyfill'

//   if (id.includes('/node_modules/vue/') || id.includes('/node_modules/@vue/'))
//     return 'vendor-vue'

//   if (id.includes('/node_modules/@vueuse/'))
//     return 'vendor-vueuse'

//   return 'vendor-common'
// }

// function resolveBundleTarget(): BundleTarget {
//   if (buildTarget === 'background' || buildTarget === 'server')
//     return 'background'

//   if (buildTarget === 'content')
//     return 'content'

//   if (buildTarget === 'page' || buildTarget === 'navigation')
//     return 'page'

//   return 'app'
// }

export function resolveBuildConfig(): UserConfig['build'] {
  // const target: BundleTarget = resolveBundleTarget()
  // if (target === 'background') {
  //   const { entryFile, outDir } = resolveBackgroundBuildMeta()

  //   return {
  //     watch: watchEnabled ? {} : undefined,
  //     outDir: resolveOutDir(outDir),
  //     cssCodeSplit: false,
  //     emptyOutDir: false,
  //     sourcemap: isDev,
  //     lib: {
  //       entry: entryFile,
  //       name: packageJson.name,
  //       formats: ['iife'],
  //     },
  //     rollupOptions: {
  //       output: { entryFileNames: 'index.mjs', extend: true },
  //     },
  //   }
  // }

  // if (target === 'content') {
  //   const { entryFile, outDir } = resolveContentBuildMeta()

  //   return {
  //     watch: watchEnabled ? {} : undefined,
  //     outDir: resolveOutDir(outDir),
  //     cssCodeSplit: false,
  //     emptyOutDir: false,
  //     sourcemap: isDev,
  //     lib: {
  //       entry: entryFile,
  //       name: packageJson.name,
  //       formats: ['iife'],
  //     },
  //     rollupOptions: {
  //       output: { entryFileNames: 'index.global.js', extend: true },
  //     },
  //   }
  // }

  // if (target === 'page') {
  //   const resolvedPageName = resolvePageName()
  //   const { entryFile, outDir } = resolvePageBuildMeta(resolvedPageName)

  //   return {
  //     watch: watchEnabled ? {} : undefined,
  //     outDir: resolveOutDir(outDir),
  //     emptyOutDir: false,
  //     sourcemap: isDev,
  //     rollupOptions: {
  //       input: {
  //         index: entryFile,
  //       },
  //       output: {
  //         manualChunks(id) {
  //           return resolvePageManualChunk(id)
  //         },
  //       },
  //     },
  //   }
  // }

  return {
    watch: watchEnabled ? {} : undefined,
    outDir: resolveOutDir(),
    emptyOutDir: false,
    sourcemap: isDev,
  }
}
