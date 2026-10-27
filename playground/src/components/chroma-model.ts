import type { Shade } from '@proj-airi/chromatic'
import type { ComputedRef } from 'vue'

import type { FitRank, TailwindFit, TailwindFitOptions } from './tailwind-fit'

import { baseChromaByHue, chromaticColorFrom, symbolicShadeConfig } from '@proj-airi/chromatic'
import { clampChroma, formatHex } from 'culori'
import { computed } from 'vue'

import { DEFAULT_TAILWIND_FIT_OPTIONS, fitTailwind } from './tailwind-fit'
import { tailwindV4Families } from './tailwind-v4'

export interface ChromaPoint {
  chroma: number
  clipped: boolean
  hex: string
  l: number
  maxChroma: number
}
export type FitTarget = '500' | 'envelope'

export interface FourierFit {
  a: number[]
  b: number[]
}

export type Model = 'current' | 'fitted' | 'tailwind' | 'tuned'

export interface TunedParams {
  bumpAmount: number
  bumpCenter: number
  bumpSharpness: number
  chromaScale: number
  fitEnabled: boolean
  fitHarmonics: number
  fitRatio: number
  fitTarget: FitTarget
  gamutMap: boolean
  /** Options of the model fitted to Tailwind v4 ("fitted"). */
  /** `relative`: fit the share of sRGB, then the exact gamut with `twChromaHarmonics` (see `ChromaFit`). */
  twChromaHarmonics: number
  twChromaMode: 'absolute' | 'relative'
  twHarmonics: number
  twHueDrift: boolean
  /** Inside this hue window the fit targets a share of sRGB instead of Tailwind (see `GamutOverride`). */
  twOverride: boolean
  twOverrideAnchorWeight: number
  twOverrideCenter: number
  twOverrideLightRatio: number
  twOverrideMidRatio: number
  twOverrideWidth: number
  twRank: FitRank
  twRatioHarmonics: number
}

export const IDENTITY_PARAMS: TunedParams = {
  bumpAmount: 0,
  bumpCenter: 215,
  bumpSharpness: 4,
  chromaScale: 1,
  fitEnabled: false,
  fitHarmonics: 4,
  fitRatio: 0.95,
  fitTarget: 'envelope',
  gamutMap: false,
  twChromaHarmonics: DEFAULT_TAILWIND_FIT_OPTIONS.chroma.harmonics,
  twChromaMode: DEFAULT_TAILWIND_FIT_OPTIONS.chroma.mode,
  twHarmonics: DEFAULT_TAILWIND_FIT_OPTIONS.harmonics,
  twHueDrift: DEFAULT_TAILWIND_FIT_OPTIONS.hueDrift,
  twOverride: true,
  twOverrideAnchorWeight: DEFAULT_TAILWIND_FIT_OPTIONS.override.anchorWeight,
  twOverrideCenter: DEFAULT_TAILWIND_FIT_OPTIONS.override.center,
  twOverrideLightRatio: DEFAULT_TAILWIND_FIT_OPTIONS.override.lightRatio,
  twOverrideMidRatio: DEFAULT_TAILWIND_FIT_OPTIONS.override.midRatio,
  twOverrideWidth: DEFAULT_TAILWIND_FIT_OPTIONS.override.width,
  twRank: DEFAULT_TAILWIND_FIT_OPTIONS.rank,
  twRatioHarmonics: DEFAULT_TAILWIND_FIT_OPTIONS.chroma.ratioHarmonics,
}

export const SUGGESTED_PARAMS: TunedParams = {
  ...IDENTITY_PARAMS,
  bumpAmount: 0.06,
  fitEnabled: true,
  fitTarget: '500',
}

export const DEG = Math.PI / 180
/** Normalizer so that shade 500 (L = 0.62) gets the full lightness bump. */
export const MID_WEIGHT = 4 * 0.62 * 0.38
// Shades used to build the "envelope" fit target: the fit keeps all of them in gamut.
const ENVELOPE_SHADES: Shade[] = [400, 500, 600, 700]

