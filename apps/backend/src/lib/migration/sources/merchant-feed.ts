import { ValidationError } from "../../errors"
import { toSlug } from "../../seo/slug"
import { parseXmlSafely } from "../../security/xml"
import { oldAddressOf } from "../addresses"
import { decodeEntities, htmlToText } from "../text"
import type {
  MigrationKind,
  MigrationSource,
  SourceBrand,
  SourceCategory,
  SourceProduct,
  SourceVariant,
  StepProblem,
} from "../types"

/**
 * A Google Merchant product feed (RSS 2.0, `g:` attributes; Merchant
 * Center's product data specification) as products, categories and
 * brands (F14.3, adr/0042 §10): every Turkish platform publishes one
 * (Ticimax, ikas, IdeaSoft, T-Soft), so one reader takes them all. Items
 * of one `item_group_id` are one product's variants.
 */

// A shop's feed: twenty thousand products in a few tens of MB
export const MAX_FEED_BYTES = 100 * 1024 * 1024

type Item = Record<string, unknown>

/** An attribute's values, with or without the `g:` prefix, entities read. */
function values(item: Item, name: string): string[] {
  const raw = item[`g:${name}`] ?? item[name]
  return (Array.isArray(raw) ? raw : [raw])
    .map((value) => (typeof value === "string" || typeof value === "number" ? String(value) : ""))
    .map((value) => decodeEntities(value).trim())
    .filter((value) => value !== "")
}
const first = (item: Item, name: string, max = 255): string | null =>
  values(item, name)[0]?.slice(0, max) ?? null

/** "1299.90 TRY" as its amount, and whether it is lira (no code: the shop's own, lira). */
function moneyOf(text: string | null): { amount: string; lira: boolean } | null {
  const match = /^([0-9]+(?:[.,][0-9]{1,2})?)\s*([A-Z]{3})?$/.exec(
    (text ?? "").replace(/\s+/g, " ").trim()
  )
  if (!match?.[1]) {
    return null
  }
  return {
    amount: Number(match[1].replace(",", ".")).toFixed(2),
    lira: !match[2] || match[2] === "TRY",
  }
}

/** Whether a sale's dates ("2026-10-01T00:00+03:00/2026-10-31T23:59+03:00") hold now; none, it does. */
function onSale(range: string | null, now: Date = new Date()): boolean {
  if (!range) {
    return true
  }
  const [from, to] = range.split("/").map((part) => new Date(part.trim()).getTime())
  return (
    from !== undefined &&
    to !== undefined &&
    !Number.isNaN(from) &&
    !Number.isNaN(to) &&
    from <= now.getTime() &&
    now.getTime() <= to
  )
}

const GRAMS: Readonly<Record<string, number>> = { g: 1, kg: 1000, oz: 28.349523125, lb: 453.59237 }

/** "1.5 kg" in grams. */
function gramsOf(text: string | null): number | null {
  const match = /^([0-9]+(?:[.,][0-9]+)?)\s*(g|kg|oz|lb)$/i.exec(text?.trim() ?? "")
  const unit = GRAMS[match?.[2]?.toLowerCase() ?? ""]
  return match?.[1] && unit ? Math.round(Number(match[1].replace(",", ".")) * unit) : null
}

// The attributes that tell a group's variants apart, as the shop names them
const OPTIONS = [
  ["color", "Renk"],
  ["size", "Beden"],
  ["material", "Malzeme"],
  ["pattern", "Desen"],
] as const

