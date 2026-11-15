// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { fieldAround, fieldLabelPlace, isFieldKey, sectionFields } from "../overlay-core"

/** The editor layer's field arithmetic (adr/0065 §9, Faz 2b). */

afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

function page() {
  document.body.innerHTML = `
    <section data-qs="giris1">
      <h1 data-qf="heading"><span id="word">Başlık</span></h1>
      <p data-qf="text" id="line">Satır</p>
      <a data-qf="links.0" id="button">Düğme</a>
      <a data-qf="links.0" id="again">Aynı anahtar</a>
      <p data-qf='a"]{}' id="odd">Bozuk</p>
      <p data-qf="slides.1.heading" id="away">Dönmüş slayt</p>
      <span id="plain">Düz</span>
      <div data-qs="rail02"><h2 data-qf="title" id="inner">İç bölüm</h2></div>
    </section>
    <h2 data-qf="title" id="outside">Dışarıda</h2>`
}

const el = (id: string) => document.getElementById(id)
/** A part of the page or the layer that the test set up. */
const must = <T>(found: T | null | undefined): T => {
  if (found === null || found === undefined) {
    throw new Error("missing")
  }
  return found
}
const section = () => must(document.querySelector('[data-qs="giris1"]'))

describe("a field key", () => {
  it("is the schema's form only", () => {
    expect(isFieldKey("heading")).toBe(true)
    expect(isFieldKey("slides.2.links.1")).toBe(true)
    expect(isFieldKey('a"]{}')).toBe(false)
    expect(isFieldKey("Heading")).toBe(false)
    expect(isFieldKey(`a${"b".repeat(80)}`)).toBe(false)
  })
})

describe("the field pointed at", () => {
  it("is the nearest mark up to the section", () => {
    page()
    expect(fieldAround(el("word"), section())?.key).toBe("heading")
    expect(fieldAround(el("word")?.firstChild, section())?.key).toBe("heading")
    expect(fieldAround(el("button"), section())?.element).toBe(el("button"))
  })

  it("is none outside any mark, and never one of the page around the section", () => {
    page()
    expect(fieldAround(el("plain"), section())).toBeNull()
    expect(fieldAround(section(), section())).toBeNull()
    const inner = must(document.querySelector('[data-qs="rail02"]'))
    // The inner section's title is its own field
    expect(fieldAround(el("inner"), inner)?.key).toBe("title")
    // The walk stops at the section: the page around it is never read
    expect(fieldAround(inner, section())).toBeNull()
    document.body.setAttribute("data-qf", "title")
    expect(fieldAround(el("plain"), section())).toBeNull()
    document.body.removeAttribute("data-qf")
  })

  it("is none for a mark that is not a field key (never put in a selector)", () => {
    page()
    expect(fieldAround(el("odd"), section())).toBeNull()
  })
})

describe("the fields the keyboard reaches", () => {
  it("are the section's own drawn marks inside its box, in page order, each key once", () => {
    page()
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
      this: Element
    ) {
      if (this.getAttribute("data-qs") === "giris1") {
        return { top: 0, bottom: 500, left: 0, right: 800, width: 800, height: 500 } as DOMRect
      }
      // A slide turned away sits beside the section's box
      const left = this.id === "away" ? 900 : 10
      return { top: 10, bottom: 40, left, right: left + 100, width: 100, height: 30 } as DOMRect
    })
    expect(sectionFields(section()).map((field) => field.key)).toEqual([
      "heading",
      "text",
      "links.0",
    ])
    expect(sectionFields(section())[2]?.element).toBe(el("button"))
  })

  it("skip a field with no box", () => {
    page()
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
      this: Element
    ) {
      const size = this.id === "line" ? 0 : 100
      return { top: 0, bottom: size, left: 0, right: size, width: size, height: size } as DOMRect
    })
    expect(sectionFields(section()).map((field) => field.key)).not.toContain("text")
  })
})

describe("where a field's label sits", () => {
  const view = { width: 1000, height: 800 }
  const size = { width: 64, height: 22 }
  const rect = (top: number, left = 100, height = 40) => ({
    top,
    bottom: top + height,
    left,
    right: left + 200,
    width: 200,
    height,
  })

  it("is on the field's top left edge, outside it, touching", () => {
    expect(fieldLabelPlace(rect(300), view, 1, size)).toEqual({ top: 278, left: 100 })
    // At the frame's scale the label is larger
    expect(fieldLabelPlace(rect(300), view, 2, size)).toEqual({ top: 256, left: 100 })
  })

  it("is inside the field when the view's top cuts it, and on screen at the right edge", () => {
    expect(fieldLabelPlace(rect(10), view, 1, size)).toEqual({ top: 10, left: 100 })
    expect(fieldLabelPlace(rect(-30), view, 1, size)).toEqual({ top: 0, left: 100 })
    expect(fieldLabelPlace(rect(300, 980), view, 1, size).left).toBe(936)
  })

  it("hangs under the field when it would meet the section's label", () => {
    const avoid = { top: 270, bottom: 300, left: 90, right: 200, width: 110, height: 30 }
    expect(fieldLabelPlace(rect(300), view, 1, size, avoid)).toEqual({ top: 340, left: 100 })
    // No room under it: it stays above
    expect(fieldLabelPlace(rect(760), view, 1, size, { ...avoid, top: 730, bottom: 760 })).toEqual({
      top: 738,
      left: 100,
    })
  })
})
