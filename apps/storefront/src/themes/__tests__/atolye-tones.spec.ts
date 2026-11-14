import { describe, expect, it } from "vitest"
import { ATOLYE_TONES, TONE_SURFACES } from "@qticaret/theme-atolye"
import type { ThemeBackground } from "@qticaret/types"
import { THEME_BACKGROUNDS } from "@/lib/views/theme"
import { atolyeCss, declared } from "@/test/atolye-css"
import { colourToHex, contrastRatio, hexToOklch } from "@/test/colour"

const tokens = atolyeCss("tokens.css")
const TONES = Object.keys(ATOLYE_TONES) as ThemeBackground[]

const surface = (tone: ThemeBackground, name: (typeof TONE_SURFACES)[number]) =>
  colourToHex(ATOLYE_TONES[tone][name])
const ink = (name: string) => colourToHex(declared(tokens, `--color-${name}`))

/** WCAG 2.2: body text (§1.4.3) and a control's edge (§1.4.11). */
const AA_TEXT = 4.5
const AA_PART = 3

describe("Atölye's page tones (adr/0062 §5)", () => {
  it("has a full surface set for every tone the settings offer", () => {
    expect([...TONES].sort()).toEqual(Object.keys(THEME_BACKGROUNDS).sort())
    for (const tone of TONES) {
      expect(Object.keys(ATOLYE_TONES[tone])).toEqual([...TONE_SURFACES])
    }
  })

  it("paints each tone's counter exactly as the backend's contrast check reads it", () => {
    for (const tone of TONES) {
      expect(surface(tone, "paper"), tone).toBe(THEME_BACKGROUNDS[tone])
    }
  })

  it("holds the wells (paper-2) the backend checks a newly saved main colour against", () => {
    // `THEME_WELLS` in the backend's theme section: the two must stay equal
    expect(Object.fromEntries(TONES.map((tone) => [tone, surface(tone, "paper-2")]))).toEqual({
      steel: "#eef1f4",
      warm: "#eeebe2",
      neutral: "#ececec",
      cool: "#e9ecf1",
    })
  })

  it("prints only plain colours for the tones that are printed", () => {
    for (const tone of TONES.filter((each) => each !== "steel")) {
      for (const name of TONE_SURFACES) {
        expect(ATOLYE_TONES[tone][name], `${tone} ${name}`).toMatch(/^#[0-9a-f]{6}$/)
      }
    }
  })

  it("derives every tone from its counter by Grafit's own lightness steps, its hue kept", () => {
    const lightness = (tone: ThemeBackground, name: (typeof TONE_SURFACES)[number]) =>
      hexToOklch(surface(tone, name)).lightness
    const steps = (tone: ThemeBackground) =>
      TONE_SURFACES.map((name) => lightness(tone, name) - lightness(tone, "paper"))
    const grafit = [0, -2.8, -6.8, 1, 0.2, -8.9]
    for (const tone of TONES) {
      steps(tone).forEach((step, index) => {
        // 8-bit channels move a step by a quarter point at most
        expect(
          Math.abs(step - (grafit[index] ?? 0)),
          `${tone} ${TONE_SURFACES[index]}`
        ).toBeLessThan(0.3)
      })
    }
    // Warm stays warm and cool stays cool down the wells; neutral has no tint
    for (const name of ["paper-2", "paper-3", "rule"] as const) {
      const warm = hexToOklch(surface("warm", name))
      const cool = hexToOklch(surface("cool", name))
      expect(warm.hue > 60 && warm.hue < 110, `warm ${name}`).toBe(true)
      expect(cool.hue > 230 && cool.hue < 280, `cool ${name}`).toBe(true)
      expect(hexToOklch(surface("neutral", name)).chroma).toBeLessThan(0.001)
    }
  })
})

describe("the fixed inks on every tone (adr/0062 §6, WCAG AA)", () => {
  it("reads text, secondary and tertiary text at 4.5:1 on every surface text stands on", () => {
    for (const tone of TONES) {
      for (const name of ["text", "text-2", "text-3"]) {
        for (const ground of ["paper", "paper-2", "paper-3", "field", "chip"] as const) {
          expect(
            contrastRatio(ink(name), surface(tone, ground)),
            `${name} on ${tone} ${ground}`
          ).toBeGreaterThanOrEqual(AA_TEXT)
        }
      }
    }
  })

  it("reads a field's example text at 4.5:1 on the field, the only ground it is drawn on", () => {
    for (const tone of TONES) {
      expect(
        contrastRatio(ink("placeholder"), surface(tone, "field")),
        tone
      ).toBeGreaterThanOrEqual(AA_TEXT)
    }
    // `.gf-field::placeholder` alone uses it; on a graphite stage the field has its own
    const users = [
      "base.css",
      "ui.css",
      "tabs.css",
      "buy.css",
      "pages.css",
      "content.css",
      "frame.css",
    ]
      .map((name) => atolyeCss(name).split("var(--color-placeholder)").length - 1)
      .reduce((sum, count) => sum + count, 0)
    expect(users).toBe(1)
    expect(atolyeCss("ui.css")).toMatch(
      /\.gf-field::placeholder \{\s+color: var\(--color-placeholder\);/
    )
  })

  it("draws a control's edge at 3:1 on the counter, both wells and the field", () => {
    for (const tone of TONES) {
      for (const ground of ["paper", "paper-2", "paper-3", "field"] as const) {
        expect(
          contrastRatio(ink("edge"), surface(tone, ground)),
          `edge on ${tone} ${ground}`
        ).toBeGreaterThanOrEqual(AA_PART)
      }
    }
  })

  it("keeps the tinted note readable: text on the main colour mixed 9% into any counter", () => {
    // The darkest a 9% tint can make a counter is black's: text still reads on it
    for (const tone of TONES) {
      const { lightness, chroma, hue } = hexToOklch(surface(tone, "paper"))
      const darkest = colourToHex(
        `oklch(${(lightness * 0.91).toFixed(2)}% ${(chroma * 0.91).toFixed(4)} ${hue.toFixed(2)})`
      )
      expect(contrastRatio(ink("text"), darkest), tone).toBeGreaterThanOrEqual(AA_TEXT)
    }
  })
})
