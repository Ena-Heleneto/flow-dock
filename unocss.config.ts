import { presetAttributify, presetIcons, presetUno, transformerDirectives } from 'unocss'
import { presetScrollbar } from 'unocss-preset-scrollbar'
import { defineConfig } from 'unocss/vite'

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons(),
    presetScrollbar(),
  ],
  transformers: [
    transformerDirectives(),
  ],
})
