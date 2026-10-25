import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { missingDimensions, variantGtin } from "../../../lib/catalog"
import type { AdvisorFacts, PageKind } from "../../../lib/seo/advisor"
import { plainText } from "../../../lib/seo"
import { CATALOG_ENTITY_TYPES } from "../../catalog/entity-paths"
import { liraOf } from "../facts"
import type { FactRow } from "../facts"
import { seoPayloadFor } from "../payload"
import { activePathOf } from "../redirects/owners"

/**
 * What the advisor reads of a page (docs/14): the search result text the
 * storefront would show (the `seo` object), the page's own fields, and the
 * catalog facts behind the rules.
 */

const OWN_FIELDS = [
  "seo_meta.seo_title",
  "seo_meta.seo_description",
  "seo_meta.focus_keyword",
  "seo_meta.robots_override",
  "seo_meta.title_hash",
  "seo_meta.description_hash",
]

interface Own {
  seo_title?: string | null
  seo_description?: string | null
  focus_keyword?: string | null
  robots_override?: string | null
  title_hash?: string | null
  description_hash?: string | null
}

const ENTITIES: Record<PageKind, { entity: string; owner: string }> = {
  product: { entity: "product", owner: CATALOG_ENTITY_TYPES.product },
  category: { entity: "product_category", owner: CATALOG_ENTITY_TYPES.category },
  brand: { entity: "brand", owner: CATALOG_ENTITY_TYPES.brand },
  collection: { entity: "product_collection", owner: CATALOG_ENTITY_TYPES.collection },
}

async function rowOf<T>(container: MedusaContainer, entity: string, fields: string[], id: string) {
  const { data } = await container
    .resolve(ContainerRegistrationKeys.QUERY)
    .graph({ entity, fields, filters: { id } })
  return (data[0] as T | undefined) ?? null
}

/** Other pages of the kind whose own title or description hashes to the same text. */
async function duplicates(container: MedusaContainer, kind: PageKind, own: Own | null | undefined) {
  const count = async (
    field: "title_hash" | "description_hash",
    hash: string | null | undefined
  ) => {
    if (!hash) {
      return 0
    }
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "seo_meta",
      fields: ["id"],
      filters: { entity_type: kind, [field]: hash },
    })
    return Math.max(0, data.length - 1)
  }
  return {
    title: await count("title_hash", own?.title_hash),
    description: await count("description_hash", own?.description_hash),
  }
}

type ProductRow = Omit<FactRow, "attribute_template" | "product_extension" | "images"> & {
  id: string
  description?: string | null
  weight?: number | null
  length?: number | null
  width?: number | null
  height?: number | null
  images?: ({ id: string } | null)[] | null
  categories?: ({ id: string } | null)[] | null
  brand?: { name: string } | null
  product_extension?: { primary_category_id?: string | null; kind?: string | null } | null
  attribute_template?: {
    definitions?:
      | ({
          id: string
          label: string
          is_required?: boolean | null
          scope?: string | null
        } | null)[]
      | null
  } | null
  attribute_values?: ({ definition?: { id: string } | null } | null)[] | null
  seo_meta?: Own | null
}

const PRODUCT_FIELDS = [
  "id",
  "title",
  "handle",
  "description",
  "weight",
  "length",
  "width",
  "height",
  "images.id",
  "categories.id",
  "brand.name",
  "product_extension.primary_category_id",
  "product_extension.kind",
  "attribute_template.definitions.id",
  "attribute_template.definitions.label",
  "attribute_template.definitions.is_required",
  "attribute_template.definitions.scope",
  "attribute_values.definition.id",
  "variants.id",
  "variants.ean",
  "variants.upc",
  "variants.barcode",
  "variants.weight",
  "variants.length",
  "variants.width",
  "variants.height",
  "variants.variant_extension.mpn",
  "variants.prices.amount",
  "variants.prices.currency_code",
  "variants.prices.price_list_id",
  ...OWN_FIELDS,
]

