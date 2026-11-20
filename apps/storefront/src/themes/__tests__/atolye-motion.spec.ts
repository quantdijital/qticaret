import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { StoreThemeSettings } from "@qticaret/types"
import { DEFAULT_THEME, themeSettings, themeView } from "@/lib/views/theme"
import { ATOLYE_SOURCE, atolyeCss, ruleBody } from "@/test/atolye-css"
import { buildAtolyeCss } from "@/test/tailwind-build"
import { renderFrame, shopFixture } from "@/test/theme-render"
import { entry } from "../atolye"

/**
 * The motion (adr/0067 Ek 2026-11-18, S7) and the cards' smoother photo
 * swap. `calm`, the default, marks nothing; `lively` marks the theme's
 * root and its stylesheet (`motion.css`) is gated by the visitor's motion
 * preference, its hover rules by a mouse, its scroll reveal by the page's
 * own scroll so the first screen and the LCP picture never start hidden.
 */

const MOTION = atolyeCss("motion.css")
const CARD = atolyeCss("card.css")
const LIVELY = '[data-motion="lively"]'

const chosen = (patch: Partial<StoreThemeSettings>): StoreThemeSettings => ({
  ...DEFAULT_THEME,
  ...patch,
})

/** The frame's root element: the first tag the theme's Layout prints. */
const rootTag = (settings: StoreThemeSettings): string => {
  const html = renderFrame(atolyeTheme, shopFixture({ theme: themeView(settings) }))
  return /^<div[^>]*>/.exec(html)?.[0] ?? ""
}

const uncommented = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "")

/** The block an at-rule opens (its braces matched), from the at-rule's own text. */
function block(css: string, opening: string): string {
  const start = css.indexOf(`${opening} {`)
  if (start < 0) {
    throw new Error(`no ${opening}`)
  }
  let depth = 0
  for (let at = css.indexOf("{", start); at < css.length; at++) {
    depth += css[at] === "{" ? 1 : css[at] === "}" ? -1 : 0
    if (depth === 0) {
      return css.slice(start, at + 1)
    }
  }
  throw new Error(`${opening} is not closed`)
}

/** Every innermost rule: its selector and body. */
const rules = (css: string) =>
  [...uncommented(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector = "", body = ""]) => ({
    selector: selector.replace(/\s+/g, " ").trim(),
    body,
  }))

const count = (css: string, text: string) => uncommented(css).split(text).length - 1

const THEME_FILES = readdirSync(ATOLYE_SOURCE, { recursive: true, encoding: "utf8" }).filter(
  (file) => file.endsWith(".css") && !file.includes("__tests__")
)

describe("the motion setting (adr/0067 Ek 2026-11-18, S7)", () => {
  it("reads calm with no answer or an unknown step, lively when chosen", () => {
    expect(DEFAULT_THEME.motion).toBe("calm")
    expect(themeSettings({}, null).motion).toBe("calm")
    expect(themeSettings({ motion: "wild" }, null).motion).toBe("calm")
    expect(themeSettings({ motion: "lively" }, null).motion).toBe("lively")
  })

  it("marks nothing at calm, so every other look prints as before; lively marks the root", () => {
    expect(rootTag(DEFAULT_THEME)).toBe(
      '<div class="flex min-h-dvh flex-col" data-surface="filled">'
    )
    expect(rootTag(chosen({ motion: "calm" }))).not.toContain("data-motion")
    expect(rootTag(chosen({ motion: "lively" }))).toBe(
      '<div class="flex min-h-dvh flex-col" data-surface="filled" data-motion="lively">'
    )
    // Attributes only: no printed CSS for either step
    expect(entry.style(chosen({ motion: "lively" }))).toBeNull()
  })

  it("draws lively in motion.css only: no other stylesheet reads the mark", () => {
    const readers = THEME_FILES.filter((file) =>
      readFileSync(join(ATOLYE_SOURCE, file), "utf8").includes("data-motion")
    )
    expect(readers).toEqual(["motion.css"])
    expect(atolyeCss("styles.css")).toContain('@import "./motion.css";')
  })

  it("gates every lively rule by the visitor's motion preference", () => {
    const gated = block(MOTION, "@media (prefers-reduced-motion: no-preference)")
    expect(count(MOTION, LIVELY)).toBeGreaterThan(10)
    expect(count(gated, LIVELY)).toBe(count(MOTION, LIVELY))
    expect(MOTION).not.toContain("prefers-reduced-motion: reduce")
  })

  it("applies its hover effects only under a mouse", () => {
    const mouse = block(MOTION, "@media (hover: hover) and (pointer: fine)")
    const hovering = rules(MOTION).filter((rule) => rule.selector.includes(":hover"))
    expect(hovering.length).toBeGreaterThan(0)
    for (const rule of hovering) {
      expect(mouse, rule.selector).toContain(rule.body)
    }
  })

  it("moves only transform, translate, scale and opacity (and the lift's shadow paints)", () => {
    const moved = new Set(
      [...uncommented(MOTION).matchAll(/transition:([^;]+);/g)].flatMap(([, list = ""]) =>
        list.split(",").map((each) => each.trim().split(/\s+/)[0])
      )
    )
    for (const property of moved) {
      expect([
        "transform",
        "translate",
        "scale",
        "opacity",
        "box-shadow",
        "background-color",
        "color",
        "border-color",
        "--gf-head-shade",
      ]).toContain(property)
    }
  })

  it("fades the header's shadow by its gradient, never by opacity (no layer of its own)", () => {
    // An opacity fade gave the 12 px strip under the sticky header its own
    // compositor layer, where Chrome could show a stale piece of the page (2026-11-20)
    expect(ruleBody(MOTION, "@property --gf-head-shade")).toContain("initial-value: 0;")
    const shadow = rules(MOTION).filter((rule) => rule.selector.endsWith(".gf-head::after"))
    expect(shadow).toHaveLength(2)
    for (const rule of shadow) {
      expect(rule.body).not.toMatch(/opacity|will-change|transform/)
    }
    const [drawn, scrolled] = shadow
    expect(drawn?.body).toMatch(/transition:\s*--gf-head-shade var\(--dur-short\)/)
    expect(drawn?.body).toContain("oklch(20% 0.012 255 / calc(0.07 * var(--gf-head-shade)))")
    expect(scrolled?.selector).toBe(
      'html[data-js-scroll] [data-motion="lively"]:not([data-shadow="none"]) .gf-head::after'
    )
    expect(scrolled?.body).toMatch(/--gf-head-shade:\s*1;/)
  })
})

