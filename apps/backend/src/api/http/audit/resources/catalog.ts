import { createHash } from "node:crypto"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { CATALOG_EXTENSION_MODULE } from "../../../../modules/catalog-extension"
import type CatalogExtensionModuleService from "../../../../modules/catalog-extension/service"
import { COLLECTION_EXTENSION_FIELDS } from "../../../../workflows/catalog/collection-fields"
import type { CollectionExtensionRow } from "../../../../workflows/catalog/collection-fields"
import type { AuditedResource, GraphQuery, Resolver, Snapshot } from "../types"
import { ID } from "../types"

interface ProductRow {
  variants?:
    | ({
        id: string
        variant_extension?: { mpn: string | null; cost?: number | null } | null
      } | null)[]
    | null
  product_extension?: {
    condition: string
    kind?: string | null
    primary_category_id: string | null
    successor_product_id: string | null
    withdrawal_excluded?: boolean | null
    restriction?: string | null
    is_gift_card?: boolean | null
    addons?: unknown
    description_doc?: unknown
    summary_doc?: unknown
  } | null
}

// A description document (adr/0055; the short one too) by its digest: the text stays out of the log
export const docDigest = (doc: unknown): string | null =>
  doc === null || doc === undefined
    ? null
    : createHash("sha256").update(JSON.stringify(doc)).digest("hex").slice(0, 16)

/**
 * A product's catalog fields (F3.1, adr/0011), as stored: the IDs it holds
 * even when the category or successor they name is gone, and one
 * `mpn.<variant id>` and `cost.<variant id>` (kuruş) per variant. An
 * unknown product reads as nothing.
 */
async function catalogSnapshot(scope: Resolver, productId: string): Promise<Snapshot> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY) as GraphQuery
  const { data } = await query.graph({
    entity: "product",
    fields: [
      "product_extension.*",
      "variants.id",
      "variants.variant_extension.mpn",
      "variants.variant_extension.cost",
    ],
    filters: { id: productId },
  })
  const product = data[0] as ProductRow | undefined
  if (!product) {
    return {}
  }
  const extension = product.product_extension ?? null
  return {
    condition: extension?.condition ?? "new",
    kind: extension?.kind ?? "physical",
    primary_category_id: extension?.primary_category_id ?? null,
    successor_product_id: extension?.successor_product_id ?? null,
    withdrawal_excluded: extension?.withdrawal_excluded ?? false,
    restriction: extension?.restriction ?? null,
    is_gift_card: extension?.is_gift_card ?? false,
    // adr/0052: one value, so a change shows as before and after
    addons: JSON.stringify(extension?.addons ?? null),
    description_doc: docDigest(extension?.description_doc),
    // adr/0055 Ek 2026-11-06: the short description, by its digest as the long one's
    summary_doc: docDigest(extension?.summary_doc),
    ...Object.fromEntries(
      (product.variants ?? []).flatMap((variant): [string, string | number | null][] =>
        variant
          ? [
              [`mpn.${variant.id}`, variant.variant_extension?.mpn ?? null],
              [`cost.${variant.id}`, variant.variant_extension?.cost ?? null],
            ]
          : []
      )
    ),
  }
}

/** A category's adults-only mark (F13.4): its reason, or none. */
async function categoryRestrictionSnapshot(scope: Resolver, categoryId: string): Promise<Snapshot> {
  const [row] = await (
    scope.resolve(CATALOG_EXTENSION_MODULE) as CatalogExtensionModuleService
  ).listCategoryRestrictions({ category_id: categoryId }, { take: 1, select: ["restriction"] })
  return { restriction: row?.restriction ?? null }
}

/** A category's picture (adr/0046 Ek 2026-11-04): its address and alt text, or none. */
async function categoryImageSnapshot(scope: Resolver, categoryId: string): Promise<Snapshot> {
  const [row] = await (
    scope.resolve(CATALOG_EXTENSION_MODULE) as CatalogExtensionModuleService
  ).listCategoryImages({ category_id: categoryId }, { take: 1, select: ["url", "alt"] })
  return { image_url: row?.url ?? null, image_alt: row?.alt ?? null }
}

