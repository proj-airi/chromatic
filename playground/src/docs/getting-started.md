<!-- eslint-disable markdown/no-missing-link-fragments -->

<script setup>
import { VAR_HUE } from '@proj-airi/unocss-preset-chromatic'
import { computed, onMounted, reactive, ref, watch } from 'vue'

import { opacityCellClass, shadeSelectorClass, symbolicCellClass } from './class-catalog'
import ColorGroup from '../components/ColorGroup.vue'
import ColorHueRange from '../components/ColorHueRange.vue'
import ColorThreeDVolume from '../components/ColorThreeDVolume.vue'

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
const symbolicLevels = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
const state = reactive({
  selectedShade: 500,
})

const currentHueLabel = computed(() => Number(themeColorsHue.value).toFixed(2))
const effectiveSelectedShade = computed(() => {
  const shade = Number(state.selectedShade)
  return shades.includes(shade) ? shade : 500
})

const opacityLookup = opacityCellClass
const shadeLookup = shadeSelectorClass
const symbolicLookup = symbolicCellClass

function getShadeSelectorClass(shade) {
  return shadeLookup[String(shade)] ?? ''
}

function getOpacityCellClass(shade, opacity) {
  return opacityLookup[String(shade)]?.[String(opacity)] ?? ''
}

function getSymbolicCellClass(shade, brightness, saturation) {
  return symbolicLookup[String(shade)]?.[String(brightness)]?.[String(saturation)] ?? ''
}

function getShadeItemClass(shade, checked) {
  return [
    getShadeSelectorClass(shade),
    checked ? 'ring-2 ring-primary-300 dark:ring-primary-600' : 'ring-1 ring-neutral-300/30 dark:ring-neutral-700/30',
  ]
}
</script>

<ColorThreeDVolume :hue="Number(themeColorsHue)" />

<div my-4>
  Current Hue: <span inline-flex bg="primary-200 dark:primary" rounded-lg px-2 py-1 font-mono min-w-4lh justify-center>{{ themeColorsHue }}</span> <span text="neutral-500 dark:neutral-400">🫲 Notice how the readability wasn't deduced.</span>
</div>

<div>
  <ColorHueRange
    v-model:colorValue="themeColorsHue"
    class="w-full"
    :disabled="false"
  />
</div>

