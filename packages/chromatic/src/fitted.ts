import type { Shade } from './index'

import { FITTED_MODEL } from './fitted-coefficients'

/**
 * One fitted quantity (lightness, chroma or hue drift) as a function of shade and hue:
 *
 *   value(shade, h) = intercepts[s] + Σ_k weights[s][k] · fourier(curves[k], h)
 *
 * where `fourier(coeffs, h) = [const] + a1·cos(h) + b1·sin(h) + a2·cos(2h) + b2·sin(2h) + …` with `h` in degrees.
 * When `curvesHaveConst` is `false` the constant lives in `intercepts` instead.
 */
export interface FittedBlock {
  curves: number[][]
  curvesHaveConst: boolean
  intercepts: number[]
  weights: number[][]
}

export interface FittedModel {
  chroma: FittedBlock
  /** Degrees added to the input hue, or `null` when the hue is used as is. */
  hueDrift: FittedBlock | null
  lightness: FittedBlock
  /** Shades the rows of every block refer to, in order. */
  shades: Shade[]
}

export interface FittedOklch {
  /** Chroma, `>= 0`. */
  c: number
  /** Hue in degrees, wrapped to `[0, 360)`. */
  h: number
  /** Lightness in `[0, 1]`. */
  l: number
}

export { FITTED_MODEL }

const DEG = Math.PI / 180

/**
 * Evaluate one fitted block for a shade row.
 *
 * @param block The fitted block.
 * @param shadeIndex Row index into `FITTED_MODEL.shades`.
 * @param hue Hue in degrees.
 */
export function evaluateFittedBlock(block: FittedBlock, shadeIndex: number, hue: number): number {
  let sum = block.intercepts[shadeIndex]
  for (let k = 0; k < block.curves.length; k++)
    sum += block.weights[shadeIndex][k] * fourierSeries(block.curves[k], hue, block.curvesHaveConst)
  return sum
}

/**
 * OKLCH of a shade in the `fitted` model, before brightness / saturation adjustments.
 *
 * The model is a smooth fit of the Tailwind CSS v4 palette over hue, except around yellow (≈ 65°–145°), where it
 * targets a share of the sRGB gamut instead to avoid neon light shades. See `scripts/generate-fitted-coefficients.ts`.
 *
 * @param shade One of `50 | 100 | … | 950`.
 * @param hue Hue in degrees, e.g. `220.25`.
 * @returns `{ l, c, h }` with `l` in `[0, 1]`, `c >= 0` and `h` in `[0, 360)`.
 *
 * @example
 * fittedOklch(500, 220.25) // ≈ { l: 0.701, c: 0.135, h: 220.25 }
 */
export function fittedOklch(shade: Shade, hue: number, model: FittedModel = FITTED_MODEL): FittedOklch {
  const s = model.shades.indexOf(shade)
  const l = evaluateFittedBlock(model.lightness, s, hue)
  const c = evaluateFittedBlock(model.chroma, s, hue)
  const drift = model.hueDrift ? evaluateFittedBlock(model.hueDrift, s, hue) : 0

  return {
    c: Math.max(0, c),
    h: (((hue + drift) % 360) + 360) % 360,
    l: Math.min(1, Math.max(0, l)),
  }
}

/**
 * Evaluate a Fourier series in hue.
 *
 * @param coeffs `[const?, a1, b1, a2, b2, …]`.
 * @param hue Hue in degrees.
 * @param withConst Whether `coeffs` starts with a constant term.
 */
export function fourierSeries(coeffs: number[], hue: number, withConst: boolean): number {
  let i = 0
  let sum = withConst ? coeffs[i++] : 0
  for (let k = 1; i < coeffs.length; k++) {
    sum += coeffs[i++] * Math.cos(k * hue * DEG)
    sum += coeffs[i++] * Math.sin(k * hue * DEG)
  }
  return sum
}
