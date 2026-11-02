import { describe, expect, it } from "vitest"
import type { LayoutDocument, ProductsSection } from "@/features/storefront/api/layout"
import { HISTORY_LIMIT, editorReducer, initialEditorState } from "./editor-state"
import type { EditorAction, EditorState } from "./editor-state"
import { newAnnouncementBar, newFooterNewsletter, newHomeSection, newSectionId } from "./sections"

const hero = newHomeSection("hero", "girisbolumu")
const products = newHomeSection("products", "yeniurunler") as ProductsSection
const posts = newHomeSection("posts", "blogyazilari")

const DOC: LayoutDocument = {
  header: [{ ...newAnnouncementBar("duyurular"), lines: ["Kargo bedava"] }],
  home: [hero, products, posts],
  footer: [newFooterNewsletter("ebultenkutusu")],
}

const run = (actions: EditorAction[], from: EditorState = initialEditorState(DOC)) =>
  actions.reduce(editorReducer, from)

const order = (state: EditorState) => state.doc.home.map((section) => section.id)

describe("editorReducer", () => {
  it("adds a home section at the end or at a place, and one of a kind to the header", () => {
    const banner = newHomeSection("banner", "kampanyabanner")
    expect(order(run([{ type: "add", group: "home", section: banner }]))).toEqual([
      "girisbolumu",
      "yeniurunler",
      "blogyazilari",
      "kampanyabanner",
    ])
    expect(order(run([{ type: "add", group: "home", section: banner, at: 1 }]))).toEqual([
      "girisbolumu",
      "kampanyabanner",
      "yeniurunler",
      "blogyazilari",
    ])
    // The header holds one announcement bar: a second one is not added, nor an id twice
    const second = run([
      { type: "add", group: "header", section: newAnnouncementBar("ikincisi") },
      { type: "add", group: "home", section: { ...banner, id: "girisbolumu" } },
    ])
    expect(second.doc).toBe(DOC)
    expect(second.past).toEqual([])
  })

  it("moves a section to a new place, and ignores a move to where it is", () => {
    const moved = run([{ type: "move", id: "blogyazilari", to: 0 }])
    expect(order(moved)).toEqual(["blogyazilari", "girisbolumu", "yeniurunler"])
    expect(order(run([{ type: "move", id: "girisbolumu", to: 99 }]))).toEqual([
      "yeniurunler",
      "blogyazilari",
      "girisbolumu",
    ])
    const still = run([{ type: "move", id: "yeniurunler", to: 1 }])
    expect(still.doc).toBe(DOC)
    expect(still.past).toHaveLength(0)
  })

  it("duplicates a home section right after it under a new id, settings and all", () => {
    const state = run([{ type: "duplicate", id: "yeniurunler" }])
    const ids = order(state)
    expect(ids).toHaveLength(4)
    expect(ids.slice(0, 2)).toEqual(["girisbolumu", "yeniurunler"])
    const copy = state.doc.home[2]
    if (!copy) throw new Error("no copy")
    expect(copy.id).toMatch(/^[a-z0-9]{12}$/)
    expect(copy).toEqual({ ...products, id: copy.id })
    // A copy is its own: changing it leaves the original as it was
    expect(copy).not.toBe(products)
    // The header's bar is one of a kind
    expect(run([{ type: "duplicate", id: "duyurular" }]).doc).toBe(DOC)
  })

  it("removes and hides a section in whichever group holds it", () => {
    const state = run([
      { type: "remove", id: "yeniurunler" },
      { type: "toggle", id: "ebultenkutusu" },
      { type: "toggle", id: "girisbolumu" },
    ])
    expect(order(state)).toEqual(["girisbolumu", "blogyazilari"])
    expect(state.doc.footer[0]?.visible).toBe(false)
    expect(state.doc.home[0]?.visible).toBe(false)
    expect(state.doc.header).toBe(DOC.header)
  })

  it("updates a section's settings, typing in one field being one step", () => {
    const typed = (title: string): EditorAction => ({
      type: "update",
      section: { ...products, title },
      merge: "yeniurunler:title",
    })
    const state = run([typed("Y"), typed("Ye"), typed("Yeni")])
    expect(state.doc.home[1]).toMatchObject({ title: "Yeni" })
    expect(state.past).toHaveLength(1)
    // Another field starts a step of its own
    const more = run(
      [{ type: "update", section: { ...products, title: "Yeni", limit: 6 }, merge: "x:limit" }],
      state
    )
    expect(more.past).toHaveLength(2)
    const back = run([{ type: "undo" }], more)
    expect(back.doc.home[1]).toMatchObject({ title: "Yeni", limit: 12 })
    expect(run([{ type: "undo" }], back).doc).toBe(DOC)
  })

  it("undoes and redoes each step; a new change after an undo drops what was undone", () => {
    const changed = run([
      { type: "move", id: "blogyazilari", to: 0 },
      { type: "toggle", id: "girisbolumu" },
    ])
    const undone = run([{ type: "undo" }, { type: "undo" }], changed)
    expect(undone.doc).toBe(DOC)
    expect(undone.future).toHaveLength(2)
    // Nothing more to undo
    expect(run([{ type: "undo" }], undone)).toBe(undone)
    const redone = run([{ type: "redo" }, { type: "redo" }], undone)
    expect(redone.doc).toBe(changed.doc)
    expect(run([{ type: "redo" }], redone)).toBe(redone)

    const branched = run([{ type: "undo" }, { type: "remove", id: "yeniurunler" }], changed)
    expect(branched.future).toEqual([])
  })

  it("keeps a limited history, and a loaded document starts a new one", () => {
    let state = initialEditorState(DOC)
    for (let step = 0; step < HISTORY_LIMIT + 10; step++) {
      state = editorReducer(state, { type: "toggle", id: "girisbolumu" })
    }
    expect(state.past).toHaveLength(HISTORY_LIMIT)
    const loaded = editorReducer(state, { type: "load", doc: DOC })
    expect(loaded).toEqual(initialEditorState(DOC))
  })

  it("makes ids of 12 lowercase letters and digits, never one already taken", () => {
    const taken = new Set(["aaaaaaaaaaaa"])
    for (let round = 0; round < 50; round++) {
      const id = newSectionId(taken)
      expect(id).toMatch(/^[a-z0-9]{12}$/)
      expect(taken.has(id)).toBe(false)
      taken.add(id)
    }
  })
})
