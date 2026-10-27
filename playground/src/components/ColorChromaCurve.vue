<script setup lang="ts">
import type { Shade } from '@proj-airi/chromatic'

import type { ChromaPoint, Model, TunedParams } from './chroma-model'
import type { DeltaEReport, FitBlock, FitRank } from '../../../scripts/fitted/fit'

import { symbolicShadeConfig, symbolicShadeValues } from '@proj-airi/chromatic'
import { oklch } from 'culori'
import { computed, reactive, ref, watch } from 'vue'

import ColorChromaSurface from './ColorChromaSurface.vue'
import ColorGroup from './ColorGroup.vue'
import ColorHueRange from './ColorHueRange.vue'
import FieldRange from './form/FieldRange.vue'

import { DEG, IDENTITY_PARAMS, maxChromaP3At, MID_WEIGHT, residualColor, residualOf, shadeWeight, SUGGESTED_PARAMS, tailwindFitOptionsOf, tailwindPointsFor, useChromaModel } from './chroma-model'
import { crossValidateTailwindFit, overrideWeight, reportAgainstTailwind, summarizeOutside, tailwindFamilyOrder, tailwindSamples } from '../../../scripts/fitted/fit'

const themeHue = defineModel<number>('hue', { default: 220.25 })

const params = reactive<TunedParams>({ ...SUGGESTED_PARAMS })
const selectedShade = ref<Shade>(500)
const clipFocus = ref<Model>('current')
// Reference overlays: Tailwind v4 (approximated between its 17 families), the model fitted to it, and the P3 boundary
const showTailwind = ref(true)
const showFitted = ref(true)
const showP3 = ref(true)

const { evaluate, fourierFit, tailwindFit } = useChromaModel(params)

function applyParams(next: TunedParams) {
  Object.assign(params, next)
}

// ---------------------------------------------------------------------------
// Models and how each one is drawn
// ---------------------------------------------------------------------------

interface ModelStyle {
  label: string
  short: string
  stroke: string
  fill: string
  tint: string
  text: string
  border: string
  dash?: string
  width: number
}

const MODEL_STYLE: Record<Model, ModelStyle> = {
  current: {
    border: 'border-neutral-900 dark:border-neutral-50',
    fill: 'fill-neutral-900 dark:fill-neutral-50',
    label: 'v1',
    short: 'v1',
    stroke: 'stroke-neutral-900 dark:stroke-neutral-50',
    text: '',
    tint: 'fill-neutral-500/15 dark:fill-neutral-400/15',
    width: 2,
  },
  fitted: {
    border: 'border-teal-600 dark:border-teal-400',
    fill: 'fill-teal-600 dark:fill-teal-400',
    label: 'fitted to tailwind',
    short: 'fit',
    stroke: 'stroke-teal-600 dark:stroke-teal-400',
    text: 'text-teal-600 dark:text-teal-400',
    tint: 'fill-teal-500/15 dark:fill-teal-400/20',
    width: 2,
  },
  tailwind: {
    border: 'border-amber-600 dark:border-amber-400',
    dash: '6 4',
    fill: 'fill-amber-600 dark:fill-amber-400',
    label: 'tailwind v4 ≈',
    short: 'tw≈',
    stroke: 'stroke-amber-600 dark:stroke-amber-400',
    text: 'text-amber-600 dark:text-amber-400',
    tint: 'fill-amber-500/15 dark:fill-amber-400/20',
    width: 1.5,
  },
  tuned: {
    border: 'border-violet-600 dark:border-violet-400',
    fill: 'fill-violet-600 dark:fill-violet-400',
    label: 'tuned',
    short: 'tuned',
    stroke: 'stroke-violet-600 dark:stroke-violet-400',
    text: 'text-violet-600 dark:text-violet-400',
    tint: 'fill-violet-500/15 dark:fill-violet-400/20',
    width: 2,
  },
}

const visibleModels = computed<Model[]>(() => [
  'current',
  'tuned',
  ...(showTailwind.value ? ['tailwind' as const] : []),
  ...(showFitted.value ? ['fitted' as const] : []),
])

/** Marker shape per model, so identity never relies on colour alone. */
function markerPath(model: Model, x: number, y: number): string {
  switch (model) {
    case 'current':
      return `M${x - 4},${y}a4,4 0 1,0 8,0a4,4 0 1,0 -8,0Z`
    case 'tuned':
      return `M${x - 4},${y - 4}h8v8h-8Z`
    case 'tailwind':
      return `M${x},${y - 5.5}l5.5,5.5l-5.5,5.5l-5.5,-5.5Z`
    case 'fitted':
      return `M${x},${y - 5.5}l5.5,9.5h-11Z`
  }
}

// ---------------------------------------------------------------------------
// Chart 1: chroma by hue
// ---------------------------------------------------------------------------

const W = 720
const H = 240
const PAD = { bottom: 24, left: 40, right: 12, top: 12 }
const C_MAX = 0.32
const HUE_STEP = 2
const STRIP_H = 16
const STRIP_GAP = 5

const plotW = W - PAD.left - PAD.right
const plotH = H - PAD.top - PAD.bottom

const xOfHue = (hue: number) => PAD.left + hue / 360 * plotW
const yOfChroma = (chroma: number) => PAD.top + (1 - Math.min(chroma, C_MAX) / C_MAX) * plotH

const yTicks = [0, 0.08, 0.16, 0.24, 0.32]
const xTicks = [0, 60, 120, 180, 240, 300, 360]
const ALL_MODELS: Model[] = ['current', 'tuned', 'tailwind', 'fitted']

interface Sample {
  hue: number
  p3Max: number
  points: Record<Model, ChromaPoint>
}

function pointsAt(hue: number, shade: Shade): Record<Model, ChromaPoint> {
  return Object.fromEntries(ALL_MODELS.map(model => [model, evaluate(model, hue, shade)])) as Record<Model, ChromaPoint>
}

const samples = computed<Sample[]>(() => {
  const list: Sample[] = []
  for (let hue = 0; hue <= 360; hue += HUE_STEP) {
    list.push({
      hue,
      p3Max: maxChromaP3At(symbolicShadeConfig[selectedShade.value].lightness, hue),
      points: pointsAt(hue, selectedShade.value),
    })
  }
  return list
})

function linePath(points: [number, number][]): string {
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join('')
}

function perModel<T>(fn: (model: Model) => T): Record<Model, T> {
  return Object.fromEntries(ALL_MODELS.map(model => [model, fn(model)])) as Record<Model, T>
}

const chromaPaths = computed(() => perModel(m => linePath(samples.value.map(s => [xOfHue(s.hue), yOfChroma(s.points[m].chroma)]))))
const gamutPaths = computed(() => perModel(m => linePath(samples.value.map(s => [xOfHue(s.hue), yOfChroma(s.points[m].maxChroma)]))))
const currentGamutArea = computed(() => `${gamutPaths.value.current}L${xOfHue(360)},${yOfChroma(0)}L${xOfHue(0)},${yOfChroma(0)}Z`)
const p3Path = computed(() => linePath(samples.value.map(s => [xOfHue(s.hue), yOfChroma(s.p3Max)])))
const tailwindDots = computed(() => tailwindPointsFor(selectedShade.value))

// Hue window where the fitted model targets a share of sRGB instead of Tailwind (split when it wraps past 0° / 360°).
const fitOverride = computed(() => tailwindFitOptionsOf(params).override ?? null)
const overrideBands = computed(() => {
  const o = fitOverride.value
  if (!o || !showFitted.value)
    return []
  const start = o.center - o.width / 2
  const end = o.center + o.width / 2
  const bands: [number, number][] = []
  for (const shift of [-360, 0, 360]) {
    const a = Math.max(0, start + shift)
    const b = Math.min(360, end + shift)
    if (b > a)
      bands.push([a, b])
  }
  return bands
})
const clippedRatios = computed(() => perModel(m => samples.value.filter(s => s.points[m].clipped).length / samples.value.length))

// Area between the gamut boundary and a curve, only where the curve exceeds it.
const clipArea = computed(() => {
  const model = clipFocus.value
  const top = samples.value.map(s => [xOfHue(s.hue), yOfChroma(Math.max(s.points[model].chroma, s.points[model].maxChroma))] as [number, number])
  const bottom = samples.value.map(s => [xOfHue(s.hue), yOfChroma(s.points[model].maxChroma)] as [number, number]).reverse()
  return `${linePath([...top, ...bottom])}Z`
})

