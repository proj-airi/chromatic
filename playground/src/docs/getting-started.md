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

const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
const opacities = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
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

<br />

```shell
# from @antfu/ni, can be installed via `npm i -g @antfu/ni`
ni -D @proj-airi/unocss-preset-chromatic
pnpm i -D @proj-airi/unocss-preset-chromatic
yarn i -D @proj-airi/unocss-preset-chromatic
npm i -D @proj-airi/unocss-preset-chromatic
```

<div grid="~ cols-12 rows-12" class="transparency-grid" items-center justify-center>
  <template
    v-for="(shade, c) in shades"
    :key="`primary-${shade}`"
  >
    <div self-end p-4 text-center font-mono :style="{ gridArea: `1 / ${c + 2} / span 1 / span 1` }">
      {{ shade }}
    </div>
  </template>

  <template
    v-for="(opacity, r) in opacities"
    :key="`primary-${opacity}`"
  >
    <div p-4 text-right font-mono :style="{ gridArea: `${r + 2} / 1 / span 1 / span 1` }">
      /{{ opacity }}
    </div>
    <div
      v-for="(shade, c) in shades"
      :key="`primary-${shade}/${opacity}`"
      class="cursor-crosshair [&_.color-label]:hover:op-100" :class="[`bg-primary-${shade}/${opacity}`]"
      h-82px flex items-center justify-center p-4
      :style="{ gridArea: `${r + 2} / ${c + 2} / span 1 / span 1` }"
    >
      <div
        bg="light op-80"
        rounded-md px-1 py-0.5 text-xs text-primary-700 font-mono op-0 dark:bg-dark dark:text-primary-300
        transition="opacity duration-100"
        class="color-label"
      >
        {{ shade }}/{{ opacity }}
      </div>
    </div>
  </template>
</div>

## Getting Started

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

### Text

<div flex items-center gap-2 text="base md:2xl" my-4>
  <div class="flex gap-2 justify-between" w-full px="0 sm:8" overflow-x-scroll>
    <div class="text-zero font-mono">
      0
    </div>
    <div class="text-thirty font-mono">
      30
    </div>
    <div class="text-sixty font-mono">
      60
    </div>
    <div class="text-ninety font-mono">
      90
    </div>
    <div class="text-hundred-twenty font-mono">
      120
    </div>
    <div class="text-hundred-fifty font-mono">
      150
    </div>
    <div class="text-hundred-eighty font-mono">
      180
    </div>
    <div class="text-two-ten font-mono">
      210
    </div>
    <div class="text-two-forty font-mono">
      240
    </div>
    <div class="text-two-seventy font-mono">
      270
    </div>
    <div class="text-three-hundred font-mono">
      300
    </div>
    <div class="text-three-thirty font-mono">
      330
    </div>
  </div>
</div>

### Background

<div flex items-center gap-2 text="base md:2xl" my-4>
  <div class="flex gap-2 justify-between" w-full px="0 sm:8" overflow-x-scroll>
    <div class="bg-zero" px-4 py-4 rounded-xl text-transparent font-mono>
      0
    </div>
    <div class="bg-thirty" px-4 py-4 rounded-xl text-transparent font-mono>
      30
    </div>
    <div class="bg-sixty" px-4 py-4 rounded-xl text-transparent font-mono>
      60
    </div>
    <div class="bg-ninety" px-4 py-4 rounded-xl text-transparent font-mono>
      90
    </div>
    <div class="bg-hundred-twenty" px-4 py-4 rounded-xl text-transparent font-mono>
      120
    </div>
    <div class="bg-hundred-fifty" px-4 py-4 rounded-xl text-transparent font-mono>
      150
    </div>
    <div class="bg-hundred-eighty" px-4 py-4 rounded-xl text-transparent font-mono>
      180
    </div>
    <div class="bg-two-ten" px-4 py-4 rounded-xl text-transparent font-mono>
      210
    </div>
    <div class="bg-two-forty" px-4 py-4 rounded-xl text-transparent font-mono>
      240
    </div>
    <div class="bg-two-seventy" px-4 py-4 rounded-xl text-transparent font-mono>
      270
    </div>
    <div class="bg-three-hundred" px-4 py-4 rounded-xl text-transparent font-mono>
      300
    </div>
    <div class="bg-three-thirty" px-4 py-4 rounded-xl text-transparent font-mono>
      330
    </div>
  </div>
</div>

In this way, it's quite easy to create a complementary color theme from Chromatic's base hue:

<div my-4>
  <div class="flex gap-2" w-full>
    <div class="text-primary-800 dark:text-primary-100" px-4 py-2 rounded-lg bg="primary-500/20 dark:primary-800/30">
      Primary
    </div>
    <div class="text-complementary-800 dark:text-complementary-100" px-4 py-2 rounded-lg bg="complementary-500/20 dark:complementary-800/30">
      Complementary
    </div>
  </div>
</div>

<style>
.transparency-grid::before {
  content: '';
  grid-area: 2 / 2 / span 11 / span 11;
  width: 100%;
  height: 100%;
  background-image: linear-gradient(45deg, oklch(90% 0 0) 25%, transparent 25%),
    linear-gradient(-45deg, oklch(90% 0 0) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, oklch(90% 0 0) 75%),
    linear-gradient(-45deg, transparent 75%, oklch(90% 0 0) 75%);
  background-size: 20px 20px;
  background-position:
    0 0,
    0 10px,
    10px -10px,
    -10px 0px;
  background-color: oklch(100% 0 0);
}

.dark .transparency-grid::before {
  background-image: linear-gradient(45deg, oklch(40% 0 0) 25%, transparent 25%),
    linear-gradient(-45deg, oklch(40% 0 0) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, oklch(40% 0 0) 75%),
    linear-gradient(-45deg, transparent 75%, oklch(40% 0 0) 75%);
  background-color: oklch(25% 0 0);
}
</style>
