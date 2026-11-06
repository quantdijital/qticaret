import type { ReactElement } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Resolution, StoreContentAuthorPage, StoreContentSummary } from "@qticaret/types"
import type { BlogIndexPageView } from "@qticaret/ui"

// A blog author's page (adr/0046 Ek, adr/0060): the backend's JSON-LD, the author's head, the posts paged

const blog = vi.hoisted(() => ({ blogAuthor: vi.fn(), blogPosts: vi.fn(), blogTerms: vi.fn() }))
vi.mock("@/lib/store-api/blog", () => blog)
vi.mock("@/lib/store-api/requests", () => ({ siteSeo: vi.fn() }))
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND")
  },
  permanentRedirect: (path: string) => {
    throw new Error(`REDIRECT ${path}`)
  },
}))

const { BlogAuthorScreen } = await import("../blog")

const author = (over: Partial<StoreContentAuthorPage> = {}): StoreContentAuthorPage => ({
  id: "cauth_1",
  name: "Ayşe Usta",
  handle: "ayse-usta",
  path: "/blog/yazar/ayse-usta",
  job_title: "Bıçak ustası",
  bio: "Yirmi yıldır bıçak yapıyor.",
  image_url: null,
  links: [{ kind: "instagram", url: "https://www.instagram.com/ayse" }],
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
  author_name: "Ayşe Usta",
  published_at: "2026-10-30T09:00:00.000Z",
  revised_at: null,
  reading_minutes: 4,
})

const jsonLd = [{ "@context": "https://schema.org", "@type": "ProfilePage" }]

const page = {
  type: "entity",
  path: "/blog/yazar/ayse-usta",
  entity_type: "post_author",
  entity_id: "cauth_1",
  seo: {
    breadcrumbs: [
      { name: "Blog", url: "https://ornek.com/blog" },
      { name: "Ayşe Usta", url: "https://ornek.com/blog/yazar/ayse-usta" },
    ],
    jsonLd,
  },
} as unknown as Extract<Resolution, { type: "entity" }>

/** The screen's two children: the JSON-LD and the theme's blog list with its view. */
async function render(address: string) {
  const tree = (await BlogAuthorScreen({ page, url: new URL(address) })) as ReactElement<{
    children: [ReactElement<{ blocks: unknown }>, ReactElement<{ view: BlogIndexPageView }>]
  }>
  const [ld, list] = tree.props.children
  return { blocks: ld.props.blocks, view: list.props.view }
}

beforeEach(() => {
  vi.clearAllMocks()
  blog.blogAuthor.mockResolvedValue(author())
  blog.blogTerms.mockResolvedValue([])
  blog.blogPosts.mockResolvedValue({
    entries: Array.from({ length: 12 }, (_, i) => post(i + 1)),
    count: 14,
  })
})

describe("BlogAuthorScreen", () => {
  it("prints the backend's JSON-LD and the author's head over their posts, twelve a page", async () => {
    const { blocks, view } = await render("https://ornek.com/blog/yazar/ayse-usta")
    expect(blocks).toBe(jsonLd)
    expect(blog.blogAuthor).toHaveBeenCalledWith("cauth_1")
    expect(blog.blogPosts).toHaveBeenCalledWith(0, 12, "author", "ayse-usta")
    expect(view.title).toBe("Ayşe Usta")
    expect(view.activeTerm).toBeNull()
    expect(view.activeAuthor).toMatchObject({
      name: "Ayşe Usta",
      jobTitle: "Bıçak ustası",
      bio: ["Yirmi yıldır bıçak yapıyor."],
      links: [{ label: "Instagram", href: "https://www.instagram.com/ayse" }],
    })
    expect(view.posts).toHaveLength(12)
    expect(view.pagination).toMatchObject({
      page: 1,
      pages: 2,
      next: "/blog/yazar/ayse-usta?sayfa=2",
    })
  })

  it("keeps the bio for the first page, as an archive's own words", async () => {
    blog.blogPosts.mockResolvedValue({ entries: [post(13), post(14)], count: 14 })
    const { view } = await render("https://ornek.com/blog/yazar/ayse-usta?sayfa=2")
    expect(blog.blogPosts).toHaveBeenCalledWith(12, 12, "author", "ayse-usta")
    expect(view.activeAuthor?.bio).toEqual([])
    expect(view.activeAuthor?.name).toBe("Ayşe Usta")
    expect(view.pagination.previous).toBe("/blog/yazar/ayse-usta")
  })

  it("asks for no posts while the author has none live, and answers a page past the last with a 404", async () => {
    blog.blogAuthor.mockResolvedValue(author({ post_count: 0 }))
    const { view } = await render("https://ornek.com/blog/yazar/ayse-usta")
    expect(blog.blogPosts).not.toHaveBeenCalled()
    expect(view.posts).toEqual([])
    await expect(render("https://ornek.com/blog/yazar/ayse-usta?sayfa=3")).rejects.toThrow(
      "NOT_FOUND"
    )
  })
})