export interface ChromaModel {
  evaluate: (model: Model, hue: number, shade: Shade) => ChromaPoint
  fourierFit: ComputedRef<FourierFit | null>
  tailwindFit: ComputedRef<TailwindFit>
}

export interface TailwindPoint {
  c: number
  h: number
  hex: string
  l: number
  name: string
}

export function evalFourier(fit: FourierFit, hue: number): number {
  let sum = 0
  for (let k = 0; k < fit.a.length; k++)
    sum += fit.a[k] * Math.cos(k * hue * DEG) + fit.b[k] * Math.sin(k * hue * DEG)
  return Math.max(0, sum)
}

export function maxChromaAt(l: number, h: number): number {
  return clampChroma({ c: 0.5, h, l, mode: 'oklch' }, 'oklch').c
}

/** Max chroma inside Display P3, which is what Tailwind v4 designs its palette against. */
export function maxChromaP3At(l: number, h: number): number {
  return clampChroma({ c: 0.5, h, l, mode: 'oklch' }, 'oklch', 'p3').c
}

const tailwindByShade = new Map<Shade, TailwindPoint[]>()

/** Diverging colour for a residual: blue (headroom) → neutral gray → red (overshoot). */
export function residualColor(residual: number, range = 0.5): string {
  const t = Math.max(-1, Math.min(1, residual / range))
  const hue = t > 0 ? 27 : 255
  const chroma = Math.abs(t) * 0.17
  const lightness = 0.86 - Math.abs(t) * 0.26
  return formatHex({ c: chroma, h: hue, l: lightness, mode: 'oklch' })
}

/**
 * Relative residual against the sRGB boundary: `> 0` overshoots (gets clipped), `< 0` leaves headroom unused.
 */
export function residualOf(point: ChromaPoint): number {
  return point.maxChroma > 0 ? point.chroma / point.maxChroma - 1 : 0
}

/** Full effect on mid shades, fading towards the very light / very dark ends. */
export function shadeWeight(lightness: number): number {
  return 4 * lightness * (1 - lightness) / MID_WEIGHT
}

/** Tailwind v4 approximated at an arbitrary hue by linearly interpolating L and C between neighbouring families. */
export function tailwindAt(hue: number, shade: Shade): ChromaPoint {
  const points = tailwindPointsFor(shade)
  const h = ((hue % 360) + 360) % 360
  let next = points.findIndex(p => p.h > h)
  if (next < 0)
    next = 0
  const a = points[(next - 1 + points.length) % points.length]
  const b = points[next]
  const span = ((b.h - a.h) + 360) % 360 || 360
  const t = (((h - a.h) + 360) % 360) / span
  const l = a.l + (b.l - a.l) * t
  const chroma = a.c + (b.c - a.c) * t
  const maxChroma = maxChromaAt(l, h)

  return {
    chroma,
    clipped: chroma > maxChroma + 1e-4,
    hex: formatHex({ c: chroma, h, l, mode: 'oklch' }),
    l,
    maxChroma,
  }
}

export function tailwindFitOptionsOf(params: TunedParams): TailwindFitOptions {
  return {
    chroma: params.twChromaMode === 'relative'
      ? { harmonics: params.twChromaHarmonics, mode: 'relative', ratioHarmonics: params.twRatioHarmonics }
      : { mode: 'absolute' },
    harmonics: params.twHarmonics,
    hueDrift: params.twHueDrift,
    override: params.twOverride
      ? {
          anchorWeight: params.twOverrideAnchorWeight,
          center: params.twOverrideCenter,
          lightRatio: params.twOverrideLightRatio,
          midRatio: params.twOverrideMidRatio,
          width: params.twOverrideWidth,
        }
      : null,
    rank: params.twRank,
  }
}

