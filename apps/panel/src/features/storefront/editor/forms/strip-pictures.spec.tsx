import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { StripGallerySection, StripItem } from "@/features/storefront/api/layout"
import { sectionProblems } from "@/features/storefront/layout/problems"
import { newHomeSection } from "@/features/storefront/layout/sections"
import { StripGalleryForm } from "./strip-gallery-form"

const CDN = "https://cdn.example.com"

interface Query {
  id?: string[]
  category_id?: string[]
  collection_id?: string[]
  status?: string[]
  order?: string
  fields?: string
}

// The catalogue the editor already reads: category pictures, collections, the product board
const fetch = vi.fn((path: string, init?: { query?: Record<string, unknown> }) => {
  switch (path) {
    case "/admin/category-images":
      return Promise.resolve({ images: [{ category_id: "c1", url: `${CDN}/c1.webp`, alt: null }] })
    case "/admin/collection-board/col1":
      return Promise.resolve({ collection: { id: "col1", image: { url: `${CDN}/col1.webp` } } })
    case "/admin/collection-board/col2":
      return Promise.resolve({ collection: { id: "col2", image: null } })
    case "/admin/collection-board/col3":
      return Promise.resolve({ collection: { id: "col3", image: null } })
    case "/admin/product-board":
      return Promise.resolve({ ids: init?.query?.["brand_id"] === "b1" ? ["p7"] : [] })
    default:
      return Promise.reject(new Error(path))
  }
})
const PRODUCTS = [
  {
    id: "p1",
    title: "Bir",
    thumbnail: `${CDN}/p1-thumb.webp`,
    // The storefront's photo is the first by rank, not the thumbnail
    images: [
      { url: `${CDN}/p1-b.webp`, rank: 1 },
      { url: `${CDN}/p1-a.webp`, rank: 0 },
    ],
  },
  { id: "p2", title: "İki", thumbnail: null, images: [] },
  { id: "p7", title: "Markanın en yenisi", thumbnail: `${CDN}/p7.webp`, images: null },
]
const NEWEST = { id: "p9", title: "En yeni", thumbnail: `${CDN}/p9.webp`, images: [] }
const list = vi.fn((query: Query) => {
  if (query.id) {
    return Promise.resolve({ products: PRODUCTS.filter(({ id }) => query.id?.includes(id)) })
  }
  const newest =
    query.collection_id?.includes("col3") || query.category_id?.includes("c3") ? [NEWEST] : []
  return Promise.resolve({ products: newest })
})
vi.mock("@/lib/sdk", () => ({
  sdk: {
    client: {
      fetch: (path: string, init?: { query?: Record<string, unknown> }) => fetch(path, init),
    },
    admin: {
      product: { list: (query: Query) => list(query) },
      productCategory: {
        list: () =>
          Promise.resolve({
            product_categories: [
              { id: "c2", name: "Üst", parent_category_id: null },
              { id: "c3", name: "Alt", parent_category_id: "c2" },
              { id: "c9", name: "Boş", parent_category_id: null },
            ],
          }),
      },
    },
  },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("./record-names", () => ({
  useRecordNames: (kind: string, ids: readonly string[]) => ({
    data: Object.fromEntries(ids.map((id) => [id, `${kind} ${id}`])),
    isPending: false,
  }),
  useLinkName: () => null,
}))

const strip = (
  kind: "product" | "category" | "collection" | "brand",
  target: string
): StripItem => ({
  source: { kind, target },
  image: null,
  title: null,
  note: null,
  link: null,
})
const own = { url: "/static/kendi.webp", alt: null }

function renderRows(items: StripItem[]) {
  const section = {
    ...(newHomeSection("strip_gallery", "seritler01") as StripGallerySection),
    items,
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <StripGalleryForm section={section} problems={sectionProblems(section)} onChange={vi.fn()} />
    </QueryClientProvider>
  )
  return within(screen.getByRole("list", { name: "Şeritler" })).getAllByRole("listitem")
}

const pictureIn = (rows: readonly HTMLElement[], at: number) =>
  rows[at]?.querySelector("img") ?? null

describe("a strip row's small picture: the one the storefront draws (adr/0049 Ek 2026-11-16)", () => {
  beforeEach(() => {
    fetch.mockClear()
    list.mockClear()
  })

  it("shows a product's first photo by rank, a category's or a collection's own picture", async () => {
    const rows = renderRows([
      strip("product", "p1"),
      strip("category", "c1"),
      strip("collection", "col1"),
    ])
    await waitFor(() => {
      expect(pictureIn(rows, 2)).not.toBeNull()
    })
    await waitFor(() => {
      expect(pictureIn(rows, 0)).toHaveAttribute("src", `${CDN}/p1-a.webp`)
    })
    expect(pictureIn(rows, 1)).toHaveAttribute("src", `${CDN}/c1.webp`)
    expect(pictureIn(rows, 2)).toHaveAttribute("src", `${CDN}/col1.webp`)
    // Decorative: the row's button names the strip
    expect(pictureIn(rows, 0)).toHaveAttribute("alt", "")
    // Nothing more is asked for a record with a picture of its own
    expect(list).toHaveBeenCalledTimes(1)
  })

  it("shows a brand's newest published product's photo, not its logo", async () => {
    const rows = renderRows([strip("brand", "b1")])
    await waitFor(() => {
      expect(pictureIn(rows, 0)).toHaveAttribute("src", `${CDN}/p7.webp`)
    })
    expect(fetch).toHaveBeenCalledWith("/admin/product-board", {
      query: { brand_id: "b1", status: "published", order: "-created_at", offset: 0, limit: 1 },
    })
    expect(fetch).not.toHaveBeenCalledWith("/admin/brands/b1", undefined)
  })

  it("shows the newest published product's photo for a collection or a category without a picture", async () => {
    const rows = renderRows([strip("collection", "col3"), strip("category", "c2")])
    await waitFor(() => {
      expect(pictureIn(rows, 0)).toHaveAttribute("src", `${CDN}/p9.webp`)
    })
    await waitFor(() => {
      expect(pictureIn(rows, 1)).toHaveAttribute("src", `${CDN}/p9.webp`)
    })
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        collection_id: ["col3"],
        status: ["published"],
        order: "-created_at",
        limit: 1,
      })
    )
    // A category's photo comes from it or one under it
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ category_id: ["c2", "c3"], status: ["published"] })
    )
  })

  it("lets the strip's own picture win and keeps the placeholder when the storefront has none", async () => {
    const rows = renderRows([
      { ...strip("brand", "b1"), image: own },
      strip("product", "p2"),
      strip("collection", "col2"),
      strip("category", "c9"),
      strip("brand", "b2"),
      // Its picture showing means the category pictures are in
      strip("category", "c1"),
    ])
    expect(pictureIn(rows, 0)).toHaveAttribute("src", own.url)
    await waitFor(() => {
      expect(pictureIn(rows, 5)).not.toBeNull()
    })
    await waitFor(() => {
      expect(list).toHaveBeenCalledWith(expect.objectContaining({ collection_id: ["col2"] }))
    })
    await waitFor(() => {
      expect(list).toHaveBeenCalledWith(expect.objectContaining({ category_id: ["c9"] }))
    })
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/admin/product-board", expect.anything())
    })
    for (const at of [1, 2, 3, 4]) {
      expect(pictureIn(rows, at)).toBeNull()
    }
    // The strip with its own picture asks nothing of its brand
    expect(fetch.mock.calls.filter(([, init]) => init?.query?.["brand_id"] === "b1")).toHaveLength(
      0
    )
  })
})
