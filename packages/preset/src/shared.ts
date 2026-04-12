import type { VariantObject } from '@unocss/core'

import { definePreset, LAYER_PREFLIGHTS } from '@unocss/core'

export const VAR_HUE = '--chromatic-hue'
export const VAR_BRIGHTNESS = '--chromatic-bri'
export const VAR_SATURATION = '--chromatic-sat'

export interface PresetChromaticOptions {
  baseHue: number
  colors: Record<string, number>
  bakeColors?: boolean
  modifierUtilityPrefixes?: string[]
  modifierVariantName?: string
}

export type Shade = 'DEFAULT' | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950

export const VAR_CHROMA_SHADES = {
  DEFAULT: '--chromatic-chroma',
  50: '--chromatic-chroma-50',
  100: '--chromatic-chroma-100',
  200: '--chromatic-chroma-200',
  300: '--chromatic-chroma-300',
  400: '--chromatic-chroma-400',
  500: '--chromatic-chroma-500',
  600: '--chromatic-chroma-600',
  700: '--chromatic-chroma-700',
  800: '--chromatic-chroma-800',
  900: '--chromatic-chroma-900',
  950: '--chromatic-chroma-950',
} as const satisfies Record<Shade, string>

const DEFAULT_MODIFIER_UTILITY_PREFIXES = ['bg', 'text', 'border', 'ring', 'fill', 'stroke']
const percentRE = /^\d{1,3}(?:\.\d+)?$/

