import { readdirSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import { DEFAULT_THEME, themeView } from "@/lib/views/theme"
import { ATOLYE_SOURCE, atolyeCss, declared, ruleBody } from "@/test/atolye-css"
import { renderFrame, shopFixture } from "@/test/theme-render"

/**
 * `shadow` (adr/0067 S2, step 2): the floating surfaces' one shadow, named
 * by whether the surface has an edge of its own (`tokens.css`), and its
 * `none` step read from the theme root's `data-shadow` (`shadow.css`).
 */

/**
 * The surfaces with a rule of their own: `none` takes the shadow and draws
 * nothing. The WhatsApp button counts as edged: its full green fill already
 * stands off any ground, and a pale ring round it reads as a halo.
 */
const EDGED = [
  "frame/Aisle.tsx",
  "frame/BackToTop.tsx",
  "frame/CategoryMenu.tsx",
  "frame/WhatsApp.tsx",
  "listing/Menu.tsx",
  "product/BuyBar.tsx",
]
/** The surfaces with no edge: `none` draws a 1 px rule in the shadow's place. */
const BARE = [
  "cart/CartPage.tsx",
  "frame/ConsentFrame.tsx",
  "frame/QuickViewDialog.tsx",
  "frame/Sheet.tsx",
  "parts/QuickAdd.tsx",
  "parts/QuickViewButton.tsx",
  "product/Installments.tsx",
  "product/Write.tsx",
]

const source = (file: string) => readFileSync(`${ATOLYE_SOURCE}${file}`, "utf8")
/** Every shadow utility a file's class lists name. */
const shadows = (file: string) =>
  [...source(file).matchAll(/\bshadow-float[a-z-]*/g)].map((m) => m[0])
/** The theme's component files, recursively, relative to its source. */
const components = (dir = ""): string[] =>
  readdirSync(`${ATOLYE_SOURCE}${dir}`, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? components(`${dir}${entry.name}/`)
      : entry.name.endsWith(".tsx") && !dir.includes("__tests__")
        ? [`${dir}${entry.name}`]
        : []
  )

interface Rule {
  selector: string
  body: string
  layer: string | null
}

/** A stylesheet's style rules, comments out, each with the `@layer` it sits in. */
function rules(css: string): Rule[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "")
  const found: Rule[] = []
  const open: string[] = []
  let start = 0
  for (let at = 0; at < text.length; at++) {
    const char = text[at]
    if (char === "{") {
      open.push(text.slice(start, at).trim())
      start = at + 1
    } else if (char === "}") {
      const selector = open.pop() ?? ""
      if (!selector.startsWith("@")) {
        const layer = open.find((each) => each.startsWith("@layer"))
        found.push({
          selector: selector.replace(/\s+/g, " "),
          body: text.slice(start, at),
          layer: layer ? layer.replace("@layer", "").trim() : null,
        })
      }
      start = at + 1
    }
  }
  return found
}

const STEP = rules(atolyeCss("shadow.css"))
const stepFor = (part: string) => STEP.find((rule) => rule.selector.includes(part))
const MARK = '[data-shadow="none"]'
const LINE = "0 0 0 1px var(--color-rule)"

describe("the floating surfaces' shadow (adr/0067 S2)", () => {
  it("is one value under two names, today's shadow", () => {
    const tokens = atolyeCss("tokens.css")
    expect(declared(tokens, "--shadow-float")).toBe(
      "0 12px 32px oklch(20% 0.012 255 / 0.14), 0 1px 2px oklch(20% 0.012 255 / 0.08)"
    )
    expect(declared(tokens, "--shadow-float-edged")).toBe("var(--shadow-float)")
  })

  it("names the edged shadow on every surface with a rule of its own", () => {
    for (const file of EDGED) {
      expect(shadows(file).length, file).toBeGreaterThan(0)
      expect(new Set(shadows(file)), file).toEqual(new Set(["shadow-float-edged"]))
    }
    expect(ruleBody(atolyeCss("menu.css"), ".gf-drop")).toContain("border: 1px solid")
    expect(ruleBody(atolyeCss("menu.css"), ".gf-drop")).toContain(
      "box-shadow: var(--shadow-float-edged)"
    )
    expect(ruleBody(atolyeCss("ui.css"), ".gf-suggest")).toContain(
      "box-shadow: var(--shadow-float-edged)"
    )
  })

  it("keeps the plain shadow on every surface with no edge", () => {
    for (const file of BARE) {
      expect(new Set(shadows(file)), file).toEqual(new Set(["shadow-float"]))
    }
    const sheet = ruleBody(atolyeCss("pages.css"), ".gf-sheet")
    expect(sheet).toContain("border: 0")
    expect(sheet).toContain("box-shadow: var(--shadow-float)")
  })

  it("leaves no floating surface unsorted: a new one must pick its name", () => {
    const named = components().filter((file) => shadows(file).length > 0)
    expect(named.sort()).toEqual([...EDGED, ...BARE].sort())
  })
})

describe("shadow's none step in the stylesheet", () => {
  it("draws the rule round an edgeless utility surface, read from an ancestor's mark", () => {
    const bare = stepFor(".shadow-float")
    expect(bare?.selector).toBe(`${MARK} .shadow-float`)
    expect(bare?.layer).toBe("utilities")
    // On the surface itself, so the rule is the one of the section it sits in
    expect(bare?.body.trim()).toBe(`--tw-shadow: ${LINE};`)
  })

  it("takes the shadow from an edged utility surface and draws nothing", () => {
    const edged = stepFor(".shadow-float-edged")
    expect(edged?.selector).toBe(`${MARK} .shadow-float-edged`)
    expect(edged?.layer).toBe("utilities")
    expect(edged?.body.trim()).toBe("--tw-shadow: 0 0 #0000;")
  })

  it("does the same for the dropdown, the suggestions and the filter sheet, in their layer", () => {
    const panels = stepFor(".gf-drop")
    expect(panels?.selector).toBe(`${MARK} :is(.gf-drop, .gf-suggest)`)
    expect(panels?.layer).toBe("components")
    expect(panels?.body.trim()).toBe("box-shadow: none;")
    const sheet = stepFor(".gf-sheet")
    // Its no-script look (`:target:not([data-ready])`, its own outline) keeps the stronger selector
    expect(sheet?.selector).toBe('[data-shadow="none"] .gf-sheet')
    expect(sheet?.layer).toBe("components")
    expect(sheet?.body.trim()).toBe(`box-shadow: ${LINE};`)
    expect(atolyeCss("pages.css")).toMatch(
      /\.gf-sheet:target:not\(\[data-ready\]\) \{[^}]*box-shadow: none;/
    )
  })

  it("writes every rule under the mark and nothing for the default step", () => {
    expect(STEP).toHaveLength(4)
    for (const rule of STEP) {
      expect(rule.selector.startsWith(`${MARK} `), rule.selector).toBe(true)
    }
    expect(atolyeCss("shadow.css")).not.toContain('data-shadow="float"')
    expect(atolyeCss("styles.css")).toContain('@import "./shadow.css";')
  })
})

describe("the mark on the theme's root", () => {
  const frame = (shadow?: "none") =>
    renderFrame(
      atolyeTheme,
      shopFixture(shadow ? { theme: themeView({ ...DEFAULT_THEME, shadow }) } : {})
    )

  it("prints nothing at today's step and data-shadow for none, the markup otherwise the same", () => {
    const html = frame()
    expect(html).not.toContain("data-shadow")
    const marked = frame("none")
    expect(marked).toContain('data-shadow="none"')
    expect(marked.replace(' data-shadow="none"', "")).toBe(html)
  })
})
