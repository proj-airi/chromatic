import { createGenerator, presetWind3 } from 'unocss'
import { describe, expect, it } from 'vitest'

import { createPresetChromatic } from './shared'

const presetChromatic = createPresetChromatic()

function createUno(
  options: Parameters<typeof presetChromatic>[0] = {
    baseHue: 220.25,
    colors: { primary: 0 },
  },
) {
  return createGenerator({
    presets: [
      presetWind3(),
      presetChromatic(options),
    ],
  })
}

describe('chromatic symbolic adjustments', () => {
  it('supports combined opacity, saturation, and brightness modifiers', async () => {
    const uno = await createUno()
    const { css } = await uno.generate('bg-primary-500/50~115*10', { preflights: false })

    expect(css).toContain('calc(62% * 0.1)')
    expect(css).toContain('calc(var(--chromatic-chroma-500) * 1.15)')
  })

  it('supports saturation-only modifier using "~"', async () => {
    const uno = await createUno()
    const { css } = await uno.generate('text-primary-600~120', { preflights: false })

    expect(css).toContain('calc(var(--chromatic-chroma-600) * 1.2)')
    expect(css).toContain('calc(54% * var(--chromatic-bri))')
  })

  it('supports brightness-only modifier using "*"', async () => {
    const uno = await createUno()
    const { css } = await uno.generate('border-primary-400*70', { preflights: false })

    expect(css).toContain('calc(74% * 0.7)')
    expect(css).toContain('calc(var(--chromatic-chroma-400) * var(--chromatic-sat))')
  })

  it('works with state variants', async () => {
    const uno = await createUno()
    const { css } = await uno.generate('hover:bg-primary-500/50~115*10', { preflights: false })

    expect(css).toContain(':hover')
    expect(css).toContain('calc(62% * 0.1)')
    expect(css).toContain('calc(var(--chromatic-chroma-500) * 1.15)')
  })

  it('scopes adjustments to the modified color utility', async () => {
    const uno = await createUno()
    const { css } = await uno.generate(
      'bg-primary-400/75~20 text-primary-400 dark:bg-primary-500 hover:bg-primary-500 active:bg-primary-600',
      { preflights: false },
    )

    expect(css).not.toContain('--chromatic-sat:0.2')
    expect(css).toMatch(/\.bg-primary-400\\\/75\\~20\{background-color:[^}]*var\(--chromatic-chroma-400\) \* 0\.2/)
    expect(css).toMatch(/\.text-primary-400\{[^}]*var\(--chromatic-chroma-400\) \* var\(--chromatic-sat\)/)
    expect(css).toMatch(/\.dark \.dark\\:bg-primary-500\{[^}]*var\(--chromatic-chroma-500\) \* var\(--chromatic-sat\)/)
    expect(css).toMatch(/\.hover\\:bg-primary-500:hover\{[^}]*var\(--chromatic-chroma-500\) \* var\(--chromatic-sat\)/)
    expect(css).toMatch(/\.active\\:bg-primary-600:active\{[^}]*var\(--chromatic-chroma-600\) \* var\(--chromatic-sat\)/)
  })

  it('scopes state adjustments to that state and utility', async () => {
    const uno = await createUno()
    const { css } = await uno.generate(
      'text-primary-400 hover:bg-primary-500~20 active:bg-primary-600',
      { preflights: false },
    )

    expect(css).not.toContain('--chromatic-sat:0.2')
    expect(css).toMatch(/\.hover\\:bg-primary-500\\~20:hover\{[^}]*var\(--chromatic-chroma-500\) \* 0\.2/)
    expect(css).toMatch(/\.active\\:bg-primary-600:active\{[^}]*var\(--chromatic-chroma-600\) \* var\(--chromatic-sat\)/)
    expect(css).toMatch(/\.text-primary-400\{[^}]*var\(--chromatic-chroma-400\) \* var\(--chromatic-sat\)/)
  })

  it('rejects invalid modifier order', async () => {
    const uno = await createUno()
    const { css } = await uno.generate('bg-primary-500*10~115', { preflights: false })

    expect(css).toBe('')
  })

  it('supports configurable utility prefixes', async () => {
    const uno = await createUno({
      baseHue: 220.25,
      colors: { primary: 0 },
      modifierUtilityPrefixes: ['bg'],
    })
    const { css } = await uno.generate('bg-primary-500*120 text-primary-500*120', { preflights: false })

    expect(css).toContain('.bg-primary-500\\*120')
    expect(css).toContain('calc(62% * 1.2)')
    expect(css).not.toContain('.text-primary-500\\*120{')
  })

  it('supports configurable modifier variant name', () => {
    const customPreset = createPresetChromatic()({
      baseHue: 220.25,
      colors: { primary: 0 },
      modifierVariantName: 'custom-modifiers',
    })
    expect(customPreset.variants?.[0]?.name).toBe('custom-modifiers')
  })
})
