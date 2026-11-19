import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { bridgeMessage } from "@qticaret/types/editor-bridge"
import { DOC } from "../theme-editor.fixtures"
import type { LayoutDocument, ProductsSection } from "@/features/storefront/api/layout"
import { newHomeSection } from "@/features/storefront/layout/sections"
import {
  fieldContext,
  groupOf,
  nameOf,
  sectionNames,
  usePreviewPicking,
} from "./use-preview-picking"
import type { PickMessage } from "./use-live-preview"

const pickOf = <T extends PickMessage["type"]>(
  type: T,
  payload: Extract<PickMessage, { type: T }>["payload"]
) => bridgeMessage(type, payload as never, 0) as PickMessage

function setup(connected = true, doc = DOC) {
  const post = vi.fn(() => true)
  const onOpen = vi.fn()
  const onVisit = vi.fn()
  const onLand = vi.fn()
  const hook = renderHook(() =>
    usePreviewPicking({ doc, connected, post, onOpen, onVisit, onLand })
  )
  return { hook, post, onOpen, onVisit, onLand }
}

/**
 * Picking in the preview, the panel's side (adr/0065 §6, Faz 2): what the
 * frame says is acted on only for ids the document has; a path is text.
 */
describe("picking in the preview", () => {
  it("knows a page by the body sections the frame shows", () => {
    expect(groupOf(DOC, ["mainheader", "mainproduct", "benzerurunler"])).toBe("product")
    expect(groupOf(DOC, ["mainheader", "girisbolumu"])).toBe("home")
    expect(groupOf(DOC, ["mainheader", "mainfooter"])).toBeNull()
    expect(groupOf(DOC, ["unknown01"])).toBeNull()
  })

  it("names every section as the tree does, footer included", () => {
    const names = sectionNames(DOC, (section, inFooter) => `${section.type}${inFooter ? "*" : ""}`)
    expect(names["girisbolumu"]).toBe("hero")
    expect(names["ebultenkutusu"]).toBe("newsletter*")
    expect(Object.keys(names)).toHaveLength(
      DOC.header.length +
        DOC.home.length +
        DOC.product.length +
        DOC.category.length +
        DOC.footer.length
    )
  })

  it("reads a name by its own entry only, never the prototype (BİLGİ-1)", () => {
    const names = { girisbolumu: "Açılış" }
    expect(nameOf(names, "girisbolumu")).toBe("Açılış")
    expect(nameOf(names, "constructor")).toBe("")
    expect(nameOf(names, "hasOwnProperty")).toBe("")
    expect(nameOf({ constructor: "Kurucu" }, "constructor")).toBe("Kurucu")
  })

  it("sends the edit word and the names once connected", () => {
    const { post } = setup()
    expect(post).toHaveBeenCalledWith(
      "labels",
      expect.objectContaining({ edit: "Düzenle", names: expect.any(Object) as unknown })
    )
  })

  it("sends the names again on each ready (a bridge set up again starts without them)", () => {
    const post = vi.fn(() => true)
    const noop = vi.fn()
    const hook = renderHook(
      ({ handshakes }) =>
        usePreviewPicking({
          doc: DOC,
          connected: true,
          handshakes,
          post,
          onOpen: noop,
          onVisit: noop,
          onLand: noop,
        }),
      { initialProps: { handshakes: 1 } }
    )
    const labels = () =>
      (post.mock.calls as unknown as [string, unknown][]).filter(([type]) => type === "labels")
    expect(labels()).toHaveLength(1)
    hook.rerender({ handshakes: 1 })
    expect(labels()).toHaveLength(1)
    hook.rerender({ handshakes: 2 })
    expect(labels()).toHaveLength(2)
  })

  it("cuts a long name to what the label carries", () => {
    const names = sectionNames(DOC, () => "x".repeat(300))
    expect(Object.values(names).every((name) => name.length === 80)).toBe(true)
  })

  it("opens a section the document has and says so; one it has not is ignored", () => {
    const { hook, onOpen } = setup()
    act(() => {
      hook.result.current.onPick(pickOf("click", { id: "unknown01" }))
    })
    expect(onOpen).not.toHaveBeenCalled()
    act(() => {
      hook.result.current.onPick(pickOf("click", { id: "yeniurunler" }))
    })
    expect(onOpen).toHaveBeenCalledWith("yeniurunler")
    expect(hook.result.current.announce).toMatch(/^Seçildi: /)
  })

  it("opens a section at a field its register knows (Faz 2b), said aloud", () => {
    const { hook, onOpen } = setup()
    act(() => {
      hook.result.current.onPick(pickOf("field", { id: "girisbolumu", field: "heading" }))
    })
    expect(onOpen).toHaveBeenCalledWith("girisbolumu", {
      target: "girisbolumu-heading",
      group: "content",
    })
    expect(hook.result.current.announce).toMatch(/^Seçildi: .*ilgili alana gidildi/)
    act(() => {
      hook.result.current.onPick(pickOf("field", { id: "duyurular", field: "lines.0" }))
    })
    expect(onOpen).toHaveBeenLastCalledWith("duyurular", {
      target: "duyurular-lines-0",
      group: "content",
    })
  })

  it("opens the section alone for a key it does not know there; ignores an unknown section", () => {
    const { hook, onOpen } = setup()
    act(() => {
      // The opening has no buttons: its first is not a field; a title is not the opening's
      hook.result.current.onPick(pickOf("field", { id: "girisbolumu", field: "links.0" }))
      hook.result.current.onPick(pickOf("field", { id: "girisbolumu", field: "title" }))
    })
    expect(onOpen.mock.calls).toEqual([
      ["girisbolumu", undefined],
      ["girisbolumu", undefined],
    ])
    expect(hook.result.current.announce).toMatch(/^Seçildi: /)
    expect(hook.result.current.announce).not.toMatch(/alana/)
    act(() => {
      hook.result.current.onPick(pickOf("field", { id: "unknown01", field: "heading" }))
    })
    expect(onOpen).toHaveBeenCalledTimes(2)
  })

  it("opens the rail a shelf's pill names, at its title, and a badge by the shared list", () => {
    const [one, two] = ["raf0000001", "raf0000002"].map(
      (id) => newHomeSection("products", id) as ProductsSection
    )
    if (!one || !two) throw new Error("no rails")
    const rails = [one, two]
    const doc: LayoutDocument = { ...DOC, home: rails }
    const found = { group: "home" as const, section: one, index: 0, page: null }
    expect(fieldContext(doc, found).shelf?.map((rail) => rail.id)).toEqual(rails.map((r) => r.id))
    expect(fieldContext(doc, found).badges).toBe(DOC.settings.trust_badges.length)
    const { hook, onOpen } = setup(true, doc)
    act(() => {
      hook.result.current.onPick(pickOf("field", { id: "raf0000001", field: "tabs.1.2" }))
    })
    expect(onOpen).toHaveBeenLastCalledWith("raf0000002", {
      target: "raf0000002-title",
      group: "content",
      section: "raf0000002",
    })
    act(() => {
      // The page drew three pills: the panel's shelf has two, so the shelf's own form opens
      hook.result.current.onPick(pickOf("field", { id: "raf0000001", field: "tabs.1.3" }))
    })
    expect(onOpen).toHaveBeenLastCalledWith("raf0000001", undefined)
  })

  it("lights a row for a known section only", () => {
    const { hook } = setup()
    act(() => {
      hook.result.current.onPick(pickOf("hover", { id: "unknown01" }))
    })
    expect(hook.result.current.hover.hovered).toBeNull()
    act(() => {
      hook.result.current.onPick(pickOf("hover", { id: "mainheader" }))
    })
    expect(hook.result.current.hover.hovered).toBe("mainheader")
  })

  it("shows a page asked for, or says the preview will not open it", () => {
    const { hook, onVisit, onLand } = setup()
    act(() => {
      hook.result.current.onPick(pickOf("navigate-request", { path: "/odeme", previewable: false }))
    })
    expect(onVisit).not.toHaveBeenCalled()
    expect(hook.result.current.blocked).toContain("/odeme")
    act(() => {
      hook.result.current.onPick(pickOf("navigate-request", { path: "/sepet", previewable: true }))
    })
    expect(onVisit).toHaveBeenCalledWith("/sepet")
    expect(hook.result.current.blocked).toBeNull()
    act(() => {
      hook.result.current.onPick(
        pickOf("location", { path: "/urun/a", sections: ["mainheader", "mainproduct"] })
      )
    })
    expect(onLand).toHaveBeenCalledWith("/urun/a", "product", null)
  })
})
