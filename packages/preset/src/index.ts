import { definePreset, LAYER_PREFLIGHTS } from '@unocss/core'
import { env } from 'node:process'

type Shade = 'DEFAULT' | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950

const VAR_HUE = '--chromatic-hue'

const VAR_CHROMA_SHADES = {
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

function createVarBasedColorShades(hueOffset: number) {
  return {
    DEFAULT: `oklch(62% var(${VAR_CHROMA_SHADES.DEFAULT}) calc(var(${VAR_HUE}) + ${hueOffset}) / %alpha)`,
    50: `color-mix(in srgb, oklch(95% var(${VAR_CHROMA_SHADES[50]}) calc(var(${VAR_HUE}) + ${hueOffset}) / %alpha) 30%, oklch(100% 0 360 / %alpha))`,
    100: `color-mix(in srgb, oklch(95% var(${VAR_CHROMA_SHADES[100]}) calc(var(${VAR_HUE}) + ${hueOffset}) / %alpha) 80%, oklch(100% 0 360 / %alpha))`,
    200: `oklch(90% var(${VAR_CHROMA_SHADES[200]}) calc(var(${VAR_HUE}) + ${hueOffset}) / %alpha)`,
    300: `oklch(85% var(${VAR_CHROMA_SHADES[300]}) calc(var(${VAR_HUE}) + ${hueOffset}) / %alpha)`,
    400: `oklch(74% var(${VAR_CHROMA_SHADES[400]}) calc(var(${VAR_HUE}) + ${hueOffset}) / %alpha)`,
    500: `oklch(62% var(${VAR_CHROMA_SHADES[500]}) calc(var(${VAR_HUE}) + ${hueOffset}) / %alpha)`,
    600: `oklch(54% var(${VAR_CHROMA_SHADES[600]}) calc(var(${VAR_HUE}) + ${hueOffset}) / %alpha)`,
    700: `oklch(49% var(${VAR_CHROMA_SHADES[700]}) calc(var(${VAR_HUE}) + ${hueOffset}) / %alpha)`,
    800: `oklch(42% var(${VAR_CHROMA_SHADES[800]}) calc(var(${VAR_HUE}) + ${hueOffset}) / %alpha)`,
    900: `oklch(37% var(${VAR_CHROMA_SHADES[900]}) calc(var(${VAR_HUE}) + ${hueOffset}) / %alpha)`,
    950: `oklch(29% var(${VAR_CHROMA_SHADES[950]}) calc(var(${VAR_HUE}) + ${hueOffset}) / %alpha)`,
  } as const satisfies Record<Shade, string>
}

function createBakedColorShades(baseHue: number, hueOffset: number) {
  const defaultChroma = 0.18 + Math.cos(baseHue * Math.PI / 180) * 0.04
  const hue = baseHue + hueOffset

  return {
    DEFAULT: `oklch(62% ${defaultChroma} ${hue} / %alpha)`,
    50: `color-mix(in srgb, oklch(95% ${defaultChroma * 0.3} ${hue} / %alpha) 30%, oklch(100% 0 360 / %alpha))`,
    100: `color-mix(in srgb, oklch(95% ${defaultChroma * 0.5} ${hue} / %alpha) 80%, oklch(100% 0 360 / %alpha))`,
    200: `oklch(90% ${defaultChroma * 0.6} ${hue} / %alpha)`,
    300: `oklch(85% ${defaultChroma * 0.75} ${hue} / %alpha)`,
    400: `oklch(74% ${defaultChroma * 0.85} ${hue} / %alpha)`,
    500: `oklch(62% ${defaultChroma} ${hue} / %alpha)`,
    600: `oklch(54% ${defaultChroma * 1.15} ${hue} / %alpha)`,
    700: `oklch(49% ${defaultChroma * 1.1} ${hue} / %alpha)`,
    800: `oklch(42% ${defaultChroma * 0.85} ${hue} / %alpha)`,
    900: `oklch(37% ${defaultChroma * 0.7} ${hue} / %alpha)`,
    950: `oklch(29% ${defaultChroma * 0.5} ${hue} / %alpha)`,
  } as const satisfies Record<Shade, string>
}

export interface PresetChromaticOptions {
  baseHue: number
  colors: Record<string, number>
  bakeColors?: boolean
}

export const presetChromatic = definePreset<PresetChromaticOptions>((options) => {
  // Some tricks
  const calledFromExtension = (env.VSCODE_ESM_ENTRYPOINT ?? '').includes('extensionHostProcess')

  return {
    name: 'preset-chromatic',
    ...options && {
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

export default presetChromatic