watch(visibleModels, (models) => {
  if (!models.includes(clipFocus.value))
    clipFocus.value = 'current'
})

const stripTop = H + STRIP_GAP
const totalH = computed(() => stripTop + (STRIP_H + STRIP_GAP) * visibleModels.value.length)

const hoverHue = ref<number | null>(null)
const svgEl = ref<SVGSVGElement | null>(null)

function onPointerMove(event: PointerEvent) {
  if (!svgEl.value)
    return
  const rect = svgEl.value.getBoundingClientRect()
  const x = (event.clientX - rect.left) / rect.width * W
  const hue = (x - PAD.left) / plotW * 360
  hoverHue.value = hue < 0 || hue > 360 ? null : Math.round(hue)
}

const activeHue = computed(() => hoverHue.value ?? themeHue.value)
const activePoints = computed(() => pointsAt(activeHue.value, selectedShade.value))
const tooltipLeft = computed(() => `${Math.min(78, Math.max(22, xOfHue(activeHue.value) / W * 100))}%`)
const tooltipGrid = computed(() => ({ gridTemplateColumns: `auto repeat(${visibleModels.value.length}, minmax(0, 1fr))` }))

// ---------------------------------------------------------------------------
// Lightness by hue
// ---------------------------------------------------------------------------

const LH = 200
const lPlotH = LH - PAD.top - PAD.bottom
const lRange = computed(() => {
  const l = symbolicShadeConfig[selectedShade.value].lightness
  const lo = Math.max(0, Math.floor((l - 0.25) * 20) / 20)
  return { hi: Math.min(1, lo + 0.5), lo }
})
const yOfL = (l: number) => PAD.top + (1 - (Math.min(Math.max(l, lRange.value.lo), lRange.value.hi) - lRange.value.lo) / (lRange.value.hi - lRange.value.lo)) * lPlotH
const lTicks = computed(() => Array.from({ length: 6 }, (_, i) => lRange.value.lo + i * 0.1).filter(t => t <= lRange.value.hi + 1e-6))
const lightnessPaths = computed(() => perModel(m => linePath(samples.value.map(s => [xOfHue(s.hue), yOfL(s.points[m].l)]))))

// ---------------------------------------------------------------------------
// Chart 2: chroma by shade at the current hue
// ---------------------------------------------------------------------------

const shadeRows = computed(() => symbolicShadeValues.map(shade => ({
  points: pointsAt(themeHue.value, shade),
  shade,
})))

const SW = 720
const SH = 180
const SWATCH_H = 22
const sPlotW = SW - PAD.left - PAD.right
const sPlotH = SH - PAD.top - PAD.bottom
const xOfShadeIndex = (i: number) => PAD.left + (i + 0.5) / symbolicShadeValues.length * sPlotW
const yOfShadeChroma = (chroma: number) => PAD.top + (1 - Math.min(chroma, C_MAX) / C_MAX) * sPlotH
const shadeSlotW = sPlotW / symbolicShadeValues.length - 8
const shadeBarW = computed(() => shadeSlotW / visibleModels.value.length - 1)
const shadeSvgH = computed(() => SH + (SWATCH_H + 4) * visibleModels.value.length + 4)
const shadePaths = computed(() => perModel(m => linePath(shadeRows.value.map((r, i) => [xOfShadeIndex(i), yOfShadeChroma(r.points[m].chroma)]))))

function roundedBar(x: number, w: number, y: number, base: number): string {
  const r = Math.min(3, w / 2, Math.max(0, base - y))
  return `M${x},${base}V${y + r}q0,-${r} ${r},-${r}H${x + w - r}q${r},0 ${r},${r}V${base}Z`
}

// ---------------------------------------------------------------------------
// Residual heatmaps (against sRGB): hue × shade
// ---------------------------------------------------------------------------

const HEAT_HUE_STEP = 4
const HEAT_HUES = Array.from({ length: 360 / HEAT_HUE_STEP }, (_, i) => i * HEAT_HUE_STEP)
const HW = 720
const HEAT_ROW_H = 18
const heatPlotW = HW - PAD.left - PAD.right
const heatCellW = heatPlotW / HEAT_HUES.length
const heatH = PAD.top + symbolicShadeValues.length * HEAT_ROW_H + 18

function heatmapFor(model: Model) {
  let over = 0
  let headroom = 0
  let absSum = 0
  const cells = symbolicShadeValues.flatMap((shade, row) => HEAT_HUES.map((hue, col) => {
    const residual = residualOf(evaluate(model, hue, shade))
    if (residual > 0.01)
      over++
    if (residual < -0.25)
      headroom++
    absSum += Math.abs(residual)
    return { col, fill: residualColor(residual), hue, residual, row, shade }
  }))
  const n = cells.length
  return { cells, stats: { headroom: headroom / n, meanAbs: absSum / n, over: over / n } }
}

const heatmaps = computed(() => Object.fromEntries(visibleModels.value.map(m => [m, heatmapFor(m)])) as Record<Model, ReturnType<typeof heatmapFor>>)

// ---------------------------------------------------------------------------
// Fit to Tailwind: ΔE of each model against the 17 × 11 Tailwind colours
// ---------------------------------------------------------------------------

type ComparedModel = 'current' | 'tuned' | 'fitted'
const COMPARED: ComparedModel[] = ['current', 'tuned', 'fitted']
const deltaFocus = ref<ComparedModel>('fitted')

/** What a model actually produces in OKLCH at a family's base hue (white mix included for 50 / 100). */
function producedLch(model: ComparedModel, shade: Shade, baseHue: number) {
  if (model === 'fitted')
    return tailwindFit.value.predict(shade, baseHue)
  const point = evaluate(model, baseHue, shade)
  if (symbolicShadeConfig[shade].mixWithWhite != null) {
    const mixed = oklch(point.hex)!
    return { c: mixed.c, h: mixed.h ?? baseHue, l: mixed.l }
  }
  return { c: point.chroma, h: baseHue, l: point.l }
}

const deltaReports = computed(() => Object.fromEntries(COMPARED.map(m => [
  m,
  reportAgainstTailwind((shade, baseHue) => producedLch(m, shade, baseHue)),
])) as Record<ComparedModel, DeltaEReport>)

// Leave-one-family-out CV is ~100–300 ms, so run it after the sliders settle.
const crossValidation = ref<DeltaEReport | null>(null)
let cvTimer: ReturnType<typeof setTimeout> | undefined
watch(() => JSON.stringify(tailwindFitOptionsOf(params)), () => {
  crossValidation.value = null
  clearTimeout(cvTimer)
  cvTimer = setTimeout(() => {
    crossValidation.value = crossValidateTailwindFit(tailwindFitOptionsOf(params))
  }, 250)
}, { immediate: true })

/** ΔE over the families outside the override window, i.e. where every model is still meant to match Tailwind. */
const deltaOutside = computed(() => Object.fromEntries(COMPARED.map(m => [
  m,
  summarizeOutside(deltaReports.value[m], fitOverride.value),
])) as Record<ComparedModel, { max: number, rms: number }>)
const familyInWindow = computed(() => tailwindFamilyOrder.map(f => overrideWeight(fitOverride.value, f.baseHue) > 0))

const fitParameterCount = computed(() => {
  const fit = tailwindFit.value
  const count = (block: FitBlock | null) => {
    if (!block)
      return 0
    if (block.curvesHaveConst && block.intercepts.every(v => v === 0) && block.curves.length === symbolicShadeValues.length)
      return block.curves.flat().length
    return block.curves.flat().length + block.weights.flat().length + (block.curvesHaveConst ? 0 : block.intercepts.length)
  }
  return count(fit.lightness) + count(fit.chroma) + count(fit.hueDrift)
})

const DW = 720
const D_LEFT = 40
const D_TOP = 34
const D_ROW_H = 18
const dCellW = (DW - D_LEFT - PAD.right) / tailwindFamilyOrder.length
const dH = D_TOP + symbolicShadeValues.length * D_ROW_H + 6
const D_MAX = 8

/** Sequential, single hue: light (ΔE 0) → dark (ΔE ≥ 8). */
function deltaFill(value: number): string {
  const t = Math.min(1, value / D_MAX)
  return `oklch(${(0.96 - t * 0.5).toFixed(3)} ${(0.02 + t * 0.13).toFixed(3)} 35)`
}

