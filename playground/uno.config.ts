import { presetChromatic } from '@proj-airi/unocss-preset-chromatic'
import { defineConfig, presetAttributify, presetIcons, presetTypography, presetWebFonts, presetWind3, transformerDirectives, transformerVariantGroup } from 'unocss'

export default defineConfig({
  presets: [
    presetWind3(),
    presetAttributify(),
    presetTypography(),
    presetWebFonts({
      fonts: {
        sans: 'DM Sans',
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
  transformers: [
    transformerDirectives({
      applyVariable: ['--at-apply'],
    }),
    transformerVariantGroup(),
  ],
})
