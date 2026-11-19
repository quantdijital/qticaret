import { describe, expect, it } from "vitest"
import type { LayoutDocument } from "@/features/storefront/api/layout"
import {
  DOC_WITH_PAGES,
  FULL_PAGES,
  PAGE_LAYOUTS,
  pageSection,
} from "@/features/storefront/editor/content-pages.fixtures"
import { DOC } from "@/features/storefront/editor/theme-editor.fixtures"
import { editorReducer, initialEditorState } from "./editor-state"
import type { EditorAction } from "./editor-state"
import { marqueeLimitIds } from "./page-limits"
import { pageSectionsOf, pagesFull } from "./page-layouts"
import { allSections, findSection, idsOf } from "./sections"

const run = (doc: LayoutDocument, ...actions: EditorAction[]) =>
  actions.reduce(editorReducer, initialEditorState(doc))

const ids = (doc: LayoutDocument, page: string) => pageSectionsOf(doc, page).map((s) => s.id)

/** The content pages' own layouts in the editor's document (adr/0073 §1, §5). */
describe("a content page's layout in the editor", () => {
  it("makes the page's entry with its first section and takes it away with its last", () => {
    const added = run(DOC, {
      type: "add",
      group: "pages",
      page: "cnt_hakkimizda",
      section: pageSection("help", "ilkyardim"),
    })
    expect(added.doc.pages).toEqual([
      { page_id: "cnt_hakkimizda", sections: [pageSection("help", "ilkyardim")] },
    ])
    expect(added.past).toHaveLength(1)

    const removed = editorReducer(added, { type: "remove", id: "ilkyardim" })
    expect(removed.doc.pages).toEqual([])
    // Undo brings the page's layout back
    expect(editorReducer(removed, { type: "undo" }).doc.pages).toHaveLength(1)
  })

  it("finds a page's section, its ids among the document's, and leaves the other pages alone", () => {
    expect(findSection(DOC_WITH_PAGES, "iletisimsss")).toMatchObject({
      group: "pages",
      page: "cnt_iletisim",
      index: 0,
    })
    expect(idsOf(DOC_WITH_PAGES).has("yorumlar")).toBe(true)
    expect(allSections(DOC_WITH_PAGES).map((s) => s.id)).toContain("hakkimizdayardim")

    const state = run(DOC_WITH_PAGES, { type: "toggle", id: "yorumlar" })
    expect(pageSectionsOf(state.doc, "cnt_hakkimizda")[1]).toMatchObject({ visible: false })
    expect(state.doc.pages[1]).toBe(PAGE_LAYOUTS[1])
    expect(state.doc.home).toBe(DOC_WITH_PAGES.home)
  })

  it("keeps the sections above the text first, moving and placing within the page", () => {
    const top = pageSection("banner", "ustbant", "top")
    const state = run(DOC_WITH_PAGES, {
      type: "add",
      group: "pages",
      page: "cnt_hakkimizda",
      section: top,
    })
    expect(ids(state.doc, "cnt_hakkimizda")).toEqual(["ustbant", "hakkimizdayardim", "yorumlar"])

    const moved = editorReducer(state, { type: "move", id: "yorumlar", to: 0 })
    expect(ids(moved.doc, "cnt_hakkimizda")).toEqual(["ustbant", "yorumlar", "hakkimizdayardim"])

    const placed = editorReducer(moved, { type: "place", id: "yorumlar", placement: "top" })
    expect(ids(placed.doc, "cnt_hakkimizda")).toEqual(["ustbant", "yorumlar", "hakkimizdayardim"])
    expect(pageSectionsOf(placed.doc, "cnt_hakkimizda")[1]).toMatchObject({ placement: "top" })

    const copied = editorReducer(placed, { type: "duplicate", id: "ustbant", copyId: "ustbant2" })
    expect(ids(copied.doc, "cnt_hakkimizda")).toEqual([
      "ustbant",
      "ustbant2",
      "yorumlar",
      "hakkimizdayardim",
    ])
  })

  it("holds twelve sections on a page and twenty pages with a layout", () => {
    const twelve = Array.from({ length: 12 }, (_, at) =>
      pageSection("help", `yardim${String(at).padStart(4, "0")}`)
    )
    const full: LayoutDocument = {
      ...DOC,
      pages: [{ page_id: "cnt_hakkimizda", sections: twelve }],
    }
    const more = run(full, {
      type: "add",
      group: "pages",
      page: "cnt_hakkimizda",
      section: pageSection("faq", "fazlasss"),
    })
    expect(more.doc).toBe(full)
    expect(run(full, { type: "duplicate", id: "yardim0000" }).doc).toBe(full)

    const twenty: LayoutDocument = { ...DOC, pages: FULL_PAGES }
    expect(pagesFull(twenty, "cnt_hakkimizda")).toBe(true)
    expect(pagesFull(twenty, "cnt_dolu3")).toBe(false)
    const refused = run(twenty, {
      type: "add",
      group: "pages",
      page: "cnt_hakkimizda",
      section: pageSection("help", "yirmibir"),
    })
    expect(refused.doc).toBe(twenty)
    // A page that has its layout still takes another section
    const taken = run(twenty, {
      type: "add",
      group: "pages",
      page: "cnt_dolu3",
      section: pageSection("faq", "dolusss"),
    })
    expect(ids(taken.doc, "cnt_dolu3")).toHaveLength(2)
  })

  it("lets go of pages deleted since, in the document and its history, without a step", () => {
    const changed = run(DOC_WITH_PAGES, { type: "toggle", id: "yorumlar" })
    const dropped = editorReducer(changed, { type: "drop-pages", ids: ["cnt_iletisim"] })
    expect(dropped.doc.pages.map((page) => page.page_id)).toEqual(["cnt_hakkimizda"])
    expect(dropped.past).toHaveLength(1)
    expect(dropped.past[0]?.pages.map((page) => page.page_id)).toEqual(["cnt_hakkimizda"])
    expect(editorReducer(dropped, { type: "drop-pages", ids: ["cnt_yok"] })).toBe(dropped)
  })

  it("marks a page's strips past the limit with the header's", () => {
    const strip = (id: string) => pageSection("marquee", id)
    const doc: LayoutDocument = {
      ...DOC,
      pages: [
        {
          page_id: "cnt_hakkimizda",
          sections: [strip("kayan00001"), strip("kayan00002"), strip("kayan00003")],
        },
      ],
    }
    expect([...marqueeLimitIds(doc)].sort()).toEqual(["kayan00001", "kayan00002", "kayan00003"])
  })
})
