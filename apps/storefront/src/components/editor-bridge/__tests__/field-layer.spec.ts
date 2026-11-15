// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createFieldLayer } from "../field-layer"

/**
 * The editor layer's field part (adr/0065 §9, Faz 2b): the field pointed
 * at gets a frame and an edit label, pressing it asks for the section's
 * form at that field; from the keyboard each field of the section gets a
 * label. (The overlay keeps it in a closed shadow root; here an open one
 * lets the test look inside.)
 */

let root: ShadowRoot

beforeEach(() => {
  document.body.innerHTML = `
    <section data-qs="giris1">
      <h1 data-qf="heading" id="heading">Bıçak ve çakı</h1>
      <div data-qf="image" id="image"><img alt="Atölye vitrini" src="/a.jpg"></div>
      <a data-qf="links.1" id="button">Tüm ürünler</a>
    </section>`
  const host = document.createElement("div")
  document.body.append(host)
  root = host.attachShadow({ mode: "open" })
  // jsdom lays nothing out: the frame's view as a 1000×800 window
  vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(1000)
  vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(800)
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (this.getAttribute("data-qs") === "giris1") {
      return { top: 0, bottom: 600, left: 0, right: 900, width: 900, height: 600 } as DOMRect
    }
    return { top: 100, bottom: 140, left: 20, right: 220, width: 200, height: 40 } as DOMRect
  })
})

afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

const el = (id: string) => document.getElementById(id) as Element
/** A part of the page or the layer that the test set up. */
const must = <T>(found: T | null | undefined): T => {
  if (found === null || found === undefined) {
    throw new Error("missing")
  }
  return found
}
const section = () => must(document.querySelector('[data-qs="giris1"]'))
const label = () => must(root.querySelector<HTMLButtonElement>(".flabel"))
const frame = () => must(root.querySelector<HTMLElement>(".fbox"))
const handles = () => [...root.querySelectorAll<HTMLButtonElement>(".fhandle")]

describe("a field's edit label", () => {
  it("frames the field pointed at and asks for its form when pressed", () => {
    const onEdit = vi.fn()
    const layer = createFieldLayer({ root, onEdit })
    layer.setWord("Düzenle")
    layer.show({ id: "giris1", key: "heading", element: el("heading") })
    expect(frame().classList.contains("on")).toBe(true)
    expect(label().classList.contains("on")).toBe(true)
    expect(label().textContent).toBe("Düzenle")
    expect(label().getAttribute("aria-label")).toBe("Düzenle: Bıçak ve çakı")
    // Positions through the CSSOM: above the field's top left edge
    expect(label().style.left).toBe("20px")
    label().click()
    expect(onEdit).toHaveBeenCalledWith("giris1", "heading")
  })

  it("names a picture by its words, and goes when the pointer leaves", () => {
    const layer = createFieldLayer({ root, onEdit: vi.fn() })
    layer.setWord("Düzenle")
    layer.show({ id: "giris1", key: "image", element: el("image") })
    expect(label().getAttribute("aria-label")).toBe("Düzenle: Atölye vitrini")
    layer.show(null)
    expect(label().classList.contains("on")).toBe(false)
    expect(frame().classList.contains("on")).toBe(false)
    expect(layer.shown()).toBeNull()
  })

  it("shows nothing before the panel sent its word", () => {
    const layer = createFieldLayer({ root, onEdit: vi.fn() })
    layer.show({ id: "giris1", key: "heading", element: el("heading") })
    expect(label().classList.contains("on")).toBe(false)
  })

  it("writes the page's words as text, never as markup", () => {
    el("heading").textContent = '<img src=x onerror="alert(1)">'
    const layer = createFieldLayer({ root, onEdit: vi.fn() })
    layer.setWord("Düzenle")
    layer.show({ id: "giris1", key: "heading", element: el("heading") })
    expect(root.querySelector("img")).toBeNull()
  })
})

describe("the keyboard's field labels", () => {
  it("label each field of the section, each asking for its own field", () => {
    const onEdit = vi.fn()
    const layer = createFieldLayer({ root, onEdit })
    layer.setWord("Düzenle")
    layer.handles({ id: "giris1", element: section() })
    expect(handles().map((button) => button.getAttribute("aria-label"))).toEqual([
      "Düzenle: Bıçak ve çakı",
      "Düzenle: Atölye vitrini",
      "Düzenle: Tüm ürünler",
    ])
    handles()[2]?.click()
    expect(onEdit).toHaveBeenCalledWith("giris1", "links.1")
  })

  it("frame the field focused, and go when the pointer is back or the section is left", () => {
    const layer = createFieldLayer({ root, onEdit: vi.fn() })
    layer.setWord("Düzenle")
    layer.handles({ id: "giris1", element: section() })
    handles()[0]?.dispatchEvent(new FocusEvent("focus"))
    expect(frame().classList.contains("on")).toBe(true)
    // The keyboard's label names it already: no second label
    expect(label().classList.contains("on")).toBe(false)
    layer.show({ id: "giris1", key: "image", element: el("image") })
    expect(handles()).toHaveLength(0)
    layer.handles({ id: "giris1", element: section() })
    layer.handles(null)
    expect(handles()).toHaveLength(0)
  })

  it("leave nothing behind when destroyed", () => {
    const layer = createFieldLayer({ root, onEdit: vi.fn() })
    layer.setWord("Düzenle")
    layer.handles({ id: "giris1", element: section() })
    layer.destroy()
    expect(root.childElementCount).toBe(0)
  })
})
