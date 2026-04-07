import { defineConfig, presetAttributify, presetIcons, presetUno, presetWebFonts, presetWind4, transformerDirectives, transformerVariantGroup } from 'unocss'
import {
  createLocalFontProcessor,
} from '@unocss/preset-web-fonts/local'
import { presetScrollbar } from 'unocss-preset-scrollbar'

export default defineConfig({
  shortcuts: [
    ['database-btn', 'px-4 py-1 rounded-lg inline-block bg-teal-700 text-white cursor-pointer !outline-none hover:bg-teal-800 disabled:cursor-default disabled:bg-gray-600 disabled:opacity-50'],
    ['database-btn-secondary', 'px-4 py-1 rounded-lg inline-block bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-100 cursor-pointer !outline-none hover:bg-gray-200 dark:hover:bg-gray-600 disabled:cursor-default disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:opacity-50'],
    ['database-btn-danger', 'px-4 py-1 rounded-lg inline-block bg-red-600 text-white cursor-pointer !outline-none hover:bg-red-700 disabled:cursor-default disabled:bg-gray-600 disabled:opacity-50'],
  ],
  presets: [
    presetUno(),
    presetAttributify(),
    presetWind4(),
    presetIcons({ scale: 1.2 }),
    presetWebFonts({
      fonts: {
        sans: { name: 'DM Sans', weights: ['400', '700'], italic: false },
        serif: 'DM Serif Display',
        mono: 'DM Mono',
      },
      processors: createLocalFontProcessor({ fontServeBaseUrl: '/assets/fonts' }),
    }),
    presetScrollbar(),
  ],

  transformers: [
    transformerDirectives(),
    transformerVariantGroup(),
  ],
})
