import type { StoreLayout, StoreMenu, StorefrontAnswer } from "@qticaret/types"
import { CAPABILITY_GROUPS } from "@qticaret/types/section-requires"
import { sectorPack } from "@qticaret/sector-packs"
import type { PresetMenu } from "@qticaret/sector-packs"
import { StoreApiError } from "@/lib/store-api/errors"
import {
  BRANDS,
  CATEGORIES,
  CATEGORY_COUNTS,
  CATEGORY_IMAGES,
  CATEGORY_PATHS,
  POSTS,
  PRODUCTS,
  RECORD_PATHS,
  REVIEWS,
  priceOf,
  productsIn,
} from "./fixture-shop"
import { linkOf } from "./preset-resolve"
import { PACKS_DIR } from "./presets"

/**
 * The fixed shop's Store API (preset lock): every call the frame and the
 * home page make answered from `fixture-shop.ts`, the published design the
 * preset's (`store-layout.ts`). A call nobody answered throws, naming it,
 * so a new request of the storefront is added here on purpose and never
 * reaches a network.
 */

type Query = Record<string, unknown> | undefined

const list = (value: unknown): string[] =>
  value === undefined ? [] : (Array.isArray(value) ? value : [value]).map(String)

const notFound = () => new StoreApiError(404, "not_found", null)

const LEGAL_KINDS = ["distance_sales", "pre_information", "privacy_notice", "return_policy"]

/** The shop's own menus: a top strip and a footer column; no main menu, the category tree shows. */
const SHOP_MENUS: StoreMenu[] = [
  {
    title: "Üst",
    location: "top",
    rank: 0,
    items: [
      {
        label: "Hakkımızda",
        kind: "page",
        target: "page_about",
        path: "/hakkimizda",
        children: [],
      },
    ],
  },
  {
    title: "Yardım",
    location: "footer",
    rank: 1,
    items: [
      { label: "İletişim", kind: "page", target: "page_contact", path: "/iletisim", children: [] },
      { label: null, kind: "system", target: "order_lookup", path: null, children: [] },
    ],
  },
]

/** A preset's menus put live (adr/0063 §4): each link placed as the shop answers it, a broken one left out. */
export function menusOf(menus: readonly PresetMenu[] | null): StoreMenu[] {
  if (!menus) {
    return SHOP_MENUS
  }
  const placed = (link: { label: string; href: string }) => {
    const found = linkOf(link.href, link.label)
    return found ? [found] : []
  }
  return menus.map((menu, rank) => ({
    title: menu.title,
    location: menu.location,
    rank,
    items: menu.items.flatMap((item) =>
      placed(item).map((link) => ({
        ...link,
        children: (item.children ?? [])
          .flatMap(placed)
          .map((child) => ({ ...child, children: [] })),
      }))
    ),
  })) as StoreMenu[]
}

function products(query: Query) {
  const ids = list(query?.["id"])
  const categories = list(query?.["category_id"])
  const offset = Number(query?.["offset"] ?? 0)
  const limit = Number(query?.["limit"] ?? 12)
  let found = PRODUCTS
  if (ids.length > 0) {
    found = found.filter((each) => ids.includes(each.id))
  }
  if (categories.length > 0) {
    const inCategories = new Set(productsIn(categories).map((each) => each.id))
    found = found.filter((each) => inCategories.has(each.id))
  }
  const page = found.slice(offset, offset + limit)
  return { products: page, count: found.length }
}

function priceDisplay(query: Query) {
  return {
    price_display: Object.fromEntries(
      list(query?.["variant_id"]).flatMap((id) => {
        const index = PRODUCTS.findIndex((each) => each.variants?.[0]?.id === id)
        if (index < 0) return []
        const { current, regular } = priceOf(index)
        const sale = current !== regular
        return [
          [
            id,
            {
              current: current.toFixed(2),
              regular: regular.toFixed(2),
              before: sale ? regular.toFixed(2) : null,
              on_sale: sale,
              since: null,
              basis: null,
              rule_version: "tr-10d-1",
            },
          ],
        ]
      })
    ),
  }
}

function cardFacts(query: Query) {
  return {
    facts: Object.fromEntries(
      list(query?.["id"] ?? query?.["product_id"]).map((id) => {
        const index = PRODUCTS.findIndex((each) => each.id === id)
        const product = PRODUCTS[index]
        return [
          id,
          {
            stock: index === 5 ? "out" : index === 3 ? "low" : "in_stock",
            quick_add: index === 5 ? null : { variant_id: product?.variants?.[0]?.id ?? "" },
            rating: index % 2 === 0 ? { average: 4.5, count: 4 + index } : null,
          },
        ]
      })
    ),
  }
}

type Features = NonNullable<StorefrontAnswer["features"]>

