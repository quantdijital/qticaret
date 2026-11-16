import { beforeEach, describe, expect, it, vi } from "vitest"
import type { StoreProduct } from "@qticaret/types"
import type { ImageView, ProductCardView } from "@qticaret/ui"
import { StoreApiError } from "@/lib/store-api/errors"
import { categoryCounts, collectionDetails } from "@/lib/store-api/extras"
import {
  brandById,
  collectionById,
  listProducts,
  pathsOf,
  priceDisplays,
  productIdsOf,
} from "@/lib/store-api/requests"
import { picturedCategories } from "../category-tiles"
import { productCards } from "../product"
import { productsInOrder } from "../section-data"
import { stripSources } from "../strip-sources"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/store-api/requests", () => ({
  brandById: vi.fn(),
  collectionById: vi.fn(),
  listProducts: vi.fn(),
  pathsOf: vi.fn(),
  priceDisplays: vi.fn(),
  productIdsOf: vi.fn(),
}))
vi.mock("@/lib/store-api/extras", () => ({ categoryCounts: vi.fn(), collectionDetails: vi.fn() }))
vi.mock("../category-tiles", () => ({ picturedCategories: vi.fn() }))
vi.mock("../section-data", () => ({ productsInOrder: vi.fn() }))
vi.mock("../theme-settings", () => ({ cardOptions: vi.fn(() => Promise.resolve({})) }))
vi.mock("../product", () => ({ productCards: vi.fn(), variantIdsOf: () => ["variant_1"] }))
vi.mock("../image", () => ({
  imageView: (image: { url: string }, alt: string) => photo(image.url, alt),
  productImages: (product: StoreProduct) => [photo(`/${product.id}.webp`, product.title)],
}))

const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}:${Object.values(values).map(String).join(",")}` : key

function photo(src: string, alt = ""): ImageView {
  return { src, alt, width: null, height: null, sources: { avif: null, webp: null } }
}

const product = (id: string) => ({ id, title: `Ürün ${id}` }) as StoreProduct
const card = (id: string, price: ProductCardView["price"]) =>
  ({
    id,
    title: `Ürün ${id}`,
    path: `/urun/${id}`,
    image: photo(`/${id}.webp`),
    price,
  }) as ProductCardView

const PRICE = { current: "1.250,00 TL", before: null, from: false, discount: null }

beforeEach(() => {
  vi.mocked(pathsOf).mockImplementation((_type, ids) =>
    Promise.resolve(
      Object.fromEntries(ids.filter((id) => !id.includes("gone")).map((id) => [id, `/${id}`]))
    )
  )
  vi.mocked(priceDisplays).mockResolvedValue({})
  vi.mocked(categoryCounts).mockResolvedValue(new Map([["pcat_1", 24]]))
  vi.mocked(collectionDetails).mockResolvedValue({ description: null, image: null })
})

describe("a strip gallery's sources, fetched live (adr/0049 Ek 2026-11-16)", () => {
  it("gives a product its card's name, page, photo and the shopper's price, a range's 'from'", async () => {
    vi.mocked(productsInOrder).mockResolvedValue([product("prod_1"), product("prod_2")])
    vi.mocked(productCards).mockReturnValue([
      card("prod_1", PRICE),
      card("prod_2", { ...PRICE, from: true }),
    ])
    const found = await stripSources(
      [
        { kind: "product", target: "prod_1" },
        { kind: "product", target: "prod_2" },
        { kind: "product", target: "prod_1" },
      ],
      t
    )
    // Each record asked for once
    expect(productsInOrder).toHaveBeenCalledWith(["prod_1", "prod_2"])
    expect(priceDisplays).toHaveBeenCalledWith(["variant_1"])
    expect(found.get("product:prod_1")).toEqual({
      name: "Ürün prod_1",
      path: "/urun/prod_1",
      image: photo("/prod_1.webp"),
      note: "1.250,00 TL",
    })
    expect(found.get("product:prod_2")?.note).toBe("price.from:1.250,00 TL")
  })

  it("gives a category its picture and its product count, none when empty", async () => {
    vi.mocked(picturedCategories).mockResolvedValue([
      { id: "pcat_1", card: { label: "Mutfak", path: "/mutfak", image: photo("/c.webp") } },
      { id: "pcat_2", card: { label: "Boş", path: "/bos" } },
    ])
    const found = await stripSources(
      [
        { kind: "category", target: "pcat_1" },
        { kind: "category", target: "pcat_2" },
      ],
      t
    )
    expect(found.get("category:pcat_1")).toMatchObject({ name: "Mutfak", note: "listing.count:24" })
    expect(found.get("category:pcat_2")).toMatchObject({ image: null, note: null })
  })

  it("takes a collection's own picture, else its newest product's photo", async () => {
    vi.mocked(collectionById).mockImplementation((id) =>
      Promise.resolve({ collection: { id, title: `Koleksiyon ${id}`, handle: id } })
    )
    vi.mocked(collectionDetails).mockImplementation((id) =>
      Promise.resolve({
        description: null,
        image:
          id === "pcol_1"
            ? { url: "/kol.webp", alt: null, width: null, height: null, derivatives: null }
            : null,
      })
    )
    vi.mocked(listProducts).mockResolvedValue({ products: [product("prod_9")], count: 1 })
    const found = await stripSources(
      [
        { kind: "collection", target: "pcol_1" },
        { kind: "collection", target: "pcol_2" },
        { kind: "collection", target: "pcol_gone" },
      ],
      t
    )
    expect(found.get("collection:pcol_1")).toMatchObject({
      name: "Koleksiyon pcol_1",
      path: "/pcol_1",
      image: { src: "/kol.webp" },
    })
    expect(found.get("collection:pcol_2")?.image).toEqual(photo("/prod_9.webp"))
    // No live page here: not in the map, so its strip is left out
    expect(found.has("collection:pcol_gone")).toBe(false)
  })

  it("stands a brand's newest product photo for it, never its logo", async () => {
    vi.mocked(brandById).mockResolvedValue({
      brand: { id: "brand_1", name: "Marka", handle: "marka", description: null },
    })
    vi.mocked(productIdsOf).mockResolvedValue({ product_ids: ["prod_5"], count: 1 })
    vi.mocked(productsInOrder).mockResolvedValue([product("prod_5")])
    const found = await stripSources([{ kind: "brand", target: "brand_1" }], t)
    expect(found.get("brand:brand_1")).toEqual({
      name: "Marka",
      path: "/brand_1",
      image: photo("/prod_5.webp"),
      note: null,
    })
  })

  it("keeps the other kinds when the backend cannot answer one", async () => {
    vi.mocked(picturedCategories).mockRejectedValue(new StoreApiError(503, null, null))
    vi.mocked(productsInOrder).mockResolvedValue([product("prod_1")])
    vi.mocked(productCards).mockReturnValue([card("prod_1", null)])
    const found = await stripSources(
      [
        { kind: "category", target: "pcat_1" },
        { kind: "product", target: "prod_1" },
      ],
      t
    )
    expect([...found.keys()]).toEqual(["product:prod_1"])
    // A card that shows no price gives no line
    expect(found.get("product:prod_1")?.note).toBeNull()
  })
})
