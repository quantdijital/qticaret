import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { StoreThemeSettings } from "@qticaret/types"
import type { ShopView } from "@qticaret/ui"
import { DEFAULT_THEME, themeView } from "@/lib/views/theme"
import { ATOLYE_SOURCE, atolyeCss } from "@/test/atolye-css"
import { renderFrame, shopFixture } from "@/test/theme-render"

/**
 * `menu_style` (adr/0067 S1, step 1): the menus' one recipe in `menu.css`,
 * its `underline` and `plain` steps read from the theme root's
 * `data-menu-style`. The markup is the same in every step; only the
 * stylesheet tells them apart.
 */

interface Rule {
  selector: string
  body: string
  layered: boolean
}

/** A stylesheet's style rules, comments out, each with whether it sits in an `@layer`. */
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
        found.push({
          selector: selector.replace(/\s+/g, " "),
          body: text.slice(start, at),
          layered: open.some((each) => each.startsWith("@layer")),
        })
      }
      start = at + 1
    }
  }
  return found
}

const MENU = rules(atolyeCss("menu.css"))
const STEP = MENU.filter((rule) => rule.selector.includes("data-menu-style"))
/** The step rules whose selector names this. */
const naming = (part: string) => STEP.filter((rule) => rule.selector.includes(part))

const HEADERS = {
  standard: {},
  centered: { headerBar: { id: "mainheader", variant: "centered", sticky: true } },
  catalog: {
    headerBar: {
      id: "mainheader",
      variant: "catalog",
      sticky: true,
      catalog: {
        searchPlaceholder: null,
        searchLabel: false,
        accountText: true,
        cartTotal: false,
        highlight: null,
        utilityBar: true,
        phone: true,
        categories: [
          {
            label: "Mutfak",
            path: "/kategori/mutfak",
            children: [{ label: "Şef bıçakları", path: "/kategori/mutfak/sef" }],
          },
        ],
        menuGround: "stage",
      },
    },
  },
} as const satisfies Record<string, Partial<ShopView>>

const frame = (header: keyof typeof HEADERS, menu?: StoreThemeSettings["menu_style"]) =>
  renderFrame(
    atolyeTheme,
    shopFixture({
      ...HEADERS[header],
      ...(menu ? { theme: themeView({ ...DEFAULT_THEME, menu_style: menu }) } : {}),
    })
  )
const headerOf = (html: string) => html.slice(html.indexOf("<header"), html.indexOf("</header>"))
/** Every class list on an element carrying this class. */
const classesWith = (html: string, name: string) =>
  [...html.matchAll(/class="([^"]*)"/g)]
    .map((match) => match[1] ?? "")
    .filter((list) => list.split(" ").includes(name))

describe("menu_style in the three headers", () => {
  it.each(Object.keys(HEADERS) as (keyof typeof HEADERS)[])(
    "draws the %s header's items from the recipe, the markup the same in every step",
    (header) => {
      const html = frame(header)
      expect(html).not.toContain("data-menu-style")
      const items = classesWith(html, "gf-menu-item")
      expect(items.length).toBeGreaterThan(0)
      for (const list of [...items, ...classesWith(html, "gf-menu-row")]) {
        // The hovered and open look lives in menu.css only, so one step can rewrite it
        expect(list).not.toMatch(/(?:^| )(?:hover:bg-|data-\[state=open\]:|aria-expanded:bg-)/)
      }
      for (const menu of ["underline", "plain"] as const) {
        const marked = frame(header, menu)
        expect(marked).toContain(`data-menu-style="${menu}"`)
        expect(headerOf(marked)).toBe(headerOf(html))
      }
    }
  )

  it("gives each item and the Kategoriler button words with their heavier copy's text", () => {
    const html = headerOf(frame("catalog"))
    expect(html).toMatch(/<span class="gf-menu-word" data-text="Çakılar">Çakılar<\/span>/)
    expect(html).toMatch(/<span class="gf-menu-word" data-text="Kategoriler">Kategoriler<\/span>/)
    expect(html).toContain("gf-bar-button")
    expect(classesWith(html, "gf-tool").length).toBeGreaterThanOrEqual(3)
  })
})