/** The 17 Tailwind v4 colour families at one shade, sorted by hue. */
export function tailwindPointsFor(shade: Shade): TailwindPoint[] {
  let points = tailwindByShade.get(shade)
  if (!points) {
    points = tailwindV4Families
      .map(({ name, shades }) => {
        const [l, c, h] = shades[shade]
        return { c, h, hex: formatHex({ c, h, l, mode: 'oklch' }), l, name }
      })
      .sort((a, b) => a.h - b.h)
    tailwindByShade.set(shade, points)
  }
  return points
}

export function useChromaModel(params: TunedParams): ChromaModel {
  /** Raised-cosine bump in [0, 1]; periodic, so no hue wrapping is needed (and it is expressible in CSS). */
  function lightnessBump(hue: number): number {
    return ((1 + Math.cos((hue - params.bumpCenter) * DEG)) / 2) ** params.bumpSharpness
  }

  function tunedLightness(hue: number, shade: Shade): number {
    const base = symbolicShadeConfig[shade].lightness
    return Math.min(1, Math.max(0, base + params.bumpAmount * lightnessBump(hue) * shadeWeight(base)))
  }

  // Least-squares Fourier fit on uniformly spaced samples is just the truncated DFT.
  const fourierFit = computed<FourierFit | null>(() => {
    if (!params.fitEnabled)
      return null

    const N = 360
    const shades: Shade[] = params.fitTarget === '500' ? [500] : ENVELOPE_SHADES
    const target: number[] = []
    for (let h = 0; h < N; h++) {
      const limit = Math.min(...shades.map(shade =>
        maxChromaAt(tunedLightness(h, shade), h) / symbolicShadeConfig[shade].chromaMultiplier,
      ))
      target.push(limit * params.fitRatio)
    }

    const a: number[] = []
    const b: number[] = []
    for (let k = 0; k <= params.fitHarmonics; k++) {
      let sa = 0
      let sb = 0
      for (let h = 0; h < N; h++) {
        sa += target[h] * Math.cos(k * h * DEG)
        sb += target[h] * Math.sin(k * h * DEG)
      }
      a.push(k === 0 ? sa / N : 2 * sa / N)
      b.push(k === 0 ? 0 : 2 * sb / N)
    }

    return { a, b }
  })

  const tailwindFit = computed(() => fitTailwind(tailwindFitOptionsOf(params)))

  function evaluate(model: Model, hue: number, shade: Shade): ChromaPoint {
    const config = symbolicShadeConfig[shade]

    if (model === 'tailwind')
      return tailwindAt(hue, shade)

    if (model === 'fitted') {
      const { c, h, l } = tailwindFit.value.predict(shade, hue)
      const maxChroma = maxChromaAt(l, h)
      return {
        chroma: c,
        clipped: !params.gamutMap && c > maxChroma + 1e-4,
        hex: formatHex({ c: params.gamutMap ? Math.min(c, maxChroma) : c, h, l, mode: 'oklch' }),
        l,
        maxChroma,
      }
    }

    if (model === 'current') {
      const chroma = baseChromaByHue(hue) * config.chromaMultiplier
      const maxChroma = maxChromaAt(config.lightness, hue)
      return {
        chroma,
        clipped: chroma > maxChroma + 1e-4,
        hex: chromaticColorFrom(hue, { model: 'classic', shade }).toHex(),
        l: config.lightness,
        maxChroma,
      }
    }

    const l = tunedLightness(hue, shade)
    const base = fourierFit.value ? evalFourier(fourierFit.value, hue) : baseChromaByHue(hue)
    const chroma = base * config.chromaMultiplier * params.chromaScale
    const maxChroma = maxChromaAt(l, hue)
    const outChroma = params.gamutMap ? Math.min(chroma, maxChroma) : chroma

    return {
      chroma,
      clipped: !params.gamutMap && chroma > maxChroma + 1e-4,
      hex: chromaticColorFrom(hue, {
        baseChroma: outChroma / config.chromaMultiplier,
        brightness: l / config.lightness * 100,
        model: 'classic',
        shade,
      }).toHex(),
      l,
      maxChroma,
    }
  }

  return { evaluate, fourierFit, tailwindFit }
}
