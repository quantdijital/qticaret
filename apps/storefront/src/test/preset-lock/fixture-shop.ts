import type { StoreBrandSummary, StoreCategory, StoreProduct } from "@qticaret/types"

/**
 * The one shop every preset is drawn in (docs/tema/bilesen-standardi §7,
 * preset lock): a fixed catalogue that names every category a preset
 * links to, plain ids, fixed prices and pictures. Nothing here reads the
 * clock, the presets or the sector packs: a preset changes only its own
 * pages, and this file changes every page on purpose.
 */

const CDN = "https://cdn.example.com"

/** A category of the fixed tree: its handle, its name, its parent's handle. */
const TREE: readonly [handle: string, name: string, parent: string | null][] = [
  ["el-yapimi-caki", "El Yapımı Çakılar", null],
  ["damascus-celik-bicaklar", "Damascus Çelik", "el-yapimi-caki"],
  ["elmax-cakilar", "Elmax Çakılar", "el-yapimi-caki"],
  ["n690-cakilar", "N690 Çakılar", "el-yapimi-caki"],
  ["geyik-boynuzu-sapli-cakilar", "Geyik Boynuzu Saplı", "el-yapimi-caki"],
  ["kemik-sapli-cakilar", "Kemik Saplı", "el-yapimi-caki"],
  ["epoksi-cakilar", "Epoksi Saplı", "el-yapimi-caki"],
  ["av-bicaklari", "Av Bıçakları", null],
  ["outdoor-ve-kamp", "Outdoor ve Kamp", null],
  ["kamp-bicaklari", "Kamp Bıçakları", "outdoor-ve-kamp"],
  ["kamp-baltalari", "Kamp Baltaları", "outdoor-ve-kamp"],
  ["mutfak-ve-sef-bicaklari", "Mutfak ve Şef Bıçakları", null],
  ["sef-bicaklari", "Şef Bıçakları", "mutfak-ve-sef-bicaklari"],
  ["mutfak-bicak-setleri", "Mutfak Bıçak Setleri", "mutfak-ve-sef-bicaklari"],
  ["kasap-bicaklari", "Kasap Bıçakları", "mutfak-ve-sef-bicaklari"],
  ["mutfak-sef-serisi", "Mutfak & Şef Serisi", null],
  ["kiliclar", "Kılıçlar", null],
  ["kilic-modelleri", "Kılıç Modelleri", "kiliclar"],
  ["ozel-koleksiyon", "Özel Koleksiyon", null],
]

export const categoryId = (handle: string): string => `pcat_${handle.replaceAll("-", "_")}`

export const CATEGORIES: StoreCategory[] = TREE.map(([handle, name, parent], rank) => ({
  id: categoryId(handle),
  name,
  handle,
  description: null,
  parent_category_id: parent ? categoryId(parent) : null,
  rank,
}))

/** A category's live path, as `/store/seo/paths` answers it: its parent's below `/kategori`. */
export const CATEGORY_PATHS: Readonly<Record<string, string>> = Object.fromEntries(
  TREE.map(([handle, , parent]) => [
    categoryId(handle),
    `/kategori/${parent ? `${parent}/` : ""}${handle}`,
  ])
)

export const BRANDS: StoreBrandSummary[] = [
  ["brand_karacelik", "Karaçelik", "karacelik"],
  ["brand_yaman", "Yaman Bıçak", "yaman-bicak"],
  ["brand_demirhan", "Demirhan", "demirhan"],
].map(([id, name, handle]) => ({
  id: id ?? "",
  name: name ?? "",
  handle: handle ?? "",
  logo_url: null,
  description: null,
}))

const PRODUCT_NAMES: readonly [handle: string, title: string][] = [
  ["karacelik-alageyik-sam-celigi-av-bicagi", "Alageyik Şam Çeliği Av Bıçağı"],
  ["yaman-n690-katlanir-caki", "N690 Katlanır Çakı"],
  ["demirhan-sef-bicagi-20", "Şef Bıçağı 20 cm"],
  ["karacelik-kamp-baltasi", "Kamp Baltası"],
  ["yaman-elmax-caki", "Elmax Gravürlü Çakı"],
  ["demirhan-kasap-seti", "Kasap Bıçağı Seti"],
  ["karacelik-damascus-caki", "Damascus Çakı"],
  ["yaman-kemik-sapli-caki", "Kemik Saplı Çakı"],
]

const pad = (index: number) => String(index + 1).padStart(2, "0")

/** Each product's price in lira; every third is on sale (its regular price a fifth higher). */
export const priceOf = (index: number): { current: number; regular: number } => {
  const current = 450 + index * 175
  return { current, regular: index % 3 === 1 ? Math.round(current * 1.2) : current }
}

