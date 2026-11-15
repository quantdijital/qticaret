// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  announceSelection,
  drawnSections,
  labelPlace,
  sectionAround,
  SELECTED_MARK,
  sectionStep,
  settleSelection,
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

  it("hangs under a short section at the top of the view, on the left", () => {
    const viewport = { width: 1000, height: 800 }
    const box = (top: number, bottom: number) => ({
      top,
      bottom,
      left: 0,
      right: 1000,
      width: 1000,
      height: bottom - top,
    })
    // The page's header: its cart and search stay clear
    expect(labelPlace(box(0, 80), viewport, 1)).toEqual({ top: 80, left: 6 })
    expect(labelPlace(box(0, 80), viewport, 2)).toEqual({ top: 80, left: 12 })
    // A tall section at the top, or a short one further down, keeps the corner inside
    expect(labelPlace(box(0, 600), viewport, 1)).toEqual({ top: 6, right: 6 })
    expect(labelPlace(box(200, 280), viewport, 1)).toEqual({ top: 206, right: 6 })
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

  it("announces a section chosen before it was drawn once a redraw brings it", () => {
    page()
    const heard: string[] = []
    document.addEventListener("qt:section:select", (event) => {
      heard.push((event as CustomEvent<{ sectionId: string }>).detail.sectionId)
    })
    // Not drawn yet: nothing to announce
    expect(settleSelection(null, "fresh1", document)).toBeNull()
    const fresh = document.createElement("section")
    fresh.setAttribute("data-qs", "fresh1")
    document.body.append(fresh)
    const chosen = settleSelection(null, "fresh1", document)
    expect(chosen?.element).toBe(fresh)
    expect(fresh.hasAttribute(SELECTED_MARK)).toBe(true)
    // Already announced: a later redraw says nothing again
    expect(settleSelection(chosen, "fresh1", document)).toBe(chosen)
    // Drawn anew (a new element with the same id): the new one is announced
    const again = document.createElement("section")
    again.setAttribute("data-qs", "fresh1")
    fresh.replaceWith(again)
    expect(settleSelection(chosen, "fresh1", document)?.element).toBe(again)
    expect(heard).toEqual(["fresh1", "fresh1"])
  })

  it("marks the chosen section for a theme part that listens late", () => {
    page()
    const head = document.querySelector('[data-qs="head01"]')
    const rail = document.querySelector('[data-qs="rail02"]')
    if (!head || !rail) {
      throw new Error("no sections")
    }
    announceSelection(null, { id: "head01", element: head })
    expect(head.hasAttribute(SELECTED_MARK)).toBe(true)
    announceSelection({ id: "head01", element: head }, { id: "rail02", element: rail })
    expect(head.hasAttribute(SELECTED_MARK)).toBe(false)
    expect(rail.hasAttribute(SELECTED_MARK)).toBe(true)
    announceSelection({ id: "rail02", element: rail }, null)
    expect(document.querySelector(`[${SELECTED_MARK}]`)).toBeNull()
  })
})
