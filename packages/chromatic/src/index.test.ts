import type { Rgb } from 'culori'

import type { Shade } from './index'

import { converter, formatHex, oklch } from 'culori'
import { describe, expect, it } from 'vitest'

import { chromaticColorFrom } from './index'

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

function mixSrgbWithWhite(color: ReturnType<typeof oklch>, baseRatio: number) {
  const rgb = toRgb(color) as Rgb | undefined
  if (!rgb)
    throw new Error('Invalid color provided for rgb conversion in test')

  const whiteRatio = 1 - baseRatio

  return {
    mode: 'rgb' as const,
    r: clampChannel(rgb.r * baseRatio + whiteRatio),
    g: clampChannel(rgb.g * baseRatio + whiteRatio),
    b: clampChannel(rgb.b * baseRatio + whiteRatio),
  }
}

function legacyToHex(shade: Shade, brightness: number, saturation: number, baseHue: number, hueOffset = 0) {
  const hue = baseHue + hueOffset
  const defaultChroma = 0.18 + Math.cos(baseHue * Math.PI / 180) * 0.04
  const lightness = Math.max(0, Math.min(100, shadeLightness[shade] * (brightness / 100)))
  const chroma = Math.max(0, defaultChroma * shadeChromaMultiplier[shade] * (saturation / 100))
  const color = oklch({
    mode: 'oklch',
    l: lightness / 100,
    c: chroma,
    h: hue,
  })

  if (!color)
    return '#000000'

  const mixRatio = shadeBaseMixRatio[shade]
  if (mixRatio != null)
    return formatHex(mixSrgbWithWhite(color, mixRatio))

  return formatHex(color)
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
            shade,
            hueOffset,
            brightness,
            saturation,
          }).toHex()

          const expected = legacyToHex(shade, brightness, saturation, baseHue, hueOffset)
          expect(actual).toBe(expected)
        }
      }
    }
  })
})
