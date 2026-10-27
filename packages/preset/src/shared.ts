import type { ChromaticModel, Shade as ChromaticShade, FittedBlock } from '@proj-airi/chromatic'
import type { UtilObject, VariantObject } from '@unocss/core'

import { FITTED_MODEL, fittedOklch } from '@proj-airi/chromatic'
import { definePreset, LAYER_PREFLIGHTS } from '@unocss/core'

export const VAR_HUE = '--chromatic-hue'
export const VAR_BRIGHTNESS = '--chromatic-bri'
export const VAR_SATURATION = '--chromatic-sat'

export interface PresetChromaticOptions {
  bakeColors?: boolean
  baseHue: number
  colors: Record<string, number>
  /**
   * Colour model, `fitted` by default: lightness, chroma and a small hue drift vary with hue (fitted to Tailwind CSS
   * v4, see `fittedOklch` of `@proj-airi/chromatic`). `classic` restores the fixed per-shade lightness and the
   * `0.18 + 0.04 · cos(hue)` chroma of earlier versions.
   *
   * NOTICE: with `fitted`, lightness / chroma / drift are computed from `--chromatic-hue` on `:root`. Overriding
   * `--chromatic-hue` on a subtree still rotates the hue there, but keeps the root's lightness and chroma, which is the
   * same as `classic` does for chroma.
   */
  model?: ChromaticModel
  modifierUtilityPrefixes?: string[]
  modifierVariantName?: string
}

export type Shade = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 | 'DEFAULT'

export const VAR_CHROMA_SHADES = {
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
  DEFAULT: '--chromatic-chroma',
} as const satisfies Record<Shade, string>

