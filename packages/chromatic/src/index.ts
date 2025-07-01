import type { Color, Oklch } from 'culori'

import { formatCss, formatHex, oklch } from 'culori'

export type { Color, Oklch }

export type Shade = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950

export interface ShadeConfig {
  lightness: number
  chromaMultiplier: number
  mixWithWhite?: number
}

export type ShadeConfigMap = Record<Shade, ShadeConfig>

export type ColorShades = Record<Shade, ChromaticColor>

export interface ChromaticColor {
  color: Color
  withAlpha: (alpha: number) => ChromaticColor
  toHex: () => string
  toCSS: () => string
}

export interface ChromaticPalette {
  baseHue: number
  chroma: number
  getAllShades: (hueOffset?: number) => ColorShades
  shadeBy: (shade: Shade) => ChromaticColor
}

export interface ColorScheme {
  // eslint-disable-next-line ts/no-unsafe-function-type
  [colorName: string]: ColorShades | Function
  getColor: (colorName: string, shade?: Shade) => ChromaticColor | undefined
  toCSS: (colorName: string, shade?: Shade) => string | undefined
  toHex: (colorName: string, shade?: Shade) => string | undefined
  adjustHue: (newBaseHue: number) => ColorScheme
  addColor: (name: string, hueOffset: number) => ColorScheme
}

export interface DynamicTheme {
  getScheme: () => ColorScheme
  setHue: (newHue: number) => ColorScheme
  animateHue: (targetHue: number, steps?: number, duration?: number) => Promise<ColorScheme>
  seasonal: {
    spring: () => ColorScheme
    summer: () => ColorScheme
    autumn: () => ColorScheme
    winter: () => ColorScheme
  }
}

function colorToChromaticColor(color: Color): ChromaticColor {
  return {
    color,
    withAlpha: (alpha: number): ChromaticColor => {
      const rgba = oklch(color)
      if (!rgba) {
        throw new Error('Invalid color provided for alpha adjustment')
      }

      return colorToChromaticColor(oklch({
        mode: 'oklch',
        l: rgba.l,
        c: rgba.c,
        h: rgba.h,
        alpha,
      }))
    },
    toHex: () => formatHex(color),
    toCSS: () => formatCss(color),
  }
}

export function chromaticPaletteFrom(baseHue = 200, baseChroma?: number): ChromaticPalette {
  const chroma = baseChroma ?? (0.18 + Math.cos(baseHue * Math.PI / 180) * 0.04)

  const shadeConfig: ShadeConfigMap = {
    50: { lightness: 0.95, chromaMultiplier: 0.3, mixWithWhite: 0.7 },
    100: { lightness: 0.95, chromaMultiplier: 0.5, mixWithWhite: 0.2 },
    200: { lightness: 0.90, chromaMultiplier: 0.6 },
    300: { lightness: 0.85, chromaMultiplier: 0.75 },
    400: { lightness: 0.74, chromaMultiplier: 0.85 },
    500: { lightness: 0.62, chromaMultiplier: 1.0 }, // base
    600: { lightness: 0.54, chromaMultiplier: 1.15 },
    700: { lightness: 0.49, chromaMultiplier: 1.1 },
    800: { lightness: 0.42, chromaMultiplier: 0.85 },
    900: { lightness: 0.37, chromaMultiplier: 0.7 },
    950: { lightness: 0.29, chromaMultiplier: 0.5 },
  }

  const shadeBy = (shade: Shade, alpha?: number, hueOffset = 0): ChromaticColor => {
    const config = shadeConfig[shade]
    const adjustedHue = (baseHue + hueOffset) % 360
    const adjustedChroma = chroma * config.chromaMultiplier

    const baseColor = oklch({
      mode: 'oklch',
      l: config.lightness,
      c: adjustedChroma,
      h: adjustedHue,
      alpha: alpha ?? 1,
    })

    // Mix with white for lighter shades if specified
    if (config.mixWithWhite) {
      const white = oklch({ mode: 'oklch', l: 1, c: 0, h: 0, alpha: alpha ?? 1 })
      return colorToChromaticColor(mixColors(baseColor, white, config.mixWithWhite))
    }

    return colorToChromaticColor(baseColor)
  }

  return {
    baseHue,
    chroma,
    getAllShades: (alpha?: number, hueOffset = 0): ColorShades => {
      const shades = {} as ColorShades
      for (const shadeKey of Object.keys(shadeConfig)) {
        const shade = Number.parseInt(shadeKey) as Shade
        shades[shade] = shadeBy(shade, alpha, hueOffset)
      }

      return shades
    },

    shadeBy,
  }
}

export function mixColors(color1: Color, color2: Color, ratio = 0.5): Color {
  const c1 = oklch(color1)
  const c2 = oklch(color2)

  if (!c1 || !c2) {
    throw new Error('Invalid colors provided for mixing')
  }

  return oklch({
    mode: 'oklch',
    l: c1.l * (1 - ratio) + c2.l * ratio,
    c: c1.c * (1 - ratio) + c2.c * ratio,
    h: mixHues(c1.h ?? 0, c2.h ?? 0, ratio),
  })
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

export function themeFrom(baseHue = 200, colors: Record<string, number> = {}): ColorScheme {
  const palette = chromaticPaletteFrom(baseHue)

  const scheme: Record<string, ColorShades> = {}
  for (const [name, hueOffset] of Object.entries(colors)) {
    scheme[name] = palette.getAllShades(hueOffset)
  }

  return {
    ...scheme,
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
    adjustHue: (newBaseHue: number): ColorScheme => themeFrom(newBaseHue, colors),
    addColor: (name: string, hueOffset: number): ColorScheme =>
      themeFrom(baseHue, { ...colors, [name]: hueOffset }),
  }
}

export function chromaticFrom(baseHue = 200): DynamicTheme {
  let currentHue = baseHue
  const currentColors: Record<string, number> = {
    primary: 0,
    secondary: 60,
    accent: 180,
    neutral: 0,
  }

  return {
    getScheme: (): ColorScheme => themeFrom(currentHue, currentColors),
    setHue: (newHue: number): ColorScheme => {
      currentHue = newHue
      return themeFrom(currentHue, currentColors)
    },
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

    // Generate seasonal themes
    seasonal: {
      spring: (): ColorScheme => themeFrom(120, currentColors), // Green base
      summer: (): ColorScheme => themeFrom(45, currentColors), // Yellow base
      autumn: (): ColorScheme => themeFrom(30, currentColors), // Orange base
      winter: (): ColorScheme => themeFrom(240, currentColors), // Blue base
    },
  }
}

export function colorBy(hue: number, name = 'color'): ColorShades {
  const scheme = themeFrom(hue, { [name]: 0 })
  return scheme[name] as ColorShades
}
