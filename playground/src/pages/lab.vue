<script setup lang="ts">
import ColorChromaCurve from '../components/ColorChromaCurve.vue'

import { useThemeHue } from '../composables/theme-hue'

const themeHue = useThemeHue()
</script>

<template>
  <div mx-auto max-w-screen-lg flex flex-col gap-4 px-4 pb-8 pt-2>
    <div text-sm text="neutral-600 dark:neutral-300">
      Compare how the <code>v1</code> and <code>v2</code> models distribute lightness and chroma over hue and
      shade, against the sRGB / P3 gamut and the Tailwind CSS v4 palette, and tune the fit the shipped
      <code>v2</code> coefficients are generated from (<code>pnpm generate:fitted</code>).
    </div>
    <ColorChromaCurve v-model:hue="themeHue" />
  </div>
</template>
