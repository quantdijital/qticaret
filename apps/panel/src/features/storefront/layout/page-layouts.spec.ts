import { describe, expect, it } from "vitest"
import type { LayoutDocument } from "@/features/storefront/api/layout"
import {
  DOC_WITH_PAGES,
  FULL_PAGES,
  PAGE_LAYOUTS,
  pageSection,
  pageText,
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

/** The content pages' own layouts in the editor's document (adr/0073 §1, Ek 2026-11-19 (2) K1). */
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
    expect(pageSectionsOf(state.doc, "cnt_hakkimizda")[2]).toMatchObject({ visible: false })
    expect(state.doc.pages[1]).toBe(PAGE_LAYOUTS[1])
    expect(state.doc.home).toBe(DOC_WITH_PAGES.home)
  })

  it("keeps a page's sections one list, its text among them, with no place sent", () => {
    const state = run(DOC_WITH_PAGES, {
      type: "add",
      group: "pages",
      page: "cnt_hakkimizda",
      section: pageSection("banner", "ustbant"),
      at: 0,
    })
    expect(ids(state.doc, "cnt_hakkimizda")).toEqual([
      "ustbant",
      "hakkimizdametin",
      "hakkimizdayardim",
      "yorumlar",
    ])

    // The page's text moves past the others as any section does
    const moved = editorReducer(state, { type: "move", id: "hakkimizdametin", to: 3 })
    expect(ids(moved.doc, "cnt_hakkimizda")).toEqual([
      "ustbant",
      "hakkimizdayardim",
      "yorumlar",
      "hakkimizdametin",
    ])
    const copied = editorReducer(moved, { type: "duplicate", id: "ustbant", copyId: "ustbant2" })
    expect(ids(copied.doc, "cnt_hakkimizda").slice(0, 2)).toEqual(["ustbant", "ustbant2"])
    expect(
      copied.doc.pages.flatMap((page) => page.sections).some((section) => "placement" in section)
    ).toBe(false)
  })

  it("holds one contact section and one of each facts on a page", () => {
    const facts = run(
      DOC_WITH_PAGES,
      {
        type: "add",
        group: "pages",
        page: "cnt_iletisim",
        section: pageSection("contact", "ikinciform"),
      },
      { type: "duplicate", id: "iletisimform", copyId: "formkopya1" }
    )
    expect(facts.doc).toBe(DOC_WITH_PAGES)

    const shipping = run(DOC_WITH_PAGES, {
      type: "add",
      group: "pages",
      page: "cnt_iletisim",
      section: pageSection("shipping_facts", "kargobilgi"),
    })
    expect(ids(shipping.doc, "cnt_iletisim")).toEqual(["iletisimsss", "iletisimform", "kargobilgi"])
  })

  it("makes a synthesized page's entry with its first change, in one step", () => {
    const text = pageText("sentezmetin", "Sıkça sorulanlar.")
    const seeded = run(DOC, {
      type: "seed",
      page: "cnt_sss",
      sections: [text],
      then: { type: "update", section: { ...text, title: "SSS" } },
    })
    expect(seeded.doc.pages).toEqual([
      { page_id: "cnt_sss", sections: [{ ...text, title: "SSS" }] },
    ])
    expect(seeded.past).toHaveLength(1)
    expect(editorReducer(seeded, { type: "undo" }).doc.pages).toEqual([])

    // No room for a fifty-first page: the change does not land
    const full: LayoutDocument = { ...DOC, pages: FULL_PAGES }
    const refused = run(full, {
      type: "seed",
      page: "cnt_sss",
      sections: [text],
      then: { type: "toggle", id: "sentezmetin" },
    })
    expect(refused.doc).toBe(full)
  })

  it("holds twelve sections on a page and fifty pages with a layout", () => {
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

    const fifty: LayoutDocument = { ...DOC, pages: FULL_PAGES }
    expect(pagesFull(fifty, "cnt_hakkimizda")).toBe(true)
    expect(pagesFull(fifty, "cnt_dolu3")).toBe(false)
    const refused = run(fifty, {
      type: "add",
      group: "pages",
      page: "cnt_hakkimizda",
      section: pageSection("help", "ellibir"),
    })
    expect(refused.doc).toBe(fifty)
    // A page that has its layout still takes another section
    const taken = run(fifty, {
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
