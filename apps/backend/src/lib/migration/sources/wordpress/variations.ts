import { decodeEntities } from "../../text"
import type { SourceVariant } from "../../types"
import type { WordpressContext } from "./context"
import { gramsOf, note, priceOf, sharesParentStock, stockOf } from "./context"
import { textOf, unserialize } from "./php"
import type { WxrItem } from "./reader"
import { attributeLabel } from "./terms"

/**
 * A WooCommerce product's attributes (`_product_attributes`, serialized)
 * and a variable product's variations as options and variants: the
 * attributes used for variations become options (three at most, in the
 * shop's order), each variation a variant (`attribute_*` meta: a term's
 * slug for a global attribute, the value itself for a product's own). A
 * variation left at "any" value stands for each of them; its own picture
 * goes with it. The other attributes are the attribute template's
 * (reported, adr/0042 Ek).
 */

export interface Attribute {
  /** The meta key's part: `pa_malzeme`, or a product's own `renk`. */
  key: string
  name: string
  global: boolean
  variation: boolean
  values: string[]
}

const MAX_OPTIONS = 3
const MAX_VARIANTS = 100
const OPTION_TEXT = 100
const SKU_TEXT = 100

/** The product's attributes in the shop's order; null for meta not read. */
export function attributesOf(item: WxrItem): Attribute[] | null {
  const raw = item.meta.get("_product_attributes") ?? ""
  if (raw.trim() === "") {
    return []
  }
  const parsed = unserialize(raw)
  if (!(parsed instanceof Map)) {
    return null
  }
  const entries: { attribute: Attribute; position: number }[] = []
  for (const [key, entry] of parsed) {
    if (!(entry instanceof Map)) {
      continue
    }
    const name = decodeEntities(textOf(entry.get("name"))).trim()
    const global = textOf(entry.get("is_taxonomy")) === "1"
    const values = global
      ? item.terms.filter((term) => term.domain === name).map((term) => term.name)
      : decodeEntities(textOf(entry.get("value")))
          .split("|")
          .map((value) => value.trim())
          .filter(Boolean)
    entries.push({
      attribute: {
        key: key.toLowerCase(),
        name: (global ? attributeLabel(name) : name || attributeLabel(key)).slice(0, OPTION_TEXT),
        global,
        variation: textOf(entry.get("is_variation")) === "1",
        values: values.map((value) => value.slice(0, OPTION_TEXT)),
      },
      position: Number(textOf(entry.get("position"))) || 0,
    })
  }
  return entries.sort((a, b) => a.position - b.position).map((entry) => entry.attribute)
}

/** Options from the variations' own keys, where the product's attributes could not be read. */
function optionsFromVariations(variations: readonly WxrItem[]): Attribute[] {
  const keys = new Set<string>()
  for (const variation of variations) {
    for (const key of variation.meta.keys()) {
      if (key.startsWith("attribute_")) {
        keys.add(key.slice("attribute_".length))
      }
    }
  }
  return [...keys].map((key) => ({
    key,
    name: attributeLabel(key),
    global: key.startsWith("pa_"),
    variation: true,
    values: [],
  }))
}

/** A variation's value of one option: a term's name for a global attribute; "" for "any". */
function valueOf(context: WordpressContext, option: Attribute, variation: WxrItem): string {
  const raw = decodeEntities(variation.meta.get(`attribute_${option.key}`) ?? "").trim()
  if (raw === "") {
    return ""
  }
  const name = option.global ? context.taxonomies.term(option.key, raw)?.name : undefined
  return (name ?? raw).slice(0, OPTION_TEXT)
}

/** Every pick of values, an "any" standing for each of its option's. */
function combinations(values: readonly string[], options: readonly Attribute[]): string[][] {
  return values.reduce<string[][]>(
    (picks, value, index) =>
      picks.flatMap((pick) =>
        (value === "" ? (options[index]?.values ?? []) : [value]).map((each) => [...pick, each])
      ),
    [[]]
  )
}

export interface VariantPlan {
  options: { name: string; values: string[] }[]
  variants: SourceVariant[]
}

/**
 * A variable product's options and variants: each variation that can be
 * bought (published, priced), in the shop's order, one per pick of values.
 */
