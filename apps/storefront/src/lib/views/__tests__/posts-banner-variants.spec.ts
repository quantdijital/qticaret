import { beforeEach, describe, expect, it, vi } from "vitest"
import type { StoreBannerSection, StoreContentSummary, StorePostsSection } from "@qticaret/types"
import { t } from "@/lib/i18n"

vi.mock("server-only", () => ({}))
vi.mock("next/headers", () => ({ headers: vi.fn(), cookies: vi.fn() }))
const blog = vi.hoisted(() => ({ blogPosts: vi.fn() }))
vi.mock("@/lib/store-api/blog", () => blog)

const { bannerView } = await import("../banner")
const { postsView } = await import("../posts-section")

const entry = (at: number): StoreContentSummary => ({
  id: `cnt_${String(at)}`,
  kind: "post",
  title: `Yazı ${String(at)}`,
  handle: `yazi-${String(at)}`,
  path: `/blog/yazi-${String(at)}`,
  excerpt: "",
  image_url: null,
  image_alt: null,
  author_name: null,
  published_at: null,
  revised_at: null,
  reading_minutes: 4,
})
const guides = (more: Partial<StorePostsSection> = {}): StorePostsSection => ({
  id: "yazilar",
  type: "posts",
  title: null,
  limit: 3,
  ...more,
})
const band = (more: Partial<StoreBannerSection> = {}): StoreBannerSection => ({
  id: "kampanya",
  type: "banner",
  slides: [
    {
      image: { url: "http://localhost:9000/static/vadi.jpg", alt: "Vadi", width: 1, height: 1 },
      heading: "Macera",
      text: null,
      link: null,
    },
  ],
  ...more,
})

beforeEach(() => {
  blog.blogPosts.mockResolvedValue({ entries: [entry(1), entry(2)], count: 2 })
})

describe("the posts' view (adr/0077 Ek)", () => {
  it("keeps today's tiles as they were: no variant, the blog's link", async () => {
    const view = await postsView(guides(), t)
    expect(view).toEqual({
      id: "yazilar",
      type: "posts",
      title: t("home.posts"),
      posts: expect.any(Array) as unknown,
      more: { label: t("home.all_posts"), path: "/blog" },
    })
    expect(blog.blogPosts).toHaveBeenCalledWith(0, 3)
  })

  it("brings the intro panel's words and button, the blog's when it has none", async () => {
    const link = { label: "Oku", kind: "url" as const, target: null, path: "/rehber" }
    expect(
      await postsView(guides({ variant: "intro_panel", eyebrow: "İlham", link }), t)
    ).toMatchObject({
      variant: "intro_panel",
      eyebrow: "İlham",
      intro: null,
      more: { label: "Oku", path: "/rehber" },
    })
    expect(await postsView(guides({ variant: "intro_panel" }), t)).toMatchObject({
      more: { path: "/blog" },
    })
  })

  it("reads a variant it does not know as the tiles, and no posts as no section", async () => {
    const view = await postsView(guides({ variant: "mosaic" as never, eyebrow: "x" }), t)
    expect(view).not.toHaveProperty("variant")
    expect(view).not.toHaveProperty("eyebrow")
    blog.blogPosts.mockResolvedValue({ entries: [], count: 0 })
    expect(await postsView(guides({ variant: "intro_panel" }), t)).toBeNull()
  })
})

describe("the band's view (adr/0077 Ek)", () => {
  it("keeps today's band without the split's fields", () => {
    const view = bannerView(band(), t)
    expect(view).not.toHaveProperty("variant")
    expect(view).not.toHaveProperty("edge")
  })

  it("brings the split's upper line and edge; an unknown edge reads straight", () => {
    expect(
      bannerView(band({ variant: "split", eyebrow: "Fırsat", edge: "curved" }), t)
    ).toMatchObject({ variant: "split", eyebrow: "Fırsat", edge: "curved" })
    expect(bannerView(band({ variant: "split", edge: "wavy" as never }), t)).toMatchObject({
      variant: "split",
      eyebrow: null,
      edge: "straight",
    })
    expect(bannerView(band({ variant: "ribbon" as never }), t)).not.toHaveProperty("variant")
  })
})
