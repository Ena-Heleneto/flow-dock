import { defineConfig, presetAttributify, presetIcons, presetUno, presetWebFonts, presetWind4, transformerDirectives, transformerVariantGroup } from 'unocss'
import {
  createLocalFontProcessor,
} from '@unocss/preset-web-fonts/local'

export default defineConfig({
  shortcuts: [
    ['database-btn', 'px-4 py-1 rounded inline-block bg-teal-700 text-white cursor-pointer !outline-none hover:bg-teal-800 disabled:cursor-default disabled:bg-gray-600 disabled:opacity-50'],
  ],
  presets: [
    presetUno(),
    presetAttributify(),
    presetWind4(),
    presetIcons({ scale: 1.2 }),
    presetIcons(),
    presetWebFonts({
      fonts: {
        sans: { name: 'DM Sans', weights: ['400', '700'], italic: false },
        serif: 'DM Serif Display',
        mono: 'DM Mono',
      },
      processors: createLocalFontProcessor({
        fontServeBaseUrl: '/assets/fonts',
      }),
    }),
  ],

  transformers: [
    transformerDirectives(),
    transformerVariantGroup(),
  ],
})