/** What the titles of one group share: "Tava - 24 cm", "Tava - 28 cm" → "Tava". */
function sharedTitle(titles: readonly string[]): string {
  const [head = "", ...rest] = titles
  let shared = head
  for (const title of rest) {
    while (!title.startsWith(shared)) {
      shared = shared.slice(0, -1)
    }
  }
  // Mid-word ("24" and "28" share "2"): back to the last whole word
  if (shared.length < head.length && /[^\s\-–/,(|:]$/.test(shared)) {
    shared = shared.slice(0, Math.max(0, shared.search(/[\s\-–/,(|:][^\s\-–/,(|:]*$/)))
  }
  const cut = shared.replace(/[\s\-–/,(|:]+$/, "").trim()
  return cut.length >= 3 ? cut : head
}

function itemsOf(xml: string): Item[] {
  let parsed: unknown
  try {
    parsed = parseXmlSafely(xml, {
      maxBytes: MAX_FEED_BYTES,
      isArray: (tag) =>
        ["item", "entry", "g:additional_image_link", "g:product_type"].includes(tag),
    })
  } catch {
    throw new ValidationError("migration.feed_invalid")
  }
  const root = parsed as { rss?: { channel?: { item?: Item[] } }; feed?: { entry?: Item[] } }
  const items = root.rss?.channel?.item ?? root.feed?.entry
  if (!items) {
    throw new ValidationError("migration.feed_invalid")
  }
  return items
}

export interface FeedRecords {
  categories: SourceCategory[]
  brands: SourceBrand[]
  products: SourceProduct[]
  notes: (StepProblem & { kind: MigrationKind })[]
}

/** The feed's products, their categories (`product_type` paths) and brands. */
export function feedRecords(xml: string): FeedRecords {
  const notes: FeedRecords["notes"] = []
  const groups = new Map<string, Item[]>()
  for (const item of itemsOf(xml)) {
    const id = first(item, "id", 50)
    if (!id) {
      continue
    }
    if (moneyOf(first(item, "sale_price", 40) ?? first(item, "price", 40))?.lira === false) {
      notes.push({ kind: "product", source_key: id, key: "migration.feed_currency" })
      continue
    }
    const group = first(item, "item_group_id", 50) ?? id
    const members = groups.get(group)
    if (members) {
      members.push(item)
    } else {
      groups.set(group, [item])
    }
  }
  const categories = new Map<string, SourceCategory>()
  const brands = new Map<string, SourceBrand>()
  const products: SourceProduct[] = []
  for (const [group, items] of groups) {
    const [lead] = items
    if (!lead) {
      continue
    }
    const title = sharedTitle(items.map((item) => first(item, "title", 150) ?? ""))
    const old = oldAddressOf(first(lead, "link", 2048) ?? "")
    const slug = toSlug(
      old?.path
        .split("/")
        .pop()
        ?.replace(/\.[a-z0-9]{2,5}$/i, "") ?? ""
    )
    const handle = slug || toSlug(title)
    if (!title || !handle) {
      notes.push({ kind: "product", source_key: group, key: "migration.feed_item_invalid" })
      continue
    }
    // A one-item product has no options: its colour or size is only a detail
    const varying = OPTIONS.filter(
      ([name]) => items.length > 1 && new Set(items.map((item) => first(item, name) ?? "")).size > 1
    )
    const variants: SourceVariant[] = items.flatMap((item) => {
      // A sale price is what the item sells for; the regular one is only crossed out
      // A sale with its dates holds only between them
      const sale = onSale(first(item, "sale_price_effective_date", 120))
        ? moneyOf(first(item, "sale_price", 40))
        : null
      const regular = moneyOf(first(item, "price", 40))
      const price = sale ?? regular
      if (!price?.lira || Number(price.amount) === 0) {
        notes.push({
          kind: "product",
          source_key: first(item, "id") ?? group,
          key: "migration.feed_item_invalid",
        })
        return []
      }
      return [
        {
          source_key: first(item, "id", 50) ?? group,
          sku: first(item, "mpn", 70) ?? first(item, "id", 50),
          barcode: first(item, "gtin", 14),
          price: price.amount,
          compare_at_price: sale && regular ? regular.amount : null,
          // A feed gives no count: one not out of stock (in stock, preorder, backorder) is
          // sold uncounted, always sellable here (adr/0042 Ek 2026-11-20); the report says so
          stock: first(item, "availability") === "out_of_stock" ? 0 : "untracked",
          options: Object.fromEntries(
            varying.map(([name, label]) => [label, first(item, name, 100) ?? "-"])
          ),
          weight: gramsOf(first(item, "product_weight") ?? first(item, "shipping_weight")),
        },
      ]
    })
    if (variants.length === 0) {
      continue
    }
    if (variants.some((variant) => variant.stock === "untracked")) {
      notes.push({
        kind: "product",
        source_key: `group:${group}`,
        key: "migration.feed_stock_untracked",
      })
    }
    const paths = values(lead, "product_type").map((type) =>
      type
        .split(">")
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(0, 10)
    )
    for (const path of paths.filter((each) => each.length > 0)) {
      const key = `type:${path.join(" > ")}`
      categories.set(key, { source_key: key, path, description: null, old_url: null })
    }
    const brand = first(lead, "brand", 70)
    if (brand) {
      brands.set(brand.toLocaleLowerCase("tr-TR"), {
        source_key: `brand:${brand.toLocaleLowerCase("tr-TR")}`,
        name: brand,
        old_url: null,
      })
    }
    products.push({
      source_key: `group:${group}`,
      handle,
      title,
      description: htmlToText(first(lead, "description", 50_000)),
      status: "published",
      categories: paths.filter((path) => path.length > 0),
      brand,
      seo_title: null,
      seo_description: null,
      images: [
        ...new Set(
          items.flatMap((item) => [
            ...values(item, "image_link"),
            ...values(item, "additional_image_link"),
          ])
        ),
      ]
        .filter((url) => /^https?:\/\//.test(url))
        .slice(0, 20),
      options: varying.map(([name, label]) => ({
        name: label,
        values: [...new Set(items.map((item) => first(item, name, 100) ?? "-"))],
      })),
      variants,
      dimensions: null,
      old_url: old?.query ? null : (old?.path ?? null),
    })
  }
  return { categories: [...categories.values()], brands: [...brands.values()], products, notes }
}

/** A feed as a migration source: products, their categories and brands; nothing of people. */
export function feedSource(xml: string, id: string): MigrationSource {
  const records = feedRecords(xml)
  const listOf =
    <T>(items: readonly T[]) =>
    (): AsyncIterable<T> => ({
      [Symbol.asyncIterator]: () => {
        const each = items.values()
        return { next: () => Promise.resolve(each.next()) }
      },
    })
  return {
    id,
    categories: listOf(records.categories),
    brands: listOf(records.brands),
    products: listOf(records.products),
    customers: listOf([]),
    orders: listOf([]),
    reviews: listOf([]),
    pages: listOf([]),
    notes: () => records.notes,
  }
}
