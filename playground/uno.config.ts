import { presetChromatic } from '@proj-airi/unocss-preset-chromatic'
import { defineConfig, presetAttributify, presetIcons, presetTypography, presetWebFonts, presetWind3, transformerDirectives, transformerVariantGroup } from 'unocss'

export function safelistAllPrimaryBackgrounds(): string[] {
  return [
    ...[undefined, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((shade) => {
      const prefix = shade ? `bg-primary-${shade}` : `bg-primary`
      return [
        prefix,
        ...[5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(opacity => `${prefix}/${opacity}`),
      ]
    }).flat(),
  ]
}

export default defineConfig({
  presets: [
    presetWind3(),
    presetAttributify(),
    presetTypography(),
    presetWebFonts({
      fonts: {
        sans: 'DM Sans',
        mono: 'DM Mono',
      },
      timeouts: {
        warning: 5000,
        failure: 10000,
      },
    }),
    presetIcons(),
    presetChromatic({
      baseHue: 350,
      colors: {
        primary: 0,
        complementary: 180, // to create a complementary color scheme
        zero: 0,
        thirty: 30,
        sixty: 60,
        ninety: 90,
        hundredTwenty: 120,
        hundredFifty: 150,
        hundredEighty: 180,
        twoTen: 210,
        twoForty: 240,
        twoSeventy: 270,
        threeHundred: 300,
        threeThirty: 330,
      },
    }),
  ],
  safelist: [
    ...safelistAllPrimaryBackgrounds(),
  ],
  transformers: [
    transformerDirectives({
      applyVariable: ['--at-apply'],
    }),
    transformerVariantGroup(),
  ],
})