/** A collection's text (by its digest), visibility and picture; none: public, no text or picture. */
async function collectionDetailsSnapshot(scope: Resolver, collectionId: string): Promise<Snapshot> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY) as GraphQuery
  const { data } = await query.graph({
    entity: "product_collection",
    fields: [...COLLECTION_EXTENSION_FIELDS],
    filters: { id: collectionId },
  })
  const own = (data[0] as { collection_extension?: CollectionExtensionRow | null } | undefined)
    ?.collection_extension
  return {
    description: docDigest(own?.description ?? null),
    // adr/0075: its document, by its digest as the text's
    description_doc: docDigest(own?.description_doc),
    is_active: own?.is_active !== false,
    image_url: own?.image_url ?? null,
    image_alt: own?.image_alt ?? null,
  }
}

/** A category's text (adr/0075): Medusa's plain text and the document, each by its digest. */
async function categoryDescriptionSnapshot(scope: Resolver, categoryId: string): Promise<Snapshot> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY) as GraphQuery
  const [{ data }, [row]] = await Promise.all([
    query.graph({
      entity: "product_category",
      fields: ["description"],
      filters: { id: categoryId },
    }),
    (
      scope.resolve(CATALOG_EXTENSION_MODULE) as CatalogExtensionModuleService
    ).listCategoryExtensions({ category_id: categoryId }, { take: 1, select: ["description_doc"] }),
  ])
  const category = data[0] as { description?: string | null } | undefined
  return {
    // Medusa keeps "" for none: no text reads as none
    description: docDigest(category?.description === "" ? null : category?.description),
    description_doc: docDigest(row?.description_doc),
  }
}

export const CATALOG_RESOURCES: readonly AuditedResource[] = [
  {
    method: "POST",
    route: "POST /admin/category-descriptions/:category_id",
    pattern: new RegExp(`^/admin/category-descriptions/(?<category_id>${ID})$`, "i"),
    resourceType: "product_category",
    resourceId: (params) => params["category_id"] ?? null,
    snapshot: ({ scope, params }) =>
      categoryDescriptionSnapshot(scope, params["category_id"] ?? ""),
  },
  {
    method: "POST",
    route: "POST /admin/collections/:id/details",
    pattern: new RegExp(`^/admin/collections/(?<id>${ID})/details$`, "i"),
    resourceType: "product_collection",
    resourceId: (params) => params["id"] ?? null,
    snapshot: ({ scope, params }) => collectionDetailsSnapshot(scope, params["id"] ?? ""),
  },
  {
    method: "POST",
    route: "POST /admin/category-images/:category_id",
    pattern: new RegExp(`^/admin/category-images/(?<category_id>${ID})$`, "i"),
    resourceType: "product_category",
    resourceId: (params) => params["category_id"] ?? null,
    snapshot: ({ scope, params }) => categoryImageSnapshot(scope, params["category_id"] ?? ""),
  },
  {
    method: "POST",
    route: "POST /admin/products/:id/catalog",
    pattern: new RegExp(`^/admin/products/(?<id>${ID})/catalog$`, "i"),
    resourceType: "product",
    resourceId: (params) => params["id"] ?? null,
    snapshot: ({ scope, params }) => catalogSnapshot(scope, params["id"] ?? ""),
  },
  {
    method: "POST",
    route: "POST /admin/category-restrictions/:category_id",
    pattern: new RegExp(`^/admin/category-restrictions/(?<category_id>${ID})$`, "i"),
    resourceType: "product_category",
    resourceId: (params) => params["category_id"] ?? null,
    snapshot: ({ scope, params }) =>
      categoryRestrictionSnapshot(scope, params["category_id"] ?? ""),
  },
]
