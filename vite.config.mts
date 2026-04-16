import { dirname, relative, resolve } from 'node:path'
import Vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import Inspect from 'vite-plugin-inspect'
import FlowDockKit from './package/flow-dock-kit/main'
import { resolveBuildConfig } from './temp_config_functions'
import { useDefine } from './useDefine'

export default defineConfig({
  resolve: {
    alias: {
      '~/': `${resolve(__dirname, 'apps')}/`,
      '#/': `${resolve(__dirname, 'server')}/`,
      '$/': `${resolve(__dirname, 'packages')}/`,
      '/': `${resolve(__dirname)}/`,
    },
  },
  define: useDefine,

  devtools: true,

  plugins: [
    Vue(),

    AutoImport({
      imports: [
        'vue',
        { 'webextension-polyfill': [['=', 'browser']] },
      ],
      dts: resolve(__dirname, 'apps/auto-imports.d.ts'),
    }),

    Components({
      dirs: [resolve(__dirname, 'apps/shared/components')],
      dts: resolve(__dirname, 'apps/components.d.ts'),

    }),

    UnoCSS(),

    FlowDockKit(),

    {
      name: 'assets-rewrite',
      enforce: 'post',
      apply: 'build',
      transformIndexHtml(html, { path }) {
        return html.replace(/"\/assets\//g, `"${relative(dirname(path), '/assets')}/`)
      },
    },

    Inspect({ build: true }),
  ],

  optimizeDeps: {
    include: ['vue', '@vueuse/core', 'webextension-polyfill'],
    exclude: ['vue-demi'],
  },

  server: {
    port: useDefine.__PORT__,
    hmr: { host: 'localhost' },
    origin: `http://localhost:${useDefine.__PORT__}`,
  },

  build: resolveBuildConfig(),

})
