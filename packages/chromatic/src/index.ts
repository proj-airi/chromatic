import type { Color, Oklch, Rgb } from 'culori'

import { converter, formatCss, formatHex, oklch } from 'culori'

export type { Color, Oklch }

export interface ChromaticColor {
  color: Color
  toCSS: () => string
  toHex: () => string
  withAlpha: (alpha: number) => ChromaticColor
}

export interface ChromaticColorFromOptions {
  alpha?: number
  baseChroma?: number
  brightness?: number
  hueOffset?: number
  saturation?: number
  shade?: Shade
}

export interface ChromaticPalette {
  baseHue: number
  chroma: number
  getAllShades: (hueOffset?: number, alpha?: number) => ColorShades
  shadeBy: (shade: Shade) => ChromaticColor
}

export type ColorShades = Record<Shade, ChromaticColor>

export type Shade = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950

export interface ShadeConfig {
  chromaMultiplier: number
  lightness: number
  mixWithWhite?: number
}

export type ShadeConfigMap = Record<Shade, ShadeConfig>

const toRgb = converter('rgb')
export const symbolicShadeValues: Shade[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]

export const symbolicShadeConfig: ShadeConfigMap = {
  50: { chromaMultiplier: 0.3, lightness: 0.95, mixWithWhite: 0.3 },
  100: { chromaMultiplier: 0.5, lightness: 0.95, mixWithWhite: 0.8 },
  200: { chromaMultiplier: 0.6, lightness: 0.90 },
  300: { chromaMultiplier: 0.75, lightness: 0.85 },
  400: { chromaMultiplier: 0.85, lightness: 0.74 },
  500: { chromaMultiplier: 1.0, lightness: 0.62 },
  600: { chromaMultiplier: 1.15, lightness: 0.54 },
  700: { chromaMultiplier: 1.1, lightness: 0.49 },
  800: { chromaMultiplier: 0.85, lightness: 0.42 },
  900: { chromaMultiplier: 0.7, lightness: 0.37 },
  950: { chromaMultiplier: 0.5, lightness: 0.29 },
}

export interface ColorScheme {
  // eslint-disable-next-line ts/no-unsafe-function-type
  [colorName: string]: ColorShades | Function
  addColor: (name: string, hueOffset: number) => ColorScheme
  adjustHue: (newBaseHue: number) => ColorScheme
  getColor: (colorName: string, shade?: Shade) => ChromaticColor | undefined
  toCSS: (colorName: string, shade?: Shade) => string | undefined
  toHex: (colorName: string, shade?: Shade) => string | undefined
}

export interface DynamicTheme {
  animateHue: (targetHue: number, steps?: number, duration?: number) => Promise<ColorScheme>
  getScheme: () => ColorScheme
  seasonal: {
    autumn: () => ColorScheme
    spring: () => ColorScheme
    summer: () => ColorScheme
    winter: () => ColorScheme
  }
  setHue: (newHue: number) => ColorScheme
}

/**
 * Estimate the base chroma for a hue in the Chromatic palette model.
 *
 * @param baseHue Base hue in degrees. Typical values are `0` to `360`.
 * Example: `220.25` for a blue-leaning base hue.
 * @returns Base chroma scalar used before shade/brightness/saturation adjustments.
 * Example output: around `0.15` to `0.22`.
 *
 * @example
 * const c = baseChromaByHue(220.25) // ~0.15-0.16
 */
export function baseChromaByHue(baseHue: number): number {
  return 0.18 + Math.cos(baseHue * Math.PI / 180) * 0.04
}

/**
 * Build one chromatic color from hue + shade + optional symbolic adjustments.
 *
 * @param baseHue Base hue in degrees. Defaults to `200`.
 * Example values: `30` (orange), `120` (green), `220.25` (blue).
 * @param options Optional per-color controls.
 * - `shade`: one of `50|100|200|300|400|500|600|700|800|900|950` (defaults to `500`)
 * - `hueOffset`: hue shift in degrees (example: `60` for secondary color)
 * - `brightness`: percentage where `100` is unchanged, `120` is brighter, `80` is dimmer
 * - `saturation`: percentage where `100` is unchanged, `0` is grayscale-ish, `150` is more vivid
 * - `alpha`: opacity from `0` to `1` (example: `0.5`)
 * - `baseChroma`: optional override for computed base chroma (advanced use)
 * @returns `ChromaticColor` wrapper with `.toHex()`, `.toCSS()`, and `.withAlpha()`.
 *
 * @example
 * const accent = chromaticColorFrom(220.25, {
 *   shade: 500,
 *   hueOffset: 60,
 *   brightness: 115,
 *   saturation: 90,
 *   alpha: 1,
 * })
 * accent.toHex()
 */
