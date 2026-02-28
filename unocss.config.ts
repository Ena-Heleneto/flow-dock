import { defineConfig, presetAttributify, presetIcons, presetUno, presetWebFonts, presetWind4, transformerDirectives, transformerVariantGroup } from 'unocss'
import {
  createLocalFontProcessor,
} from '@unocss/preset-web-fonts/local'

export default defineConfig({
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
