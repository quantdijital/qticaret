import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { bridgeMessage } from "@qticaret/types/editor-bridge"
import { DOC } from "../theme-editor.fixtures"
import { groupOf, sectionNames, usePreviewPicking } from "./use-preview-picking"
import type { PickMessage } from "./use-live-preview"

const pickOf = <T extends PickMessage["type"]>(
  type: T,
  payload: Extract<PickMessage, { type: T }>["payload"]
) => bridgeMessage(type, payload as never, 0) as PickMessage

function setup(connected = true) {
  const post = vi.fn(() => true)
  const onOpen = vi.fn()
  const onVisit = vi.fn()
  const onLand = vi.fn()
  const hook = renderHook(() =>
    usePreviewPicking({ doc: DOC, connected, post, onOpen, onVisit, onLand })
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
    expect(onLand).toHaveBeenCalledWith("/urun/a", "product")
  })
})
