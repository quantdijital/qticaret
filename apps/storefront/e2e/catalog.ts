import { BACKEND_URL } from "./admin"

/**
 * What the shop sells, found when the tests run, through the Store API as
 * the storefront asks it: the e2e names no product, category or price of
 * its own, so it runs on the demo seed and on a shop's own catalog alike.
 * All it needs is one published product in stock with a lira price.
 */

export interface ShopProduct {
  id: string
  title: string
  /** Its storefront path, from the URL registry as its cards link it (`/store/seo/paths`). */
  path: string
  /** The variant a test buys: in stock, its price in kuruş as the catalog gives it now. */
  variant: { id: string; title: string | null; kurus: number }
}

interface StoreVariant {
  id: string
  title: string | null
  manage_inventory: boolean | null
  inventory_quantity?: number | null
  calculated_price?: { calculated_amount: number | null; currency_code: string | null } | null
}

interface StoreProduct {
  id: string
  title: string
  variants: StoreVariant[] | null
  product_extension?: { is_gift_card?: boolean | null } | null
}

const PRODUCT_FIELDS = [
  "id",
  "title",
  "variants.id",
  "variants.title",
  "variants.manage_inventory",
  "variants.inventory_quantity",
  "*variants.calculated_price",
  // A gift card's form asks for its recipient: not the plain purchase the tests make
  "product_extension.is_gift_card",
].join(",")

let key: Promise<string> | undefined
let found: Promise<ShopProduct> | undefined

/**
 * The sales channel's publishable key: `E2E_PUBLISHABLE_KEY`, else the one
 * the development storefront itself asks the backend for (`/dev/storefront-key`).
 */
async function publishableKey(): Promise<string> {
  const given = process.env["E2E_PUBLISHABLE_KEY"]
  if (given) {
    return given
  }
  const response = await fetch(new URL("/dev/storefront-key", BACKEND_URL))
  const body = (await response.json()) as { publishable_key?: unknown }
  if (!response.ok || typeof body.publishable_key !== "string") {
    throw new Error("the backend gives no storefront key: set E2E_PUBLISHABLE_KEY")
  }
  return body.publishable_key
}

/** A Store API read with the storefront's key, as the storefront makes it. */
export async function storeGet<T>(
  path: string,
  query: Record<string, string | string[]>
): Promise<T> {
  const url = new URL(path, BACKEND_URL)
  for (const [name, value] of Object.entries(query)) {
    for (const each of typeof value === "string" ? [value] : value) {
      url.searchParams.append(name, each)
    }
  }
  key ??= publishableKey()
  const response = await fetch(url, {
    headers: { accept: "application/json", "x-publishable-api-key": await key },
  })
  if (!response.ok) {
    throw new Error(`GET ${path} answered ${String(response.status)}`)
  }
  return (await response.json()) as T
}

/** Units to sell now; a variant whose stock is not kept never runs out. */
const stockOf = (variant: StoreVariant): number =>
  variant.manage_inventory === false
    ? Number.POSITIVE_INFINITY
    : Math.max(variant.inventory_quantity ?? 0, 0)

/** Medusa's lira amount in kuruş; null without a lira price. */
function kurusOf(variant: StoreVariant): number | null {
  const price = variant.calculated_price
  const amount = price?.calculated_amount
  return price?.currency_code === "try" && typeof amount === "number" && amount > 0
    ? Math.round(amount * 100)
    : null
}

async function discover(): Promise<ShopProduct> {
  const { regions } = await storeGet<{ regions: { id: string; currency_code: string }[] }>(
    "/store/regions",
    { fields: "id,currency_code", limit: "50" }
  )
  const region = regions.find((each) => each.currency_code === "try")
  if (!region) {
    throw new Error("the backend has no Turkish lira region")
  }
  const { products } = await storeGet<{ products: StoreProduct[] }>("/store/products", {
    region_id: region.id,
    fields: PRODUCT_FIELDS,
    order: "created_at",
    limit: "100",
  })
  /**
   * Each priced variant in stock, the deepest stock first (the oldest
   * product on a tie): every order a test places holds a unit, so a shop
   * stocking two or three of each is not emptied one product at a time.
   */
  const candidates = products
    .filter((product) => product.product_extension?.is_gift_card !== true)
    .flatMap((product) =>
      (product.variants ?? []).flatMap((variant) => {
        const kurus = kurusOf(variant)
        const stock = stockOf(variant)
        return kurus !== null && stock > 0 ? [{ product, variant, kurus, stock }] : []
      })
    )
    .sort((a, b) => b.stock - a.stock)
  if (candidates.length === 0) {
    throw new Error("no published product in stock with a lira price for the e2e to buy")
  }
  const { paths } = await storeGet<{ paths: Record<string, string> }>("/store/seo/paths", {
    type: "product",
    id: [...new Set(candidates.map((each) => each.product.id))],
  })
  const chosen = candidates.find((each) => paths[each.product.id] !== undefined)
  if (!chosen) {
    throw new Error("no product in stock has a storefront path")
  }
  return {
    id: chosen.product.id,
    title: chosen.product.title,
    path: paths[chosen.product.id] ?? "",
    variant: { id: chosen.variant.id, title: chosen.variant.title, kurus: chosen.kurus },
  }
}

/** A product the tests can open and buy, found once per worker. */
export function stockedProduct(): Promise<ShopProduct> {
  found ??= discover().catch((error: unknown) => {
    found = undefined
    throw error
  })
  return found
}

/** Its page with its variant chosen (`?variant=`, as the option picker leaves it): ready to add. */
export const purchasePath = (product: ShopProduct): string =>
  `${product.path}?variant=${encodeURIComponent(product.variant.id)}`

/** A search for a word of its name (the first of four letters or more): one with results. */
export function searchPath(product: ShopProduct): string {
  const words = product.title.toLocaleLowerCase("tr-TR").match(/\p{L}{4,}/gu) ?? []
  const word = words[0] ?? product.title.trim().split(/\s+/)[0] ?? product.title
  return `/arama?q=${encodeURIComponent(word)}`
}

/** Stand-ins in a list of pages for the paths found when the test runs (`pathOf`). */
export const PRODUCT_PAGE = "a stocked product's page"
export const SEARCH_PAGE = "a search for its name"

/** A listed page's path: a stand-in's as found, any other as written. */
export async function pathOf(entry: string): Promise<string> {
  if (entry === PRODUCT_PAGE) {
    return (await stockedProduct()).path
  }
  if (entry === SEARCH_PAGE) {
    return searchPath(await stockedProduct())
  }
  return entry
}
