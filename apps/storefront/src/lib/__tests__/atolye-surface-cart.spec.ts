import { describe, expect, it } from "vitest"
import { ATOLYE_TONES } from "@qticaret/theme-atolye"
import type { StoreThemeSettings, ThemeBackground } from "@qticaret/types"
import { DEFAULT_THEME } from "@/lib/views/theme"
import { atolyeCss, declared, ruleBody } from "@/test/atolye-css"
import { colourToHex, contrastRatio, hexToOklch } from "@/test/colour"
import { buildAtolyeCss } from "@/test/tailwind-build"
import { entry } from "@/themes/atolye"

/**
 * The cart at `surface_style: lined` (Tezgâh): its summary's subtotal well
 * and a line's quantity were drawn a step off their box's `filled` tone
 * (the paper, the field) and vanished into a ruled box on the paper. The
 * checks resolve the colours the built stylesheet paints, per page tone:
 * at `lined` each stands apart from its box; at `filled` no new rule
 * matches and each resolves to the colour it always had.
 */

const TONES = Object.keys(ATOLYE_TONES) as ThemeBackground[]
const tokens = atolyeCss("tokens.css")
const LINED = '[data-surface="lined"]'

/** The custom properties a page resolves at a tone, `lined` adding the root's box variables. */
function properties(tone: ThemeBackground, lined: boolean): Map<string, string> {
  const map = new Map<string, string>([["--color-edge", declared(tokens, "--color-edge")]])
  for (const [name, value] of Object.entries(ATOLYE_TONES[tone])) {
    map.set(`--color-${name}`, value)
  }
  const settings: StoreThemeSettings = {
    ...DEFAULT_THEME,
    surface_style: lined ? "lined" : "filled",
  }
  const root = entry.style(settings) ?? ""
  for (const [, name = "", value = ""] of root.matchAll(/(--[\w-]+):([^;}]+)/g)) {
    map.set(name, value)
  }
  return map
}

/** A value with its `var()`s resolved (fallbacks taken when the property is unset), as `#rrggbb`. */
function resolve(value: string, map: Map<string, string>): string {
  const found = /^var\((--[\w-]+)(?:,\s*(.+))?\)$/.exec(value.trim())
  if (!found) {
    return colourToHex(value)
  }
  const [, name = "", fallback] = found
  const next = map.get(name) ?? fallback
  if (next === undefined) {
    throw new Error(`${name} is unset`)
  }
  return resolve(next, map)
}

const declaration = (body: string, property: string) => {
  const found = new RegExp(`${property}:\\s*([^;]+);`).exec(body)
  if (!found?.[1]) {
    throw new Error(`no ${property} in ${body}`)
  }
  return found[1].trim()
}

/** The at-rules a rule sits in (`[]`: unlayered), outermost first. */
function around(css: string, selector: string): string[] {
  // The rule as written at its line's start, unlayered or indented in a layer
  const found = new RegExp(`\\n *${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{`).exec(css)
  expect(found, selector).not.toBeNull()
  const start = found?.index ?? 0
  const open: string[] = []
  let head = 0
  for (let at = 0; at < start; at++) {
    const char = css[at]
    if (char === "{") {
      open.push(css.slice(head, at).trim())
    } else if (char === "}") {
      open.pop()
    }
    if (char === "{" || char === "}" || char === ";") {
      head = at + 1
    }
  }
  return open
}

const lightness = (hex: string) => hexToOklch(hex).lightness

const css = await buildAtolyeCss(["bg-paper", "bg-paper-2", "bg-field"])
const ground = (selector: string) => declaration(ruleBody(css, selector), "background-color")
/** What each paints: the cart's box, the subtotal well, a line's quantity and its ring. */
const box = ground(".gf-box")
const well = {
  filled: ground(".bg-paper"),
  lined: ground(`${LINED} :is(.gf-pane, .gf-box) .gf-shape`),
}
const stepper = ground(".bg-field")
const stepperLine = declaration(ruleBody(css, `${LINED} .gf-stepper::after`), "box-shadow")

