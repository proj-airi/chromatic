import type { Shade } from './tailwind-v4'

import { clampChroma, differenceEuclidean } from 'culori'

import { tailwindV4Families } from './tailwind-v4'

const SHADES: Shade[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]

/**
 * Fits smooth hue curves to the Tailwind v4 palette.
 *
 * Every block (lightness, chroma, hue drift) is modelled as
 *
 *   Y(shade, h) = intercept[shade] + Σ_k weight[shade][k] · f_k(h),   f_k(h) = Fourier series in h
 *
 * - `rank: 'per-shade'` gives every shade its own Fourier series. That is linear in the parameters, so it is plain
 *   least squares and solved in one step.
 * - `rank: 1 | 2` shares 1–2 hue curves across all shades, scaled per shade (CSS-friendly: a few curves + weights).
 *   Curves × weights is bilinear, so we use alternating least squares: fix one side, solve the other exactly, repeat.
 *
 * An optional gamut override replaces Tailwind as the target inside a hue window (by default the yellow region, where
 * Tailwind is sparse and runs at or past the sRGB limit): there the chroma target becomes `ratio × sRGB max`, the hue
 * drift fades to 0, and synthetic anchor columns fill the gap between Tailwind's families. Targets change, the model
 * does not, so the fit stays plain least squares.
 */

/**
 * How chroma is fitted.
 *
 * - `absolute`: fit Tailwind's chroma values directly (smooth curves cannot follow the kinks of the sRGB boundary, so
 *   peaks next to them come out low).
 * - `relative`: two stages. First fit the share of the sRGB max that Tailwind uses (smooth, `ratioHarmonics`), then
 *   rebuild `share × exact sRGB max` on a 1° grid and fit that with many harmonics (`harmonics`); the dense, exact
 *   targets let the second stage follow the gamut closely without overfitting Tailwind's 17 samples.
 */
export type ChromaFit
  = | { harmonics: number, mode: 'relative', ratioHarmonics: number }
    | { mode: 'absolute' }

export interface FitBlock {
  /** Fourier coefficients of each shared curve: [const?, cos h, sin h, cos 2h, sin 2h, ...] */
  curves: number[][]
  /** Whether `curves` include the constant term (otherwise the per-shade intercept carries it). */
  curvesHaveConst: boolean
  intercepts: number[]
  predict: (shadeIndex: number, hue: number) => number
  weights: number[][]
}

export type FitRank = 1 | 2 | 'per-shade'

export interface GamutOverride {
  /** Least-squares weight of the synthetic anchors relative to a Tailwind sample. */
  anchorWeight: number
  /** Window centre in degrees. */
  center: number
  /** Target chroma as a fraction of the sRGB max, for shades 50–400. */
  lightRatio: number
  /** Same for shades 500–950. */
  midRatio: number
  /** Full width of the raised-cosine window in degrees. */
  width: number
}

export interface TailwindFit {
  chroma: FitBlock
  hueDrift: FitBlock | null
  lightness: FitBlock
  options: TailwindFitOptions
  predict: (shade: Shade, hue: number) => { c: number, h: number, l: number }
}

export interface TailwindFitOptions {
  /** Defaults to `absolute`. */
  chroma?: ChromaFit
  harmonics: number
  hueDrift: boolean
  override?: GamutOverride | null
  rank: FitRank
}

/**
 * The options `@proj-airi/chromatic`'s `v2` model is generated from (`pnpm run generate:fitted`).
 * Changing them here changes the playground defaults and, after regenerating, the shipped coefficients.
 */
export const DEFAULT_TAILWIND_FIT_OPTIONS = {
  chroma: { harmonics: 12, mode: 'relative', ratioHarmonics: 3 },
  harmonics: 3,
  hueDrift: true,
  override: {
    anchorWeight: 2,
    center: 105,
    lightRatio: 0.82,
    midRatio: 0.95,
    width: 80,
  },
  rank: 2,
} as const satisfies TailwindFitOptions

export interface TailwindSample {
  /** Base hue of the family (its 500 hue); this is what chromatic's single hue input corresponds to. */
  baseHue: number
  c: number
  family: string
  h: number
  l: number
  shade: Shade
  shadeIndex: number
}

