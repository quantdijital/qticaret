import { beforeEach, describe, expect, it, vi } from "vitest"
import { StoreApiError } from "@/lib/store-api/errors"
import type * as Sections from "../sections"

const state = vi.hoisted(() => ({ headers: new Headers() }))
vi.mock("next/headers", () => ({ headers: () => Promise.resolve(state.headers) }))
vi.mock("@/lib/store-api/requests", () => ({}))
const reads = vi.hoisted(() => ({
  publishedPageLayout: vi.fn(),
  previewPageLayout: vi.fn(),
  sessionPage: vi.fn(),
}))
vi.mock("@/lib/store-api/page-layout", () => reads)
const views = vi.hoisted(() => ({
  sectionViews: vi.fn((sections: { id: string }[]) =>
    Promise.resolve(sections.map((section) => ({ id: section.id, type: "help" })))
  ),
}))
vi.mock("../sections", async (actual) => ({
  ...(await actual<typeof Sections>()),
  sectionViews: views.sectionViews,
}))

const { contentSections, draftContentPage, pageLayoutOf } = await import("../page-sections")

const LINK = `sfl_01ABC.to51q5.${"a".repeat(43)}`
const SESSION = `sfs_${"0a".repeat(16)}.to51q5.${"b".repeat(43)}`
const ID = "cnt_01KABC"
const LAYOUT = {
  page_id: ID,
  sections: [
    { id: "ust", type: "rich_text", placement: "top" },
    { id: "alt", type: "help", placement: "bottom" },
    { id: "alt2", type: "faq", placement: "bottom" },
  ],
}
const ENTRY = { id: ID, kind: "page", title: "İade", path: "/iade-kosullari", html: "" }

const on = (token: string | null) => {
  state.headers = new Headers(token ? { "x-qt-layout-preview": token } : {})
}

const t = (key: string) => key

/** A content page's own layout, read from the answer its request is on (adr/0073 §5, §6). */
describe("a content page's layout", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    on(null)
  })

  it("reads the published layout for a shopper", async () => {
    reads.publishedPageLayout.mockResolvedValue(LAYOUT)
    expect(await pageLayoutOf(ID)).toBe(LAYOUT)
    expect(reads.publishedPageLayout).toHaveBeenCalledWith(ID)
    expect(reads.previewPageLayout).not.toHaveBeenCalled()
    expect(reads.sessionPage).not.toHaveBeenCalled()
  })

  it("reads a signed design link's draft through the link, the live session's through the session", async () => {
    on(LINK)
    reads.previewPageLayout.mockResolvedValue(LAYOUT)
    expect(await pageLayoutOf(ID)).toBe(LAYOUT)
    expect(reads.previewPageLayout).toHaveBeenCalledWith(LINK, ID)

    on(SESSION)
    reads.sessionPage.mockResolvedValue({ page: LAYOUT, entry: ENTRY })
    expect(await pageLayoutOf(ID)).toBe(LAYOUT)
    expect(reads.sessionPage).toHaveBeenCalledWith(SESSION, ID)
    expect(reads.publishedPageLayout).not.toHaveBeenCalled()
  })

  it("reads the published layout on a token of no preview's form", async () => {
    on("sfs_short.to51q5.x")
    reads.publishedPageLayout.mockResolvedValue(null)
    expect(await pageLayoutOf(ID)).toBeNull()
    expect(reads.publishedPageLayout).toHaveBeenCalledWith(ID)
    expect(reads.sessionPage).not.toHaveBeenCalled()
  })

  it("draws the page as before when the answer fails or the session ended", async () => {
    reads.publishedPageLayout.mockRejectedValue(new StoreApiError(503, null, null))
    expect(await pageLayoutOf(ID)).toBeNull()
    on(SESSION)
    reads.sessionPage.mockResolvedValue(null)
    expect(await pageLayoutOf(ID)).toBeNull()
    // A bug is not an answer: it is not hidden
    on(null)
    reads.publishedPageLayout.mockRejectedValue(new TypeError("boom"))
    await expect(pageLayoutOf(ID)).rejects.toThrow("boom")
  })

  it("gives the sections above the text and below it, read as every page's", async () => {
    reads.publishedPageLayout.mockResolvedValue(LAYOUT)
    expect(await contentSections(ID, t)).toEqual({
      top: [{ id: "ust", type: "help" }],
      bottom: [
        { id: "alt", type: "help" },
        { id: "alt2", type: "help" },
      ],
    })
    expect(views.sectionViews).toHaveBeenCalledTimes(2)
  })

  it("gives none for a page without a layout or with nothing left to show", async () => {
    reads.publishedPageLayout.mockResolvedValue(null)
    expect(await contentSections(ID, t)).toBeUndefined()
    reads.publishedPageLayout.mockResolvedValue({ page_id: ID, sections: [] })
    expect(await contentSections(ID, t)).toBeUndefined()
    reads.publishedPageLayout.mockResolvedValue(LAYOUT)
    views.sectionViews.mockResolvedValue([])
    expect(await contentSections(ID, t)).toBeUndefined()
  })
})

describe("a content page in draft (`?icerik=`)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("opens on the live session only, as resolve would find a live page", async () => {
    on(SESSION)
    reads.sessionPage.mockResolvedValue({ page: LAYOUT, entry: ENTRY })
    expect(await draftContentPage(ID)).toEqual({
      page: {
        type: "entity",
        path: "/iade-kosullari",
        entity_type: "page",
        entity_id: ID,
        seo: null,
      },
      entry: ENTRY,
    })
  })

  it("never opens on a signed design link or a live page", async () => {
    for (const token of [LINK, null]) {
      on(token)
      expect(await draftContentPage(ID)).toBeNull()
    }
    expect(reads.sessionPage).not.toHaveBeenCalled()
  })

  it("opens nothing for a session that names no such page, nor a post", async () => {
    on(SESSION)
    reads.sessionPage.mockResolvedValue(null)
    expect(await draftContentPage(ID)).toBeNull()
    reads.sessionPage.mockResolvedValue({ page: null, entry: { ...ENTRY, kind: "post" } })
    expect(await draftContentPage(ID)).toBeNull()
  })
})
