<script setup lang="ts">
import { VAR_HUE } from '@proj-airi/unocss-preset-chromatic'
import { onMounted, ref, watch } from 'vue'

import ColorHueRange from './components/ColorHueRange.vue'

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

<template>
  <div class="mx-auto max-w-screen-xl p-4 font-sans">
    <div>
      <ColorHueRange
        v-model="themeColorsHue"
        class="w-full"
        :disabled="false"
      />
    </div>
    <div>
      <div class="flex gap-2">
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
  </div>
</template>