const DEG = Math.PI / 180

/** All 17 × 11 Tailwind colours, families sorted by base hue. */
export const tailwindSamples: TailwindSample[] = tailwindV4Families
  .map(family => ({ baseHue: family.shades[500][2], family }))
  .sort((a, b) => a.baseHue - b.baseHue)
  .flatMap(({ baseHue, family }) => SHADES.map((shade, shadeIndex) => {
    const [l, c, h] = family.shades[shade]
    return { baseHue, c, family: family.name, h, l, shade, shadeIndex }
  }))

export const tailwindFamilyOrder: { baseHue: number, name: string }[] = [...new Map(
  tailwindSamples.map(s => [s.family, { baseHue: s.baseHue, name: s.family }]),
).values()]

interface BlockData {
  hues: number[]
  /** values[shadeIndex][column] */
  values: number[][]
  /** Optional least-squares weight per value (same shape as `values`), default 1. */
  weights?: number[][]
}

function dot(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++)
    sum += a[i] * b[i]
  return sum
}

function fitBlock(data: BlockData, columns: number[], rank: FitRank, harmonics: number, intercept: boolean): FitBlock {
  const shadeCount = data.values.length
  // Weighted least squares = ordinary least squares on rows and targets scaled by √weight.
  const root = (s: number, j: number) => Math.sqrt(data.weights?.[s][j] ?? 1)

  if (rank === 'per-shade') {
    const curves = data.values.map((row, s) => leastSquares(
      columns.map(j => fourierBasis(data.hues[j], harmonics, true).map(v => v * root(s, j))),
      columns.map(j => row[j] * root(s, j)),
      1e-7,
    ))
    return {
      curves,
      curvesHaveConst: true,
      intercepts: Array.from<number>({ length: shadeCount }).fill(0),
      predict: (s, hue) => dot(curves[s], fourierBasis(hue, harmonics, true)),
      weights: curves.map((_, s) => curves.map((__, k) => (k === s ? 1 : 0))),
    }
  }

  const withConst = !intercept
  const nb = fourierBasis(0, harmonics, withConst).length
  let weights = Array.from({ length: shadeCount }, (_, s) =>
    Array.from({ length: rank }, (__, k) => (k === 0 ? 1 : 0.1 * (s / shadeCount - 0.5))))
  const intercepts = Array.from<number>({ length: shadeCount }).fill(0)
  let curves: number[][] = []

  for (let iteration = 0; iteration < 80; iteration++) {
    // Fix weights → solve all curve coefficients jointly.
    const rows: number[][] = []
    const targets: number[] = []
    for (let s = 0; s < shadeCount; s++) {
      for (const j of columns) {
        const b = fourierBasis(data.hues[j], harmonics, withConst)
        const w = root(s, j)
        const row: number[] = []
        for (let k = 0; k < rank; k++) {
          for (const v of b)
            row.push(weights[s][k] * v * w)
        }
        rows.push(row)
        targets.push((data.values[s][j] - intercepts[s]) * w)
      }
    }
    const x = leastSquares(rows, targets, 1e-8)
    curves = Array.from({ length: rank }, (_, k) => x.slice(k * nb, (k + 1) * nb))

    // Fix curves → solve per-shade weights (+ intercept).
    weights = weights.map((_, s) => {
      const shadeRows = columns.map((j) => {
        const b = fourierBasis(data.hues[j], harmonics, withConst)
        const r = curves.map(curve => dot(curve, b))
        return (intercept ? [1, ...r] : r).map(v => v * root(s, j))
      })
      const solved = leastSquares(shadeRows, columns.map(j => data.values[s][j] * root(s, j)), 1e-10)
      if (intercept) {
        intercepts[s] = solved[0]
        return solved.slice(1)
      }
      return solved
    })
  }

  return {
    curves,
    curvesHaveConst: withConst,
    intercepts,
    predict: (s, hue) => {
      const b = fourierBasis(hue, harmonics, withConst)
      let sum = intercepts[s]
      for (let k = 0; k < curves.length; k++)
        sum += weights[s][k] * dot(curves[k], b)
      return sum
    },
    weights,
  }
}

