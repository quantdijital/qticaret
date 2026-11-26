import { z } from "zod"
import {
  MEDIA_ALT_TARGET,
  PRICING_TARGET,
  PRODUCT_SECTIONS,
  STOCK_TARGET,
  VARIANT_CODES_TARGET,
} from "../detail/sections"

/**
 * The product page's parts (docs/06 "Ürün sayfası"), each column in its
 * default order. A locked part is always shown: the product's name and
 * address, the "Ürün verileri" card with its prices and variants, and the
 * SEO advisor, through whose "Alana git" a hidden part is still reached.
 * `targets` are the element ids inside the part the advisor's "go to
 * field" lands on.
 */
export interface PartInfo {
  key: string
  locked?: boolean
  targets: readonly string[]
}

/**
 * The tabs of the "Ürün verileri" card (WooCommerce's product data box),
 * in their fixed order; a hidden tab is not drawn. The simple product's
 * prices (Genel) and the variants are locked. The price and code targets
 * here are a product's with variants; a simple product has them in its
 * Genel and Stok tabs (`tabOfTarget`).
 */
export const TAB_PARTS = [
  { key: "pricing", locked: true, targets: [PRICING_TARGET] },
  { key: "stock", targets: [STOCK_TARGET] },
  { key: "shipping", targets: [PRODUCT_SECTIONS.shipping] },
  { key: "attributes", targets: [PRODUCT_SECTIONS.attributes] },
  { key: "variants", locked: true, targets: ["product-variants", VARIANT_CODES_TARGET] },
  { key: "catalog", targets: [PRODUCT_SECTIONS.catalog] },
  // S3: upsells and cross-sells (WooCommerce's "Linked Products")
  { key: "linked", targets: [] },
  { key: "advanced", targets: [PRODUCT_SECTIONS.addons, PRODUCT_SECTIONS.priceHistory] },
] as const satisfies readonly PartInfo[]

export const MAIN_PARTS = [
  { key: "general", locked: true, targets: ["product-general"] },
  { key: "media", targets: ["product-media", MEDIA_ALT_TARGET] },
  { key: "description", targets: ["product-description"] },
  // Its tabs' targets: its mark in the section bar counts them all
  { key: "data", locked: true, targets: TAB_PARTS.flatMap((tab) => [...tab.targets]) },
  { key: "shortDescription", targets: ["product-short-description"] },
  { key: "departures", targets: [] },
  { key: "program", targets: ["product-program"] },
  { key: "seo", targets: [PRODUCT_SECTIONS.seo] },
  { key: "faq", targets: [PRODUCT_SECTIONS.faq] },
] as const satisfies readonly PartInfo[]

export const SIDE_PARTS = [
  { key: "summary", targets: [] },
  { key: "advisor", locked: true, targets: [] },
  { key: "organize", targets: [PRODUCT_SECTIONS.organize] },
] as const satisfies readonly PartInfo[]

export type MainPart = (typeof MAIN_PARTS)[number]["key"]
export type SidePart = (typeof SIDE_PARTS)[number]["key"]
export type TabPart = (typeof TAB_PARTS)[number]["key"]
export type PartKey = MainPart | SidePart | TabPart

const ALL: readonly PartInfo[] = [...MAIN_PARTS, ...SIDE_PARTS, ...TAB_PARTS]

export const TAB_KEYS: readonly TabPart[] = TAB_PARTS.map((tab) => tab.key)

export const isTab = (key: string): key is TabPart => (TAB_KEYS as readonly string[]).includes(key)

export const isLocked = (key: PartKey): boolean =>
  ALL.some((part) => part.key === key && part.locked === true)

/**
 * The element ids a part holds, for its findings; a simple product's
 * price and codes count in its Genel and Stok tabs, not its variants.
 */
export function targetsOf(key: PartKey, simple = false): readonly string[] {
  const own = ALL.find((part) => part.key === key)?.targets ?? []
  if (!simple || !isTab(key)) {
    return own
  }
  if (key === "variants") {
    return []
  }
  const moved = ["product-variants", VARIANT_CODES_TARGET].filter(
    (target) => tabOfTarget(target, true) === key
  )
  return [...own, ...moved]
}

