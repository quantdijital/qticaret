import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import ProductCatalogExtensionLink from "../../../links/product-catalog-extension"
import { CATALOG_EXTENSION_MODULE } from "../../../modules/catalog-extension"
import type CatalogExtensionModuleService from "../../../modules/catalog-extension/service"
import { URL_REGISTRY_MODULE } from "../../../modules/url-registry"
import type UrlRegistryModuleService from "../../../modules/url-registry/service"
import type { UrlOwner } from "../../../modules/url-registry/validation"
import { CATALOG_ENTITY_TYPES, CATALOG_LOCALE } from "../../catalog/entity-paths"

/**
 * The records behind storefront paths, as resolution needs them (docs/13
 * §2.4): is the page live, gone for good, or only hidden, and where does a
 * product no longer sold send its visitors (its successor).
 */

export type OwnerState =
  | { kind: "live" }
  | { kind: "hidden"; successorId: string | null }
  | { kind: "deleted"; successorId: string | null }

// A successor that is itself no longer sold passes visitors on; the chain
// was checked for loops when it was saved (catalog.successor_loop)
const MAX_SUCCESSORS = 5

interface OwnerRow {
  id: string
  deleted_at?: Date | string | null
  status?: string | null
  is_active?: boolean | null
  is_internal?: boolean | null
  // A landing page's category (F3.16)
  category_id?: string | null
  product_extension?: { successor_product_id?: string | null } | null
}

const OWNER_QUERIES: Readonly<Record<string, { entity: string; fields: string[] }>> = {
  [CATALOG_ENTITY_TYPES.product]: {
    entity: "product",
    fields: ["id", "deleted_at", "status", "product_extension.successor_product_id"],
  },
  [CATALOG_ENTITY_TYPES.category]: {
    entity: "product_category",
    fields: ["id", "deleted_at", "is_active", "is_internal"],
  },
  [CATALOG_ENTITY_TYPES.collection]: { entity: "product_collection", fields: ["id", "deleted_at"] },
  [CATALOG_ENTITY_TYPES.brand]: { entity: "brand", fields: ["id", "deleted_at", "is_active"] },
  [CATALOG_ENTITY_TYPES.page]: { entity: "content_entry", fields: ["id", "deleted_at", "status"] },
  [CATALOG_ENTITY_TYPES.post]: { entity: "content_entry", fields: ["id", "deleted_at", "status"] },
  [CATALOG_ENTITY_TYPES.landing]: {
    entity: "landing_page",
    fields: ["id", "deleted_at", "status", "category_id"],
  },
  // A blog archive shows while its term is there, its posts or none (adr/0019 ek 2026-11-03)
  [CATALOG_ENTITY_TYPES.post_category]: { entity: "content_term", fields: ["id", "deleted_at"] },
  [CATALOG_ENTITY_TYPES.post_tag]: { entity: "content_term", fields: ["id", "deleted_at"] },
}

function isLive(type: string, row: OwnerRow): boolean {
  if (
    type === CATALOG_ENTITY_TYPES.product ||
    type === CATALOG_ENTITY_TYPES.page ||
    type === CATALOG_ENTITY_TYPES.post ||
    type === CATALOG_ENTITY_TYPES.landing
  ) {
    return row.status === "published"
  }
  if (type === CATALOG_ENTITY_TYPES.category) {
    return row.is_active === true && row.is_internal !== true
  }
  if (type === CATALOG_ENTITY_TYPES.brand) {
    return row.is_active === true
  }
  return true
}

/**
 * A deleted product's successor: its catalog row goes with it (the link
 * cascades), so the link and the row are read with the deleted ones.
 */
async function deletedSuccessor(
  container: MedusaContainer,
  owner: UrlOwner
): Promise<string | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: ProductCatalogExtensionLink.entryPoint,
    fields: ["product_extension_id"],
    filters: { product_id: owner.entity_id },
    withDeleted: true,
  })
  const ids = (data as { product_extension_id?: string | null }[]).flatMap((link) =>
    link.product_extension_id ? [link.product_extension_id] : []
  )
  if (ids.length === 0) {
    return null
  }
  const extensions = await container
    .resolve<CatalogExtensionModuleService>(CATALOG_EXTENSION_MODULE)
    .listProductExtensions({ id: ids }, { withDeleted: true, select: ["successor_product_id"] })
  return extensions.find((row) => row.successor_product_id)?.successor_product_id ?? null
}

// A landing page's category: its page shows while the category does, and goes with it
async function categoryState(container: MedusaContainer, id: string): Promise<OwnerState["kind"]> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_category",
    fields: ["deleted_at", "is_active", "is_internal"],
    filters: { id },
    withDeleted: true,
  })
  const row = data[0] as OwnerRow | undefined
  if (!row || row.deleted_at) {
    return "deleted"
  }
  return isLive(CATALOG_ENTITY_TYPES.category, row) ? "live" : "hidden"
}

/** Live, hidden (a draft, an inactive category) or deleted; an unknown type counts as deleted. */
export async function ownerState(container: MedusaContainer, owner: UrlOwner): Promise<OwnerState> {
  const spec = Object.hasOwn(OWNER_QUERIES, owner.entity_type)
    ? OWNER_QUERIES[owner.entity_type]
    : undefined
  if (!spec) {
    return { kind: "deleted", successorId: null }
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: spec.entity,
    fields: spec.fields,
    filters: { id: owner.entity_id },
    withDeleted: true,
  })
  const row = data[0] as OwnerRow | undefined
  if (!row || row.deleted_at) {
    const product = owner.entity_type === CATALOG_ENTITY_TYPES.product
    return {
      kind: "deleted",
      successorId: product ? await deletedSuccessor(container, owner) : null,
    }
  }
  const successorId = row.product_extension?.successor_product_id ?? null
  if (!isLive(owner.entity_type, row)) {
    return { kind: "hidden", successorId }
  }
  // A landing page shows while its category does, and goes with it (F3.16)
  const category = row.category_id ? await categoryState(container, row.category_id) : "live"
  if (category !== "live") {
    return { kind: category, successorId: null }
  }
  return { kind: "live" }
}

/** The record's active path, or null when it has none. */
export async function activePathOf(
  container: MedusaContainer,
  owner: UrlOwner
): Promise<string | null> {
  const registry = container.resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
  const [entry] = await registry.listUrlEntries(
    { locale: CATALOG_LOCALE, ...owner, status: "active" },
    { take: 1, select: ["path"] }
  )
  return entry?.path ?? null
}

/** The first live successor's path down the chain, or null when none is sold. */
export async function successorPath(
  container: MedusaContainer,
  successorId: string | null
): Promise<string | null> {
  let next = successorId
  for (let step = 0; next !== null && step < MAX_SUCCESSORS; step += 1) {
    const owner = { entity_type: CATALOG_ENTITY_TYPES.product, entity_id: next }
    const state = await ownerState(container, owner)
    if (state.kind === "live") {
      return activePathOf(container, owner)
    }
    next = state.successorId
  }
  return null
}
