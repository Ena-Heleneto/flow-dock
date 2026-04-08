/// <reference types="vitest" />

import type { UserConfig } from 'vite'
import { dirname, relative } from 'node:path'
import Vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import IconsResolver from 'unplugin-icons/resolver'
import Icons from 'unplugin-icons/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import packageJson from './package.json'
import { buildTarget, isDev, port, r } from './scripts/context'

type BundleTarget = 'server' | 'content' | 'app'

function resolveBundleTarget(): BundleTarget {
  if (buildTarget === 'server' || buildTarget === 'content')
    return buildTarget

  return 'app'
}

function resolveBuildConfig(target: BundleTarget): UserConfig['build'] {
  if (target === 'server') {
    return {
      watch: isDev ? {} : undefined,
      outDir: r('extension/dist/server'),
      cssCodeSplit: false,
      emptyOutDir: false,
      sourcemap: isDev ? 'inline' : false,
      lib: {
        entry: r('server/main.ts'),
        name: packageJson.name,
        formats: ['iife'],
      },
      rollupOptions: {
        output: {
          entryFileNames: 'index.mjs',
          extend: true,
        },
      },
    }
  }

  if (target === 'content') {
    return {
      watch: isDev ? {} : undefined,
      outDir: r('extension/dist/contentScripts'),
      cssCodeSplit: false,
      emptyOutDir: false,
      sourcemap: isDev ? 'inline' : false,
      lib: {
        entry: r('apps/contentScripts/index.ts'),
        name: packageJson.name,
        formats: ['iife'],
      },
      rollupOptions: {
        output: {
          entryFileNames: 'index.global.js',
          extend: true,
        },
      },
    }
  }

  return {
    watch: isDev ? {} : undefined,
    outDir: r('extension/dist'),
    emptyOutDir: false,
    sourcemap: isDev ? 'inline' : false,
  }
}

export const sharedConfig: UserConfig = {
  root: r('.'),
  resolve: {
    alias: {
      '~/': `${r('apps')}/`,
      '@server/': `${r('server')}/`,
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
      dts: r('apps/auto-imports.d.ts'),
    }),

    // https://github.com/antfu/unplugin-vue-components
    Components({
      dirs: [r('apps/shared/components')],
      // generate `components.d.ts` for ts support with Volar
      dts: r('apps/components.d.ts'),
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

  return {
    ...sharedConfig,
    base: command === 'serve' ? `http://localhost:${port}/` : '/dist/',
    server: {
      port,
      hmr: { host: 'localhost' },
      origin: `http://localhost:${port}`,
    },
    build: resolveBuildConfig(target),
    test: { globals: true, environment: 'jsdom' },
  }
})