function escapeRegExp(raw: string): string {
  return raw.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function createColorUtilityPrefixRE(prefixes: string[]): RegExp {
  const sanitized = prefixes
    .map(prefix => prefix.trim())
    .filter(Boolean)
    .map(escapeRegExp)

  if (!sanitized.length)
    return /^$/

  return new RegExp(`^(?:${sanitized.join('|')})-`)
}

function toRatio(raw: string): string {
  const parsed = Number.parseFloat(raw)
  const bounded = Number.isFinite(parsed) ? Math.min(200, Math.max(0, parsed)) : 100
  return `${Number((bounded / 100).toFixed(4))}`
}

function variantChromaticAdjustments(
  utilityPrefixes: string[] = DEFAULT_MODIFIER_UTILITY_PREFIXES,
  name = 'chromatic-modifiers',
): VariantObject {
  const colorUtilityPrefixRE = createColorUtilityPrefixRE(utilityPrefixes)

  return {
    name,
    match(matcher) {
      if (!colorUtilityPrefixRE.test(matcher))
        return

      let base = matcher
      let brightness: string | undefined
      let saturation: string | undefined

      const starIndex = base.lastIndexOf('*')
      if (starIndex >= 0) {
        const briCandidate = base.slice(starIndex + 1)
        if (!percentRE.test(briCandidate))
          return
        brightness = briCandidate
        base = base.slice(0, starIndex)
      }

      const tildeIndex = base.lastIndexOf('~')
      if (tildeIndex >= 0) {
        const satCandidate = base.slice(tildeIndex + 1)
        if (!percentRE.test(satCandidate))
          return
        saturation = satCandidate
        base = base.slice(0, tildeIndex)
      }

      if (!base || (!brightness && !saturation))
        return

      return {
        matcher: base,
        body: (body) => {
          if (!body.length)
            return body

          const next = [...body]
          if (brightness)
            next.push([VAR_BRIGHTNESS, toRatio(brightness)])
          if (saturation)
            next.push([VAR_SATURATION, toRatio(saturation)])

          return next
        },
      }
    },
  }
}

function lightness(level: number): string {
  return `clamp(0%, calc(${level}% * var(${VAR_BRIGHTNESS})), 100%)`
}

function chroma(level: string): string {
  return `calc(${level} * var(${VAR_SATURATION}))`
}

export function createVarBasedColorShades(hueOffset: number) {
  return {
    DEFAULT: `oklch(${lightness(62)} ${chroma(`var(${VAR_CHROMA_SHADES.DEFAULT})`)} calc(var(${VAR_HUE}) + ${hueOffset}) / %alpha)`,
    50: `color-mix(in srgb, oklch(${lightness(95)} ${chroma(`var(${VAR_CHROMA_SHADES[50]})`)} calc(var(${VAR_HUE}) + ${hueOffset}) / %alpha) 30%, oklch(100% 0 360 / %alpha))`,
    100: `color-mix(in srgb, oklch(${lightness(95)} ${chroma(`var(${VAR_CHROMA_SHADES[100]})`)} calc(var(${VAR_HUE}) + ${hueOffset}) / %alpha) 80%, oklch(100% 0 360 / %alpha))`,
    200: `oklch(${lightness(90)} ${chroma(`var(${VAR_CHROMA_SHADES[200]})`)} calc(var(${VAR_HUE}) + ${hueOffset}) / %alpha)`,
    300: `oklch(${lightness(85)} ${chroma(`var(${VAR_CHROMA_SHADES[300]})`)} calc(var(${VAR_HUE}) + ${hueOffset}) / %alpha)`,
    400: `oklch(${lightness(74)} ${chroma(`var(${VAR_CHROMA_SHADES[400]})`)} calc(var(${VAR_HUE}) + ${hueOffset}) / %alpha)`,
    500: `oklch(${lightness(62)} ${chroma(`var(${VAR_CHROMA_SHADES[500]})`)} calc(var(${VAR_HUE}) + ${hueOffset}) / %alpha)`,
    600: `oklch(${lightness(54)} ${chroma(`var(${VAR_CHROMA_SHADES[600]})`)} calc(var(${VAR_HUE}) + ${hueOffset}) / %alpha)`,
    700: `oklch(${lightness(49)} ${chroma(`var(${VAR_CHROMA_SHADES[700]})`)} calc(var(${VAR_HUE}) + ${hueOffset}) / %alpha)`,
    800: `oklch(${lightness(42)} ${chroma(`var(${VAR_CHROMA_SHADES[800]})`)} calc(var(${VAR_HUE}) + ${hueOffset}) / %alpha)`,
    900: `oklch(${lightness(37)} ${chroma(`var(${VAR_CHROMA_SHADES[900]})`)} calc(var(${VAR_HUE}) + ${hueOffset}) / %alpha)`,
    950: `oklch(${lightness(29)} ${chroma(`var(${VAR_CHROMA_SHADES[950]})`)} calc(var(${VAR_HUE}) + ${hueOffset}) / %alpha)`,
  } as const satisfies Record<Shade, string>
}

export function createBakedColorShades(baseHue: number, hueOffset: number) {
  const defaultChroma = 0.18 + Math.cos(baseHue * Math.PI / 180) * 0.04
  const hue = baseHue + hueOffset

  return {
    DEFAULT: `oklch(${lightness(62)} ${chroma(`${defaultChroma}`)} ${hue} / %alpha)`,
    50: `color-mix(in srgb, oklch(${lightness(95)} ${chroma(`${defaultChroma * 0.3}`)} ${hue} / %alpha) 30%, oklch(100% 0 360 / %alpha))`,
    100: `color-mix(in srgb, oklch(${lightness(95)} ${chroma(`${defaultChroma * 0.5}`)} ${hue} / %alpha) 80%, oklch(100% 0 360 / %alpha))`,
    200: `oklch(${lightness(90)} ${chroma(`${defaultChroma * 0.6}`)} ${hue} / %alpha)`,
    300: `oklch(${lightness(85)} ${chroma(`${defaultChroma * 0.75}`)} ${hue} / %alpha)`,
    400: `oklch(${lightness(74)} ${chroma(`${defaultChroma * 0.85}`)} ${hue} / %alpha)`,
    500: `oklch(${lightness(62)} ${chroma(`${defaultChroma}`)} ${hue} / %alpha)`,
    600: `oklch(${lightness(54)} ${chroma(`${defaultChroma * 1.15}`)} ${hue} / %alpha)`,
    700: `oklch(${lightness(49)} ${chroma(`${defaultChroma * 1.1}`)} ${hue} / %alpha)`,
    800: `oklch(${lightness(42)} ${chroma(`${defaultChroma * 0.85}`)} ${hue} / %alpha)`,
    900: `oklch(${lightness(37)} ${chroma(`${defaultChroma * 0.7}`)} ${hue} / %alpha)`,
    950: `oklch(${lightness(29)} ${chroma(`${defaultChroma * 0.5}`)} ${hue} / %alpha)`,
  } as const satisfies Record<Shade, string>
}

export function createPresetChromatic(calledFromExtension = false) {
  return definePreset<PresetChromaticOptions>((options) => {
    return {
      name: 'preset-chromatic',
      ...options && {
        variants: [
          variantChromaticAdjustments(
            options.modifierUtilityPrefixes,
            options.modifierVariantName,
          ),
        ],
        theme: {
          colors: Object
            .entries(options.colors)
            .reduce((colors, [key, hueOffset]) => {
              colors[key] = (options.bakeColors || calledFromExtension)
                ? createBakedColorShades(options.baseHue, hueOffset)
                : createVarBasedColorShades(hueOffset)

              return colors
            }, {} as Record<string, Record<Shade, string>>),
        },
        preflights: [
          {
            layer: LAYER_PREFLIGHTS,
            getCSS() {
              return `
:root {
  ${VAR_HUE}: ${options.baseHue};
  ${VAR_BRIGHTNESS}: 1;
  ${VAR_SATURATION}: 1;
  ${VAR_CHROMA_SHADES.DEFAULT}: calc(0.18 + (cos(var(${VAR_HUE}) * 3.14159265 / 180) * 0.04));
  ${VAR_CHROMA_SHADES[50]}: calc(var(${VAR_CHROMA_SHADES.DEFAULT}) * 0.3);
  ${VAR_CHROMA_SHADES[100]}: calc(var(${VAR_CHROMA_SHADES.DEFAULT}) * 0.5);
  ${VAR_CHROMA_SHADES[200]}: calc(var(${VAR_CHROMA_SHADES.DEFAULT}) * 0.6);
  ${VAR_CHROMA_SHADES[300]}: calc(var(${VAR_CHROMA_SHADES.DEFAULT}) * 0.75);
  ${VAR_CHROMA_SHADES[400]}: calc(var(${VAR_CHROMA_SHADES.DEFAULT}) * 0.85);
  ${VAR_CHROMA_SHADES[500]}: var(${VAR_CHROMA_SHADES.DEFAULT});
  ${VAR_CHROMA_SHADES[600]}: calc(var(${VAR_CHROMA_SHADES.DEFAULT}) * 1.15);
  ${VAR_CHROMA_SHADES[700]}: calc(var(${VAR_CHROMA_SHADES.DEFAULT}) * 1.1);
  ${VAR_CHROMA_SHADES[800]}: calc(var(${VAR_CHROMA_SHADES.DEFAULT}) * 0.85);
  ${VAR_CHROMA_SHADES[900]}: calc(var(${VAR_CHROMA_SHADES.DEFAULT}) * 0.7);
  ${VAR_CHROMA_SHADES[950]}: calc(var(${VAR_CHROMA_SHADES.DEFAULT}) * 0.5);
}
          `
            },
          },
        ],
      },
    }
  })
}
