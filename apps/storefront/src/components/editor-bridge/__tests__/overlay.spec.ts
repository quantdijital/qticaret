// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createOverlay, type Overlay } from "../overlay"

/**
 * The editor layer with its field part (adr/0065 §9, Faz 2b): a field
 * label belongs to the section framed; another section clears it; the
 * keyboard's field labels follow the section's own. The layer's shadow
 * root is closed; here it is opened so the test can look inside.
 */

let shadow: ShadowRoot | null = null
let overlay: Overlay | null = null

beforeEach(() => {
  document.body.innerHTML = `
    <section data-qs="giris1"><h1 data-qf="heading" id="heading">Bıçak ve çakı</h1></section>
    <section data-qs="marka1"><h2 data-qf="title" id="title">Markalar</h2></section>`
  // On the subclass: the base's own method stays, and does the work
  vi.spyOn(HTMLElement.prototype, "attachShadow").mockImplementation(function (
    this: Element,
    init: ShadowRootInit
  ) {
    shadow = Element.prototype.attachShadow.call(this, { ...init, mode: "open" })
    return shadow
  })
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    top: 100,
    bottom: 300,
    left: 0,
    right: 800,
    width: 800,
    height: 200,
  } as DOMRect)
  vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(1000)
  vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(800)
})

afterEach(() => {
  overlay?.destroy()
  overlay = null
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

function layer() {
  const onEdit = vi.fn()
  const onEditField = vi.fn()
  overlay = createOverlay({ nonce: undefined, touch: false, onEdit, onEditField })
  overlay.setLabels("Düzenle", { giris1: "Açılış", marka1: "Markalar" })
  return { overlay, onEdit, onEditField }
}

/** A part of the page or the layer that the test set up. */
const must = <T>(found: T | null | undefined): T => {
  if (found === null || found === undefined) {
    throw new Error("missing")
  }
  return found
}
const fieldLabel = () => must(shadow?.querySelector<HTMLButtonElement>(".flabel"))
const el = (id: string) => document.getElementById(id) as Element

describe("the editor layer's field labels", () => {
  it("asks for the framed section's form at the field pressed", () => {
    const { overlay, onEdit, onEditField } = layer()
    overlay.show("giris1")
    overlay.showField({ key: "heading", element: el("heading") })
    expect(fieldLabel().classList.contains("on")).toBe(true)
    fieldLabel().click()
    expect(onEditField).toHaveBeenCalledWith("giris1", "heading")
    expect(onEdit).not.toHaveBeenCalled()
  })

  it("shows no field label without a section framed, and drops it for another section", () => {
    const { overlay } = layer()
    overlay.showField({ key: "heading", element: el("heading") })
    expect(fieldLabel().classList.contains("on")).toBe(false)
    overlay.show("giris1")
    overlay.showField({ key: "heading", element: el("heading") })
    overlay.show("marka1")
    expect(fieldLabel().classList.contains("on")).toBe(false)
  })

  it("gives the keyboard the section's fields after its own label", () => {
    const { overlay, onEditField } = layer()
    overlay.show("marka1")
    overlay.focusLabel()
    const buttons = [...(shadow?.querySelectorAll("button") ?? [])]
    const own = buttons.findIndex((button) => button.classList.contains("label"))
    const field = buttons.findIndex((button) => button.classList.contains("fhandle"))
    expect(own).toBeGreaterThanOrEqual(0)
    expect(field).toBeGreaterThan(own)
    expect(shadow?.activeElement).toBe(buttons[own])
    buttons[field]?.click()
    expect(onEditField).toHaveBeenCalledWith("marka1", "title")
  })

  it("names a section by the labels' own entry only, never the prototype (BİLGİ-1)", () => {
    document.body.innerHTML = `<section data-qs="constructor"><h1>Bölüm</h1></section>`
    const { overlay } = layer()
    overlay.show("constructor")
    const label = must(shadow?.querySelector<HTMLButtonElement>(".label"))
    expect(label.getAttribute("aria-label")).toBe("Düzenle")
    expect(label.textContent).not.toContain("function")
    // Named by the panel: shown
    overlay.setLabels("Düzenle", { constructor: "Kurucu" })
    expect(label.getAttribute("aria-label")).toBe("Düzenle: Kurucu")
  })
})
