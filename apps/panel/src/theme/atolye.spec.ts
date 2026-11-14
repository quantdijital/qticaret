import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
// The theme's own data, read as a file of the repository: the panel does not depend on the package
import { ATOLYE_TONES as THEME_TONES } from "../../../../packages/themes/atolye/src/tones"
import { HEADING_FONTS, SINGLE_WEIGHT_FONTS } from "../features/storefront/api/theme"
import {
  ATOLYE_BUTTON_RADIUS,
  ATOLYE_CARD_RATIO,
  ATOLYE_COLORS,
  ATOLYE_DISPLAY_WEIGHT,
  ATOLYE_NOTE_SHARE,
  ATOLYE_RADII,
  ATOLYE_RADIUS_SCALE,
  ATOLYE_SINGLE_WEIGHT,
  ATOLYE_TONES,
} from "./atolye"
import { STOREFRONT_BACKGROUNDS } from "./storefront"

/**
 * The panel's mirror of the Atölye theme against the theme's own files:
 * the settings form's sample must paint what the storefront paints
 * (adr/0062 §12). A token changed in the theme fails here until the mirror
 * follows.
 */

// Tests run from the package
const REPO = join(process.cwd(), "..", "..")
const read = (path: string) => readFileSync(join(REPO, path), "utf8")
const TOKENS = read("packages/themes/atolye/src/tokens.css")
const STYLES = read("packages/themes/atolye/src/styles.css")
const STOREFRONT_THEME = read("apps/storefront/src/lib/views/theme.ts")

