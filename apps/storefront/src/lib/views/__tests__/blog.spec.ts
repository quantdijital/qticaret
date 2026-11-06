import type { StoreContentSummary } from "@qticaret/types"
import { describe, expect, it } from "vitest"
import { t } from "@/lib/i18n"
import { blogPageOf, blogPagePath, blogPagination, blogTermBar } from "../blog"
import { postCards, postTerms } from "../posts"

const ARCHIVE = "/blog/kategori/bakim"

describe("a blog list's pages (/blog, an archive)", () => {
  it("reads ?sayfa= as a page, nothing else", () => {
    expect(blogPageOf(undefined)).toBe(1)
    expect(blogPageOf("3")).toBe(3)
    expect(blogPageOf("0")).toBeNull()
    expect(blogPageOf("abc")).toBeNull()
    expect(blogPageOf(["2", "3"])).toBeNull()
  })

  it("gives each page of an archive its own address, the first the bare one", () => {
    expect(blogPagePath(ARCHIVE, 1)).toBe(ARCHIVE)
    expect(blogPagination(ARCHIVE, 2, 3)).toEqual({
      page: 2,
      pages: 3,
      previous: ARCHIVE,
      next: `${ARCHIVE}?sayfa=3`,
      pagePath: { 1: ARCHIVE, 2: `${ARCHIVE}?sayfa=2`, 3: `${ARCHIVE}?sayfa=3` },
    })
    expect(blogPagination("/blog", 1, 1)).toEqual({
      page: 1,
      pages: 1,
      previous: null,
      next: null,
      pagePath: { 1: "/blog" },
    })
  })

  it("puts all posts first in the bar of categories, the page shown marked", () => {
    const terms = [
      { name: "Bakım", path: ARCHIVE },
      { name: "Tarifler", path: "/blog/kategori/tarifler" },
    ]
    expect(blogTermBar(terms, ARCHIVE, t)).toEqual([
      { label: "Tüm yazılar", path: "/blog", current: false },
      { label: "Bakım", path: ARCHIVE, current: true },
      { label: "Tarifler", path: "/blog/kategori/tarifler", current: false },
    ])
    expect(blogTermBar(terms, "/blog", t)[0]?.current).toBe(true)
    // A tag's archive marks nothing; a blog with no category has no bar
    expect(blogTermBar(terms, "/blog/etiket/celik", t).some((term) => term.current)).toBe(false)
    expect(blogTermBar([], "/blog", t)).toEqual([])
  })
})

describe("a post's terms", () => {
  const term = (kind: string, handle: string, name: string) => ({
    id: `cterm_${handle}`,
    name,
    handle,
    path: `/blog/${kind}/${handle}`,
  })

  it("puts the category on the card and the category and tags on the post", () => {
    const entry = {
      id: "cnt_1",
      kind: "post",
      title: "Bıçak bakımı",
      handle: "bicak-bakimi",
      path: "/blog/bicak-bakimi",
      excerpt: "",
      image_url: null,
      image_alt: null,
      author_name: null,
      published_at: null,
      revised_at: null,
      reading_minutes: 3,
      category: term("kategori", "bakim", "Bakım"),
      tags: [term("etiket", "celik", "Çelik"), term("etiket", "bileme", "Bileme")],
    } satisfies StoreContentSummary
    expect(postCards([entry], t)[0]?.category).toEqual({ label: "Bakım", path: ARCHIVE })
    expect(postTerms(entry)).toEqual({
      category: { label: "Bakım", path: ARCHIVE },
      tags: [
        { label: "Çelik", path: "/blog/etiket/celik" },
        { label: "Bileme", path: "/blog/etiket/bileme" },
      ],
    })
    expect(postCards([{ ...entry, category: null }], t)[0]?.category).toBeNull()
    expect(postTerms({})).toEqual({ category: null, tags: [] })
  })
})
