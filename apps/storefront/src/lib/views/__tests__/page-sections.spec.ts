import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ContentEntry } from "@/lib/store-api/content-entry"
import { StoreApiError } from "@/lib/store-api/errors"
import type * as PageText from "../page-text"
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
// The text sections' own reading is `page-text.spec.ts`'s: here, where each opens
const text = vi.hoisted(() => ({
  pageTextView: vi.fn(),
}))
vi.mock("../page-text", async (actual) => ({
  ...(await actual<typeof PageText>()),
  pageTextView: text.pageTextView,
}))

const { contentSections, draftContentPage, pageLayoutOf } = await import("../page-sections")

const LINK = `sfl_01ABC.to51q5.${"a".repeat(43)}`
const SESSION = `sfs_${"0a".repeat(16)}.to51q5.${"b".repeat(43)}`
const ID = "cnt_01KABC"
// One list since adr/0073 Ek 2026-11-19 (2) K1, the page's text among its sections
const LAYOUT = {
  page_id: ID,
  sections: [
    { id: "ust", type: "rich_text" },
    { id: "metin", type: "rich_text", variant: "article" },
    { id: "alt", type: "help" },
    { id: "alt2", type: "faq" },
  ],
}
const ENTRY = {
  id: ID,
  kind: "page",
  title: "İade",
  path: "/iade-kosullari",
  html: "",
  image_url: null,
} as unknown as ContentEntry

const on = (token: string | null) => {
  state.headers = new Headers(token ? { "x-qt-layout-preview": token } : {})
}

const t = (key: string) => key

/** A content page's own layout, read from the answer its request is on (adr/0073 §5, §6). */
describe("a content page's layout", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    on(null)
    text.pageTextView.mockImplementation(
      (section: { id: string; type: string }, _t: unknown, place: { opens: boolean }) =>
        Promise.resolve({ id: section.id, type: section.type, opens: place.opens })
    )
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

  it("gives the page's sections as one list in its order, its text sections read as the page's", async () => {
    reads.publishedPageLayout.mockResolvedValue(LAYOUT)
    expect(await contentSections(ID, ENTRY, t)).toEqual([
      { id: "ust", type: "help" },
      { id: "metin", type: "rich_text", opens: false },
      { id: "alt", type: "help" },
      { id: "alt2", type: "help" },
    ])
    expect(views.sectionViews).toHaveBeenCalledTimes(3)
    expect(text.pageTextView).toHaveBeenCalledTimes(1)
  })

  it("lets only a text that opens a page without a cover load its picture at once", async () => {
    reads.publishedPageLayout.mockResolvedValue({
      page_id: ID,
      sections: [
        { id: "iletisim", type: "contact" },
        { id: "kargo", type: "shipping_facts" },
      ],
    })
    expect(await contentSections(ID, ENTRY, t)).toEqual([
      { id: "iletisim", type: "contact", opens: true },
      { id: "kargo", type: "shipping_facts", opens: false },
    ])
    const covered = { ...ENTRY, image_url: "https://cdn.example.com/kapak.jpg" }
    expect(await contentSections(ID, Promise.resolve(covered), t)).toEqual([
      { id: "iletisim", type: "contact", opens: false },
      { id: "kargo", type: "shipping_facts", opens: false },
    ])
  })

  it("keeps a text section's look and screens, and leaves out one with nothing to show", async () => {
    reads.publishedPageLayout.mockResolvedValue({
      page_id: ID,
      sections: [
        { id: "metin", type: "rich_text", variant: "article", device: "mobile", look: {} },
        { id: "odeme", type: "payment_facts" },
      ],
    })
    text.pageTextView.mockImplementation((section: { id: string; type: string }) =>
      Promise.resolve(
        section.type === "payment_facts" ? null : { id: section.id, type: section.type }
      )
    )
    expect(await contentSections(ID, ENTRY, t)).toEqual([
      { id: "metin", type: "rich_text", device: "mobile" },
    ])
  })

  it("draws the page's text alone, unmarked, when its layout does not come (K7)", async () => {
    reads.publishedPageLayout.mockRejectedValue(new StoreApiError(503, null, null))
    const entry = { ...ENTRY, html: "<p>Ayna.</p>" }
    expect(await contentSections(ID, entry, t)).toEqual([
      { id: "", type: "rich_text", opens: true },
    ])
    expect(text.pageTextView).toHaveBeenCalledWith(
      { id: "", type: "rich_text", variant: "article", title: null, html: "<p>Ayna.</p>" },
      t,
      { opens: true }
    )
    // An empty answer is a page of no sections, not a failure
    reads.publishedPageLayout.mockResolvedValue({ page_id: ID, sections: [] })
    expect(await contentSections(ID, ENTRY, t)).toEqual([])
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

  it("opens nothing when the backend does not answer, so the preview shows the draft's home", async () => {
    on(SESSION)
    for (const status of [500, 503, 429]) {
      reads.sessionPage.mockRejectedValueOnce(new StoreApiError(status, null, null))
      expect(await draftContentPage(ID)).toBeNull()
    }
    // A bug is not an answer: it is not hidden
    reads.sessionPage.mockRejectedValueOnce(new TypeError("boom"))
    await expect(draftContentPage(ID)).rejects.toThrow("boom")
  })
})
