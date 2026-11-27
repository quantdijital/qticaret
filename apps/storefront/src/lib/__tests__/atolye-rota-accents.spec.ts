import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { HomeSectionView } from "@qticaret/ui"
import type { StoreStepsSection } from "@qticaret/types"
import { styleKitAttributes } from "@qticaret/types/style-kit"
import { t } from "@/lib/i18n"
import { atolyeCss } from "@/test/atolye-css"
import { stepsView } from "@/lib/views/points"
import { renderPage } from "@/test/theme-render"

/**
 * Three settings brought from Rota's reference (Nepalora): the style kit's
 * S10 `section_title` (a heading's words between asterisks as its accent),
 * the steps' `connector` and the scroller's `focus`. Each off by default,
 * and at its default the page prints what it did before.
 */

const howTo = (over: Partial<StoreStepsSection> = {}): StoreStepsSection => ({
  id: "adimlar01",
  type: "steps",
  title: "Yolculuğunuz *dört adımda*",
  intro: null,
  items: [
    { title: "Seçin", text: null },
    { title: "Ayırtın", text: null },
    { title: "Yola çıkın", text: null },
  ],
  link: null,
  ...over,
})

const home = (sections: HomeSectionView[]) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections } })

const steps = (over: Partial<StoreStepsSection> = {}) => {
  const view = stepsView(howTo(over), t)
  if (!view) {
    throw new Error("no steps")
  }
  return home([view])
}

describe("a section heading's accent words", () => {
  it("draws the words between asterisks as its accent, a heading without them as before", () => {
    const html = steps()
    expect(html).toContain('Yolculuğunuz <em class="gf-title-em">dört adımda</em>')
    expect(html).not.toContain("*")
    const bare = steps({ title: "Yolculuğunuz dört adımda" })
    expect(bare).toContain(">Yolculuğunuz dört adımda</h2>")
    expect(bare).not.toContain("gf-title-em")
    // A lone asterisk stays as written
    expect(steps({ title: "Yıldız * tek" })).toContain(">Yıldız * tek</h2>")
  })

  it("marks the kit's step on the root only off its default", () => {
    expect(styleKitAttributes({ section_title: "plain" })).toEqual({})
    expect(styleKitAttributes({ section_title: "serif_accent" })).toEqual({
      "data-section-title": "serif_accent",
    })
  })
})

describe("the steps' dotted line and the scroller's centre focus", () => {
  it("marks the dotted line on a row only, nothing by default", () => {
    expect(steps()).not.toContain("data-connector")
    expect(steps({ connector: "dotted" })).toContain('data-connector="dotted"')
    expect(steps({ connector: "dotted", layout: "column" })).not.toContain("data-connector")
  })

  it("keeps every rule under its own mark", () => {
    const strip = (file: string) => atolyeCss(file).replace(/\/\*[\s\S]*?\*\//g, "")
    const selectors = (file: string) =>
      (strip(file).match(/[^{}]+(?=\{)/g) ?? [])
        .map((selector) => selector.trim())
        .filter((selector) => !selector.startsWith("@") && !/^\d+%/.test(selector))
    for (const selector of selectors("steps-connector.css")) {
      expect(selector).toContain('[data-connector="dotted"]')
    }
    expect(strip("scroller-focus.css")).toContain('.gf-scroller[data-focus="center"]')
    expect(strip("section-title.css")).toContain('[data-section-title="serif_accent"]')
  })
})
