import { presetChromatic } from '@proj-airi/preset-chromatic'
import { defineConfig, presetMini } from 'unocss'

export default defineConfig({
  presets: [
    presetMini(),
    presetChromatic({
      baseHue: 350,
      colors: {
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
})
