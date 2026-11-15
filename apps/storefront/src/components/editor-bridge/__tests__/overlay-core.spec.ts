// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  announceSelection,
  drawnSections,
  labelPlace,
  sectionAround,
  sectionStep,
  stepSection,
  strokeFactor,
} from "../overlay-core"

/** The editor layer's arithmetic (adr/0065 §4, Faz 2). */

afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

function page() {
  document.body.innerHTML = `
    <header data-qs="head01"><a id="logo" href="/">Logo</a></header>
    <section data-qs="shelf1"><div data-panel="1"><div data-qs="rail02"><span id="card">Kart</span></div></div></section>
    <section data-qs='a"]{}'><span id="odd">x</span></section>
    <footer data-qs="foot01"></footer>`
}

describe("finding the section pointed at", () => {
  it("is the nearest marked element around the pointer", () => {
    page()
    expect(sectionAround(document.getElementById("logo"))?.id).toBe("head01")
    // A rail drawn inside a tabbed shelf is its own section
    expect(sectionAround(document.getElementById("card"))?.id).toBe("rail02")
    expect(sectionAround(document.getElementById("card")?.firstChild)?.id).toBe("rail02")
    expect(sectionAround(document.body)).toBeNull()
  })

  it("skips a mark that is not a section id (never put in a selector)", () => {
    page()
    expect(sectionAround(document.getElementById("odd"))).toBeNull()
  })
})

describe("the sections in page order", () => {
  it("lists those with a box only, in page order", () => {
    page()
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
      this: Element
    ) {
      const size = this.getAttribute("data-qs") === "rail02" ? 0 : 100
      return { width: size, height: size } as DOMRect
    })
    expect(drawnSections(document).map((section) => section.id)).toEqual([
      "head01",
      "shelf1",
      "foot01",
    ])
  })

  it("steps with Alt+↓ and Alt+↑, held at the ends", () => {
    const ids = ["a00001", "b00002", "c00003"]
    expect(stepSection(ids, null, 1)).toBe("a00001")
    expect(stepSection(ids, null, -1)).toBe("c00003")
    expect(stepSection(ids, "a00001", 1)).toBe("b00002")
    expect(stepSection(ids, "c00003", 1)).toBe("c00003")
    expect(stepSection(ids, "a00001", -1)).toBe("a00001")
    expect(stepSection([], null, 1)).toBeNull()
    const key = { altKey: true, ctrlKey: false, metaKey: false, shiftKey: false }
    expect(sectionStep({ ...key, key: "ArrowDown" })).toBe(1)
    expect(sectionStep({ ...key, key: "ArrowUp" })).toBe(-1)
    expect(sectionStep({ ...key, key: "ArrowUp", ctrlKey: true })).toBeNull()
    expect(sectionStep({ ...key, key: "ArrowDown", altKey: false })).toBeNull()
  })
})

describe("the label at the frame's scale", () => {
  it("draws strokes larger as the frame is scaled down", () => {
    expect(strokeFactor(1)).toBe(1)
    expect(strokeFactor(0.5)).toBe(2)
    expect(strokeFactor(0)).toBe(20)
  })

  it("sits at the section's top right, kept on screen while the section is", () => {
    const viewport = { width: 1000, height: 800 }
    const box = (top: number, bottom: number) => ({
      top,
      bottom,
      left: 0,
      right: 900,
      width: 900,
      height: bottom - top,
    })
    expect(labelPlace(box(100, 400), viewport, 1)).toEqual({ top: 106, right: 106 })
    // Scrolled half away: the label stays at the top of the screen
    expect(labelPlace(box(-300, 400), viewport, 1)).toEqual({ top: 6, right: 106 })
    // At half scale, the gap doubles with the strokes
    expect(labelPlace(box(100, 400), viewport, 2)).toEqual({ top: 112, right: 112 })
  })
})

describe("the theme's editor events", () => {
  it("deselects the section left and selects the one chosen, bubbling", () => {
    page()
    const heard: string[] = []
    document.addEventListener("qt:section:select", (event) => {
      heard.push(`select ${(event as CustomEvent<{ sectionId: string }>).detail.sectionId}`)
    })
    document.addEventListener("qt:section:deselect", (event) => {
      heard.push(`deselect ${(event as CustomEvent<{ sectionId: string }>).detail.sectionId}`)
    })
    const at = (id: string) => {
      const element = document.querySelector(`[data-qs="${id}"]`)
      if (!element) {
        throw new Error(`no section ${id}`)
      }
      return { id, element }
    }
    announceSelection(null, at("head01"))
    announceSelection(at("head01"), at("rail02"))
    announceSelection(at("rail02"), null)
    expect(heard).toEqual(["select head01", "deselect head01", "select rail02", "deselect rail02"])
  })
})
