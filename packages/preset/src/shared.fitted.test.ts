import type { Shade } from '@proj-airi/chromatic'

import { fittedOklch } from '@proj-airi/chromatic'
import { createGenerator, presetWind3, presetWind4 } from 'unocss'
import { describe, expect, it } from 'vitest'

import { createFittedBakedColorShades, createFittedPreflight, createPresetChromatic } from './shared'

const presetChromatic = createPresetChromatic()
const shades: Shade[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
const colors = { accent: 180, primary: 0, secondary: 60 }

function createUno(wind: 'wind3' | 'wind4' = 'wind3') {
  return createGenerator({
    presets: [
      wind === 'wind3' ? presetWind3() : presetWind4(),
      // no `model`: fitted is the default
      presetChromatic({ baseHue: 220.25, colors }),
    ],
  })
}

/**
 * Evaluates the custom properties of a preflight the way a browser would, for the subset of CSS it uses:
 * `calc()`, `cos()`, `sin()`, `max()`, `var()` and plain arithmetic on numbers.
 */
function evaluateCustomProperties(css: string, overrides: Record<string, number>): (name: string) => number {
  const declarations = new Map(
    [...css.matchAll(/^ *(--[\w-]+): ([^;]+);$/gm)].map(([, name, value]) => [name, value]),
  )
  const cache = new Map<string, number>(Object.entries(overrides))

  const evaluate = (name: string): number => {
    if (cache.has(name))
      return cache.get(name)!
    const value = declarations.get(name)
    if (value == null)
      throw new Error(`undefined custom property ${name}`)

    const js = value
      .replaceAll(/var\((--[\w-]+)\)/g, (_, ref: string) => `(${evaluate(ref)})`)
      .replaceAll(/\b(calc|cos|sin|max)\(/g, (_, fn: string) => (fn === 'calc' ? '(' : `Math.${fn}(`))
    // eslint-disable-next-line no-new-func
    const result = Number(new Function(`return ${js}`)())
    cache.set(name, result)
    return result
  }

  return evaluate
}

function wrapDegrees(d: number): number {
  return ((d % 360) + 540) % 360 - 180
}

describe('fitted model', () => {
  it('computes the same lightness, chroma and hue drift in CSS as in @proj-airi/chromatic', () => {
    const css = createFittedPreflight(220.25, colors)

    for (const hue of [0, 37.5, 105, 220.25, 300]) {
      const read = evaluateCustomProperties(css, { '--chromatic-hue': hue })

      for (const [name, offset] of Object.entries(colors)) {
        for (const shade of shades) {
          const expected = fittedOklch(shade, (hue + offset) % 360)

          expect(read(`--chromatic-fit-${name}-l-${shade}`)).toBeCloseTo(expected.l, 6)
          expect(read(`--chromatic-fit-${name}-c-${shade}`)).toBeCloseTo(expected.c, 6)
          expect(wrapDegrees(hue + offset + read(`--chromatic-fit-${name}-hd-${shade}`) - expected.h)).toBeCloseTo(0, 4)
        }
      }
    }
  })

  it('is the default and emits the fitted custom properties as the preflight', async () => {
    const uno = await createUno()
    const { css } = await uno.generate('', { preflights: true })

    expect(css).toContain('--chromatic-hue: 220.25;')
    expect(css).toContain('--chromatic-fit-primary-l-500:')
    expect(css).toContain('--chromatic-fit-accent-b-cos1: cos(')
    expect(css).toContain('--chromatic-fit-accent-c-950: max(0, calc(')
    expect(css).not.toContain('--chromatic-chroma-500')
  })

  it('reads the per-shade properties in utilities and keeps the modifiers working', async () => {
    const uno = await createUno()
    const { css } = await uno.generate('text-primary-600 bg-accent-500/50~115*10', { preflights: false })

    expect(css).toMatch(/\.text-primary-600\{[^}]*var\(--chromatic-fit-primary-l-600\) \* 100% \* var\(--chromatic-bri\)/)
    expect(css).toMatch(/\.text-primary-600\{[^}]*calc\(var\(--chromatic-fit-primary-c-600\) \* var\(--chromatic-sat\)\)/)
    expect(css).toMatch(/\.text-primary-600\{[^}]*calc\(var\(--chromatic-hue\) \+ 0 \+ var\(--chromatic-fit-primary-hd-600\)\)/)
    expect(css).toContain('var(--chromatic-fit-accent-l-500) * 100% * 0.1')
    expect(css).toContain('var(--chromatic-fit-accent-c-500) * 1.15')
  })

  it('leaves no %alpha placeholder with presetWind4', async () => {
    const uno = await createUno('wind4')
    const { css } = await uno.generate('text-primary-500 bg-secondary-300/50', { preflights: false })

    expect(css).toContain('var(--chromatic-fit-primary-l-500)')
    expect(css).not.toContain('%alpha')
  })

  it('bakes the values of fittedOklch', () => {
    const baked = createFittedBakedColorShades(220.25, 60)

    for (const shade of shades) {
      const { c, h, l } = fittedOklch(shade, 280.25)
      expect(baked[shade]).toBe(
        `oklch(clamp(0%, calc(${Number((l * 100).toFixed(4))}% * var(--chromatic-bri)), 100%) calc(${Number(c.toFixed(6))} * var(--chromatic-sat)) ${Number(h.toFixed(4))} / %alpha)`,
      )
    }
    expect(baked.DEFAULT).toBe(baked[500])
  })
})
