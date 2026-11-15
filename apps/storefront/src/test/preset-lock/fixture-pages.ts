import type { StoreProduct } from "@qticaret/types"
import type { ListingAnswer } from "@/lib/store-api/listings"
import { BRANDS, PRODUCTS, categoryId } from "./fixture-shop"

/**
 * The fixed shop's product and category page (preset lock,
 * docs/tema/bilesen-standardi §7): one product with options whose variants
 * are on sale, nearly sold out and sold out, and one category page with
 * filters, a sort, three pages and four cards. Kept apart from
 * `fixture-shop.ts` so the home page's snapshots do not move with it.
 */

const CDN = "https://cdn.example.com"

export const PAGE_CATEGORY = categoryId("el-yapimi-caki")
export const PAGE_CATEGORY_PATH = "/kategori/el-yapimi-caki"

const LENGTH = { id: "opt_length", title: "Uzunluk" }
const HANDLE = { id: "opt_handle", title: "Sap" }

/** A variant of the page's product: its option values, price in lira, regular price, stock. */
const VARIANTS: readonly [
  id: string,
  length: string,
  handle: string,
  price: number,
  regular: number,
  stock: number,
][] = [
  ["variant_page_a", "18 cm", "Ceviz", 1890, 2290, 2],
  ["variant_page_b", "18 cm", "Geyik boynuzu", 2490, 2490, 0],
  ["variant_page_c", "22 cm", "Ceviz", 2190, 2190, 14],
]

const value = (option: string, text: string) => `optval_${option}_${text.replace(/\W+/g, "_")}`

const picture = (name: string) => ({
  url: `${CDN}/p/sayfa-${name}.webp`,
  width: 1200,
  height: 1200,
})

export const PAGE_PRODUCT: StoreProduct = {
  id: "prod_page",
  title: "Ceviz Saplı Av Bıçağı",
  handle: "ceviz-sapli-av-bicagi",
  categories: [{ id: PAGE_CATEGORY }],
  subtitle: "El dövmesi N690 çelik",
  description: "Elde dövülmüş N690 çelik, ceviz sap, deri kılıf.",
  thumbnail: picture("1").url,
  brand: BRANDS[0]
    ? { id: BRANDS[0].id, name: BRANDS[0].name, handle: BRANDS[0].handle, logo_url: null }
    : null,
  media_assets: ["1", "2", "3"].map((name) => ({
    id: `media_page_${name}`,
    ...picture(name),
    alt: `Ceviz Saplı Av Bıçağı ${name}`,
    derivatives: {
      srcset: {
        webp: [400, 800].map((width) => ({ width, url: `${CDN}/p/sayfa-${name}-${width}.webp` })),
      },
    },
  })),
  images: ["1", "2", "3"].map((name, rank) => ({
    id: `img_page_${name}`,
    url: picture(name).url,
    rank,
  })),
  options: [
    {
      ...LENGTH,
      values: ["18 cm", "22 cm"].map((text) => ({ id: value("length", text), value: text })),
    },
    {
      ...HANDLE,
      values: ["Ceviz", "Geyik boynuzu"].map((text) => ({
        id: value("handle", text),
        value: text,
      })),
    },
  ],
  variants: VARIANTS.map(([id, length, handle, price, regular, stock]) => ({
    id,
    title: `${length} / ${handle}`,
    sku: id.toUpperCase(),
    manage_inventory: true,
    allow_backorder: false,
    inventory_quantity: stock,
    options: [
      { id: value("length", length), value: length, option_id: LENGTH.id },
      { id: value("handle", handle), value: handle, option_id: HANDLE.id },
    ],
    calculated_price: {
      calculated_amount: price,
      original_amount: regular,
      currency_code: "try",
    },
  })),
  attribute_values: [
    ["steel", "Çelik", "N690"],
    ["blade_length", "Ağız uzunluğu", "11 cm"],
  ].map(([key, label, text], rank) => ({
    id: `attr_page_${String(rank)}`,
    value_text: text ?? null,
    value_number: null,
    value_boolean: null,
    value_options: null,
    definition: {
      key: key ?? "",
      label: label ?? "",
      type: "text" as const,
      unit: null,
      rank,
      options: null,
      is_seo_highlight: rank === 0,
    },
  })),
  product_extension: { is_gift_card: false, kind: "physical" },
}

/** The page product's prices as `/store/price-display` answers them, by variant. */
export function pagePriceDisplay(ids: readonly string[]) {
  return Object.fromEntries(
    VARIANTS.filter(([id]) => ids.includes(id)).map(([id, , , price, regular]) => [
      id,
      {
        current: price.toFixed(2),
        regular: regular.toFixed(2),
        before: price !== regular ? regular.toFixed(2) : null,
        on_sale: price !== regular,
        since: null,
        basis: null,
        rule_version: "tr-10d-1",
      },
    ])
  )
}

const facet = (value: string, label: string, count: number, selected = false) => ({
  value,
  label,
  count,
  selected,
})

/** The category page's first page: four of its ten products, its filters. */
export const PAGE_LISTING: ListingAnswer = {
  product_ids: [0, 1, 3, 5].map((index) => PRODUCTS[index]?.id ?? ""),
  count: 10,
  page: 1,
  page_size: 4,
  facets: {
    brands: BRANDS.map((brand, index) => facet(brand.handle, brand.name, 4 - index)),
    attributes: [
      {
        key: "celik",
        label: "Çelik",
        values: [
          facet("n690", "N690", 6),
          facet("elmax", "Elmax", 3),
          facet("damascus", "Damascus", 1),
        ],
      },
    ],
    price: { min: 450, max: 1675 },
    stock: { count: 8, selected: false },
  },
}
