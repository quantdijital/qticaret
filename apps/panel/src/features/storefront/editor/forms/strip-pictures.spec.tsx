import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { StripGallerySection, StripItem } from "@/features/storefront/api/layout"
import { sectionProblems } from "@/features/storefront/layout/problems"
import { newHomeSection } from "@/features/storefront/layout/sections"
import { StripGalleryForm } from "./strip-gallery-form"

const CDN = "https://cdn.example.com"

// The catalogue the editor already reads: product list, category pictures, a collection, a brand
const fetch = vi.fn((path: string) => {
  switch (path) {
    case "/admin/category-images":
      return Promise.resolve({ images: [{ category_id: "c1", url: `${CDN}/c1.webp`, alt: null }] })
    case "/admin/collection-board/col1":
      return Promise.resolve({ collection: { id: "col1", image: { url: `${CDN}/col1.webp` } } })
    case "/admin/collection-board/col2":
      return Promise.resolve({ collection: { id: "col2", image: null } })
    case "/admin/brands/b1":
      return Promise.resolve({ brand: { id: "b1", name: "Marka", logo_url: `${CDN}/logo.png` } })
    default:
      return Promise.reject(new Error(path))
  }
})
const list = vi.fn<(query: unknown) => Promise<unknown>>(() =>
  Promise.resolve({
    products: [
      { id: "p1", title: "Bir", thumbnail: `${CDN}/p1.webp` },
      { id: "p2", title: "İki", thumbnail: null },
    ],
  })
)
vi.mock("@/lib/sdk", () => ({
  sdk: {
    client: { fetch: (path: string) => fetch(path) },
    admin: { product: { list: (query: unknown) => list(query) } },
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

describe("a strip row's small picture (adr/0049 Ek 2026-11-16)", () => {
  it("shows its record's picture when the strip has none of its own", async () => {
    const rows = renderRows([
      strip("product", "p1"),
      strip("category", "c1"),
      strip("collection", "col1"),
      strip("brand", "b1"),
    ])
    await waitFor(() => {
      expect(pictureIn(rows, 3)).not.toBeNull()
    })
    expect(pictureIn(rows, 0)).toHaveAttribute("src", `${CDN}/p1.webp`)
    expect(pictureIn(rows, 1)).toHaveAttribute("src", `${CDN}/c1.webp`)
    expect(pictureIn(rows, 2)).toHaveAttribute("src", `${CDN}/col1.webp`)
    // A logo is a mark: it sits whole in the box, a photo fills it
    expect(pictureIn(rows, 3)).toHaveAttribute("src", `${CDN}/logo.png`)
    expect(pictureIn(rows, 3)).toHaveAttribute("data-fit", "contain")
    expect(pictureIn(rows, 0)).toHaveAttribute("data-fit", "cover")
    // Decorative: the row's button names the strip
    expect(pictureIn(rows, 0)).toHaveAttribute("alt", "")
    // The product list the editor reads for names carries the small picture
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ fields: "id,title,thumbnail" }))
  })

  it("lets the strip's own picture win and keeps the placeholder when neither has one", async () => {
    const rows = renderRows([
      { ...strip("product", "p1"), image: own },
      strip("product", "p2"),
      strip("collection", "col2"),
      strip("category", "c9"),
      // Its picture showing means the category pictures are in
      strip("category", "c1"),
    ])
    expect(pictureIn(rows, 0)).toHaveAttribute("src", own.url)
    await waitFor(() => {
      expect(pictureIn(rows, 4)).not.toBeNull()
    })
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/admin/collection-board/col2")
    })
    expect(list).toHaveBeenCalled()
    for (const at of [1, 2, 3]) {
      expect(pictureIn(rows, at)).toBeNull()
    }
  })
})