/** `oklch(L% C H)` as `#rrggbb` (CSS Color 4: OKLCH → OKLab → linear sRGB → gamma, 8-bit). */
function oklchToHex(lightness: number, chroma: number, hue: number): string {
  const L = lightness / 100
  const a = chroma * Math.cos((hue * Math.PI) / 180)
  const b = chroma * Math.sin((hue * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  const channels = linear.map((value) => {
    const clipped = Math.min(1, Math.max(0, value))
    const gamma = clipped <= 0.0031308 ? 12.92 * clipped : 1.055 * clipped ** (1 / 2.4) - 0.055
    return Math.round(gamma * 255)
      .toString(16)
      .padStart(2, "0")
  })
  return `#${channels.join("")}`
}

/** A token's three OKLCH numbers as a stylesheet declares it. */
function oklchOf(css: string, name: string): [number, number, number] {
  const found = new RegExp(`${name}:\\s*oklch\\(([\\d.]+)%\\s+([\\d.]+)\\s+([\\d.]+)\\)`).exec(css)
  if (!found) {
    throw new Error(`the theme declares no oklch ${name}`)
  }
  return [Number(found[1]), Number(found[2]), Number(found[3])]
}

const token = (css: string, name: string) => oklchToHex(...oklchOf(css, name))

/** A tone's surface as `#rrggbb`, whether the theme wrote it so or in OKLCH. */
const surface = (value: string) => (value.startsWith("#") ? value : token(`v: ${value}`, "v"))

/** A number the storefront's theme view holds in one of its tables (`{ sharp: "0.2", … }`). */
function tableOf(name: string): string {
  const found = new RegExp(`const ${name} = \\{([^}]*)\\}`).exec(STOREFRONT_THEME)
  if (!found?.[1]) {
    throw new Error(`the storefront's theme view has no ${name}`)
  }
  return found[1]
}

const entry = (table: string, key: string): string | null => {
  const found = new RegExp(`["']?${key}["']?:\\s*(null|"[^"]*")`).exec(table)
  if (!found?.[1]) {
    throw new Error(`no ${key} in ${table}`)
  }
  return found[1] === "null" ? null : found[1].slice(1, -1)
}

describe("the panel's mirror of the Atölye theme", () => {
  it("holds the theme's colours as its stylesheets declare them", () => {
    expect(ATOLYE_COLORS).toEqual({
      wine: token(STYLES, "--primary"),
      stage: token(TOKENS, "--color-stage"),
      stageText: token(TOKENS, "--color-stage-text"),
      text: token(TOKENS, "--color-text"),
      text2: token(TOKENS, "--color-text-2"),
      text3: token(TOKENS, "--color-text-3"),
      edge: token(TOKENS, "--color-edge"),
      placeholder: token(TOKENS, "--color-placeholder"),
      star: token(TOKENS, "--color-star"),
    })
    // The page colour "steel" is the theme's own counter
    expect(STOREFRONT_BACKGROUNDS.steel).toBe(token(TOKENS, "--color-paper"))
  })

  it("draws the announcement bar on the theme's graphite, not on the main colour", () => {
    expect(STYLES).toMatch(/--announcement:\s*var\(--color-stage\)/)
    expect(STYLES).toMatch(/--announcement-foreground:\s*var\(--color-stage-text\)/)
  })

  it("holds the theme's corners, with or without the corner scale around them", () => {
    const px = (name: string) => {
      const found = new RegExp(`${name}:\\s*(?:calc\\(\\s*)?(\\d+)px`).exec(TOKENS)
      return found ? Number(found[1]) : null
    }
    expect(ATOLYE_RADII).toEqual({
      tile: px("--radius-tile"),
      media: px("--radius-media"),
      inner: px("--radius-inner"),
    })
    expect(STYLES).toMatch(/--button-radius:\s*999px/)
    expect(Number(/--display-weight:\s*(\d+)/.exec(TOKENS)?.[1])).toBe(ATOLYE_DISPLAY_WEIGHT)
  })

  it("scales corners, shapes buttons and cards as the storefront prints them", () => {
    const scale = tableOf("RADIUS_SCALE")
    expect(ATOLYE_RADIUS_SCALE).toEqual({
      sharp: Number(entry(scale, "sharp")),
      // Nothing printed: the theme's own scale
      soft: entry(scale, "soft") === null ? 1 : Number.NaN,
      round: Number(entry(scale, "round")),
    })
    const button = tableOf("BUTTON_RADIUS")
    expect(ATOLYE_BUTTON_RADIUS).toEqual({
      pill: entry(button, "pill") ?? "999px",
      rounded: entry(button, "rounded"),
      square: entry(button, "square"),
    })
    const ratio = tableOf("CARD_RATIO")
    expect(STYLES).toMatch(/--card-ratio:\s*1 \/ 1/)
    expect(ATOLYE_CARD_RATIO).toEqual({
      "4:5": entry(ratio, "4:5"),
      "1:1": entry(ratio, "1:1") ?? "1 / 1",
      "3:4": entry(ratio, "3:4"),
    })
  })

  it("holds each page colour's well and field as the theme's tone sets do", () => {
    const tones = Object.keys(STOREFRONT_BACKGROUNDS) as (keyof typeof STOREFRONT_BACKGROUNDS)[]
    expect(Object.keys(THEME_TONES).sort()).toEqual([...tones].sort())
    for (const tone of tones) {
      const own = THEME_TONES[tone]
      expect(STOREFRONT_BACKGROUNDS[tone], tone).toBe(surface(own.paper))
      expect(ATOLYE_TONES[tone], tone).toEqual({
        well: surface(own["paper-2"]),
        field: surface(own.field),
      })
    }
  })

  it("marks a selected chip in graphite and tints a note with the main colour until an accent is chosen", () => {
    expect(TOKENS).toMatch(/--color-mark:\s*var\(--color-text\)/)
    expect(TOKENS).toMatch(/--color-mark-ink:\s*var\(--color-paper\)/)
    expect(STYLES).toMatch(/--highlight:\s*var\(--color-signal\)/)
    const share =
      /--color-highlight-soft:\s*color-mix\(in oklab,\s*var\(--highlight\)\s*(\d+)%,\s*var\(--color-paper\)\)/.exec(
        TOKENS
      )
    expect(Number(share?.[1])).toBe(ATOLYE_NOTE_SHARE)
  })

  it("sets headings in each face's weight as the storefront prints it", () => {
    for (const font of HEADING_FONTS) {
      const found = new RegExp(`["']?${font}["']?:\\s*\\{[^}]*displayWeight:\\s*(\\d+)`).exec(
        STOREFRONT_THEME
      )
      expect(Number(found?.[1]), font).toBe(
        SINGLE_WEIGHT_FONTS.has(font) ? ATOLYE_SINGLE_WEIGHT : ATOLYE_DISPLAY_WEIGHT
      )
    }
  })
})