describe("the cart at lined boxes (Tezgâh)", () => {
  it("sets the subtotal well apart from its ruled box by the step it has at filled", () => {
    for (const tone of TONES) {
      const filled = properties(tone, false)
      const lined = properties(tone, true)
      const filledStep = lightness(resolve(box, filled)) - lightness(resolve(well.filled, filled))
      // Before: the well's paper on the ruled box's paper, no step at all
      expect(resolve(well.filled, lined), tone).toBe(resolve(box, lined))
      // Now the same pair of tones, the other way round: the tone on the paper
      const linedStep = lightness(resolve(well.lined, lined)) - lightness(resolve(box, lined))
      expect(Math.abs(filledStep), tone).toBeGreaterThan(2)
      expect(linedStep, tone).toBeCloseTo(filledStep, 6)
    }
  })

  it("rings a line's quantity at lined with a field's edge, at 3:1 on its box and its pill", () => {
    expect(stepperLine.startsWith("inset 0 0 0 1px ")).toBe(true)
    const line = stepperLine.replace("inset 0 0 0 1px ", "")
    // The edge a field takes: `.gf-field` and the product page's quantity field
    expect(atolyeCss("ui.css")).toMatch(/\.gf-field \{[^}]*border: 1px solid var\(--color-edge\);/)
    for (const tone of TONES) {
      const lined = properties(tone, true)
      const edge = resolve(line, lined)
      // Before: the field's light ground on the ruled box's paper, a lightness point apart
      expect(
        Math.abs(lightness(resolve(stepper, lined)) - lightness(resolve(box, lined))),
        tone
      ).toBeLessThan(1.5)
      expect(contrastRatio(edge, resolve(box, lined)), tone).toBeGreaterThanOrEqual(3)
      expect(contrastRatio(edge, resolve(stepper, lined)), tone).toBeGreaterThanOrEqual(3)
    }
  })

  it("draws the ring over the minus and plus, inside the pill, unlayered", () => {
    expect(ruleBody(css, `${LINED} .gf-stepper`)).toContain("position: relative;")
    const ring = ruleBody(css, `${LINED} .gf-stepper::after`)
    for (const part of [
      "position: absolute;",
      "inset: 0;",
      "border-radius: inherit;",
      "pointer-events: none;",
    ]) {
      expect(ring).toContain(part)
    }
    expect(around(css, `${LINED} .gf-stepper`)).toEqual([])
    expect(around(css, `${LINED} .gf-stepper::after`)).toEqual([])
    expect(around(css, `${LINED} :is(.gf-pane, .gf-box) .gf-shape`)).toEqual([])
    expect(around(css, ".bg-paper")).toEqual(["@layer utilities"])
  })

  it("changes nothing at filled: no rule names the well or the quantity without the lined mark", () => {
    const rules = css.match(/[^\n{}]*\.gf-(shape|stepper)\b[^\n{]*\{/g) ?? []
    expect(rules.length).toBeGreaterThan(0)
    for (const rule of rules) {
      expect(rule).toContain(LINED)
    }
    for (const tone of TONES) {
      const filled = properties(tone, false)
      // The colours they always had: the well the paper, the pill the field, the box the tone
      expect(resolve(well.filled, filled), tone).toBe(colourToHex(ATOLYE_TONES[tone].paper))
      expect(resolve(stepper, filled), tone).toBe(colourToHex(ATOLYE_TONES[tone].field))
      expect(resolve(box, filled), tone).toBe(colourToHex(ATOLYE_TONES[tone]["paper-2"]))
    }
  })

  it("marks the subtotal well a shape and the quantity a stepper", () => {
    expect(atolyeCss("cart/CartSummary.tsx")).toMatch(/rounded-media gf-shape bg-paper p-4/)
    expect(atolyeCss("parts/Stepper.tsx")).toMatch(/rounded-button gf-stepper bg-field/)
  })
})
