import type { Preset } from 'unocss'

import { presetChromatic } from '@proj-airi/unocss-preset-chromatic'
import { defineConfig, presetAttributify, presetIcons, presetTypography, presetWebFonts, presetWind3, transformerDirectives, transformerVariantGroup } from 'unocss'

export default defineConfig({
  content: {
    pipeline: {
      // Needed so literal class catalogs imported from script blocks are scanned.
      include: [
        /\.(vue|md)($|\?)/,
        /\.(ts|js|mts|cts)($|\?)/,
      ],
    },
  },
  presets: [
    presetWind3(),
    presetAttributify(),
    presetTypography(),
    presetWebFonts({
      fonts: {
        mono: 'DM Mono',
        sans: 'DM Sans',
      },
      timeouts: {
        failure: 10000,
        warning: 5000,
      },
    }),
    presetIcons(),
    presetChromatic({
      baseHue: 350,
      colors: {
        complementary: 180, // to create a complementary color scheme
        hundredEighty: 180,
        hundredFifty: 150,
        hundredTwenty: 120,
        ninety: 90,
        primary: 0,
        sixty: 60,
        thirty: 30,
        threeHundred: 300,
        threeThirty: 330,
        twoForty: 240,
        twoSeventy: 270,
        twoTen: 210,
        zero: 0,
      },
    }) as Preset,
  ],
  transformers: [
    transformerDirectives({
      applyVariable: ['--at-apply'],
    }),
    transformerVariantGroup(),
  ],
})
