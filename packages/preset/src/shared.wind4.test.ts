import { createGenerator, presetWind4 } from 'unocss'
import { describe, expect, it } from 'vitest'

import { createPresetChromatic } from './shared'

const presetChromatic = createPresetChromatic()

function createUno() {
  return createGenerator({
    presets: [
      presetWind4(),
      presetChromatic({ baseHue: 220.44, colors: { primary: 0 }, model: 'v1' }),
    ],
  })
}

/** Declarations of one rule, keyed by property. */
function declarationsOf(css: string, selector: string): Record<string, string> {
  const escaped = selector.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const body = new RegExp(`(?:^|\\n)${escaped}\\{([^}]*)\\}`).exec(css)?.[1]
  expect(body, `rule ${selector} in:\n${css}`).toBeDefined()

  return Object.fromEntries(body!
    .split(';')
    .filter(Boolean)
    .map((declaration) => {
      const index = declaration.indexOf(':')
      return [declaration.slice(0, index), declaration.slice(index + 1)]
    }))
}

describe('chromatic with presetWind4', () => {
  // ROOT CAUSE:
  //
  // presetWind4 inlines theme colors that contain `var(` into the utility instead of emitting a theme variable
  // (`colorCSSGenerator` in `@unocss/preset-wind4/dist/utils-*.mjs`), and it only replaces the `%alpha` placeholder
  // when it emits theme variables (`getThemeVarsMap` in `@unocss/preset-wind4/dist/index.mjs`). The runtime palette
  // of chromatic always contains `var(--chromatic-hue)`, so wind4 produced:
  //
  // color:color-mix(in srgb, oklch(… calc(var(--chromatic-hue) + 0) / %alpha) var(--un-text-opacity), transparent)
  //
  // which browsers drop as invalid. We fixed this by replacing the placeholders left in utility values with `1`,
  // the same value wind4 uses for its theme variables; wind4's `color-mix(…, transparent)` applies the opacity.
  // color:color-mix(in srgb, oklch(… calc(var(--chromatic-hue) + 0) / 1) var(--un-text-opacity), transparent)

  /**
   * @example
   * expect(css).not.toContain('%alpha')
   */
  it('leaves no %alpha placeholder in utilities', async () => {
    const uno = await createUno()
    const { css } = await uno.generate(
      'text-primary-600 bg-primary-500/50 border-primary-400 ring-primary-500 bg-primary-50 bg-primary-500/50~10*115',
      { preflights: false },
    )

    expect(css).not.toContain('%alpha')
  })

  /**
   * @example
   * expect(declarationsOf(css, '.text-primary-600').color).toBe('color-mix(in srgb, oklch(…) var(--un-text-opacity), transparent)')
   */
  it('keeps the hue dynamic and lets color-mix apply the opacity', async () => {
    const uno = await createUno()
    const { css } = await uno.generate('text-primary-600 bg-primary-500/50', { preflights: false })

    expect(declarationsOf(css, '.text-primary-600').color).toBe(
      'color-mix(in srgb, oklch(clamp(0%, calc(54% * var(--chromatic-bri)), 100%) calc(var(--chromatic-chroma-600) * var(--chromatic-sat)) calc(var(--chromatic-hue) + 0) / 1) var(--un-text-opacity), transparent)',
    )
    expect(declarationsOf(css, '.bg-primary-500\\/50')['background-color']).toBe(
      'color-mix(in srgb, oklch(clamp(0%, calc(62% * var(--chromatic-bri)), 100%) calc(var(--chromatic-chroma-500) * var(--chromatic-sat)) calc(var(--chromatic-hue) + 0) / 1) 50%, transparent)',
    )
  })

  /**
   * @example
   * expect(declarationsOf(css, '.border-primary-400')['border-color']).toContain('var(--un-border-opacity)')
   */
  it('works for border, ring, and the mixed light shades', async () => {
    const uno = await createUno()
    const { css } = await uno.generate('border-primary-400 ring-primary-500 bg-primary-50', { preflights: false })

    expect(declarationsOf(css, '.border-primary-400')['border-color']).toBe(
      'color-mix(in srgb, oklch(clamp(0%, calc(74% * var(--chromatic-bri)), 100%) calc(var(--chromatic-chroma-400) * var(--chromatic-sat)) calc(var(--chromatic-hue) + 0) / 1) var(--un-border-opacity), transparent)',
    )
    expect(declarationsOf(css, '.ring-primary-500')['--un-ring-color']).toBe(
      'color-mix(in srgb, oklch(clamp(0%, calc(62% * var(--chromatic-bri)), 100%) calc(var(--chromatic-chroma-500) * var(--chromatic-sat)) calc(var(--chromatic-hue) + 0) / 1) var(--un-ring-opacity), transparent)',
    )
    expect(declarationsOf(css, '.bg-primary-50')['background-color']).toBe(
      'color-mix(in srgb, color-mix(in srgb, oklch(clamp(0%, calc(95% * var(--chromatic-bri)), 100%) calc(var(--chromatic-chroma-50) * var(--chromatic-sat)) calc(var(--chromatic-hue) + 0) / 1) 30%, oklch(100% 0 360 / 1)) var(--un-bg-opacity), transparent)',
    )
  })

  /**
   * @example
   * expect(declarationsOf(css, '.bg-primary-500\\/50\\~10\\*115')['background-color']).toContain('calc(62% * 1.15)')
   */
  it('applies the saturation and brightness modifiers', async () => {
    const uno = await createUno()
    const { css } = await uno.generate('bg-primary-500/50~10*115', { preflights: false })

    expect(declarationsOf(css, '.bg-primary-500\\/50\\~10\\*115')['background-color']).toBe(
      'color-mix(in srgb, oklch(clamp(0%, calc(62% * 1.15), 100%) calc(var(--chromatic-chroma-500) * 0.1) calc(var(--chromatic-hue) + 0) / 1) 50%, transparent)',
    )
  })
})