function productFacts(row: ProductRow): NonNullable<AdvisorFacts["product"]> {
  const brand = row.brand?.name ?? null
  const variants = (row.variants ?? []).filter((variant) => variant !== null)
  const filled = new Set(
    (row.attribute_values ?? []).flatMap((value) => value?.definition?.id ?? [])
  )
  const physical = (row.product_extension?.kind ?? "physical") === "physical"
  return {
    images: (row.images ?? []).filter(Boolean).length,
    variants: variants.length,
    unpriced: variants.filter((variant) => liraOf(variant) === null).length,
    unidentified: variants.filter(
      (variant) => !variantGtin(variant) && !(variant.variant_extension?.mpn && brand)
    ).length,
    brand,
    categories: (row.categories ?? []).filter(Boolean).length,
    primaryCategory: Boolean(row.product_extension?.primary_category_id),
    physical,
    missingDimensions:
      physical &&
      variants.some(
        (variant) =>
          missingDimensions(row, variant as Parameters<typeof missingDimensions>[1]).length > 0
      ),
    missingAttributes: (row.attribute_template?.definitions ?? []).flatMap((definition) =>
      definition?.is_required && definition.scope !== "variant" && !filled.has(definition.id)
        ? [definition.label]
        : []
    ),
  }
}

/** Published products a category, brand or collection lists. */
async function listedCount(
  container: MedusaContainer,
  kind: PageKind,
  id: string
): Promise<number> {
  const products = container.resolve(Modules.PRODUCT)
  if (kind === "category") {
    return (
      await products.listAndCountProducts(
        { categories: { id: [id] }, status: "published" },
        { take: 1 }
      )
    )[1]
  }
  if (kind === "collection") {
    return (
      await products.listAndCountProducts({ collection_id: id, status: "published" }, { take: 1 })
    )[1]
  }
  const brand = await rowOf<{ products?: ({ id: string } | null)[] | null }>(
    container,
    "brand",
    ["products.id"],
    id
  )
  const ids = (brand?.products ?? []).flatMap((row) => (row ? [row.id] : []))
  return ids.length
    ? (await products.listAndCountProducts({ id: ids, status: "published" }, { take: 1 }))[1]
    : 0
}

interface ListingRow {
  id: string
  name?: string
  title?: string
  handle: string
  description?: string | null
  mpath?: string | null
  logo_url?: string | null
  seo_meta?: Own | null
}

const LISTING_FIELDS: Record<Exclude<PageKind, "product">, string[]> = {
  category: ["id", "name", "handle", "description", "mpath"],
  brand: ["id", "name", "handle", "description", "logo_url"],
  collection: ["id", "title", "handle"],
}

/** The advisor's facts for a page, or null when it is gone. */
export async function advisorFacts(
  container: MedusaContainer,
  kind: PageKind,
  id: string
): Promise<AdvisorFacts | null> {
  const spec = ENTITIES[kind]
  const row =
    kind === "product"
      ? await rowOf<ProductRow>(container, spec.entity, PRODUCT_FIELDS, id)
      : await rowOf<ListingRow>(
          container,
          spec.entity,
          [...LISTING_FIELDS[kind], ...OWN_FIELDS],
          id
        )
  if (!row) {
    return null
  }
  const owner = { entity_type: spec.owner, entity_id: id }
  const path = (await activePathOf(container, owner)) ?? `/${row.handle}`
  const seo = await seoPayloadFor(container, owner, path)
  const own = row.seo_meta ?? null
  const html = row.description ?? ""
  const named = row as { title?: string | null; name?: string | null }
  const name = named.title ?? named.name ?? row.handle
  return {
    kind,
    name,
    handle: row.handle,
    title: seo?.title ?? name,
    titleIsOwn: Boolean(own?.seo_title),
    description: seo?.description ?? "",
    descriptionIsOwn: Boolean(own?.seo_description),
    body: plainText(html),
    bodyHtml: html,
    focusKeyword: own?.focus_keyword ?? null,
    duplicates: await duplicates(container, kind, own),
    noindex: own?.robots_override?.startsWith("noindex") ?? false,
    product: kind === "product" ? productFacts(row as ProductRow) : undefined,
    listing:
      kind === "product"
        ? undefined
        : {
            products: await listedCount(container, kind, id),
            depth: ((row as ListingRow).mpath ?? id).split(".").length,
            hasLogo: Boolean("logo_url" in row && row.logo_url),
          },
  }
}