describe("menu_style's steps in the stylesheet", () => {
  it("writes every step rule under the root's mark, in the layer of the rule it rewrites", () => {
    expect(STEP.length).toBeGreaterThan(0)
    const mark =
      /^(?:\[data-menu-style="(?:underline|plain)"\]|:is\(\[data-menu-style="underline"\], \[data-menu-style="plain"\]\)) /
    for (const rule of STEP) {
      for (const part of rule.selector.split(/,(?![^(]*\))/)) {
        expect(part.trim(), rule.selector).toMatch(mark)
      }
      // The tools' hover (`.gf-icon-btn:hover`, ui.css) is unlayered; the menus' recipe is a component
      expect(rule.layered, rule.selector).toBe(!rule.selector.includes(".gf-tool"))
    }
  })

  it("takes the fill, the box and the bar line away in both steps, a press keeping its fill", () => {
    const [clear] = naming('.gf-menu-item[data-state="open"]').filter((rule) =>
      rule.body.includes("transparent")
    )
    for (const part of [
      ".gf-menu-item:hover",
      '.gf-bar-button[aria-expanded="true"]',
      ".gf-menu-row:hover",
      ".gf-drop-row:hover:not(:active)",
    ]) {
      expect(clear?.selector).toContain(part)
    }
    expect(clear?.body).toContain("box-shadow: none")
    expect(MENU.find((rule) => rule.selector === ".gf-drop-row:active")?.body).toContain(
      "var(--color-paper-3)"
    )
  })

  it("draws underline's 2 px line in the item's own ink, and underlines a row's words", () => {
    const line = naming("::after").find((rule) => rule.selector.includes(".gf-menu-item:hover"))
    expect(line?.selector).toMatch(/^\[data-menu-style="underline"\]/)
    expect(line?.body).toContain("height: 2px")
    expect(line?.body).toContain("background: currentColor")
    const words = naming(".gf-menu-word").find((rule) => rule.body.includes("underline"))
    expect(words?.body).toContain("text-decoration-thickness: 2px")
    expect(naming(".gf-tool").some((rule) => rule.body.includes("height: 2px"))).toBe(true)
  })

  it("turns plain's words heavier, open too, their width kept by the hidden copy", () => {
    const heavy = naming(".gf-menu-word").find((rule) => rule.body.includes("font-weight: 800"))
    expect(heavy?.selector).toContain('.gf-menu-item[data-state="open"]')
    expect(heavy?.selector).toContain('.gf-bar-button[aria-expanded="true"]')
    const copy = naming(".gf-menu-word[data-text]::after")[0]
    expect(copy?.body).toContain("content: attr(data-text)")
    expect(copy?.body).toContain("visibility: hidden")
    expect(copy?.body).toContain("font-weight: 800")
    // The catalog bar's items may shrink (no wrap): the clipped copy still holds the width
    expect(copy?.body).toContain("min-width: max-content")
    // Open is never colour alone: the arrow turns as well
    expect(headerOf(frame("standard"))).toContain("group-data-[state=open]:rotate-180")
  })

  it("keeps the focus ring in every step and leaves the phone's sheet alone", () => {
    expect(MENU.filter((rule) => rule.body.includes("outline"))).toEqual([])
    expect(atolyeCss("base.css")).toMatch(
      /:focus-visible \{\s*outline: 2px solid var\(--color-focus\)/
    )
    const sheet = readFileSync(`${ATOLYE_SOURCE}frame/MenuSheet.tsx`, "utf8")
    expect(sheet).not.toMatch(/gf-menu-(?:item|row|word)|gf-drop-row|gf-tool/)
    expect(sheet).toContain("hover:bg-paper-2 hover:text-text active:bg-paper-3")
  })
})