const deltaCells = computed(() => {
  const values = deltaReports.value[deltaFocus.value].values
  return tailwindSamples.map((sample, i) => ({
    col: Math.floor(i / symbolicShadeValues.length),
    family: sample.family,
    row: sample.shadeIndex,
    shade: sample.shade,
    value: values[i],
  }))
})

// ---------------------------------------------------------------------------
// Palette grid
// ---------------------------------------------------------------------------

const GRID_HUES = Array.from({ length: 18 }, (_, i) => i * 20)
const gridRows = computed(() => GRID_HUES.map(hue => ({
  hue,
  palettes: perModel(m => symbolicShadeValues.map(shade => evaluate(m, hue, shade).hex)),
})))
const paletteGrid = computed(() => ({ gridTemplateColumns: `auto repeat(${visibleModels.value.length}, minmax(0, 1fr))` }))

// ---------------------------------------------------------------------------
// Exported formulas
// ---------------------------------------------------------------------------

const formulaModel = ref<'tuned' | 'fitted'>('fitted')
const fmt = (n: number) => Number(n.toFixed(5)).toString()
const CSS_H = 'var(--chromatic-hue) * 3.14159265 / 180'

// Full width at half maximum of cos^(2k)(d / 2), in degrees.
const bumpFwhm = computed(() => 4 * Math.acos(2 ** (-1 / (2 * params.bumpSharpness))) / DEG)

const tunedTs = computed(() => {
  const lines: string[] = []
  if (fourierFit.value) {
    const { a, b } = fourierFit.value
    lines.push(`// chroma: ${params.fitHarmonics}-harmonic fit, ${Math.round(params.fitRatio * 100)}% of sRGB (${params.fitTarget === '500' ? 'shade 500' : '400–700 envelope'})`)
    lines.push(`const CHROMA_A = [${a.map(fmt).join(', ')}]`)
    lines.push(`const CHROMA_B = [${b.map(fmt).join(', ')}]`)
    lines.push('export function baseChromaByHue(h: number): number {')
    lines.push('  let c = 0')
    lines.push('  for (let k = 0; k < CHROMA_A.length; k++)')
    lines.push('    c += CHROMA_A[k] * Math.cos(k * h * Math.PI / 180) + CHROMA_B[k] * Math.sin(k * h * Math.PI / 180)')
    lines.push(params.chromaScale === 1 ? '  return c' : `  return c * ${fmt(params.chromaScale)}`)
    lines.push('}')
  }
  if (params.bumpAmount > 0) {
    if (lines.length)
      lines.push('')
    lines.push('// lightness: L + amount * bump(h) * 4L(1 - L) / (4 * 0.62 * 0.38)')
    lines.push(`const bump = (h: number) => ((1 + Math.cos((h - ${fmt(params.bumpCenter)}) * Math.PI / 180)) / 2) ** ${params.bumpSharpness}`)
    lines.push(`const tunedL = (L: number, h: number) => L + ${fmt(params.bumpAmount)} * bump(h) * 4 * L * (1 - L) / ${fmt(MID_WEIGHT)}`)
  }
  return lines.join('\n') || '// identical to the v1 model'
})

const tunedCss = computed(() => {
  const lines: string[] = []
  if (fourierFit.value) {
    const { a, b } = fourierFit.value
    const terms = [fmt(a[0])]
    for (let k = 1; k < a.length; k++) {
      const angle = k === 1 ? CSS_H : `${k} * ${CSS_H}`
      terms.push(`${fmt(a[k])} * cos(${angle})`)
      terms.push(`${fmt(b[k])} * sin(${angle})`)
    }
    lines.push(`--chromatic-chroma: calc(\n  (${terms.join('\n    + ')})${params.chromaScale === 1 ? '' : ` * ${fmt(params.chromaScale)}`}\n);`)
  }
  if (params.bumpAmount > 0) {
    lines.push(`--chromatic-l-bump: pow(calc((1 + cos((var(--chromatic-hue) - ${fmt(params.bumpCenter)}) * 3.14159265 / 180)) / 2), ${params.bumpSharpness});`)
    const weights = symbolicShadeValues.map(shade => `${shade}: ${fmt(shadeWeight(symbolicShadeConfig[shade].lightness))}`).join(', ')
    lines.push(`/* per shade: L% + ${fmt(params.bumpAmount * 100)}% * weight * var(--chromatic-l-bump)\n   weights { ${weights} } */`)
  }
  return lines.join('\n') || '/* identical to the v1 model */'
})

function fourierCss(coeffs: number[], withConst: boolean): string {
  const terms: string[] = []
  let i = 0
  if (withConst)
    terms.push(fmt(coeffs[i++]))
  for (let k = 1; i < coeffs.length; k++) {
    const angle = k === 1 ? CSS_H : `${k} * ${CSS_H}`
    terms.push(`${fmt(coeffs[i++])} * cos(${angle})`)
    terms.push(`${fmt(coeffs[i++])} * sin(${angle})`)
  }
  return terms.join(' + ').replaceAll('+ -', '- ')
}

function blockCss(name: string, block: FitBlock, wrap: (expr: string) => string): string[] {
  const lines: string[] = []
  const perShade = block.curves.length === symbolicShadeValues.length && block.curvesHaveConst
  if (perShade) {
    symbolicShadeValues.forEach((shade, s) => lines.push(`--chromatic-${name}-${shade}: ${wrap(`calc(${fourierCss(block.curves[s], true)})`)};`))
    return lines
  }
  block.curves.forEach((curve, k) => lines.push(`--chromatic-${name}-f${k + 1}: calc(${fourierCss(curve, block.curvesHaveConst)});`))
  symbolicShadeValues.forEach((shade, s) => {
    const terms = block.curves.map((_, k) => `${fmt(block.weights[s][k])} * var(--chromatic-${name}-f${k + 1})`)
    if (!block.curvesHaveConst)
      terms.unshift(fmt(block.intercepts[s]))
    lines.push(`--chromatic-${name}-${shade}: ${wrap(`calc(${terms.join(' + ').replaceAll('+ -', '- ')})`)};`)
  })
  return lines
}

function blockTs(name: string, block: FitBlock): string {
  return `const ${name} = ${JSON.stringify({
    curves: block.curves.map(c => c.map(v => +fmt(v))),
    curvesHaveConst: block.curvesHaveConst,
    intercepts: block.intercepts.map(v => +fmt(v)),
    weights: block.weights.map(w => w.map(v => +fmt(v))),
  })}`
}

const fittedTs = computed(() => {
  const fit = tailwindFit.value
  const { harmonics, hueDrift, rank } = fit.options
  return [
    `// fitted to Tailwind v4: ${rank === 'per-shade' ? 'per-shade Fourier' : `rank ${rank}`}, ${harmonics} harmonics${hueDrift ? ', with hue drift' : ''}`,
    '// value(shade, h) = intercepts[s] + Σ_k weights[s][k] · fourier(curves[k], h)',
    blockTs('LIGHTNESS', fit.lightness),
    blockTs('CHROMA', fit.chroma),
    fit.hueDrift ? blockTs('HUE_DRIFT', fit.hueDrift) : '',
    '',
    'function fourier(coeffs: number[], h: number, withConst: boolean): number {',
    '  let i = 0',
    '  let sum = withConst ? coeffs[i++] : 0',
    '  for (let k = 1; i < coeffs.length; k++)',
    '    sum += coeffs[i++] * Math.cos(k * h * Math.PI / 180) + coeffs[i++] * Math.sin(k * h * Math.PI / 180)',
    '  return sum',
    '}',
    '',
    'function evalBlock(block: typeof LIGHTNESS, s: number, h: number): number {',
    '  return block.intercepts[s] + block.curves.reduce((sum, curve, k) => sum + block.weights[s][k] * fourier(curve, h, block.curvesHaveConst), 0)',
    '}',
  ].filter((line, i, all) => line !== '' || all[i - 1] !== '').join('\n')
})

const fittedCss = computed(() => {
  const fit = tailwindFit.value
  return [
    '/* fitted to Tailwind v4; use as oklch(var(--chromatic-l-<shade>) var(--chromatic-c-<shade>) var(--chromatic-h-<shade>)) */',
    ...blockCss('l', fit.lightness, e => e),
    ...blockCss('c', fit.chroma, e => `max(0, ${e})`),
    ...(fit.hueDrift
      ? blockCss('h', fit.hueDrift, e => `calc(var(--chromatic-hue) + ${e})`)
      : symbolicShadeValues.map(shade => `--chromatic-h-${shade}: var(--chromatic-hue);`)),
  ].join('\n')
})