export const PRODUCTS: StoreProduct[] = PRODUCT_NAMES.map(([handle, title], index) => {
  const brand = BRANDS[index % BRANDS.length]
  const url = `${CDN}/p/${pad(index)}.webp`
  const { current, regular } = priceOf(index)
  return {
    id: `prod_${pad(index)}`,
    title,
    handle,
    subtitle: null,
    description: null,
    thumbnail: url,
    brand: brand ? { id: brand.id, name: brand.name, handle: brand.handle, logo_url: null } : null,
    media_assets: [
      {
        id: `media_${pad(index)}`,
        url,
        width: 1200,
        height: 1200,
        alt: title,
        derivatives: {
          srcset: {
            webp: [400, 800].map((width) => ({
              width,
              url: `${CDN}/p/${pad(index)}-${width}.webp`,
            })),
          },
        },
      },
    ],
    images: [
      { id: `img_${pad(index)}a`, url, rank: 0 },
      { id: `img_${pad(index)}b`, url: `${CDN}/p/${pad(index)}-b.webp`, rank: 1 },
    ],
    product_extension: { is_gift_card: false, kind: "physical" },
    variants: [
      {
        id: `variant_${pad(index)}`,
        title: null,
        sku: `SKU-${pad(index)}`,
        manage_inventory: true,
        allow_backorder: false,
        // One sold out, one nearly
        inventory_quantity: index === 5 ? 0 : index === 3 ? 2 : 20,
        calculated_price: {
          calculated_amount: current,
          original_amount: regular,
          currency_code: "try",
        },
      },
    ],
  }
})

/** A category's products: a fixed two thirds of the catalogue, turned by the category's place. */
export function productsIn(categoryIds: readonly string[]): StoreProduct[] {
  const places = categoryIds.map((id) => CATEGORIES.findIndex((each) => each.id === id))
  return PRODUCTS.filter((_, index) => places.some((place) => (index + place) % 3 !== 0))
}

/** The best sellers' and the sale's picks, as the backend orders them. */
export const BEST_SELLERS = [6, 0, 4, 2, 7, 1, 3, 5].map((index) => `prod_${pad(index)}`)
export const ON_SALE = PRODUCTS.filter((_, index) => index % 3 === 1).map((each) => each.id)

export const CATEGORY_IMAGES = CATEGORIES.filter((_, index) => index % 2 === 0).map((category) => ({
  category_id: category.id,
  url: `${CDN}/c/${category.handle}.webp`,
  alt: category.name,
  width: 800,
  height: 800,
  derivatives: null,
}))

export const CATEGORY_COUNTS: Record<string, number> = Object.fromEntries(
  CATEGORIES.map((category, index) => [category.id, 3 + ((index * 7) % 11)])
)

export const POSTS = [1, 2, 3, 4].map((n) => ({
  id: `post_${String(n)}`,
  kind: "post" as const,
  title: `Bıçak bakımı rehberi ${String(n)}`,
  handle: `bicak-bakimi-${String(n)}`,
  path: `/blog/bicak-bakimi-${String(n)}`,
  excerpt: "Çeliği nasıl bilersiniz, sapı nasıl korursunuz: kısa bir rehber.",
  image_url: `${CDN}/b/${String(n)}.webp`,
  image_alt: null,
  image_width: 1200,
  image_height: 800,
  image_derivatives: null,
  author_name: "Atölye",
  author: null,
  published_at: `2026-10-0${String(n)}T09:00:00.000Z`,
  revised_at: null,
  reading_minutes: 3 + n,
  category: null,
  tags: [],
}))

export const REVIEWS = [5, 4, 5, 3, 5].map((rating, index) => ({
  product_id: PRODUCTS[index]?.id ?? "",
  product_title: PRODUCTS[index]?.title ?? "",
  rating,
  title: index % 2 === 0 ? "Çok memnun kaldım" : null,
  body: "Keskin geldi, kutusu özenliydi. Sapı elde iyi duruyor.",
  author_name: ["Ayşe K.", "Mehmet T.", "Zeynep A.", "Can Ö.", "Elif S."][index] ?? null,
  created_at: `2026-10-${String(10 + index)}T12:00:00.000Z`,
  verified_purchase: true,
  photos: [],
}))

/** Paths of the records that are not categories: products, brands. */
export const RECORD_PATHS: Readonly<Record<string, string>> = Object.fromEntries([
  ...PRODUCTS.map((product): [string, string] => [product.id, `/urun/${product.handle}`]),
  ...BRANDS.map((brand): [string, string] => [brand.id, `/marka/${brand.handle}`]),
])
