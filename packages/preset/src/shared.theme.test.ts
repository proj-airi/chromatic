import type { SourceCodeTransformer } from '@unocss/core'

import { createRequire } from 'node:module'

import { createGenerator, presetWind3, transformerDirectives } from 'unocss'
import { describe, expect, it } from 'vitest'

import { createPresetChromatic } from './shared'

// magic-string is what UnoCSS hands transformers; load the copy unocss itself uses.
const require = createRequire(import.meta.url)
const magicString = createRequire(require.resolve('unocss'))('magic-string')
const MagicString = (magicString.default ?? magicString) as typeof import('magic-string').default

const presetChromatic = createPresetChromatic()

/** Runs the transformers the way `@unocss/vite` does: the `pre` pass, then the default one, then `post`. */
async function transform(code: string, id = 'src/styles/main.css', model: 'v1' | 'v2' = 'v2') {
  const uno = await createGenerator({
    presets: [presetWind3(), presetChromatic({ baseHue: 220.25, colors: { complementary: 180, primary: 0 }, model })],
    transformers: [transformerDirectives({ applyVariable: ['--at-apply'] })],
  })
  const transformers: SourceCodeTransformer[] = uno.config.transformers ?? []

  for (const enforce of ['pre', undefined, 'post'] as const) {
    for (const t of transformers.filter(t => t.enforce === enforce)) {
      if (t.idFilter && !t.idFilter(id))
        continue
      if (t.codeFilter && !t.codeFilter(code, id))
        continue
      const s = new MagicString(code)
      await t.transform(s, id, { uno } as Parameters<SourceCodeTransformer['transform']>[2])
      code = s.toString()
    }
  }
  return code
}

describe('theme() with chromatic colours', () => {
  it('resolves the alpha placeholder when no opacity is given', async () => {
    const css = await transform(`.a { color: theme('colors.primary.400'); }`)

    expect(css).not.toContain('%alpha')
    expect(css).not.toContain('theme(')
    expect(css).toContain('var(--chromatic-fit-primary-l-400)')
    expect(css).toMatch(/\/ 1\);/)
  })

  it('handles double quotes, DEFAULT and every configured colour', async () => {
    const css = await transform(`.a { color: theme("colors.complementary.200"); background: theme('colors.primary'); }`)

    expect(css).not.toContain('%alpha')
    expect(css).toContain('var(--chromatic-fit-complementary-c-200)')
    expect(css).toContain('var(--chromatic-fit-primary-l-500)')
  })

  it('keeps an explicit opacity and a default value', async () => {
    const css = await transform(`.a { color: theme('colors.primary.400 / 50%'); fill: theme('colors.primary.300', red); }`)

    expect(css).toMatch(/\/\s+50%\);/)
    expect(css).not.toContain('/ 1 / 50%')
    expect(css).toContain('var(--chromatic-fit-primary-l-300)')
    expect(css).not.toContain('%alpha')
  })

  it('works for the v1 model too', async () => {
    const css = await transform(`.a { color: theme('colors.primary.400'); }`, undefined, 'v1')

    expect(css).not.toContain('%alpha')
    expect(css).toContain('var(--chromatic-chroma-400)')
  })

  it('leaves other colours and non-CSS files alone', async () => {
    const other = await transform(`.a { color: theme('colors.red.500'); }`)
    expect(other).toContain('.a { color: #ef4444; }')

    const ts = `const c = "theme('colors.primary.400')"`
    expect(await transform(ts, 'src/main.ts')).toBe(ts)
  })
})
