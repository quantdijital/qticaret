import { toSlug } from "../../seo/slug"
import { htmlToText } from "../text"
import type { SourceBrand, SourceCategory, SourceProduct, SourceVariant } from "../types"
import type { BulkNode } from "./bulk"
import { amount, at, childrenOf, roots, text, typeOf } from "./fields"

/**
 * Shopify's collections and products as the common records (F14,
 * adr/0042 §1): collections are the categories, vendors the brands. Old
 * addresses are Shopify's own paths, for the 301s.
 */

export function categoriesOf(nodes: readonly BulkNode[]): SourceCategory[] {
  return roots(nodes, "Collection").flatMap((node) => {
    const title = text(node, "title")
    const handle = text(node, "handle")
    if (!title || !node.id) {
      return []
    }
    const description = htmlToText(text(node, "descriptionHtml", 50_000))
    return [
      {
        source_key: node.id,
        path: [title],
        description,
        old_url: handle ? `/collections/${encodeURIComponent(handle)}` : null,
      },
    ]
  })
}

/** Brands are Shopify's vendors: one per name, any case. */
export function brandsOf(products: readonly SourceProduct[]): SourceBrand[] {
  const brands = new Map<string, SourceBrand>()
  for (const product of products) {
    const name = product.brand
    const key = name?.toLocaleLowerCase("tr-TR")
    if (name && key && !brands.has(key)) {
      brands.set(key, { source_key: `vendor:${key}`, name, old_url: null })
    }
  }
  return [...brands.values()]
}

// What Shopify gives a product with no options of its own
const isDefaultOption = (name: string, value: string) =>
  name === "Title" && value === "Default Title"

const GRAMS: Readonly<Record<string, number>> = {
  GRAMS: 1,
  KILOGRAMS: 1000,
  OUNCES: 28.349523125,
  POUNDS: 453.59237,
}

function variantOf(node: BulkNode): SourceVariant | null {
  const price = amount(node, "price")
  if (!node.id || price === null) {
    return null
  }
  const options: Record<string, string> = {}
  const selected = at(node, "selectedOptions")
  for (const option of Array.isArray(selected) ? selected : []) {
    const name = text(option, "name")
    const value = text(option, "value")
    if (name && value && !isDefaultOption(name, value)) {
      options[name] = value
    }
  }
  const weight = at(node, "inventoryItem.measurement.weight.value")
  const unit = GRAMS[text(node, "inventoryItem.measurement.weight.unit") ?? ""]
  const stock = at(node, "inventoryQuantity")
  return {
    source_key: node.id,
    sku: text(node, "sku"),
    barcode: text(node, "barcode", 64),
    price,
    compare_at_price: amount(node, "compareAtPrice"),
    stock: typeof stock === "number" && Number.isInteger(stock) ? Math.max(0, stock) : null,
    options,
    weight: typeof weight === "number" && unit && weight > 0 ? Math.round(weight * unit) : null,
  }
}

export function productsOf(nodes: readonly BulkNode[]): SourceProduct[] {
  const children = childrenOf(nodes)
  return roots(nodes, "Product").flatMap((node) => {
    const title = text(node, "title")
    const handle = toSlug(text(node, "handle") ?? "") || toSlug(title ?? "")
    if (!node.id || !title || !handle) {
      return []
    }
    const own = children.get(node.id) ?? []
    const variants = own
      .filter((child) => typeOf(child) === "ProductVariant")
      .map(variantOf)
      .filter((variant): variant is SourceVariant => variant !== null)
    const options = (Array.isArray(at(node, "options")) ? (at(node, "options") as unknown[]) : [])
      .map((option) => ({
        name: text(option, "name") ?? "",
        values: (Array.isArray(at(option, "values")) ? (at(option, "values") as unknown[]) : [])
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.slice(0, 255)),
      }))
      .filter(
        (option) => option.name !== "" && !isDefaultOption(option.name, option.values[0] ?? "")
      )
      .slice(0, 3)
    const description = htmlToText(text(node, "descriptionHtml", 200_000))
    const oldHandle = text(node, "handle")
    return [
      {
        source_key: node.id,
        handle,
        title,
        description: description?.slice(0, 50_000) ?? null,
        status: text(node, "status") === "ACTIVE" ? ("published" as const) : ("draft" as const),
        categories: own
          .filter((child) => typeOf(child) === "Collection")
          .map((child) => text(child, "title"))
          .filter((name): name is string => name !== null)
          .map((name) => [name]),
        brand: text(node, "vendor"),
        seo_title: text(node, "seo.title"),
        seo_description: text(node, "seo.description", 1_000),
        images: own
          .map((child) => text(child, "image.url", 2048))
          .filter((url): url is string => url !== null && /^https?:\/\//.test(url))
          .slice(0, 50),
        options,
        variants,
        dimensions: null,
        old_url: oldHandle ? `/products/${encodeURIComponent(oldHandle)}` : null,
      },
    ]
  })
}