function fourierBasis(hue: number, harmonics: number, withConst: boolean): number[] {
  const v = withConst ? [1] : []
  for (let k = 1; k <= harmonics; k++)
    v.push(Math.cos(k * hue * DEG), Math.sin(k * hue * DEG))
  return v
}

/** Least squares via normal equations + a tiny ridge, solved with Gauss–Jordan elimination. */
function leastSquares(rows: number[][], targets: number[], ridge = 1e-9): number[] {
  const n = rows[0].length
  const m = Array.from({ length: n }, () => Array.from<number>({ length: n + 1 }).fill(0))
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    for (let i = 0; i < n; i++) {
      m[i][n] += row[i] * targets[r]
      for (let j = 0; j < n; j++)
        m[i][j] += row[i] * row[j]
    }
  }
  for (let i = 0; i < n; i++)
    m[i][i] += ridge

  for (let i = 0; i < n; i++) {
    let pivot = i
    for (let r = i + 1; r < n; r++) {
      if (Math.abs(m[r][i]) > Math.abs(m[pivot][i]))
        pivot = r
    }
    [m[i], m[pivot]] = [m[pivot], m[i]]
    for (let r = 0; r < n; r++) {
      if (r === i || m[i][i] === 0)
        continue
      const f = m[r][i] / m[i][i]
      for (let c = i; c <= n; c++)
        m[r][c] -= f * m[i][c]
    }
  }
  return m.map((row, i) => (row[i] === 0 ? 0 : row[n] / row[i]))
}

function wrapDegrees(d: number): number {
  return ((d % 360) + 540) % 360 - 180
}

const familyCount = tailwindFamilyOrder.length
const shadeCount = SHADES.length
const familyHues = tailwindFamilyOrder.map(f => f.baseHue)

function matrixOf(pick: (s: TailwindSample) => number): number[][] {
  const rows = Array.from({ length: shadeCount }, () => Array.from<number>({ length: familyCount }).fill(0))
  tailwindSamples.forEach((sample, i) => {
    rows[sample.shadeIndex][Math.floor(i / shadeCount)] = pick(sample)
  })
  return rows
}

const tailwindL = matrixOf(s => s.l)
const tailwindC = matrixOf(s => s.c)
const tailwindDrift = matrixOf(s => wrapDegrees(s.h - s.baseHue))

export interface DeltaEReport {
  max: number
  rms: number
  /** ΔE per sample, same order as `tailwindSamples`. */
  values: number[]
}

interface FitData {
  /** Synthetic columns appended after the 17 families (always used, also during cross-validation). */
  anchorColumns: number[]
  chroma: BlockData
  drift: BlockData
  lightness: BlockData
}

/** Leave-one-family-out: refit without a family, then predict that family. */
export function crossValidateTailwindFit(options: TailwindFitOptions): DeltaEReport {
  const values: number[] = Array.from<number>({ length: tailwindSamples.length }).fill(0)
  for (let j = 0; j < familyCount; j++) {
    const fit = fitTailwind(options, familyHues.map((_, i) => i).filter(i => i !== j))
    for (let s = 0; s < shadeCount; s++) {
      const index = j * shadeCount + s
      const sample = tailwindSamples[index]
      values[index] = deltaE(fit.predict(sample.shade, sample.baseHue), sample)
    }
  }
  return summarize(values)
}

/** OKLab distance × 100 between two OKLCH colours. */
const oklabDifference = differenceEuclidean('oklab')

/** OKLab distance × 100 between two OKLCH colours. */
export function deltaE(a: { c: number, h: number, l: number }, b: { c: number, h: number, l: number }): number {
  return oklabDifference({ ...a, mode: 'oklch' }, { ...b, mode: 'oklch' }) * 100
}