Ergonomic, <span inline-flex bg="primary-200 dark:primary" rounded-lg px-1 py-0.5 font-mono min-w-4lh justify-center>accessible</span>, and customizable <span class="text-primary-500 dark:text-primary-400">color system</span> offering both TypeScript module and [UnoCSS](https://unocss.dev/) presets. All powered by [**OKLCH**](https://oklch.com/) color space and CSS variables.

```shell
# from @antfu/ni, can be installed via `npm i -g @antfu/ni`
ni -D @proj-airi/unocss-preset-chromatic
pnpm i -D @proj-airi/unocss-preset-chromatic
yarn i -D @proj-airi/unocss-preset-chromatic
npm i -D @proj-airi/unocss-preset-chromatic
```

## Why?

Why would you need this?

Have you ever needed to design applications that are capable of having a entire customizable themes, while maintaining good contrast and readability? If you do, <span class="text-primary-500 dark:text-primary-400">Chromatic</span> can be a great help to achieve that with ease.

Assuming you are already using [Tailwind](https://tailwindcss.com/) or [UnoCSS](https://unocss.dev/) in your project, you probably would use colors like this:

<div class="flex gap-4">
  <div class="bg-blue-500 text-blue-100 px-2 py-1 rounded-lg">
    bg-blue-500
  </div>
  <div class="bg-cyan-500 text-cyan-100 px-2 py-1 rounded-lg">
    bg-cyan-500
  </div>
</div>

However, the hue that Tailwind palette uses for <span class="text-red-500 dark:text-red-400">red</span>, <span class="text-rose-500 dark:text-rose-400">rose</span>, and <span class="text-pink-500 dark:text-pink-400">pink</span> isn't continuous, you cannot have the user to
customize their themes easily without breaking the overall harmony. You cannot point anywhere on the hue wheel and say, yeah that's what I need for my theme. You cannot animate it too.

With <span class="text-primary-500 dark:text-primary-400">Chromatic</span>, you can use JavaScript to manipulate your theme colors by tuning the <span class="text-zero">h</span><span class="text-sixty">u</span><span class="text-hundred-twenty">e</span>.

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

Once configured, all you need to do is to use the generated color utilities:

```html
<div class="bg-primary-50 border-2 border-primary-300 text-primary-400 px-2 py-1 rounded-lg w-fit">
  Primary
</div>
```

this will give you:

<div class="bg-primary-50 border-2 border-primary-300 text-primary-400 px-2 py-1 rounded-lg w-fit">
  Primary
</div>

for dark mode friendly, you still need to specify the color for dark mode:

```html
<div class="bg-primary-50 dark:bg-primary-900 border-2 border-primary-300 dark:border-primary-700 text-primary-400 dark:text-primary-300 px-2 py-1 rounded-lg w-fit">
  Primary
</div>
```

this will give you:

<div class="bg-primary-50 dark:bg-primary-900 border-2 border-primary-300 dark:border-primary-700 text-primary-400 dark:text-primary-300 px-2 py-1 rounded-lg w-fit">
  Primary
</div>

## Features

Ok now what other features do we have?

- [Opacity friendly](#opacity-/-95-friendly)
- [Hue offset](#hue-offset)
- [Brightness and saturation modifiers](#brightness-and-saturation-modifiers)

### Opacity (`/95` friendly)

<div my-4>
  Current Hue: <span inline-flex bg="primary-200 dark:primary" rounded-lg px-2 py-1 font-mono min-w-4lh justify-center>{{ themeColorsHue }}</span> <span text="neutral-500 dark:neutral-400">🫲 Use this hue slider to preview all possible opacity values.</span>
</div>

<div>
  <ColorHueRange
    v-model:colorValue="themeColorsHue"
    class="w-full"
    :disabled="false"
  />
</div>

<div grid="~ cols-12 rows-12" class="transparency-grid" items-center justify-center my-4>
  <template
    v-for="(shade, c) in shades"
    :key="`primary-${shade}`"
  >
    <div class="self-end px-2 sm:px-4 py-1 text-center font-mono text-xs sm:text-base" :style="{ gridArea: `1 / ${c + 2} / span 1 / span 1` }">
      {{ shade }}
    </div>
  </template>

  <template
    v-for="(opacity, r) in opacities"
    :key="`primary-${opacity}`"
  >
    <div class="px-2 sm:px-4 py-1 text-right font-mono text-xs sm:text-base" :style="{ gridArea: `${r + 2} / 1 / span 1 / span 1` }">
      /{{ opacity }}
    </div>
    <div
      v-for="(shade, c) in shades"
      :key="`primary-${shade}/${opacity}`"
      class="cursor-crosshair [&_.color-label]:hover:op-100 h-42px flex items-center justify-center px-2 sm:px-4 py-1" :class="[getOpacityCellClass(shade, opacity)]"
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

### Hue offset

How it will look like for other hue offset?

#### Text

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

#### Background

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

### Brightness and Saturation Modifiers

<div my-4 grid="~ cols-1 sm:cols-2" gap-3>
  <div rounded-lg p-3 bg="primary-500/60" text="primary-900 dark:primary-100">
    <div font-mono text-sm>
      bg-primary-500/60
    </div>
    <div mt-1 text-sm>
      Baseline
    </div>
  </div>
  <div rounded-lg p-3 bg="primary-500/60~80*120" text="primary-900 dark:primary-100">
    <div font-mono text-sm>
      bg-primary-500/60~80*120
    </div>
    <div mt-1 text-sm>
      Brighter + lower saturation
    </div>
  </div>
</div>

By default, [UnoCSS](https://unocss.dev/) only covers modifier changing the opacity of the color, but with Chromatic, you can tune chromatic colors inline with brightness and saturation modifiers:

```txt
<utility>-<color>-<shade>/<opacity>~<saturation>*<brightness>
```

- `/` controls opacity (UnoCSS standard behavior)
- `~` controls saturation/chroma (`100` = unchanged)
- `*` controls brightness (`100` = unchanged)

```html
<div class="bg-primary-500/50~10*115" />
<div class="hover:bg-primary-500/60~80*120" />
<div class="text-primary-600~120" />
<div class="border-primary-400*70" />
```

For cheat sheet, consider:

<div class="text-primary-700 dark:text-primary-200">

- `*` (brightness) as <div i-solar:sun-bold-duotone inline-block text-yellow-500 translate-y-1 /> (Sun)
- `~` (saturation) as <div i-solar:soundwave-broken inline-block text-green-500 translate-y-1 /> (Wave, visible light spectrum)

</div>

Oh and, the order is strict:

<div>
  <div class="i-solar:check-circle-line-duotone inline-block text-green-600 dark:text-green-400 size-7 translate-y-2.5" /> <code>bg-primary-500~&lt;saturation&gt;*&lt;brightness&gt;</code>
</div>

<div>
  <div class="i-solar:check-circle-line-duotone inline-block text-green-600 dark:text-green-400 size-7 translate-y-2.5" /> <code>bg-primary-500/&lt;opacity&gt;~&lt;saturation&gt;*&lt;brightness&gt;</code>
</div>

<div>
  <div class="i-solar:check-circle-line-duotone inline-block text-green-600 dark:text-green-400 size-7 translate-y-2.5" /> <code>bg-primary-500/&lt;opacity&gt;*&lt;brightness&gt;</code>
</div>

<div>
  <div class="i-solar:close-circle-line-duotone inline-block text-red-600 dark:text-red-400 size-7 translate-y-2.5" /> <code>bg-primary-500*&lt;brightness&gt;/&lt;opacity&gt;~&lt;saturation&gt;</code>
</div>

<div>
  <div class="i-solar:close-circle-line-duotone inline-block text-red-600 dark:text-red-400 size-7 translate-y-2.5" /> <code>bg-primary-500*&lt;brightness&gt;~&lt;saturation&gt;</code>
</div>

<br />

#### All the possible colors?

You might wonder how the whole color space looks like with different brightness and saturation levels.

Let's explore it with the help of a 3D volume!

<div my-4>
  Current Hue: <span inline-flex bg="primary-200 dark:primary" rounded-lg px-2 py-1 font-mono min-w-4lh justify-center>{{ themeColorsHue }}</span> <span text="neutral-500 dark:neutral-400">🫲 Notice how the following 3D volume changes.</span>
</div>

<div>
  <ColorHueRange
    v-model:colorValue="themeColorsHue"
    class="w-full"
    :disabled="false"
  />
</div>

<div my-4>
  <div class="mb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
    <div text-sm font-mono>
      3D Volume (drag to orbit)
    </div>
    <div text="xs neutral-500 dark:neutral-400">
      x = shade, y = brightness, z = saturation
    </div>
  </div>
  <ColorThreeDVolume :hue="Number(themeColorsHue)" />
</div>

<div my-4>
  Current Hue: <span inline-flex bg="primary-200 dark:primary" rounded-lg px-2 py-1 font-mono min-w-4lh justify-center>{{ themeColorsHue }}</span> <span text="neutral-500 dark:neutral-400">🫲 Notice how the following grid reflects the color shades.</span>
</div>

<div>
  <ColorHueRange
    v-model:colorValue="themeColorsHue"
    class="w-full"
    :disabled="false"
  />
</div>

<div my-4>
  <div class="mb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
    <div font-mono text-sm>
      Select Shade (opacity fixed at /100)
    </div>
    <div text="xs neutral-500 dark:neutral-400">
      Selected: {{ effectiveSelectedShade }}
    </div>
  </div>

  <ColorGroup
    v-model="state.selectedShade"
    :options="shades"
    aria-label="Select shade"
    :item-class="getShadeItemClass"
    :wrap="true"
  />
</div>

<div my-4>
  <div class="mb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
    <div font-mono text-sm>
      bg-primary-{{ effectiveSelectedShade }}/100~{brightness}*{saturation}
    </div>
    <div text="xs neutral-500 dark:neutral-400">
      rows = brightness, cols = saturation
    </div>
  </div>

  <div grid="~ cols-12 rows-12" class="transparency-grid" items-center justify-center>
    <template
      v-for="(saturation, c) in symbolicLevels"
      :key="`symbolic-sat-${saturation}`"
    >
      <div class="self-end px-2 sm:px-4 py-1 text-center font-mono text-xs sm:text-base" :style="{ gridArea: `1 / ${c + 2} / span 1 / span 1` }">
        *{{ saturation }}
      </div>
    </template>
    <template
      v-for="(brightness, r) in symbolicLevels"
      :key="`symbolic-bri-${brightness}`"
    >
      <div class="px-2 sm:px-4 py-1 text-right font-mono text-xs sm:text-base" :style="{ gridArea: `${r + 2} / 1 / span 1 / span 1` }">
        ~{{ brightness }}
      </div>
      <div
        v-for="(saturation, c) in symbolicLevels"
        :key="`symbolic-${effectiveSelectedShade}-b${brightness}-s${saturation}`"
        class="cursor-crosshair [&_.color-label]:hover:op-100 h-42px flex items-center justify-center px-2 sm:px-4 py-1" :class="[getSymbolicCellClass(effectiveSelectedShade, brightness, saturation)]"
        :style="{ gridArea: `${r + 2} / ${c + 2} / span 1 / span 1` }"
      >
        <div
          bg="light op-80"
          rounded-md px-1 py-0.5 text-xs text-primary-700 font-mono op-0 dark:bg-dark dark:text-primary-300
          transition="opacity duration-100"
          class="color-label"
        >
          ~{{ brightness }} *{{ saturation }}
        </div>
      </div>
    </template>
  </div>
</div>

Do check out [Project AIRI](https://airi.moeru.ai/docs/en/). You can get to play the theme colors with the hue slider and see how the colors change in real time!

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
