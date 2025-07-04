<script setup>
import { VAR_HUE } from '@proj-airi/unocss-preset-chromatic'
import { onMounted, ref, watch } from 'vue'

import ColorHueRange from '../components/ColorHueRange.vue'

const DEFAULT_THEME_COLORS_HUE = 220.25
const themeColorsHue = ref(DEFAULT_THEME_COLORS_HUE)

onMounted(() => {
  const hue = document.documentElement.style.getPropertyValue(VAR_HUE)
  const hueF = Number.parseFloat(hue)

  themeColorsHue.value = hueF >= 0 && hueF <= 360 ? hueF : DEFAULT_THEME_COLORS_HUE
  document.documentElement.style.setProperty(VAR_HUE, themeColorsHue.value.toString())
})

watch(themeColorsHue, () => {
  document.documentElement.style.setProperty(VAR_HUE, themeColorsHue.value.toString())
})
</script>

Ergonomic, accessible, and customizable color system.

<div my-4>
  Current Hue: <span inline-flex bg="primary-200 dark:primary" rounded-lg px-2 py-1 font-mono min-w-4lh justify-center>{{ themeColorsHue }}</span> <span text="neutral-500 dark:neutral-400">🫲 Notice how the readability wasn't deduced.</span>
</div>

<div>
  <ColorHueRange
    v-model="themeColorsHue"
    class="w-full"
    :disabled="false"
  />
</div>

## Getting Started

```shell
# from @antfu/ni, can be installed via `npm i -g @antfu/ni`
ni -D @proj-airi/unocss-preset-chromatic
pnpm i -D @proj-airi/unocss-preset-chromatic
yarn i -D @proj-airi/unocss-preset-chromatic
npm i -D @proj-airi/unocss-preset-chromatic
```

Configure your `uno.config.ts` to use the preset:

```ts
import { presetChromatic } from '@proj-airi/unocss-preset-chromatic'
import { defineConfig } from 'unocss'

export default defineConfig({
  presets: [
    presetChromatic({
      baseHue: 220.25, // default hue offset
      colors: {
        primary: 0,
        secondary: 180, // to create a complementary color scheme
      }
    }),
  ],
})
```

## Show

How it will look like for other hue offset?

<div flex items-center gap-2 text="base md:2xl" my-4>
  <div class="flex gap-2 justify-between" w-full px-8>
    <div class="text-zero">
      0
    </div>
    <div class="text-thirty">
      30
    </div>
    <div class="text-sixty">
      60
    </div>
    <div class="text-ninety">
      90
    </div>
    <div class="text-hundred-twenty">
      120
    </div>
    <div class="text-hundred-fifty">
      150
    </div>
    <div class="text-hundred-eighty">
      180
    </div>
    <div class="text-two-ten">
      210
    </div>
    <div class="text-two-forty">
      240
    </div>
    <div class="text-two-seventy">
      270
    </div>
    <div class="text-three-hundred">
      300
    </div>
    <div class="text-three-thirty">
      330
    </div>
  </div>
</div>

In this way, it's quite easy to create a complementary color theme from Chromatic's base hue:

<div my-4>
  <div class="flex gap-2" w-full>
    <div class="text-primary-800 dark:text-primary-100" px-4 py-2 rounded-lg bg="primary-200 dark:primary-800/75">
      Primary
    </div>
    <div class="text-complementary-800 dark:text-complementary-100" px-4 py-2 rounded-lg bg="complementary-200 dark:complementary-800/75">
      Complementary
    </div>
  </div>
</div>