describe("the scroll reveal never hides the first screen or the LCP picture", () => {
  const reveal = rules(MOTION).find((rule) => rule.body.includes("animation-timeline"))

  it("runs only where the browser drives animations by scrolling", () => {
    expect(block(MOTION, "@supports (animation-timeline: view())")).toContain(
      "animation-timeline: view(), scroll(root)"
    )
  })

  it("leaves out a page's opening and anything holding an eager or high-priority picture", () => {
    expect(reveal?.selector).toContain(".gf-section:not([data-thin], :has(.gf-card))")
    expect(reveal?.selector).toContain(':has(img[fetchpriority="high"], img[loading="eager"])')
    expect(reveal?.selector).not.toMatch(/\bimg\b(?![^)]*\))/)
    // Katalog's opening (its LCP picture) is not a gf-section
    const lock = "../../lib/__tests__/preset-lock/cutlery-katalog/home-01-katalogacilis.html"
    const opening = readFileSync(new URL(lock, import.meta.url), "utf8")
    expect(opening).toContain('fetchPriority="high"')
    expect(opening).not.toMatch(/class="gf-section"/)
  })

  it("shows everything fully at the top of the page: the gate starts shut and opens by scrolling", () => {
    const body = reveal?.body ?? ""
    expect(body).toContain("opacity: calc(1 - var(--gf-gate) * (1 - var(--gf-seen)));")
    expect(body).toContain("translate: 0 calc(var(--gf-gate) * (1 - var(--gf-seen)) * 0.875rem);")
    // At scroll 0 (and on a page that cannot scroll, an inactive timeline) the gate is 0
    expect(ruleBody(MOTION, "@property --gf-gate")).toContain("initial-value: 0;")
    expect(ruleBody(MOTION, "@property --gf-seen")).toContain("initial-value: 1;")
    expect(block(MOTION, "@keyframes gf-gate")).toMatch(/from \{\s*--gf-gate: 0;/)
    expect(body).toMatch(/animation-range:[\s\S]*,\s*0 10rem;/)
  })

  it("fades lazy images only, never an eager (LCP) one", () => {
    // What starts unseen: only the waiting images
    const hide = rules(MOTION).filter((rule) => /opacity:\s*0;/.test(rule.body))
    expect(hide.map((rule) => rule.selector)).toEqual([
      'html[data-js-img] [data-motion="lively"] main img[loading="lazy"]:not([data-js-loaded])',
    ])
  })
})

describe("the cards' photo swap, every look (sahip 2026-11-18)", () => {
  it("crossfades over ~420 ms with the gentle ease, in and out", () => {
    const fade = block(
      CARD,
      "@media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)"
    )
    expect(fade).toContain("opacity var(--dur-long) var(--ease-gentle)")
    expect(fade).toContain("display var(--dur-long) allow-discrete")
    expect(atolyeCss("tokens.css")).toContain("--dur-long: 420ms;")
  })

  it("keeps the second photo unseen until its picture is decoded, once the script runs", () => {
    expect(uncommented(CARD).replace(/\s+/g, " ")).toContain(
      "html[data-js-img] .gf-card:is(:hover, :focus-within) .gf-card-slide--second:not(:has(img[data-js-loaded])) { opacity: 0; }"
    )
  })
})

describe("the built stylesheet", () => {
  it("keeps the motion's property types, its gate and its reveal through Tailwind", async () => {
    const css = (await buildAtolyeCss([])).replace(/\s+/g, " ")
    expect(css).toContain("@property --gf-gate")
    expect(css).toContain("@property --gf-head-shade")
    expect(css).toContain("transition: --gf-head-shade")
    expect(css).toContain("@keyframes gf-seen")
    expect(css).toContain("animation-timeline: view(), scroll(root)")
    expect(css).toContain("--ease-gentle: cubic-bezier(0.4, 0, 0.2, 1)")
  })
})
