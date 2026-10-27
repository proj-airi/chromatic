import type { Rgb } from 'culori'

import type { Shade } from './index'

import { converter, formatHex, oklch } from 'culori'
import { describe, expect, it } from 'vitest'

import { chromaticColorFrom, chromaticPaletteFrom, colorBy, fittedOklch, themeFrom } from './index'

const shadeValues: Shade[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
const shadeLightness: Record<Shade, number> = {
  50: 95,
  100: 95,
  200: 90,
  300: 85,
  400: 74,
  500: 62,
  600: 54,
  700: 49,
  800: 42,
  900: 37,
  950: 29,
}
const shadeChromaMultiplier: Record<Shade, number> = {
  50: 0.3,
  100: 0.5,
  200: 0.6,
  300: 0.75,
  400: 0.85,
  500: 1,
  600: 1.15,
  700: 1.1,
  800: 0.85,
  900: 0.7,
  950: 0.5,
}
const shadeBaseMixRatio: Partial<Record<Shade, number>> = {
  50: 0.3,
  100: 0.8,
}
const toRgb = converter('rgb')

function clampChannel(channel: number): number {
  return Math.min(1, Math.max(0, channel))
}

function legacyToHex(shade: Shade, brightness: number, saturation: number, baseHue: number, hueOffset = 0) {
  const hue = baseHue + hueOffset
  const defaultChroma = 0.18 + Math.cos(baseHue * Math.PI / 180) * 0.04
  const lightness = Math.max(0, Math.min(100, shadeLightness[shade] * (brightness / 100)))
  const chroma = Math.max(0, defaultChroma * shadeChromaMultiplier[shade] * (saturation / 100))
  const color = oklch({
    c: chroma,
    h: hue,
    l: lightness / 100,
    mode: 'oklch',
  })

  if (!color)
    return '#000000'

  const mixRatio = shadeBaseMixRatio[shade]
  if (mixRatio != null)
    return formatHex(mixSrgbWithWhite(color, mixRatio))

  return formatHex(color)
}

function mixSrgbWithWhite(color: ReturnType<typeof oklch>, baseRatio: number) {
  const rgb = toRgb(color) as Rgb | undefined
  if (!rgb)
    throw new Error('Invalid color provided for rgb conversion in test')

  const whiteRatio = 1 - baseRatio

  return {
    b: clampChannel(rgb.b * baseRatio + whiteRatio),
    g: clampChannel(rgb.g * baseRatio + whiteRatio),
    mode: 'rgb' as const,
    r: clampChannel(rgb.r * baseRatio + whiteRatio),
  }
}

describe('chromaticColorFrom', () => {
  it('matches existing symbolic shade math across sampled values', () => {
    const baseHue = 220.25
    const hueOffset = 60
    const brightnessValues = [10, 40, 70, 100, 130, 200]
    const saturationValues = [0, 10, 60, 100, 170, 200]

    for (const shade of shadeValues) {
      for (const brightness of brightnessValues) {
        for (const saturation of saturationValues) {
          const actual = chromaticColorFrom(baseHue, {
            brightness,
            hueOffset,
            model: 'classic',
            saturation,
            shade,
          }).toHex()

          const expected = legacyToHex(shade, brightness, saturation, baseHue, hueOffset)
          expect(actual).toBe(expected)
        }
      }
    }
  })
})

describe('fitted model', () => {
  const toOklch = (hex: string) => oklch(hex)!

  it('produces the fitted OKLCH for every shade and hue offset', () => {
    for (const shade of shadeValues) {
      const color = chromaticColorFrom(220.25, { hueOffset: 60, model: 'fitted', shade }).color
      const expected = fittedOklch(shade, 280.25)
      const actual = oklch(color)!

      expect(actual.l).toBeCloseTo(expected.l, 10)
      expect(actual.c).toBeCloseTo(expected.c, 10)
      expect(actual.h).toBeCloseTo(expected.h, 10)
    }
  })

  it('applies brightness and saturation as ratios and ignores baseChroma', () => {
    const fitted = fittedOklch(400, 30)
    const color = oklch(chromaticColorFrom(30, { baseChroma: 0.01, brightness: 80, model: 'fitted', saturation: 150, shade: 400 }).color)!

    expect(color.l).toBeCloseTo(fitted.l * 0.8, 10)
    expect(color.c).toBeCloseTo(fitted.c * 1.5, 10)
  })

  it('does not mix shades 50 / 100 with white', () => {
    const fitted = fittedOklch(50, 220.25)
    const color = oklch(chromaticColorFrom(220.25, { model: 'fitted', shade: 50 }).color)!

    expect(color.l).toBeCloseTo(fitted.l, 10)
    expect(color.c).toBeCloseTo(fitted.c, 10)
  })

  it('stays within sane OKLCH ranges for every hue', () => {
    for (let hue = 0; hue < 360; hue += 5) {
      let previousL = Infinity
      for (const shade of shadeValues) {
        const { c, l } = fittedOklch(shade, hue)
        expect(l).toBeGreaterThan(0.2)
        expect(l).toBeLessThan(previousL)
        expect(c).toBeGreaterThanOrEqual(0)
        expect(c).toBeLessThan(0.33)
        previousL = l
      }
    }
  })

  it('threads the model through palettes and schemes', () => {
    const palette = chromaticPaletteFrom(220.25, undefined, { model: 'fitted' })
    expect(palette.model).toBe('fitted')
    expect(palette.chroma).toBeCloseTo(fittedOklch(500, 220.25).c, 10)

    const scheme = themeFrom(220.25, { accent: 180, primary: 0 }, { model: 'fitted' })
    expect(scheme.toHex('accent', 700)).toBe(chromaticColorFrom(220.25, { hueOffset: 180, model: 'fitted', shade: 700 }).toHex())
    expect(scheme.adjustHue(30).toHex('primary', 300)).toBe(chromaticColorFrom(30, { model: 'fitted', shade: 300 }).toHex())

    expect(colorBy(100, 'yellow', { model: 'fitted' })[400].toHex()).toBe(chromaticColorFrom(100, { model: 'fitted', shade: 400 }).toHex())
    expect(toOklch(colorBy(100, 'x', { model: 'classic' })[400].toHex()).c).not.toBeCloseTo(toOklch(colorBy(100, 'x', { model: 'fitted' })[400].toHex()).c, 3)
  })

  it('is the default', () => {
    expect(chromaticPaletteFrom(220.25).model).toBe('fitted')
    expect(chromaticColorFrom(220.25, { shade: 300 }).toHex()).toBe(chromaticColorFrom(220.25, { model: 'fitted', shade: 300 }).toHex())
    expect(themeFrom(220.25, { primary: 0 }).toHex('primary', 500)).toBe(chromaticColorFrom(220.25, { model: 'fitted', shade: 500 }).toHex())
  })

  it('still offers classic on request', () => {
    expect(chromaticPaletteFrom(220.25, undefined, { model: 'classic' }).model).toBe('classic')
    expect(themeFrom(220.25, { primary: 0 }, { model: 'classic' }).toHex('primary', 500)).toBe(chromaticColorFrom(220.25, { model: 'classic', shade: 500 }).toHex())
  })
})