const tsSnippet = computed(() => formulaModel.value === 'tuned' ? tunedTs.value : fittedTs.value)
const cssSnippet = computed(() => formulaModel.value === 'tuned' ? tunedCss.value : fittedCss.value)

const copied = ref<string | null>(null)
async function copy(kind: 'ts' | 'css') {
  await navigator.clipboard.writeText(kind === 'ts' ? tsSnippet.value : cssSnippet.value)
  copied.value = kind
  setTimeout(() => copied.value = null, 1200)
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

function getShadeItemClass(_shade: string | number, checked: boolean) {
  return [
    checked ? 'bg-neutral-800 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-800',
  ]
}

const segmentClass = (active: boolean) => [
  'px-2 py-0.5 rounded-md transition-colors',
  active ? 'bg-neutral-800 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900' : 'hover:bg-neutral-200 dark:hover:bg-neutral-700',
]

const RANK_OPTIONS: { label: string, value: FitRank }[] = [
  { label: '1 curve', value: 1 },
  { label: '2 curves', value: 2 },
  { label: 'per shade', value: 'per-shade' },
]
</script>

<template>
  <div class="chroma-lab">
    <!-- Controls -->
    <aside class="chroma-lab__controls" rounded-xl p-4 bg="neutral-100/70 dark:neutral-800/50" flex flex-col gap-4>
      <div flex flex-wrap items-center justify-between gap-2>
        <div font-mono text-sm>
          Chroma lab
        </div>
        <div flex gap-2 text-xs font-mono>
          <button :class="segmentClass(false)" bg="white dark:neutral-900" @click="applyParams({ ...IDENTITY_PARAMS })">
            Reset tuned
          </button>
          <button :class="segmentClass(false)" bg="white dark:neutral-900" @click="applyParams({ ...SUGGESTED_PARAMS })">
            Suggested
          </button>
        </div>
      </div>

      <div flex flex-col gap-2>
        <div flex items-baseline justify-between text-xs font-mono>
          <span font-bold tracking-wide uppercase text="neutral-500 dark:neutral-400">Hue</span>
          <code>{{ themeHue.toFixed(2) }}°</code>
        </div>
        <ColorHueRange v-model:colorValue="themeHue" class="w-full" />
      </div>

      <div flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono>
        <span font-bold tracking-wide uppercase text="neutral-500 dark:neutral-400">Show</span>
        <label flex cursor-pointer items-center gap-1.5>
          <input v-model="showTailwind" type="checkbox"> <span :class="MODEL_STYLE.tailwind.text">Tailwind v4 ≈</span>
        </label>
        <label flex cursor-pointer items-center gap-1.5>
          <input v-model="showFitted" type="checkbox"> <span :class="MODEL_STYLE.fitted.text">fitted</span>
        </label>
        <label flex cursor-pointer items-center gap-1.5>
          <input v-model="showP3" type="checkbox"> P3 boundary
        </label>
      </div>

      <div class="chroma-lab__fieldsets">
        <fieldset m-0 flex flex-col gap-2 border-none p-0>
          <legend mb-1 text-xs font-bold tracking-wide uppercase :class="MODEL_STYLE.fitted.text">
            Fit to Tailwind
          </legend>
          <div class="chroma-control">
            <span>shape</span>
            <div flex flex-wrap gap-1 text-xs font-mono>
              <button v-for="option in RANK_OPTIONS" :key="String(option.value)" :class="segmentClass(params.twRank === option.value)" @click="params.twRank = option.value">
                {{ option.label }}
              </button>
            </div>
            <span />
          </div>
          <FieldRange
            v-model="params.twHarmonics"
            as="div" :label="params.twChromaMode === 'relative' ? 'L / drift harmonics' : 'harmonics'"
            :min="1" :max="5" :step="1"
            :default-value="SUGGESTED_PARAMS.twHarmonics"
            :format-value="() => `${params.twHarmonics}`"
          />
          <div class="chroma-control">
            <span>chroma fit</span>
            <div flex gap-1 text-xs font-mono>
              <button :class="segmentClass(params.twChromaMode === 'absolute')" title="fit Tailwind's chroma values directly" @click="params.twChromaMode = 'absolute'">
                absolute
              </button>
              <button :class="segmentClass(params.twChromaMode === 'relative')" title="fit the share of sRGB, then the exact gamut" @click="params.twChromaMode = 'relative'">
                share of sRGB
              </button>
            </div>
            <span />
          </div>
          <template v-if="params.twChromaMode === 'relative'">
            <FieldRange
              v-model="params.twRatioHarmonics"
              as="div" label="share harmonics"
              :min="1" :max="5" :step="1"
              :default-value="SUGGESTED_PARAMS.twRatioHarmonics"
              :format-value="() => `${params.twRatioHarmonics}`"
            />
            <FieldRange
              v-model="params.twChromaHarmonics"
              as="div" label="gamut harmonics"
              :min="2" :max="24" :step="1"
              :default-value="SUGGESTED_PARAMS.twChromaHarmonics"
              :format-value="() => `${params.twChromaHarmonics}`"
            />
          </template>
          <label class="chroma-control">
            <span>hue drift</span>
            <input v-model="params.twHueDrift" type="checkbox" justify-self-start>
            <code>{{ params.twHueDrift ? 'fitted' : 'off' }}</code>
          </label>
          <label class="chroma-control">
            <span>sRGB window</span>
            <input v-model="params.twOverride" type="checkbox" justify-self-start>
            <code>{{ params.twOverride ? 'share of sRGB' : 'off (all Tailwind)' }}</code>
          </label>
          <template v-if="params.twOverride">
            <FieldRange
              v-model="params.twOverrideCenter"
              as="div" label="window center"
              :min="0" :max="360" :step="1"
              :default-value="SUGGESTED_PARAMS.twOverrideCenter"
              :format-value="() => `${params.twOverrideCenter}°`"
            />
            <FieldRange
              v-model="params.twOverrideWidth"
              as="div" label="window width"
              :min="20" :max="180" :step="5"
              :default-value="SUGGESTED_PARAMS.twOverrideWidth"
              :format-value="() => `${params.twOverrideWidth}°`"
            />
            <FieldRange
              v-model="params.twOverrideLightRatio"
              as="div" label="50–400 % of sRGB"
              :min="0.5" :max="1.1" :step="0.01"
              :default-value="SUGGESTED_PARAMS.twOverrideLightRatio"
              :format-value="() => `${Math.round(params.twOverrideLightRatio * 100)}%`"
            />
            <FieldRange
              v-model="params.twOverrideMidRatio"
              as="div" label="500–950 % of sRGB"
              :min="0.5" :max="1.1" :step="0.01"
              :default-value="SUGGESTED_PARAMS.twOverrideMidRatio"
              :format-value="() => `${Math.round(params.twOverrideMidRatio * 100)}%`"
            />
            <FieldRange
              v-model="params.twOverrideAnchorWeight"
              as="div" label="anchor weight"
              :min="0" :max="6" :step="0.5"
              :default-value="SUGGESTED_PARAMS.twOverrideAnchorWeight"
              :format-value="() => `×${params.twOverrideAnchorWeight}`"
            />
          </template>
          <div text-xs font-mono text="neutral-500 dark:neutral-400">
            ΔE fit {{ deltaReports.fitted.rms.toFixed(2) }} · CV {{ crossValidation ? crossValidation.rms.toFixed(2) : '…' }} · {{ fitParameterCount }} params
          </div>
        </fieldset>

        <fieldset m-0 flex flex-col gap-2 border-none p-0>
          <legend mb-1 text-xs font-bold tracking-wide uppercase :class="MODEL_STYLE.tuned.text">
            Tuned · lightness bump
          </legend>
          <FieldRange
            v-model="params.bumpAmount"
            as="div" label="amount ΔL"
            :min="0" :max="0.15" :step="0.005"
            :default-value="SUGGESTED_PARAMS.bumpAmount"
            :format-value="() => `${params.bumpAmount.toFixed(3)}`"
          />
          <FieldRange
            v-model="params.bumpCenter"
            as="div" label="center"
            :min="0" :max="360" :step="1"
            :default-value="SUGGESTED_PARAMS.bumpCenter"
            :format-value="() => `${params.bumpCenter}°`"
          />
          <FieldRange
            v-model="params.bumpSharpness"
            as="div" label="sharpness k"
            :min="1" :max="24" :step="1"
            :default-value="SUGGESTED_PARAMS.bumpSharpness"
            :format-value="() => `${params.bumpSharpness} (~${bumpFwhm.toFixed(0)}° wide)`"
          />
        </fieldset>

        <fieldset m-0 flex flex-col gap-2 border-none p-0>
          <legend mb-1 text-xs font-bold tracking-wide uppercase :class="MODEL_STYLE.tuned.text">
            Tuned · chroma curve
          </legend>
          <label class="chroma-control">
            <span>fit to sRGB</span>
            <input v-model="params.fitEnabled" type="checkbox" justify-self-start>
            <code>{{ params.fitEnabled ? 'Fourier fit' : 'cos (v1)' }}</code>
          </label>
          <FieldRange
            v-model="params.fitHarmonics"
            as="div" label="harmonics"
            :min="1" :max="8" :step="1"
            :default-value="SUGGESTED_PARAMS.fitHarmonics"
            :format-value="() => `${params.fitHarmonics}`"
            :class="{ 'op-40 pointer-events-none': !params.fitEnabled }"
          />
          <FieldRange
            v-model="params.fitRatio"
            as="div" label="% of sRGB max"
            :min="0.6" :max="1.2" :step="0.01"
            :default-value="SUGGESTED_PARAMS.fitRatio"
            :format-value="() => `${Math.round(params.fitRatio * 100)}%`"
            :class="{ 'op-40 pointer-events-none': !params.fitEnabled }"
          />
          <div class="chroma-control" :class="{ 'op-40 pointer-events-none': !params.fitEnabled }">
            <span>fit target</span>
            <div flex gap-1 text-xs font-mono>
              <button :class="segmentClass(params.fitTarget === '500')" @click="params.fitTarget = '500'">
                500
              </button>
              <button :class="segmentClass(params.fitTarget === 'envelope')" @click="params.fitTarget = 'envelope'">
                400–700
              </button>
            </div>
            <span />
          </div>
          <FieldRange
            v-model="params.chromaScale"
            as="div" label="chroma scale"
            :min="0.5" :max="1.5" :step="0.01"
            :default-value="SUGGESTED_PARAMS.chromaScale"
            :format-value="() => `×${params.chromaScale.toFixed(2)}`"
          />
          <label class="chroma-control">
            <span>gamut map</span>
            <input v-model="params.gamutMap" type="checkbox" justify-self-start>
            <code>{{ params.gamutMap ? 'clamp chroma' : 'channel clip' }}</code>
          </label>
        </fieldset>
      </div>
    </aside>

    <div class="chroma-lab__charts-wrap">
      <div class="chroma-lab__charts">
        <!-- Chart 1: chroma by hue -->
        <div class="chroma-card">
          <div class="mb-2 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div font-mono text-sm>
              Chroma by hue · shade {{ selectedShade }} (L = {{ symbolicShadeConfig[selectedShade].lightness }})
            </div>
            <div text="xs neutral-500 dark:neutral-400">
              out of sRGB:
              <template v-for="(m, i) in visibleModels" :key="`cr-${m}`">
                <span :class="MODEL_STYLE[m].text">{{ MODEL_STYLE[m].short }} {{ (clippedRatios[m] * 100).toFixed(0) }}%</span><span v-if="i < visibleModels.length - 1"> · </span>
              </template>
            </div>
          </div>

          <ColorGroup
            v-model="selectedShade"
            :options="symbolicShadeValues"
            ariaLabel="Select shade for chroma curve"
            :item-class="getShadeItemClass"
            :wrap="true"
          >
            <template #option="{ option }">
              <span text-xs font-mono>{{ option }}</span>
            </template>
          </ColorGroup>

          <div mt-2 flex flex-wrap items-center gap-2 text-xs font-mono>
            <span text="neutral-500 dark:neutral-400">highlight clipping of</span>
            <button v-for="m in visibleModels" :key="`cf-${m}`" :class="segmentClass(clipFocus === m)" @click="clipFocus = m">
              {{ MODEL_STYLE[m].short }}
            </button>
          </div>

          <div relative mt-3>
            <svg
              ref="svgEl"
              :viewBox="`0 0 ${W} ${totalH}`"
              class="block h-auto w-full touch-none select-none"
              role="img"
              aria-label="Chroma curve by hue compared with the sRGB gamut boundary"
              @pointermove="onPointerMove"
              @pointerleave="hoverHue = null"
            >
              <defs>
                <pattern id="chroma-clip-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="6" height="6" class="fill-red-500/15" />
                  <line x1="0" y1="0" x2="0" y2="6" stroke-width="2" class="stroke-red-500/70" />
                </pattern>
              </defs>

              <g class="text-neutral-400 dark:text-neutral-500" style="font-size: 10px; font-family: DM Mono, monospace">
                <g v-for="t in yTicks" :key="`y${t}`">
                  <line :x1="PAD.left" :x2="W - PAD.right" :y1="yOfChroma(t)" :y2="yOfChroma(t)" stroke="currentColor" stroke-opacity="0.25" />
                  <text :x="PAD.left - 6" :y="yOfChroma(t) + 3" text-anchor="end" fill="currentColor">{{ t.toFixed(2) }}</text>
                </g>
                <text v-for="t in xTicks" :key="`x${t}`" :x="xOfHue(t)" :y="H - 6" text-anchor="middle" fill="currentColor">{{ t }}°</text>
              </g>

              <rect
                v-for="([a, b], i) in overrideBands" :key="`ob${i}`"
                :x="xOfHue(a)" :y="PAD.top" :width="xOfHue(b) - xOfHue(a)" :height="plotH" class="fill-teal-500/8 dark:fill-teal-400/10"
              >
                <title>fitted model targets {{ Math.round(params.twOverrideLightRatio * 100) }}% / {{ Math.round(params.twOverrideMidRatio * 100) }}% of sRGB here instead of Tailwind</title>
              </rect>
              <path :d="currentGamutArea" class="fill-neutral-500/10 dark:fill-neutral-400/10" />
              <path :d="gamutPaths.current" fill="none" stroke-width="1.5" stroke-dasharray="4 3" class="stroke-neutral-500 dark:stroke-neutral-400" />
              <path v-if="params.bumpAmount > 0" :d="gamutPaths.tuned" fill="none" stroke-width="1.2" stroke-dasharray="4 3" class="stroke-violet-400/80 dark:stroke-violet-300/70" />
              <path v-if="showP3" :d="p3Path" fill="none" stroke-width="1.5" stroke-dasharray="1 3" stroke-linecap="round" class="stroke-neutral-400 dark:stroke-neutral-500" />

              <path :d="clipArea" fill="url(#chroma-clip-hatch)" />

              <path
                v-for="m in visibleModels" :key="`cp-${m}`"
                :d="chromaPaths[m]" fill="none" stroke-linejoin="round"
                :stroke-width="MODEL_STYLE[m].width" :stroke-dasharray="MODEL_STYLE[m].dash" :class="MODEL_STYLE[m].stroke"
              />
              <g v-if="showTailwind">
                <rect
                  v-for="dot in tailwindDots" :key="`tw${dot.name}`"
                  :x="xOfHue(dot.h) - 4.5" :y="yOfChroma(dot.c) - 4.5" width="9" height="9" :fill="dot.hex" stroke-width="1.5"
                  :transform="`rotate(45 ${xOfHue(dot.h)} ${yOfChroma(dot.c)})`"
                  class="stroke-white dark:stroke-neutral-900"
                >
                  <title>{{ dot.name }}-{{ selectedShade }}: oklch({{ (dot.l * 100).toFixed(1) }}% {{ dot.c }} {{ dot.h }})</title>
                </rect>
              </g>

              <g>
                <template v-for="(m, row) in visibleModels" :key="`strip-${m}`">
                  <rect
                    v-for="s in samples" :key="`${m}${s.hue}`"
                    :x="xOfHue(s.hue)" :y="stripTop + (STRIP_H + STRIP_GAP) * row" :width="plotW / 360 * HUE_STEP + 0.5" :height="STRIP_H" :fill="s.points[m].hex"
                  />
                  <text
                    :x="PAD.left - 6" :y="stripTop + (STRIP_H + STRIP_GAP) * row + 11" text-anchor="end"
                    class="fill-neutral-500 dark:fill-neutral-400" style="font-size: 9px; font-family: DM Mono, monospace"
                  >{{ MODEL_STYLE[m].short }}</text>
                </template>
              </g>

              <line
                :x1="xOfHue(activeHue)" :x2="xOfHue(activeHue)" :y1="PAD.top" :y2="totalH - 2"
                stroke-width="1" class="stroke-neutral-900/60 dark:stroke-neutral-50/60"
              />
              <path
                v-for="m in visibleModels" :key="`am-${m}`"
                :d="markerPath(m, xOfHue(activeHue), yOfChroma(activePoints[m].chroma))"
                stroke-width="1.5" :class="[MODEL_STYLE[m].fill, 'stroke-white dark:stroke-neutral-900']"
              />
            </svg>

            <div
              class="pointer-events-none absolute top-2 z-1 rounded-lg px-3 py-2 text-xs font-mono shadow-md -translate-x-1/2"
              bg="white/90 dark:neutral-900/90" backdrop-blur-sm
              :style="{ left: tooltipLeft, minWidth: `${6 + visibleModels.length * 4.5}rem` }"
            >
              <div mb-1 font-bold>
                h {{ activeHue.toFixed(activeHue % 1 ? 2 : 0) }}°
              </div>
              <div grid gap-x-3 :style="tooltipGrid">
                <span />
                <span v-for="m in visibleModels" :key="`th-${m}`" text-right :class="MODEL_STYLE[m].text">{{ MODEL_STYLE[m].short }}</span>
                <span text="neutral-500 dark:neutral-400">L</span>
                <span v-for="m in visibleModels" :key="`tl-${m}`" text-right>{{ activePoints[m].l.toFixed(3) }}</span>
                <span text="neutral-500 dark:neutral-400">C</span>
                <span v-for="m in visibleModels" :key="`tc-${m}`" text-right>{{ activePoints[m].chroma.toFixed(3) }}</span>
                <span text="neutral-500 dark:neutral-400">max</span>
                <span v-for="m in visibleModels" :key="`tm-${m}`" text-right>{{ activePoints[m].maxChroma.toFixed(3) }}</span>
                <span />
                <span v-for="m in visibleModels" :key="`tx-${m}`" flex items-center justify-end gap-1>
                  <span inline-block size-3 shrink-0 rounded-sm :style="{ background: activePoints[m].hex }" />
                  <span v-if="activePoints[m].clipped" text="red-600 dark:red-400">!</span>
                </span>
              </div>
            </div>
          </div>

          <div mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text="neutral-600 dark:neutral-300">
            <span v-for="m in visibleModels" :key="`lg-${m}`" flex items-center gap-1.5>
              <span inline-block w-4 border-t-2 :class="[MODEL_STYLE[m].border, MODEL_STYLE[m].dash ? 'border-dashed' : '']" />{{ MODEL_STYLE[m].label }}
            </span>
            <span flex items-center gap-1.5><span inline-block w-4 border-t-2 border-dashed border="neutral-500 dark:neutral-400" />sRGB max (v1 L)</span>
            <span v-if="params.bumpAmount > 0" flex items-center gap-1.5><span inline-block w-4 border-t-2 border-dashed border="violet-400 dark:violet-300" />sRGB max (tuned L)</span>
            <span v-if="showP3" flex items-center gap-1.5><span inline-block w-4 border-t-2 border-dotted border="neutral-400 dark:neutral-500" />P3 max (v1 L)</span>
            <span v-if="showTailwind">◆ = actual Tailwind families</span>
            <span v-if="overrideBands.length" flex items-center gap-1.5><span inline-block size-3 rounded-sm bg="teal-500/15 dark:teal-400/20" />fit targets sRGB share, not Tailwind</span>
            <span flex items-center gap-1.5><span inline-block size-3 rounded-sm class="chroma-clip-swatch" />exceeds sRGB → channel-clipped</span>
          </div>
        </div>

        <!-- Lightness by hue -->
        <div class="chroma-card">
          <div class="mb-2 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div font-mono text-sm>
              Lightness by hue · shade {{ selectedShade }}
            </div>
            <div text="xs neutral-500 dark:neutral-400">
              v1 L is fixed per shade; the others vary with hue
            </div>
          </div>
          <svg :viewBox="`0 0 ${W} ${LH}`" class="block h-auto w-full" role="img" aria-label="OKLCH lightness by hue for the selected shade">
            <g class="text-neutral-400 dark:text-neutral-500" style="font-size: 10px; font-family: DM Mono, monospace">
              <g v-for="t in lTicks" :key="`ly${t}`">
                <line :x1="PAD.left" :x2="W - PAD.right" :y1="yOfL(t)" :y2="yOfL(t)" stroke="currentColor" stroke-opacity="0.25" />
                <text :x="PAD.left - 6" :y="yOfL(t) + 3" text-anchor="end" fill="currentColor">{{ t.toFixed(2) }}</text>
              </g>
              <text v-for="t in xTicks" :key="`lx${t}`" :x="xOfHue(t)" :y="LH - 6" text-anchor="middle" fill="currentColor">{{ t }}°</text>
            </g>
            <path
              v-for="m in visibleModels" :key="`lp-${m}`"
              :d="lightnessPaths[m]" fill="none" stroke-linejoin="round"
              :stroke-width="MODEL_STYLE[m].width" :stroke-dasharray="MODEL_STYLE[m].dash" :class="MODEL_STYLE[m].stroke"
            />
            <g v-if="showTailwind">
              <rect
                v-for="dot in tailwindDots" :key="`lw${dot.name}`"
                :x="xOfHue(dot.h) - 4.5" :y="yOfL(dot.l) - 4.5" width="9" height="9" :fill="dot.hex" stroke-width="1.5"
                :transform="`rotate(45 ${xOfHue(dot.h)} ${yOfL(dot.l)})`"
                class="stroke-white dark:stroke-neutral-900"
              >
                <title>{{ dot.name }}-{{ selectedShade }}: L {{ (dot.l * 100).toFixed(1) }}%</title>
              </rect>
            </g>
            <line
              :x1="xOfHue(themeHue)" :x2="xOfHue(themeHue)" :y1="PAD.top" :y2="LH - PAD.bottom"
              stroke-width="1" class="stroke-neutral-900/60 dark:stroke-neutral-50/60"
            />
          </svg>
          <div mt-1 text-xs text="neutral-500 dark:neutral-400">
            Uses the shade picked in the chroma-by-hue chart.
          </div>
        </div>

        <!-- Chart 2: chroma by shade -->
        <div class="chroma-card">
          <div class="mb-2 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div font-mono text-sm>
              Chroma by shade · hue {{ themeHue.toFixed(2) }}°
            </div>
            <div text="xs neutral-500 dark:neutral-400">
              bars = sRGB max at each model's L, lines = chroma
            </div>
          </div>

          <svg :viewBox="`0 0 ${SW} ${shadeSvgH}`" class="block h-auto w-full" role="img" aria-label="Chroma by shade at the current hue">
            <g class="text-neutral-400 dark:text-neutral-500" style="font-size: 10px; font-family: DM Mono, monospace">
              <g v-for="t in yTicks" :key="`sy${t}`">
                <line :x1="PAD.left" :x2="SW - PAD.right" :y1="yOfShadeChroma(t)" :y2="yOfShadeChroma(t)" stroke="currentColor" stroke-opacity="0.25" />
                <text :x="PAD.left - 6" :y="yOfShadeChroma(t) + 3" text-anchor="end" fill="currentColor">{{ t.toFixed(2) }}</text>
              </g>
            </g>

            <g v-for="(row, i) in shadeRows" :key="`bar${row.shade}`">
              <path
                v-for="(m, k) in visibleModels" :key="`b-${m}`"
                :d="roundedBar(xOfShadeIndex(i) - shadeSlotW / 2 + k * (shadeBarW + 1), shadeBarW, yOfShadeChroma(row.points[m].maxChroma), yOfShadeChroma(0))"
                :class="MODEL_STYLE[m].tint"
              >
                <title>{{ row.shade }} {{ MODEL_STYLE[m].label }}: L {{ row.points[m].l.toFixed(3) }}, sRGB max {{ row.points[m].maxChroma.toFixed(3) }}</title>
              </path>
              <text :x="xOfShadeIndex(i)" :y="SH - 6" text-anchor="middle" class="fill-neutral-500 dark:fill-neutral-400" style="font-size: 10px; font-family: DM Mono, monospace">{{ row.shade }}</text>
              <rect
                v-for="(m, k) in visibleModels" :key="`sw-${m}`"
                :x="xOfShadeIndex(i) - shadeSlotW / 2" :y="SH + 2 + k * (SWATCH_H + 4)" :width="shadeSlotW" :height="SWATCH_H" rx="4" :fill="row.points[m].hex"
              >
                <title>{{ row.shade }} {{ MODEL_STYLE[m].label }} {{ row.points[m].hex }}</title>
              </rect>
            </g>

            <path
              v-for="m in visibleModels" :key="`sp-${m}`"
              :d="shadePaths[m]" fill="none" stroke-linejoin="round"
              :stroke-width="MODEL_STYLE[m].width" :stroke-dasharray="MODEL_STYLE[m].dash" :class="MODEL_STYLE[m].stroke"
            />
            <template v-for="(row, i) in shadeRows" :key="`dot${row.shade}`">
              <path
                v-for="m in visibleModels" :key="`d-${m}`"
                :d="markerPath(m, xOfShadeIndex(i), yOfShadeChroma(row.points[m].chroma))" stroke-width="1.5"
                :class="[row.points[m].clipped ? 'fill-red-500' : MODEL_STYLE[m].fill, 'stroke-white dark:stroke-neutral-900']"
              >
                <title>{{ row.shade }} {{ MODEL_STYLE[m].label }}{{ row.points[m].clipped ? ' (outside sRGB)' : '' }}: L {{ row.points[m].l.toFixed(3) }}, C {{ row.points[m].chroma.toFixed(3) }} / max {{ row.points[m].maxChroma.toFixed(3) }}</title>
              </path>
            </template>

            <text
              v-for="(m, k) in visibleModels" :key="`sl-${m}`"
              :x="PAD.left - 6" :y="SH + 2 + k * (SWATCH_H + 4) + 15" text-anchor="end"
              class="fill-neutral-500 dark:fill-neutral-400" style="font-size: 9px; font-family: DM Mono, monospace"
            >{{ MODEL_STYLE[m].short }}</text>
          </svg>
          <div mt-1 text-xs text="neutral-500 dark:neutral-400">
            ● v1 · ■ tuned · ◆ Tailwind ≈ (interpolated between its two nearest families) · ▲ fitted. Red markers exceed sRGB and get channel-clipped. Shades 50 / 100 of v1 / tuned are additionally mixed with white.
          </div>
        </div>

        <!-- Fit to Tailwind -->
        <div class="chroma-card">
          <div class="mb-2 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div font-mono text-sm>
              ΔE vs Tailwind v4 · 17 families × 11 shades
            </div>
            <div flex items-center gap-1 text-xs font-mono>
              <button v-for="m in COMPARED" :key="`df-${m}`" :class="segmentClass(deltaFocus === m)" @click="deltaFocus = m">
                {{ MODEL_STYLE[m].short }}
              </button>
            </div>
          </div>

          <table mb-2 w-full text-xs font-mono style="border-collapse: collapse">
            <thead text="neutral-500 dark:neutral-400">
              <tr>
                <th text-left font-normal>
                  model
                </th>
                <th text-right font-normal>
                  ΔE RMS
                </th>
                <th text-right font-normal>
                  ΔE max
                </th>
                <th v-if="fitOverride" text-right font-normal title="families outside the sRGB window">
                  outside RMS
                </th>
                <th text-right font-normal>
                  CV RMS
                </th>
                <th text-right font-normal>
                  CV max
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in COMPARED" :key="`dr-${m}`">
                <td :class="MODEL_STYLE[m].text">
                  {{ MODEL_STYLE[m].label }}
                </td>
                <td text-right>
                  {{ deltaReports[m].rms.toFixed(2) }}
                </td>
                <td text-right>
                  {{ deltaReports[m].max.toFixed(1) }}
                </td>
                <td v-if="fitOverride" text-right>
                  {{ deltaOutside[m].rms.toFixed(2) }}
                </td>
                <td text-right>
                  {{ m === 'fitted' ? (crossValidation ? crossValidation.rms.toFixed(2) : '…') : '—' }}
                </td>
                <td text-right>
                  {{ m === 'fitted' ? (crossValidation ? crossValidation.max.toFixed(1) : '…') : '—' }}
                </td>
              </tr>
            </tbody>
          </table>

          <svg :viewBox="`0 0 ${DW} ${dH}`" class="block h-auto w-full" role="img" :aria-label="`ΔE between ${deltaFocus} and Tailwind v4`">
            <g class="fill-neutral-500 dark:fill-neutral-400" style="font-size: 9px; font-family: DM Mono, monospace">
              <rect
                v-for="(inside, col) in familyInWindow" v-show="inside" :key="`fw-${col}`"
                :x="D_LEFT + col * dCellW - 1" :y="D_TOP - 16" :width="dCellW + 1" :height="symbolicShadeValues.length * D_ROW_H + 17" rx="3"
                class="fill-teal-500/10 dark:fill-teal-400/15"
              />
              <text
                v-for="(family, col) in tailwindFamilyOrder" :key="`fh-${family.name}`"
                :x="D_LEFT + (col + 0.5) * dCellW" :y="D_TOP - 6" text-anchor="middle"
                :class="familyInWindow[col] ? 'fill-teal-600 dark:fill-teal-400' : ''"
              >
                {{ family.name.slice(0, 4) }}
                <title>{{ family.name }} ({{ family.baseHue.toFixed(0) }}°)</title>
              </text>
              <text
                v-for="(shade, row) in symbolicShadeValues" :key="`fs-${shade}`"
                :x="D_LEFT - 6" :y="D_TOP + row * D_ROW_H + D_ROW_H / 2 + 3" text-anchor="end"
              >{{ shade }}</text>
            </g>
            <g v-for="cell in deltaCells" :key="`dc-${cell.family}-${cell.shade}`">
              <rect
                :x="D_LEFT + cell.col * dCellW" :y="D_TOP + cell.row * D_ROW_H"
                :width="dCellW - 1" :height="D_ROW_H - 1" rx="2" :fill="deltaFill(cell.value)"
              >
                <title>{{ cell.family }}-{{ cell.shade }}: ΔE {{ cell.value.toFixed(2) }}</title>
              </rect>
              <text
                :x="D_LEFT + cell.col * dCellW + dCellW / 2" :y="D_TOP + cell.row * D_ROW_H + D_ROW_H / 2 + 2.5" text-anchor="middle"
                :fill="cell.value > D_MAX * 0.55 ? 'white' : 'oklch(0.35 0.05 35)'" style="font-size: 8px; font-family: DM Mono, monospace; pointer-events: none"
              >{{ cell.value.toFixed(1) }}</text>
            </g>
          </svg>
          <div mt-1 flex flex-wrap items-center gap-2 text-xs text="neutral-500 dark:neutral-400">
            <span>ΔE = OKLab distance × 100 (≈ 2 is just noticeable)</span>
            <span class="delta-scale" inline-block h-2.5 w-24 rounded-sm />
            <span>0 → {{ D_MAX }}+</span>
            <span>· CV = leave one family out, refit, predict it</span>
            <span v-if="fitOverride">· teal columns sit in the sRGB window, where the fit deliberately leaves Tailwind</span>
          </div>
        </div>

        <!-- Residual heatmaps against sRGB, one card per model so the grid can pair them -->
        <div v-for="m in visibleModels" :key="`heat-${m}`" class="chroma-card">
          <div class="mb-2 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div font-mono text-sm>
              sRGB residual · <span :class="MODEL_STYLE[m].text">{{ MODEL_STYLE[m].label }}</span>
            </div>
            <div flex items-center gap-2 text-xs text="neutral-600 dark:neutral-300">
              <span>−50%</span>
              <span class="residual-scale" inline-block h-2.5 w-24 rounded-sm />
              <span>+50%</span>
            </div>
          </div>
          <div mb-1 text-xs font-mono text="neutral-500 dark:neutral-400">
            over sRGB <b text="red-600 dark:red-400">{{ (heatmaps[m].stats.over * 100).toFixed(1) }}%</b>
            · &lt; 75% of sRGB <b text="blue-600 dark:blue-400">{{ (heatmaps[m].stats.headroom * 100).toFixed(1) }}%</b>
            · mean |residual| <b>{{ (heatmaps[m].stats.meanAbs * 100).toFixed(1) }}%</b>
          </div>
          <svg :viewBox="`0 0 ${HW} ${heatH}`" class="block h-auto w-full" role="img" :aria-label="`sRGB residual heatmap for the ${m} model`">
            <rect
              v-for="cell in heatmaps[m].cells" :key="`${cell.row}-${cell.col}`"
              :x="PAD.left + cell.col * heatCellW" :y="PAD.top + cell.row * HEAT_ROW_H"
              :width="heatCellW + 0.3" :height="HEAT_ROW_H + 0.3" :fill="cell.fill"
            >
              <title>h {{ cell.hue }}°, shade {{ cell.shade }}: {{ cell.residual > 0 ? '+' : '' }}{{ (cell.residual * 100).toFixed(1) }}%</title>
            </rect>
            <line
              :x1="PAD.left + themeHue / 360 * heatPlotW" :x2="PAD.left + themeHue / 360 * heatPlotW"
              :y1="PAD.top - 3" :y2="PAD.top + symbolicShadeValues.length * HEAT_ROW_H + 3"
              stroke-width="1.5" class="stroke-neutral-900 dark:stroke-neutral-50"
            />
            <g class="fill-neutral-500 dark:fill-neutral-400" style="font-size: 10px; font-family: DM Mono, monospace">
              <text
                v-for="(shade, row) in symbolicShadeValues" :key="`hl${shade}`"
                :x="PAD.left - 6" :y="PAD.top + row * HEAT_ROW_H + HEAT_ROW_H / 2 + 3" text-anchor="end"
              >{{ shade }}</text>
              <text
                v-for="t in xTicks" :key="`hx${t}`"
                :x="PAD.left + t / 360 * heatPlotW" :y="heatH - 4" text-anchor="middle"
              >{{ t }}°</text>
            </g>
          </svg>
          <div mt-1 text-xs text="neutral-500 dark:neutral-400">
            Residual = chroma / sRGB max − 1 at that hue and shade's lightness. Red cells get channel-clipped; deep blue cells could be more vivid.
          </div>
        </div>

        <!-- 3D surface -->
        <div class="chroma-card chroma-card--surface">
          <div mb-2 font-mono text-sm>
            Chroma surface · hue × shade × chroma (drag to orbit)
          </div>
          <ColorChromaSurface :params="params" />
        </div>

        <!-- Palette grid -->
        <div class="chroma-card chroma-card--palette">
          <div class="mb-2 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div font-mono text-sm>
              Palettes side by side
            </div>
            <div text="xs neutral-500 dark:neutral-400">
              rows = hue, columns = 50 … 950
            </div>
          </div>
          <div grid items-center gap-x-3 gap-y-1 text-xs font-mono :style="paletteGrid">
            <span />
            <span v-for="m in visibleModels" :key="`ph-${m}`" :class="MODEL_STYLE[m].text || 'text-neutral-500 dark:text-neutral-400'">{{ MODEL_STYLE[m].short }}</span>
            <template v-for="row in gridRows" :key="`grid${row.hue}`">
              <span text-right text="neutral-500 dark:neutral-400">{{ row.hue }}°</span>
              <div v-for="m in visibleModels" :key="`pr-${m}`" flex overflow-hidden rounded-md>
                <div v-for="(hex, i) in row.palettes[m]" :key="i" h-5 flex-1 :style="{ background: hex }" :title="`${symbolicShadeValues[i]} ${hex}`" />
              </div>
            </template>
          </div>
        </div>

        <!-- Formula -->
        <div class="chroma-card chroma-card--formula">
          <div class="chroma-card--formula__head" flex flex-wrap items-center gap-2 text-xs font-mono>
            <span text="neutral-500 dark:neutral-400">export</span>
            <button :class="segmentClass(formulaModel === 'tuned')" @click="formulaModel = 'tuned'">
              tuned
            </button>
            <button :class="segmentClass(formulaModel === 'fitted')" @click="formulaModel = 'fitted'">
              fitted
            </button>
          </div>
          <div min-w-0>
            <div mb-2 flex items-center justify-between>
              <span font-mono text-sm>TypeScript</span>
              <button :class="segmentClass(false)" text-xs font-mono @click="copy('ts')">
                {{ copied === 'ts' ? 'copied' : 'copy' }}
              </button>
            </div>
            <pre class="chroma-code">{{ tsSnippet }}</pre>
          </div>
          <div min-w-0>
            <div mb-2 flex items-center justify-between>
              <span font-mono text-sm>CSS (preset)</span>
              <button :class="segmentClass(false)" text-xs font-mono @click="copy('css')">
                {{ copied === 'css' ? 'copied' : 'copy' }}
              </button>
            </div>
            <pre class="chroma-code">{{ cssSnippet }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chroma-clip-swatch {
  background: repeating-linear-gradient(45deg, rgb(239 68 68 / 0.7) 0 2px, rgb(239 68 68 / 0.15) 2px 5px);
}

.residual-scale {
  background: linear-gradient(to right, oklch(0.6 0.17 255), oklch(0.86 0 0), oklch(0.6 0.17 27));
}

.delta-scale {
  background: linear-gradient(to right, oklch(0.96 0.02 35), oklch(0.46 0.15 35));
}

.chroma-control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    'label value'
    'input input';
  align-items: center;
  gap: 0.25rem 0.75rem;
  font-size: 0.875rem;
}

.chroma-control > :first-child {
  grid-area: label;
}

.chroma-control > :nth-child(2) {
  grid-area: input;
}

.chroma-control > :nth-child(3) {
  grid-area: value;
}

.chroma-control > code {
  font-size: 0.75rem;
  opacity: 0.8;
}

.chroma-code {
  margin: 0;
  max-height: 20rem;
  overflow: auto;
  border-radius: 0.5rem;
  padding: 0.75rem;
  font-size: 0.75rem;
  line-height: 1.6;
  white-space: pre;
  background: rgb(0 0 0 / 0.04);
}

.dark .chroma-code {
  background: rgb(255 255 255 / 0.06);
}

.chroma-lab {
  position: relative;
  left: 50%;
  translate: -50% 0;
  width: min(calc(100vw - 2rem), 3600px);
  display: grid;
  gap: 1.5rem;
  align-items: start;
}

.chroma-lab__fieldsets {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1rem 2rem;
}

.chroma-lab__charts-wrap {
  container-type: inline-size;
  min-width: 0;
}

.chroma-lab__charts {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-auto-flow: row dense;
  gap: 1.5rem;
}

.chroma-card {
  min-width: 0;
}

.chroma-card--formula {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 480px), 1fr));
  align-content: start;
  gap: 1rem;
}

