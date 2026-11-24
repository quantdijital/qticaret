// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { HomeSectionView, ProgramSectionView, ProgramStepView } from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"
// The theme's own part: it exports pages, not this
import { ProgramAccordion } from "../../../../../packages/themes/atolye/src/sections/ProgramAccordion"

/**
 * A dated product's program in the Grafit theme (adr/0078): `timeline`
 * every step open down a rule, `accordion` rows that open with the first
 * open; each step's words stay in the HTML either way.
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const step = (n: number, extra: Partial<ProgramStepView> = {}): ProgramStepView => ({
  label: `${String(n)}. Gün`,
  title: `Durak ${String(n)}`,
  bodyHtml: `<p>Gün ${String(n)} metni</p>`,
  image: null,
  tags: [],
  ...extra,
})

const program = (over: Partial<ProgramSectionView> = {}): ProgramSectionView => ({
  id: "program-1",
  type: "program",
  title: "Program",
  variant: "timeline",
  steps: [
    step(1, {
      tags: [
        { key: "breakfast", label: "Kahvaltı" },
        { key: "accommodation", label: "Konaklama" },
      ],
      image: {
        src: "/media/goreme.jpg",
        alt: "Peri bacaları",
        width: 1600,
        height: 1200,
        sources: { avif: null, webp: "/media/goreme.webp 800w" },
      },
    }),
    step(2),
    step(3, { bodyHtml: null }),
  ],
  ...over,
})

const home = (sections: HomeSectionView[]) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections } })

describe("the program section, timeline", () => {
  it("draws every step open in order, its label, title, body, picture and tags", () => {
    const html = home([program()])
    expect(html).toContain(">Program</h2>")
    expect(html.match(/<h3/g)).toHaveLength(3)
    expect(html.indexOf("Durak 1")).toBeLessThan(html.indexOf("Durak 2"))
    expect(html).toContain("1. Gün")
    expect(html).toContain("<p>Gün 2 metni</p>")
    expect(html).toContain('alt="Peri bacaları"')
    expect(html).toContain('loading="lazy"')
    expect(html).toContain('type="image/webp"')
    expect(html).toContain("Kahvaltı")
    expect(html).toContain("Konaklama")
    // Nothing opens or closes: no buttons, nothing hidden
    expect(html).not.toContain("aria-expanded")
    expect(html).not.toContain(' hidden=""')
  })
})

describe("the program section, accordion", () => {
  it("names each row's state, the first open, the others' words in the HTML but hidden", () => {
    const html = home([program({ variant: "accordion" })])
    expect(html.match(/aria-expanded="true"/g)).toHaveLength(1)
    expect(html.match(/aria-expanded="false"/g)).toHaveLength(2)
    expect(html).toContain('aria-controls="program-program-1-0"')
    expect(html).toMatch(/id="program-program-1-0" class="[^"]*"/)
    expect(html).toMatch(/hidden="" id="program-program-1-1"|id="program-program-1-1" hidden=""/)
    expect(html).toContain("<p>Gün 2 metni</p>")
  })

  describe("opening and closing", () => {
    let host: HTMLDivElement
    let root: Root

    beforeEach(() => {
      host = document.createElement("div")
      document.body.append(host)
      root = createRoot(host)
    })

    afterEach(() => {
      act(() => {
        root.unmount()
      })
      host.remove()
    })

    it("opens a closed row and closes an open one on its button", () => {
      act(() => {
        root.render(<ProgramAccordion section={program({ variant: "accordion" })} />)
      })
      const buttons = [...host.querySelectorAll("button")]
      const panel = (index: number) => host.querySelector(`#program-program-1-${String(index)}`)
      expect(buttons.map((button) => button.getAttribute("aria-expanded"))).toEqual([
        "true",
        "false",
        "false",
      ])
      act(() => {
        buttons[1]?.click()
      })
      expect(buttons[1]?.getAttribute("aria-expanded")).toBe("true")
      expect(panel(1)?.hasAttribute("hidden")).toBe(false)
      act(() => {
        buttons[0]?.click()
      })
      expect(buttons[0]?.getAttribute("aria-expanded")).toBe("false")
      expect(panel(0)?.hasAttribute("hidden")).toBe(true)
    })
  })
})
