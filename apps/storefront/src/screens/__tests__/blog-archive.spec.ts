import type { ReactElement } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Resolution, StoreContentSummary, StoreContentTermSummary } from "@qticaret/types"
import type { BlogIndexPageView } from "@qticaret/ui"

// A blog category's archive (adr/0075 Ek 2026-11-24): its own words at the foot, as a listing's

const blog = vi.hoisted(() => ({
  blogAuthor: vi.fn(),
  blogPosts: vi.fn(),
  blogTerms: vi.fn(),
  blogTermDescription: vi.fn(),
}))
const look = vi.hoisted(() => ({ currentTheme: vi.fn() }))
vi.mock("@/lib/store-api/blog", () => blog)
vi.mock("@/lib/store-api/requests", () => ({ siteSeo: vi.fn() }))
vi.mock("@/lib/views/theme-settings", () => look)
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND")
  },
  permanentRedirect: (path: string) => {
    throw new Error(`REDIRECT ${path}`)
  },
}))

const { BlogArchiveScreen } = await import("../blog")

const term = (over: Partial<StoreContentTermSummary> = {}): StoreContentTermSummary => ({
  id: "cterm_1",
  kind: "category",
  name: "Rehberler",
  handle: "rehberler",
  path: "/blog/kategori/rehberler",
  post_count: 14,
  ...over,
})

const post = (n: number): StoreContentSummary => ({
  id: `cnt_${String(n)}`,
  kind: "post",
  title: `Yazı ${String(n)}`,
  handle: `yazi-${String(n)}`,
  path: `/blog/yazi-${String(n)}`,
  excerpt: "Özet",
  image_url: null,
  image_alt: null,
  author_name: null,
  published_at: "2026-10-30T09:00:00.000Z",
  revised_at: null,
  reading_minutes: 4,
})

const page = {
  type: "entity",
  path: "/blog/kategori/rehberler",
  entity_type: "post_category",
  entity_id: "cterm_1",
  seo: {
    breadcrumbs: [
      { name: "Blog", url: "https://ornek.com/blog" },
      { name: "Rehberler", url: "https://ornek.com/blog/kategori/rehberler" },
    ],
    jsonLd: [],
  },
} as unknown as Extract<Resolution, { type: "entity" }>

async function render(address: string) {
  const tree = (await BlogArchiveScreen({ page, url: new URL(address) })) as ReactElement<{
    children: [ReactElement, ReactElement<{ view: BlogIndexPageView }>]
  }>
  return tree.props.children[1].props.view
}

beforeEach(() => {
  vi.clearAllMocks()
  blog.blogTerms.mockResolvedValue([term()])
  blog.blogTermDescription.mockResolvedValue({
    term_id: "cterm_1",
    description: "Bakım\n\nKuru tutun.",
    description_html: "<h2>Bakım</h2><p>Kuru tutun.</p>",
  })
  blog.blogPosts.mockResolvedValue({
    entries: Array.from({ length: 12 }, (_, i) => post(i + 1)),
    count: 14,
  })
  look.currentTheme.mockResolvedValue({
    listing_text: { size: "lg", align: "center", width: "wide", collapse: false },
  })
})

describe("a blog archive's own words", () => {
  it("come at the foot of the first page as the backend's HTML, in the shop's look, none under the title", async () => {
    const view = await render("https://ornek.com/blog/kategori/rehberler")

    expect(blog.blogTermDescription).toHaveBeenCalledWith("cterm_1")
    expect(view.activeTerm).toEqual({ kind: "category", name: "Rehberler", description: [] })
    expect(view.footText).toEqual({
      html: "<h2>Bakım</h2><p>Kuru tutun.</p>",
      paragraphs: [],
      look: { size: "lg", align: "center", width: "wide", collapse: false },
    })
  })

  it("fall back to the plain text's paragraphs, with the default look for an older backend", async () => {
    blog.blogTermDescription.mockResolvedValue({
      term_id: "cterm_1",
      description: "Bakım rehberi.\n\nİkinci paragraf.",
      description_html: null,
    })
    look.currentTheme.mockResolvedValue({})

    const view = await render("https://ornek.com/blog/kategori/rehberler")

    expect(view.footText).toEqual({
      html: null,
      paragraphs: ["Bakım rehberi.", "İkinci paragraf."],
      look: { size: "md", align: "start", width: "narrow", collapse: true },
    })
  })

  it("are none when the term's text cannot be read (the page never fails for it)", async () => {
    blog.blogTermDescription.mockResolvedValue(null)

    const view = await render("https://ornek.com/blog/kategori/rehberler")

    expect(view.footText).toBeNull()
  })

  it("are not read nor drawn past the first page", async () => {
    const view = await render("https://ornek.com/blog/kategori/rehberler?sayfa=2")

    expect(blog.blogTermDescription).not.toHaveBeenCalled()
    expect(view.footText).toBeNull()
  })

  it("are none for a term no longer listed", async () => {
    blog.blogTerms.mockResolvedValue([])

    const view = await render("https://ornek.com/blog/kategori/rehberler")

    expect(view.footText).toBeNull()
  })
})