/**
 * The data card's tab a target is in. `simple`: a product without
 * variants, its price in Genel and its codes in Stok.
 */
export function tabOfTarget(target: string, simple: boolean): TabPart | undefined {
  if (simple && target === "product-variants") {
    return "pricing"
  }
  if (simple && target === VARIANT_CODES_TARGET) {
    return "stock"
  }
  return TAB_PARTS.find((tab) => (tab.targets as readonly string[]).includes(target))?.key
}

/**
 * The part an advisor target lands in, a tab of the data card before the
 * card itself; none for an id the page does not lay out.
 */
export function partOfTarget(target: string, simple = false): PartKey | undefined {
  return (
    tabOfTarget(target, simple) ??
    [...MAIN_PARTS, ...SIDE_PARTS].find((part) =>
      (part.targets as readonly string[]).includes(target)
    )?.key
  )
}

/**
 * The parts folded to a line (docs/06 "Ürün sayfası"), closed by default;
 * the shop may have them start open ("Gelişmiş"). Each key is also the
 * fold's remembered name, `product.<key>`.
 */
export const FOLDED_PARTS = ["seo", "faq"] as const
export type FoldedPart = (typeof FOLDED_PARTS)[number]

const isFolded = (key: string): key is FoldedPart =>
  (FOLDED_PARTS as readonly string[]).includes(key)

/**
 * The page as laid out: each column's order, the parts hidden (tabs of the
 * data card too) and the folded ones open. The tabs keep their order.
 */
export interface ProductLayout {
  main: MainPart[]
  side: SidePart[]
  hidden: PartKey[]
  open: FoldedPart[]
}

export const DEFAULT_LAYOUT: ProductLayout = {
  main: MAIN_PARTS.map((part) => part.key),
  side: SIDE_PARTS.map((part) => part.key),
  hidden: [],
  open: [],
}

/** What the shop saved (`panel_layout.product`), as the server keeps it. */
export const storedLayoutSchema = z.object({
  main: z.array(z.string()).catch([]),
  side: z.array(z.string()).catch([]),
  hidden: z.array(z.string()).catch([]),
  open: z.array(z.string()).catch([]),
})
export type StoredLayout = z.infer<typeof storedLayoutSchema>

/**
 * A column's order from what was saved: keys it no longer knows dropped
 * (a card that became a tab of the data card), each once; a part not in
 * the saved order (new since) at its default place, after the part it
 * follows by default.
 */
function columnOrder<K extends string>(defaults: readonly K[], saved: readonly string[]): K[] {
  const known = new Set<string>(defaults)
  const order: K[] = []
  for (const key of saved) {
    if (known.has(key) && !order.includes(key as K)) {
      order.push(key as K)
    }
  }
  if (order.length === 0) {
    return [...defaults]
  }
  defaults.forEach((key, index) => {
    if (order.includes(key)) {
      return
    }
    const before = defaults
      .slice(0, index)
      .reverse()
      .find((each) => order.includes(each))
    order.splice(before === undefined ? 0 : order.indexOf(before) + 1, 0, key)
  })
  return order
}

/** The layout from the stored value; anything unreadable is the default. */
export function layoutOf(stored: unknown): ProductLayout {
  const parsed = storedLayoutSchema.safeParse(stored)
  if (!parsed.success) {
    return DEFAULT_LAYOUT
  }
  const main = columnOrder(DEFAULT_LAYOUT.main, parsed.data.main)
  const side = columnOrder(DEFAULT_LAYOUT.side, parsed.data.side)
  const known = new Set<string>([...main, ...side, ...TAB_KEYS])
  const hidden = [...new Set(parsed.data.hidden)].filter(
    (key): key is PartKey => known.has(key) && !isLocked(key as PartKey)
  )
  const open = [...new Set(parsed.data.open)].filter(isFolded)
  return { main, side, hidden, open }
}

/** Whether two layouts show the same page. */
export const sameLayout = (a: ProductLayout, b: ProductLayout): boolean =>
  a.main.join() === b.main.join() &&
  a.side.join() === b.side.join() &&
  [...a.hidden].sort().join() === [...b.hidden].sort().join() &&
  [...a.open].sort().join() === [...b.open].sort().join()
