import { PAGE_LAYOUT_LIMITS } from "@qticaret/types"
import type { JSONContent } from "@tiptap/react"
import type { ContentEntry } from "@/features/content/api/content"
import type {
  ContentPageSection,
  LayoutDocument,
  PageLayout,
} from "@/features/storefront/api/layout"
import { newBodySection, newPageText } from "@/features/storefront/layout/sections"
import { DOC } from "./theme-editor.fixtures"
import type { FetchMock, Init } from "./theme-editor.fixtures"

/** What the content page specs share (adr/0073): the shop's pages in İçerik and their layouts. */

const entry = (
  id: string,
  title: string,
  handle: string,
  status: ContentEntry["status"] = "published"
): ContentEntry => ({
  id,
  kind: "page",
  title,
  handle,
  path: `/${handle}`,
  status,
  excerpt: null,
  author_name: null,
  author_id: null,
  author: null,
  image_url: null,
  published_at: status === "published" ? "2026-11-01T09:00:00.000Z" : null,
  revised_at: null,
  created_at: "2026-11-01T09:00:00.000Z",
  updated_at: "2026-11-01T09:00:00.000Z",
  category_id: null,
  tag_ids: [],
  category: null,
  tags: [],
})

/** The shop's content pages, newest change first: two live, one draft. */
export const CONTENT_PAGES: ContentEntry[] = [
  entry("cnt_hakkimizda", "Hakkımızda", "hakkimizda"),
  entry("cnt_iletisim", "İletişim", "iletisim"),
  entry("cnt_iade", "İade koşulları", "iade-kosullari", "draft"),
]

/** A content page's section of a type (adr/0073 Ek 2026-11-19 (2) K1: one list, no place). */
export const pageSection = (type: ContentPageSection["type"], id: string) =>
  newBodySection("pages", type, id) as ContentPageSection

/** A content page's own text ("Sayfa metni", K2) with a line written. */
export const pageText = (id: string, text: string): ContentPageSection =>
  newPageText(id, {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  })

/**
 * Two pages with layouts of their own: Hakkımızda's text with a help box
 * and reviews after it, İletişim's questions above its contact section.
 */
export const PAGE_LAYOUTS: PageLayout[] = [
  {
    page_id: "cnt_hakkimizda",
    sections: [
      pageText("hakkimizdametin", "Köklerimizden geleceğe."),
      pageSection("help", "hakkimizdayardim"),
      pageSection("reviews", "yorumlar"),
    ],
  },
  {
    page_id: "cnt_iletisim",
    sections: [
      {
        ...pageSection("faq", "iletisimsss"),
        items: [{ question: "Ne zaman ararsınız?", answer: "Aynı gün döneriz." }],
      } as ContentPageSection,
      pageSection("contact", "iletisimform"),
    ],
  },
]

export const DOC_WITH_PAGES: LayoutDocument = { ...DOC, pages: PAGE_LAYOUTS }

/** As many pages as may have a layout of their own, none of them the shop's three. */
export const FULL_PAGES: PageLayout[] = Array.from(
  { length: PAGE_LAYOUT_LIMITS.pages },
  (_, index) => ({
    page_id: `cnt_dolu${String(index)}`,
    sections: [pageSection("help", `doluyardim${String(index).padStart(2, "0")}`)],
  })
)

/**
 * The content pages' answers over the editor's server (`serve`): the pages
 * list (all of them), a page by its id with its text (`bodies`, else
 * empty), a new page opened as a draft, a page's settings saved and a page
 * deleted, each kept for the reads after it.
 */
export function serveContent(
  fetchMock: FetchMock,
  start: ContentEntry[] = CONTENT_PAGES,
  bodies: Readonly<Record<string, JSONContent>> = {}
) {
  const inner = fetchMock.getMockImplementation()
  let pages = [...start]
  const detail = (page: ContentEntry) => ({
    entry: {
      ...page,
      body: bodies[page.id] ?? { type: "doc", content: [] },
      image_alt: null,
    },
  })
  fetchMock.mockImplementation((url: string, init?: Init) => {
    if (url === "/admin/content" && init?.method === "POST") {
      const { title, handle } = init.body as { title: string; handle?: string }
      const made = entry("cnt_yeni", title, handle ?? "yeni-sayfa", "draft")
      pages = [made, ...pages]
      return Promise.resolve(detail(made))
    }
    if (url === "/admin/content") {
      return Promise.resolve({ entries: pages, count: pages.length })
    }
    if (url.startsWith("/admin/content/")) {
      const found = pages.find((page) => url === `/admin/content/${page.id}`)
      if (!found) {
        return Promise.reject(Object.assign(new Error("not found"), { status: 404 }))
      }
      if (init?.method === "DELETE") {
        pages = pages.filter((page) => page.id !== found.id)
        return Promise.resolve({ id: found.id, deleted: true })
      }
      if (init?.method === "POST") {
        const changed = { ...found, ...(init.body as Partial<ContentEntry>) }
        pages = pages.map((page) => (page.id === found.id ? changed : page))
        return Promise.resolve(detail(changed))
      }
      return Promise.resolve(detail(found))
    }
    return inner ? inner(url, init) : Promise.reject(new Error(`unexpected ${url}`))
  })
}
