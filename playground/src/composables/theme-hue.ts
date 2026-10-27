import type { Ref } from 'vue'

import { VAR_HUE } from '@proj-airi/unocss-preset-chromatic'
import { ref, watch } from 'vue'

const DEFAULT_THEME_COLORS_HUE = 220.25

let themeHue: Ref<number> | undefined

/**
 * The hue of the whole playground, shared by every page and written to `--chromatic-hue` on `<html>`, so switching
 * routes keeps the theme.
 */
export function useThemeHue(): Ref<number> {
  if (themeHue)
    return themeHue

  const fromDocument = Number.parseFloat(document.documentElement.style.getPropertyValue(VAR_HUE))
  themeHue = ref(fromDocument >= 0 && fromDocument <= 360 ? fromDocument : DEFAULT_THEME_COLORS_HUE)

  watch(themeHue, (hue) => {
    document.documentElement.style.setProperty(VAR_HUE, hue.toString())
  }, { immediate: true })

  return themeHue
}