export function chromaticColorFrom(baseHue = 200, options: ChromaticColorFromOptions = {}): ChromaticColor {
  const {
    alpha = 1,
    baseChroma = baseChromaByHue(baseHue),
    brightness = 100,
    hueOffset = 0,
    saturation = 100,
    shade = 500,
  } = options

  const config = symbolicShadeConfig[shade]
  const lightness = Math.min(1, Math.max(0, config.lightness * clampPercentToRatio(brightness)))
  const chroma = Math.max(0, baseChroma * config.chromaMultiplier * clampPercentToRatio(saturation))

  const color = oklch({
    alpha,
    c: chroma,
    h: wrapHue(baseHue + hueOffset),
    l: lightness,
    mode: 'oklch',
  })

  if (config.mixWithWhite != null)
    return colorToChromaticColor(mixSrgbWithWhite(color, config.mixWithWhite))

  return colorToChromaticColor(color)
}

/**
 * Create a dynamic theme controller that can update hue over time.
 *
 * @param baseHue Initial base hue in degrees. Defaults to `200`.
 * @returns `DynamicTheme` with `getScheme`, `setHue`, `animateHue`, and seasonal presets.
 *
 * @example
 * const dynamic = chromaticFrom(220.25)
 * dynamic.setHue(280)
 * const winter = dynamic.seasonal.winter()
 */
export function chromaticFrom(baseHue = 200): DynamicTheme {
  let currentHue = baseHue
  const currentColors: Record<string, number> = {
    accent: 180,
    neutral: 0,
    primary: 0,
    secondary: 60,
  }

  return {
    animateHue: (targetHue: number, steps = 10, duration = 1000): Promise<ColorScheme> => {
      const startHue = currentHue
      const stepSize = (targetHue - startHue) / steps
      const stepDuration = duration / steps

      return new Promise((resolve) => {
        let step = 0
        const interval = setInterval(() => {
          currentHue = startHue + (stepSize * step)
          step++

          if (step > steps) {
            clearInterval(interval)
            currentHue = targetHue
            resolve(themeFrom(currentHue, currentColors))
          }
        }, stepDuration)
      })
    },
    getScheme: (): ColorScheme => themeFrom(currentHue, currentColors),
    // Generate seasonal themes
    seasonal: {
      autumn: (): ColorScheme => themeFrom(30, currentColors), // Orange base
      spring: (): ColorScheme => themeFrom(120, currentColors), // Green base
      summer: (): ColorScheme => themeFrom(45, currentColors), // Yellow base
      winter: (): ColorScheme => themeFrom(240, currentColors), // Blue base
    },

    setHue: (newHue: number): ColorScheme => {
      currentHue = newHue
      return themeFrom(currentHue, currentColors)
    },
  }
}

/**
 * Create a reusable palette object for one base hue.
 *
 * @param baseHue Base hue in degrees. Defaults to `200`.
 * @param baseChroma Optional manual chroma override. If omitted, it is computed from `baseHue`.
 * @returns `ChromaticPalette` with `shadeBy()` and `getAllShades()`.
 *
 * @example
 * const palette = chromaticPaletteFrom(220.25)
 * const primary500 = palette.shadeBy(500).toHex()
 * const shifted = palette.getAllShades(60) // all shades with +60 hue offset
 */
export function chromaticPaletteFrom(baseHue = 200, baseChroma?: number): ChromaticPalette {
  const chroma = baseChroma ?? baseChromaByHue(baseHue)

  const shadeBy = (shade: Shade, alpha = 1, hueOffset = 0): ChromaticColor =>
    chromaticColorFrom(baseHue, {
      alpha,
      baseChroma: chroma,
      hueOffset,
      shade,
    })

  return {
    baseHue,
    chroma,
    getAllShades: (hueOffset = 0, alpha = 1): ColorShades => {
      const shades = {} as ColorShades
      for (const shadeKey of Object.keys(symbolicShadeConfig)) {
        const shade = Number.parseInt(shadeKey) as Shade
        shades[shade] = shadeBy(shade, alpha, hueOffset)
      }

      return shades
    },

    shadeBy,
  }
}

/**
 * Convenience helper to get all shades for a single named color at a hue.
 *
 * @param hue Base hue in degrees.
 * Example: `220.25`.
 * @param name Optional temporary color key name. Defaults to `'color'`.
 * @returns Shade map (`50..950`) for that color.
 *
 * @example
 * const shades = colorBy(220.25)
 * shades[500].toHex()
 */
export function colorBy(hue: number, name = 'color'): ColorShades {
  const scheme = themeFrom(hue, { [name]: 0 })
  return scheme[name] as ColorShades
}