const DEFAULT_MODIFIER_UTILITY_PREFIXES = ['bg', 'text', 'border', 'ring', 'fill', 'stroke']
const SHADES: ChromaticShade[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
const DEG_TO_RAD = '0.01745329252'
const percentRE = /^\d{1,3}(?:\.\d+)?$/
// Same placeholders as `alphaPlaceholders` of `@unocss/rule-utils`.
const alphaPlaceholdersRE = /%alpha|<alpha-value>/g

export function createBakedColorShades(baseHue: number, hueOffset: number) {
  const defaultChroma = 0.18 + Math.cos(baseHue * Math.PI / 180) * 0.04
  const hue = baseHue + hueOffset

  return {
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
    DEFAULT: `oklch(${lightness(62)} ${chroma(`${defaultChroma}`)} ${hue} / %alpha)`,
  } as const satisfies Record<Shade, string>
}

/** Shades of the `fitted` model with every value computed at build time. */
export function createFittedBakedColorShades(baseHue: number, hueOffset: number) {
  const shades = Object.fromEntries(SHADES.map((shade) => {
    const { c, h, l } = fittedOklch(shade, wrapHue(baseHue + hueOffset))
    return [shade, `oklch(${lightness(round(l * 100, 4))} ${chroma(`${round(c, 6)}`)} ${round(h, 4)} / %alpha)`]
  })) as Record<ChromaticShade, string>

  return { ...shades, DEFAULT: shades[500] } satisfies Record<Shade, string>
}

/**
 * Custom properties of the `fitted` model. Per colour: the Fourier basis `-b-cos<k>` / `-b-sin<k>` of its hue, the
 * shared hue curves of the blocks that have them (`-f<k>`), then lightness (`-l-<shade>`, 0–1), chroma
 * (`-c-<shade>`) and hue drift in degrees (`-hd-<shade>`) for each shade.
 */
export function createFittedPreflight(baseHue: number, colors: Record<string, number>): string {
  const lines = [
    `${VAR_HUE}: ${baseHue};`,
    `${VAR_BRIGHTNESS}: 1;`,
    `${VAR_SATURATION}: 1;`,
  ]

  const blocks = [FITTED_MODEL.lightness, FITTED_MODEL.chroma, FITTED_MODEL.hueDrift].filter(block => block != null)
  const harmonics = Math.max(...blocks.flatMap(block => block.curves.map(curve => harmonicsOf(curve, block.curvesHaveConst))))

  for (const [name, hueOffset] of Object.entries(colors)) {
    // cos(k·h) / sin(k·h) once per colour; every fitted value is a weighted sum of these.
    const basis = fittedVar(name, 'b')
    const angle = `(var(${VAR_HUE}) + ${hueOffset}) * ${DEG_TO_RAD}`
    for (let k = 1; k <= harmonics; k++) {
      const theta = k === 1 ? angle : `${k} * ${angle}`
      lines.push(`${basis}-cos${k}: cos(${theta});`, `${basis}-sin${k}: sin(${theta});`)
    }

    lines.push(...fittedBlockDeclarations(fittedVar(name, 'l'), FITTED_MODEL.lightness, basis, expr => expr))
    lines.push(...fittedBlockDeclarations(fittedVar(name, 'c'), FITTED_MODEL.chroma, basis, expr => `max(0, ${expr})`))
    if (FITTED_MODEL.hueDrift)
      lines.push(...fittedBlockDeclarations(fittedVar(name, 'hd'), FITTED_MODEL.hueDrift, basis, expr => expr))
  }

  return `
:root {
${lines.map(line => `  ${line}`).join('\n')}
}
`
}

/** Shades of the `fitted` model reading the custom properties of {@link createFittedPreflight}. */
export function createFittedVarBasedColorShades(name: string, hueOffset: number) {
  const shades = Object.fromEntries(SHADES.map((shade) => {
    const l = `var(${fittedVar(name, 'l')}-${shade})`
    const c = `var(${fittedVar(name, 'c')}-${shade})`
    const drift = FITTED_MODEL.hueDrift ? ` + var(${fittedVar(name, 'hd')}-${shade})` : ''
    return [
      shade,
      `oklch(clamp(0%, calc(${l} * 100% * var(${VAR_BRIGHTNESS})), 100%) ${chroma(c)} calc(var(${VAR_HUE}) + ${hueOffset}${drift}) / %alpha)`,
    ]
  })) as Record<ChromaticShade, string>

  return { ...shades, DEFAULT: shades[500] } satisfies Record<Shade, string>
}

export function createPresetChromatic(calledFromExtension = false) {
  return definePreset<PresetChromaticOptions>((options) => {
    return {
      name: 'preset-chromatic',
      ...options && {
        postprocess: [resolveLeftoverAlphaPlaceholders],
        preflights: [
          {
            getCSS() {
              if ((options.model ?? 'fitted') === 'fitted')
                return createFittedPreflight(options.baseHue, options.colors)

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
            layer: LAYER_PREFLIGHTS,
          },
        ],
        theme: {
          colors: Object
            .entries(options.colors)
            .reduce((colors, [key, hueOffset]) => {
              const bake = options.bakeColors || calledFromExtension
              if ((options.model ?? 'fitted') === 'fitted') {
                colors[key] = bake
                  ? createFittedBakedColorShades(options.baseHue, hueOffset)
                  : createFittedVarBasedColorShades(key, hueOffset)
              }
              else {
                colors[key] = bake
                  ? createBakedColorShades(options.baseHue, hueOffset)
                  : createVarBasedColorShades(hueOffset)
              }

              return colors
            }, {} as Record<string, Record<Shade, string>>),
        },
        variants: [
          variantChromaticAdjustments(
            options.modifierUtilityPrefixes,
            options.modifierVariantName,
          ),
        ],
      },
    }
  })
}

export function createVarBasedColorShades(hueOffset: number) {
  return {
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
    DEFAULT: `oklch(${lightness(62)} ${chroma(`var(${VAR_CHROMA_SHADES.DEFAULT})`)} calc(var(${VAR_HUE}) + ${hueOffset}) / %alpha)`,
  } as const satisfies Record<Shade, string>
}

function chroma(level: string): string {
  return `calc(${level} * var(${VAR_SATURATION}))`
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

function escapeRegExp(raw: string): string {
  return raw.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * `<prefix>-f<k>` for each shared curve and `<prefix>-<shade>` combining them, mirroring `evaluateFittedBlock`.
 */
function fittedBlockDeclarations(prefix: string, block: FittedBlock, basis: string, wrap: (expr: string) => string): string[] {
  // One curve per shade with identity weights: write each shade's series directly, no intermediate curve properties.
  if (isPerShadeBlock(block))
    return SHADES.map((shade, s) => `${prefix}-${shade}: ${wrap(`calc(${fourierCSS(block.curves[s], basis, true)})`)};`)

  const lines = block.curves.map((curve, k) => `${prefix}-f${k + 1}: calc(${fourierCSS(curve, basis, block.curvesHaveConst)});`)

  SHADES.forEach((shade, s) => {
    const terms = block.curves
      .map((_, k) => block.weights[s][k])
      .map((weight, k) => (weight === 0 ? '' : `${weight} * var(${prefix}-f${k + 1})`))
      .filter(Boolean)
    if (block.intercepts[s] !== 0 || !terms.length)
      terms.unshift(`${block.intercepts[s]}`)
    lines.push(`${prefix}-${shade}: ${wrap(`calc(${terms.join(' + ')})`)};`)
  })

  return lines
}

/** `--chromatic-fit-<name>-<quantity>`, with characters that are not valid in a custom property name replaced. */
function fittedVar(name: string, quantity: 'b' | 'c' | 'hd' | 'l'): string {
  return `--chromatic-fit-${name.replaceAll(/[^\w-]/g, '-')}-${quantity}`
}

/** CSS for `[const?] + a1·cos(θ) + b1·sin(θ) + a2·cos(2θ) + …` with θ given as a radian expression. */
function fourierCSS(coeffs: number[], basis: string, withConst: boolean): string {
  const terms: string[] = []
  let i = 0
  if (withConst)
    terms.push(`${coeffs[i++]}`)
  for (let k = 1; i < coeffs.length; k++) {
    const a = coeffs[i++]
    const b = coeffs[i++]
    if (a !== 0)
      terms.push(`${a} * var(${basis}-cos${k})`)
    if (b !== 0)
      terms.push(`${b} * var(${basis}-sin${k})`)
  }
  return terms.length ? terms.join(' + ') : '0'
}

/** Number of harmonics in a Fourier coefficient list `[const?, a1, b1, a2, b2, …]`. */
function harmonicsOf(coeffs: number[], withConst: boolean): number {
  return (coeffs.length - (withConst ? 1 : 0)) / 2
}

function isPerShadeBlock(block: FittedBlock): boolean {
  return block.curvesHaveConst
    && block.curves.length === SHADES.length
    && block.intercepts.every(v => v === 0)
    && block.weights.every((row, s) => row.every((w, k) => w === (k === s ? 1 : 0)))
}

function lightness(level: number): string {
  return `clamp(0%, calc(${level}% * var(${VAR_BRIGHTNESS})), 100%)`
}

/**
 * Replaces alpha placeholders that the base preset left in a utility with `1`.
 *
 * NOTICE:
 * presetWind4 inlines a theme color that contains `var(` (every shade of the runtime palette contains
 * `var(--chromatic-hue)`) into the utility as `color-mix(<method>, <color> <opacity>, transparent)` without touching
 * its `%alpha` placeholder (`colorCSSGenerator` in `@unocss/preset-wind4/dist/utils-*.mjs`, 66.7.5 lines 569-586).
 * It only replaces placeholders with `1` when it emits theme variables (`getThemeVarsMap` in
 * `@unocss/preset-wind4/dist/index.mjs`, line 456), which it skips for such colors. The leftover `%alpha` makes the
 * declaration invalid, so browsers drop it.
 * Replacing the placeholder with `1` gives the value wind4 itself would use; the surrounding `color-mix(…, transparent)`
 * still applies the utility's opacity. presetWind3 resolves every placeholder before postprocessing (it puts the
 * opacity into the color), so this never changes wind3 output.
 * Remove when presetWind4 resolves placeholders of inlined `var(` colors itself.
 */
function resolveLeftoverAlphaPlaceholders(util: UtilObject): void {
  for (const entry of util.entries) {
    if (typeof entry[1] === 'string')
      entry[1] = entry[1].replaceAll(alphaPlaceholdersRE, '1')
  }
}

function round(value: number, digits: number): number {
  return Number(value.toFixed(digits))
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
        body: (body) => {
          if (!body.length)
            return body

          const brightnessRatio = brightness && toRatio(brightness)
          const saturationRatio = saturation && toRatio(saturation)

          return body.map(([property, value]) => {
            if (typeof value !== 'string')
              return [property, value]

            return [
              property,
              value
                .replaceAll(`var(${VAR_BRIGHTNESS})`, brightnessRatio || `var(${VAR_BRIGHTNESS})`)
                .replaceAll(`var(${VAR_SATURATION})`, saturationRatio || `var(${VAR_SATURATION})`),
            ]
          })
        },
        matcher: base,
      }
    },
    name,
  }
}

function wrapHue(hue: number): number {
  return ((hue % 360) + 360) % 360
}
