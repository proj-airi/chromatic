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

    expect(css).toContain('--chromatic-bri:0.1')
    expect(css).toContain('--chromatic-sat:1.15')
  })

  it('supports saturation-only modifier using "~"', async () => {
    const uno = await createUno()
    const { css } = await uno.generate('text-primary-600~120', { preflights: false })

    expect(css).toContain('--chromatic-sat:1.2')
  })

  it('supports brightness-only modifier using "*"', async () => {
    const uno = await createUno()
    const { css } = await uno.generate('border-primary-400*70', { preflights: false })

    expect(css).toContain('--chromatic-bri:0.7')
  })

  it('works with state variants', async () => {
    const uno = await createUno()
    const { css } = await uno.generate('hover:bg-primary-500/50~115*10', { preflights: false })

    expect(css).toContain(':hover')
    expect(css).toContain('--chromatic-bri:0.1')
    expect(css).toContain('--chromatic-sat:1.15')
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
    expect(css).toContain('--chromatic-bri:1.2')
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