/**
 * Mix two colors in OKLCH space.
 *
 * @param color1 First color.
 * Example: `{ mode: 'oklch', l: 0.62, c: 0.16, h: 220 }`
 * @param color2 Second color.
 * Example: `{ mode: 'oklch', l: 1, c: 0, h: 0 }` (white)
 * @param ratio Mix ratio for `color2` in `[0,1]`.
 * `0` = only `color1`, `1` = only `color2`, `0.5` = midpoint.
 * @returns Mixed color object (culori `Color`).
 *
 * @example
 * const mixed = mixColors(
 *   { mode: 'oklch', l: 0.62, c: 0.16, h: 220 },
 *   { mode: 'oklch', l: 1, c: 0, h: 0 },
 *   0.25,
 * )
 */
export function mixColors(color1: Color, color2: Color, ratio = 0.5): Color {
  const c1 = oklch(color1)
  const c2 = oklch(color2)

  if (!c1 || !c2) {
    throw new Error('Invalid colors provided for mixing')
  }

  return oklch({
    c: c1.c * (1 - ratio) + c2.c * ratio,
    h: mixHues(c1.h ?? 0, c2.h ?? 0, ratio),
    l: c1.l * (1 - ratio) + c2.l * ratio,
    mode: 'oklch',
  })
}

/**
 * Build a named color scheme from one base hue plus hue offsets.
 *
 * @param baseHue Base hue in degrees. Defaults to `200`.
 * @param colors Map of color name -> hue offset in degrees.
 * Example: `{ primary: 0, secondary: 60, accent: 180 }`
 * @returns `ColorScheme` with named shade maps and helpers (`getColor`, `toHex`, `toCSS`).
 *
 * @example
 * const scheme = themeFrom(220.25, {
 *   primary: 0,
 *   secondary: 60,
 *   accent: 180,
 * })
 * scheme.toHex('primary', 500)
 */
export function themeFrom(baseHue = 200, colors: Record<string, number> = {}): ColorScheme {
  const palette = chromaticPaletteFrom(baseHue)

  const scheme: Record<string, ColorShades> = {}
  for (const [name, hueOffset] of Object.entries(colors)) {
    scheme[name] = palette.getAllShades(hueOffset)
  }

  return {
    ...scheme,
    addColor: (name: string, hueOffset: number): ColorScheme =>
      themeFrom(baseHue, { ...colors, [name]: hueOffset }),
    adjustHue: (newBaseHue: number): ColorScheme => themeFrom(newBaseHue, colors),
    getColor: (colorName: string, shade: Shade = 500): ChromaticColor | undefined =>
      scheme[colorName]?.[shade],
    toCSS: (colorName: string, shade: Shade = 500): string | undefined => {
      const color = scheme[colorName]?.[shade]
      return color ? formatCss(color.color) : undefined
    },
    toHex: (colorName: string, shade: Shade = 500): string | undefined => {
      const color = scheme[colorName]?.[shade]
      return color ? formatHex(color.color) : undefined
    },
  }
}

function clampChannel(channel: number): number {
  return Math.min(1, Math.max(0, channel))
}

function clampPercentToRatio(value: number | undefined): number {
  const parsed = Number.isFinite(value) ? value! : 100
  const bounded = Math.min(200, Math.max(0, parsed))
  return bounded / 100
}

function colorToChromaticColor(color: Color): ChromaticColor {
  return {
    color,
    toCSS: () => formatCss(color),
    toHex: () => formatHex(color),
    withAlpha: (alpha: number): ChromaticColor => {
      const rgba = oklch(color)
      if (!rgba) {
        throw new Error('Invalid color provided for alpha adjustment')
      }

      return colorToChromaticColor(oklch({
        alpha,
        c: rgba.c,
        h: rgba.h,
        l: rgba.l,
        mode: 'oklch',
      }))
    },
  }
}

function mixHues(h1: number, h2: number, ratio: number): number {
  // Handle hue interpolation considering circular nature
  let diff = h2 - h1

  if (diff > 180)
    diff -= 360
  if (diff < -180)
    diff += 360

  return (h1 + diff * ratio + 360) % 360
}

function mixSrgbWithWhite(color: ReturnType<typeof oklch>, baseRatio: number): Color {
  const rgb = toRgb(color) as Rgb | undefined
  if (!rgb)
    throw new Error('Invalid color provided for rgb conversion')

  const whiteRatio = 1 - baseRatio

  return {
    alpha: rgb.alpha,
    b: clampChannel(rgb.b * baseRatio + whiteRatio),
    g: clampChannel(rgb.g * baseRatio + whiteRatio),
    mode: 'rgb',
    r: clampChannel(rgb.r * baseRatio + whiteRatio),
  }
}

function wrapHue(hue: number): number {
  return ((hue % 360) + 360) % 360
}
