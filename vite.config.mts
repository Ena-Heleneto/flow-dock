/// <reference types="vitest" />

import type { UserConfig } from 'vite'
import { dirname, relative, resolve } from 'node:path'
import process from 'node:process'
import Vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import IconsResolver from 'unplugin-icons/resolver'
import Icons from 'unplugin-icons/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import packageJson from './package.json'
import { discoverModules } from './scripts/module-registry'

const port = Number(process.env.PORT || '') || 3303
const isDev = process.env.NODE_ENV !== 'production'
const buildTarget = process.env.BUILD_TARGET
const pageName = process.env.PAGE_NAME
const browserTarget = process.env.EXTENSION === 'firefox' ? 'firefox' : 'chrome'
const outputMode = isDev ? 'dev' : 'build'
const watchEnabled = process.env.WATCH === 'true'
const r = (...args: string[]) => resolve(__dirname, ...args)

type BundleTarget = 'background' | 'content' | 'page' | 'app'
const discoveredModules = discoverModules({ appsRoot: r('apps') })

function resolveBundleTarget(): BundleTarget {
  if (buildTarget === 'background' || buildTarget === 'server')
    return 'background'

  if (buildTarget === 'content')
    return 'content'

  if (buildTarget === 'page' || buildTarget === 'navigation')
    return 'page'

  return 'app'
}

function resolvePageName() {
  if (pageName)
    return pageName

  if (buildTarget === 'navigation')
    return 'navigation'

  return 'navigation'
}

function resolveModuleByKind(kind: 'background' | 'content') {
  const module = discoveredModules.find(item => item.kind === kind)
  if (!module)
    throw new Error(`[vite] missing module config for kind: ${kind}`)

  return module
}

function resolvePageModule(name: string) {
  const module = discoveredModules.find(item => item.kind === 'page' && (item.dirName === name || item.id === name))
  if (!module)
    throw new Error(`[vite] missing page module: ${name}`)

  return module
}

function resolveBackgroundBuildMeta() {
  const module = resolveModuleByKind('background')

  return {
    entryFile: r('apps', module.dirName, module.entry),
    outDir: module.outDir,
  }
}

function resolveContentBuildMeta() {
  const module = resolveModuleByKind('content')

  return {
    entryFile: r('apps', module.dirName, module.entry),
    outDir: module.outDir,
  }
}

function resolvePageBuildMeta(name: string) {
  const module = resolvePageModule(name)
  const rootDir = r('apps', module.dirName)

  return {
    rootDir,
    entryFile: r('apps', module.dirName, module.entry),
    outDir: module.outDir,
  }
}

function resolveOutDir(...parts: string[]) {
  return resolve(__dirname, 'dist', outputMode, browserTarget, ...parts)
}

function resolvePageManualChunk(id: string) {
  if (!id.includes('/node_modules/'))
    return undefined

  if (id.includes('/node_modules/xlsx/'))
    return 'vendor-xlsx'

  if (id.includes('/node_modules/webext-bridge/'))
    return 'vendor-webext-bridge'

  if (id.includes('/node_modules/webextension-polyfill/'))
    return 'vendor-webextension-polyfill'

  if (id.includes('/node_modules/vue/') || id.includes('/node_modules/@vue/'))
    return 'vendor-vue'

  if (id.includes('/node_modules/@vueuse/'))
    return 'vendor-vueuse'

  return 'vendor-common'
}

function resolveBuildConfig(target: BundleTarget): UserConfig['build'] {
  if (target === 'background') {
    const { entryFile, outDir } = resolveBackgroundBuildMeta()

    return {
      watch: watchEnabled ? {} : undefined,
      outDir: resolveOutDir(outDir),
      cssCodeSplit: false,
      emptyOutDir: false,
      sourcemap: isDev,
      lib: {
        entry: entryFile,
        name: packageJson.name,
        formats: ['iife'],
      },
      rollupOptions: {
        output: { entryFileNames: 'index.mjs', extend: true },
      },
    }
  }

  if (target === 'content') {
    const { entryFile, outDir } = resolveContentBuildMeta()

    return {
      watch: watchEnabled ? {} : undefined,
      outDir: resolveOutDir(outDir),
      cssCodeSplit: false,
      emptyOutDir: false,
      sourcemap: isDev,
      lib: {
        entry: entryFile,
        name: packageJson.name,
        formats: ['iife'],
      },
      rollupOptions: {
        output: { entryFileNames: 'index.global.js', extend: true },
      },
    }
  }

  if (target === 'page') {
    const resolvedPageName = resolvePageName()
    const { entryFile, outDir } = resolvePageBuildMeta(resolvedPageName)

    return {
      watch: watchEnabled ? {} : undefined,
      outDir: resolveOutDir(outDir),
      emptyOutDir: false,
      sourcemap: isDev,
      rollupOptions: {
        input: {
          index: entryFile,
        },
        output: {
          manualChunks(id) {
            return resolvePageManualChunk(id)
          },
        },
      },
    }
  }

  return {
    watch: watchEnabled ? {} : undefined,
    outDir: resolveOutDir(),
    emptyOutDir: false,
    sourcemap: isDev,
  }
}

export const sharedConfig: UserConfig = {
  resolve: {
    alias: {
      '~/': `${resolve(__dirname, 'apps')}/`,
      '@/': `${resolve(__dirname, 'server')}/`,
    },
  },
  define: {
    '__DEV__': isDev,
    '__NAME__': JSON.stringify(packageJson.name),
    'process.env.NODE_ENV': JSON.stringify(isDev ? 'development' : 'production'),
  },
  plugins: [
    Vue(),

    AutoImport({
      imports: [
        'vue',
        { 'webextension-polyfill': [['=', 'browser']] },
      ],
      dts: resolve(__dirname, 'apps/auto-imports.d.ts'),
    }),

    // https://github.com/antfu/unplugin-vue-components
    Components({
      dirs: [resolve(__dirname, 'apps/shared/components')],
      // generate `components.d.ts` for ts support with Volar
      dts: resolve(__dirname, 'apps/components.d.ts'),
      resolvers: [
        // auto import icons
        IconsResolver({ prefix: '' }),
      ],
    }),

    // https://github.com/antfu/unplugin-icons
    Icons(),

    // https://github.com/unocss/unocss
    UnoCSS(),

    // rewrite assets to use relative path
    {
      name: 'assets-rewrite',
      enforce: 'post',
      apply: 'build',
      transformIndexHtml(html, { path }) {
        return html.replace(/"\/assets\//g, `"${relative(dirname(path), '/assets')}/`)
      },
    },
  ],
  optimizeDeps: {
    include: ['vue', '@vueuse/core', 'webextension-polyfill'],
    exclude: ['vue-demi'],
  },
}

export default defineConfig(({ command }) => {
  const target = resolveBundleTarget()
  const resolvedPageName = resolvePageName()
  const pageMeta = target === 'page' ? resolvePageBuildMeta(resolvedPageName) : undefined

  return {
    ...sharedConfig,
    root: target === 'page' ? pageMeta?.rootDir : __dirname,
    base: command === 'serve' ? `http://localhost:${port}/` : './',
    server: {
      port,
      hmr: { host: 'localhost' },
      origin: `http://localhost:${port}`,
    },
    build: resolveBuildConfig(target),
    test: { globals: true, environment: 'jsdom' },
  }
})