export function fitTailwind(options: TailwindFitOptions, familyColumns = familyHues.map((_, j) => j)): TailwindFit {
  const { harmonics, hueDrift, override, rank } = options
  const data = buildData(override)
  const columns = [...familyColumns, ...data.anchorColumns]
  const lightness = fitBlock(data.lightness, columns, rank, harmonics, true)
  // Hue drift is small and smooth; one shared curve (or per-shade when asked) is plenty.
  const drift = hueDrift ? fitBlock(data.drift, columns, rank === 'per-shade' ? 'per-shade' : 1, Math.min(harmonics, 3), true) : null
  const chroma = options.chroma?.mode === 'relative'
    ? fitRelativeChroma(options.chroma, familyColumns, override, lightness, drift)
    : fitBlock(data.chroma, columns, rank, harmonics, false)

  return {
    chroma,
    hueDrift: drift,
    lightness,
    options,
    predict: (shade, hue) => {
      const s = SHADES.indexOf(shade)
      return {
        c: Math.max(0, chroma.predict(s, hue)),
        h: hue + (drift ? drift.predict(s, hue) : 0),
        l: Math.min(1, Math.max(0, lightness.predict(s, hue))),
      }
    },
  }
}

/** Largest OKLCH chroma that is still inside sRGB at lightness `l` and hue `h` (degrees). */
export function maxSrgbChroma(l: number, h: number): number {
  return clampChroma({ c: 0.5, h, l, mode: 'oklch' }, 'oklch').c
}

/** Raised-cosine weight in [0, 1]: 1 at the centre, 0 outside `width`. */
export function overrideWeight(override: GamutOverride | null | undefined, hue: number): number {
  if (!override)
    return 0
  const half = override.width / 2
  const d = Math.abs(wrapDegrees(hue - override.center))
  return d >= half ? 0 : (1 + Math.cos(Math.PI * d / half)) / 2
}

export function reportAgainstTailwind(predict: (shade: Shade, baseHue: number) => { c: number, h: number, l: number }): DeltaEReport {
  const values = tailwindSamples.map(sample => deltaE(predict(sample.shade, sample.baseHue), sample))
  return summarize(values)
}

/** RMS / max over the samples whose family lies outside the override window (i.e. still meant to match Tailwind). */
export function summarizeOutside(report: DeltaEReport, override: GamutOverride | null | undefined): { max: number, rms: number } {
  const values = report.values.filter((_, i) => overrideWeight(override, tailwindSamples[i].baseHue) === 0)
  return values.length ? summarize(values) : { max: 0, rms: 0 }
}

function buildData(override: GamutOverride | null | undefined): FitData {
  const anchorHues = override
    ? [-0.4, -0.2, 0, 0.2, 0.4].map(f => override.center + f * override.width)
    : []
  const hues = [...familyHues, ...anchorHues]
  const L: number[][] = []
  const C: number[][] = []
  const D: number[][] = []
  const weights = Array.from({ length: shadeCount }, () => hues.map((_, j) => (j < familyCount ? 1 : override?.anchorWeight ?? 1)))

  for (let s = 0; s < shadeCount; s++) {
    const ratio = s <= SHADES.indexOf(400) ? override?.lightRatio ?? 1 : override?.midRatio ?? 1
    L.push([])
    C.push([])
    D.push([])
    hues.forEach((hue, j) => {
      const isFamily = j < familyCount
      const l = isFamily ? tailwindL[s][j] : interpolateFamilies(tailwindL[s], hue)
      const c = isFamily ? tailwindC[s][j] : interpolateFamilies(tailwindC[s], hue)
      const drift = isFamily ? tailwindDrift[s][j] : interpolateFamilies(tailwindDrift[s], hue)
      const w = overrideWeight(override, hue)
      // Inside the window: keep Tailwind's lightness, fade the hue drift out, aim chroma at a share of sRGB.
      const d = (1 - w) * drift
      L[s].push(l)
      D[s].push(d)
      C[s].push(w === 0 ? c : (1 - w) * c + w * ratio * maxChromaAt(l, hue + d))
    })
  }

  return {
    anchorColumns: anchorHues.map((_, k) => familyCount + k),
    chroma: { hues, values: C, weights },
    drift: { hues, values: D, weights },
    lightness: { hues, values: L, weights },
  }
}

