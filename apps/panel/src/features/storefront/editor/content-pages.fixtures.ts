import type { ContentEntry } from "@/features/content/api/content"
import type {
  ContentPageSection,
  LayoutDocument,
  PageLayout,
} from "@/features/storefront/api/layout"
import { newBodySection } from "@/features/storefront/layout/sections"
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

/** A content page's section of a type, on a side of the page's text. */
export const pageSection = (
  type: ContentPageSection["type"],
  id: string,
  placement: "top" | "bottom" = "bottom"
) => newBodySection("pages", type, id, placement) as ContentPageSection

/** Two pages with layouts of their own: Hakkımızda's below its text, İletişim's above. */
export const PAGE_LAYOUTS: PageLayout[] = [
  {
    page_id: "cnt_hakkimizda",
    sections: [pageSection("help", "hakkimizdayardim"), pageSection("reviews", "yorumlar")],
  },
  {
    page_id: "cnt_iletisim",
    sections: [
      {
        ...pageSection("faq", "iletisimsss", "top"),
        items: [{ question: "Ne zaman ararsınız?", answer: "Aynı gün döneriz." }],
      } as ContentPageSection,
    ],
  },
]

export const DOC_WITH_PAGES: LayoutDocument = { ...DOC, pages: PAGE_LAYOUTS }

/** As many pages as may have a layout of their own, none of them the shop's three. */
export const FULL_PAGES: PageLayout[] = Array.from({ length: 20 }, (_, index) => ({
  page_id: `cnt_dolu${String(index)}`,
  sections: [pageSection("help", `doluyardim${String(index).padStart(2, "0")}`)],
}))

/**
 * İçerik's answers over the editor's server (`serve`): the pages list (all
 * of them, by title when searched) and a page by its id.
 */
export function serveContent(fetchMock: FetchMock, pages: ContentEntry[] = CONTENT_PAGES) {
  const inner = fetchMock.getMockImplementation()
  fetchMock.mockImplementation((url: string, init?: Init) => {
    if (url === "/admin/content") {
      return Promise.resolve({ entries: pages, count: pages.length })
    }
    if (url.startsWith("/admin/content/")) {
      const found = pages.find((page) => url === `/admin/content/${page.id}`)
      return found
        ? Promise.resolve({ entry: { ...found, body: { type: "doc", content: [] } } })
        : Promise.reject(Object.assign(new Error("not found"), { status: 404 }))
    }
    return inner ? inner(url, init) : Promise.reject(new Error(`unexpected ${url}`))
  })
}