const ALL_OFF: Features = { gift_cards: false, product_addons: false, booking: false }

/**
 * `GET /store/storefront`'s `features` as a shop the pack set up has them
 * (adr/0077 §8): each flag as the pack's `flags.json` turns it, else off
 * (the registry's defaults for these three); a frame fixture with no pack, all off.
 */
export function packFeatures(pack: string | null): Features {
  const flags = pack ? (sectorPack(pack, PACKS_DIR)?.flags ?? []) : []
  const on = (key: string) => flags.some((flag) => flag.key === key && flag.enabled)
  return {
    gift_cards: on("promotions.gift_cards"),
    product_addons: on("catalog.addons"),
    booking: on(CAPABILITY_GROUPS.dated.flag),
  }
}

/** The drawn preset's features: a spec sets them with its layout (`packFeatures`). */
export const shopFeatures: { current: Features } = { current: ALL_OFF }

/** The answer to a GET, by path; throws for one this file does not know. */
export function storeAnswer(
  layout: StoreLayout,
  menus: StoreMenu[],
  path: string,
  query: Query
): unknown {
  switch (path) {
    case "/store/seo/site":
      return {
        shop: { name: "Örnek Atölye", logo_url: null },
        home: null,
        canonical_host: "ornek.example.com",
        indexing: false,
        indexnow_key: null,
        jsonLd: [],
        system_pages: [],
      }
    case "/store/storefront":
      return {
        storefront: {
          announcements: [],
          trust_badges: [],
          primary_color: null,
          hero: null,
          contact_form_path: null,
          color_swatches: [],
        },
        free_shipping_threshold: 1500,
        features: shopFeatures.current,
        marks: {
          payments: [{ key: "visa" }, { key: "mastercard" }],
          carriers: [{ key: "yurtici" }],
        },
      }
    case "/store/storefront-layout":
      return { layout }
    case "/store/storefront-menus":
      return { menus }
    case "/store/legal-identity":
      return {
        identity: {
          company_title: "Örnek Atölye Ltd. Şti.",
          mersis: "0000000000000000",
          tax_office: "Denizli",
          tax_number: "0000000000",
          address: "Örnek Mah. 1. Sok. No: 1, Denizli",
          kep: null,
          etbis: null,
          etbis_qr: null,
          same_as: ["https://www.instagram.com/ornek", "https://www.youtube.com/@ornek"],
          email: "bilgi@example.com",
          phone: "+905320000000",
          whatsapp: "+905320000000",
          opening_hours: [1, 2, 3, 4, 5].map((day) => ({ day, opens: "09:00", closes: "18:00" })),
          map_url: null,
        },
      }
    case "/store/product-categories":
      return { product_categories: CATEGORIES }
    case "/store/seo/paths":
      return {
        paths: Object.fromEntries(
          list(query?.["id"]).flatMap((id) => {
            const found = CATEGORY_PATHS[id] ?? RECORD_PATHS[id]
            return found ? [[id, found]] : []
          })
        ),
      }
    case "/store/regions":
      return { regions: [{ id: "reg_try", name: "Türkiye", currency_code: "try" }] }
    case "/store/products":
      return products(query)
    case "/store/price-display":
      return priceDisplay(query)
    case "/store/card-facts":
      return cardFacts(query)
    case "/store/category-images":
      return { images: CATEGORY_IMAGES }
    case "/store/category-counts":
      return { counts: CATEGORY_COUNTS }
    case "/store/brands":
      return { brands: BRANDS, count: BRANDS.length }
    case "/store/content":
      return { entries: POSTS.slice(0, Number(query?.["limit"] ?? 3)), count: POSTS.length }
    case "/store/reviews":
      return { reviews: REVIEWS.slice(0, Number(query?.["limit"] ?? 3)), count: REVIEWS.length }
    case "/store/reviews/summary":
      return {
        rating: { average: 4.4, count: 5, distribution: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 3 } },
      }
    case "/store/reviews/photos":
    case "/store/google-reviews":
    case "/store/consents/cookies":
    case "/store/customers/me":
      throw notFound()
  }
  const legal = /^\/store\/legal\/(\w+)$/.exec(path)
  if (legal?.[1]) {
    if (!LEGAL_KINDS.includes(legal[1])) throw notFound()
    return {
      document: {
        kind: legal[1],
        version: 1,
        title: legal[1],
        html: "<p>Metin</p>",
        published_at: null,
      },
    }
  }
  const product = /^\/store\/products\/([\w-]+)$/.exec(path)
  if (product?.[1]) {
    const found = PRODUCTS.find((each) => each.id === product[1])
    if (!found) throw notFound()
    return { product: found }
  }
  throw new Error(`preset lock: no fixture answers GET ${path} ${JSON.stringify(query ?? {})}`)
}