/** Linear interpolation of one shade's Tailwind values between the two families around `hue`. */
function interpolateFamilies(row: number[], hue: number): number {
  const h = ((hue % 360) + 360) % 360
  let next = familyHues.findIndex(fh => fh > h)
  if (next < 0)
    next = 0
  const prev = (next - 1 + familyCount) % familyCount
  const span = ((familyHues[next] - familyHues[prev]) + 360) % 360 || 360
  const t = (((h - familyHues[prev]) + 360) % 360) / span
  return row[prev] + (row[next] - row[prev]) * t
}

function maxChromaAt(l: number, h: number): number {
  return maxSrgbChroma(l, h)
}

/** Share of the sRGB max chroma each Tailwind colour uses, at its own lightness and hue. */
let tailwindRatioCache: number[][] | undefined
/**
 * Two-stage chroma fit (see {@link ChromaFit}): share of sRGB per shade with few harmonics, then
 * `share × sRGB max(fitted L, fitted hue)` on a 1° grid with many harmonics. Returns a per-shade block.
 */
function fitRelativeChroma(
  options: Extract<ChromaFit, { mode: 'relative' }>,
  familyColumns: number[],
  override: GamutOverride | null | undefined,
  lightness: FitBlock,
  drift: FitBlock | null,
): FitBlock {
  const ratios = tailwindRatio()
  const anchorHues = override ? [-0.4, -0.2, 0, 0.2, 0.4].map(f => override.center + f * override.width) : []

  const curves = SHADES.map((_, s) => {
    const target = s <= SHADES.indexOf(400) ? override?.lightRatio ?? 1 : override?.midRatio ?? 1

    // Stage 1: share of the sRGB max; inside the override window it is the configured ratio instead of Tailwind's.
    const rows: number[][] = []
    const values: number[] = []
    const push = (hue: number, ratio: number, weight: number) => {
      const w = overrideWeight(override, hue)
      const root = Math.sqrt(weight)
      rows.push(fourierBasis(hue, options.ratioHarmonics, true).map(v => v * root))
      values.push(((1 - w) * ratio + w * target) * root)
    }
    for (const j of familyColumns)
      push(familyHues[j], ratios[s][j], 1)
    for (const hue of anchorHues)
      push(hue, interpolateFamilies(ratios[s], hue), override?.anchorWeight ?? 1)
    const share = leastSquares(rows, values, 1e-8)

    // Stage 2: exact gamut on a uniform 1° grid. On a uniform grid the sines and cosines are orthogonal, so the
    // least-squares Fourier fit is just the truncated DFT: no system to solve.
    const N = 360
    const dense: number[] = []
    for (let hue = 0; hue < N; hue++) {
      const l = Math.min(1, Math.max(0, lightness.predict(s, hue)))
      const h = hue + (drift ? drift.predict(s, hue) : 0)
      dense.push(Math.max(0, dot(share, fourierBasis(hue, options.ratioHarmonics, true))) * maxSrgbChroma(l, h))
    }
    return truncatedDft(dense, options.harmonics)
  })

  return {
    curves,
    curvesHaveConst: true,
    intercepts: Array.from<number>({ length: shadeCount }).fill(0),
    predict: (s, hue) => dot(curves[s], fourierBasis(hue, options.harmonics, true)),
    weights: curves.map((_, s) => curves.map((__, k) => (k === s ? 1 : 0))),
  }
}

function summarize(values: number[]): DeltaEReport {
  const rms = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0) / values.length)
  return { max: Math.max(...values), rms, values }
}

function tailwindRatio(): number[][] {
  tailwindRatioCache ??= matrixOf(s => s.c / Math.max(1e-6, maxSrgbChroma(s.l, s.h)))
  return tailwindRatioCache
}

/** `[a0, a1, b1, a2, b2, …]` of `samples` taken at `0, 1, …, N − 1` degrees over a full turn. */
function truncatedDft(samples: number[], harmonics: number): number[] {
  const n = samples.length
  const coeffs = [samples.reduce((sum, v) => sum + v, 0) / n]
  for (let k = 1; k <= harmonics; k++) {
    let a = 0
    let b = 0
    for (let i = 0; i < n; i++) {
      a += samples[i] * Math.cos(2 * Math.PI * k * i / n)
      b += samples[i] * Math.sin(2 * Math.PI * k * i / n)
    }
    coeffs.push(2 * a / n, 2 * b / n)
  }
  return coeffs
}