export function variantsOf(
  context: WordpressContext,
  product: WxrItem,
  productKey: string,
  attributes: readonly Attribute[] | null
): VariantPlan {
  const variations = context.variations.get(product.id) ?? []
  let options = (attributes ?? []).filter((attribute) => attribute.variation)
  if (options.length === 0) {
    options = optionsFromVariations(variations)
  }
  if (options.length > MAX_OPTIONS) {
    note(context, "product", productKey, "migration.wordpress_options_too_many")
    options = options.slice(0, MAX_OPTIONS)
  }
  const variants: SourceVariant[] = []
  const seen = new Set<string>()
  for (const variation of variations) {
    const key = `variation:${variation.id}`
    if (variation.status === "private") {
      note(context, "product", key, "migration.wordpress_variation_disabled")
      continue
    }
    if (variation.status !== "publish") {
      continue
    }
    const price = priceOf(variation.meta)
    if (!price) {
      note(context, "product", key, "migration.wordpress_variation_no_price")
      continue
    }
    const picks = combinations(
      options.map((option) => valueOf(context, option, variation)),
      options
    )
    if (picks.length === 0) {
      note(context, "product", key, "migration.wordpress_variation_unread")
      continue
    }
    const sku = (variation.meta.get("_sku") ?? "").trim().slice(0, SKU_TEXT) || null
    const image = imageOf(context, variation)
    const stock = stockOf(variation.meta, product.meta)
    // One count several variants here sell from: each takes it whole, the report says so
    if (
      typeof stock === "number" &&
      stock > 0 &&
      (sharesParentStock(variation.meta, product.meta) || picks.length > 1)
    ) {
      note(context, "product", key, "migration.wordpress_stock_shared")
    }
    for (const [index, pick] of picks.entries()) {
      const id = JSON.stringify(pick)
      if (seen.has(id) || variants.length >= MAX_VARIANTS) {
        continue
      }
      seen.add(id)
      variants.push({
        source_key: picks.length > 1 ? `${key}:${String(index + 1)}` : key,
        // One SKU names one variant: an "any" variation's picks share none
        sku: picks.length > 1 ? null : sku,
        barcode: barcodeOf(variation.meta),
        price: price.price,
        compare_at_price: price.compare_at_price,
        stock,
        options: Object.fromEntries(options.map((option, at) => [option.name, pick[at] ?? ""])),
        weight: gramsOf(variation.meta.get("_weight")) ?? gramsOf(product.meta.get("_weight")),
        ...(image ? { image } : {}),
      })
    }
  }
  return {
    options: options
      .map((option) => {
        const used = new Set(variants.map((variant) => variant.options[option.name] ?? ""))
        return {
          name: option.name,
          values: [...option.values.filter((value) => used.has(value)), ...used].filter(
            (value, at, all) => value !== "" && all.indexOf(value) === at
          ),
        }
      })
      .filter((option) => option.values.length > 0),
    variants,
  }
}

/**
 * A variation's own picture (`_thumbnail_id`): its address in the media
 * library, as the product's pictures list it; none without one.
 */
function imageOf(context: WordpressContext, variation: WxrItem): string | null {
  const id = (variation.meta.get("_thumbnail_id") ?? "").trim()
  const url =
    /^\d+$/.test(id) && id !== "0" ? context.attachments.get(id)?.attachmentUrl : undefined
  return url && /^https?:\/\//i.test(url) ? url : null
}

/** A GTIN WooCommerce keeps (`_global_unique_id`, 9.2+): 8 to 14 digits. */
export function barcodeOf(meta: ReadonlyMap<string, string>): string | null {
  const value = (meta.get("_global_unique_id") ?? "").trim()
  return /^\d{8,14}$/.test(value) ? value : null
}

/** The product's simple variant: its own price, SKU, stock and weight. */
export function simpleVariant(product: WxrItem, key: string): SourceVariant | null {
  const price = priceOf(product.meta)
  if (!price) {
    return null
  }
  return {
    source_key: key,
    sku: (product.meta.get("_sku") ?? "").trim().slice(0, SKU_TEXT) || null,
    barcode: barcodeOf(product.meta),
    price: price.price,
    compare_at_price: price.compare_at_price,
    stock: stockOf(product.meta),
    options: {},
    weight: gramsOf(product.meta.get("_weight")),
  }
}