.chroma-card--formula__head {
  grid-column: 1 / -1;
}

/* Wide screens: sticky controls on the left, charts spread out on the right. */
@media (min-width: 1600px) {
  .chroma-lab {
    grid-template-columns: 340px minmax(0, 1fr);
  }

  .chroma-lab__controls {
    position: sticky;
    top: 5.5rem;
    max-height: calc(100vh - 6.5rem);
    overflow-y: auto;
  }
}

/* Reflow the chart cards by the space actually available to them. */
@container (min-width: 1100px) {
  .chroma-lab__charts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .chroma-card--surface,
  .chroma-card--palette {
    grid-column: span 2;
  }

  .chroma-card {
    border-radius: 0.75rem;
    padding: 1rem;
    background: rgb(0 0 0 / 0.02);
  }

  .dark .chroma-card {
    background: rgb(255 255 255 / 0.03);
  }
}

@container (min-width: 1900px) {
  .chroma-lab__charts {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  /* the tall 3D card takes a 2 × 2 block; smaller cards pack around it */
  .chroma-card--surface {
    grid-row: span 2;
  }

  .chroma-card--palette {
    grid-column: auto;
  }
}

@container (min-width: 2600px) {
  .chroma-lab__charts {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .chroma-card--palette,
  .chroma-card--formula {
    grid-row: span 2;
  }
}
</style>
