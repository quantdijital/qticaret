import type { MedusaContainer } from "@medusajs/framework/types"
import { oldAddressOf } from "../../lib/migration/addresses"
import { parseRequestPath } from "../../lib/seo/redirects"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import type { InventoryUrl } from "../../modules/migration/service"
import { CATALOG_ENTITY_TYPES } from "../catalog/entity-paths"
import { followPath } from "../seo/redirects/resolve"

type Container = Pick<MedusaContainer, "resolve">

/**
 * The old site's addresses (F14.7, adr/0042 §8): an inventory, what each
 * answers here today, and what an apply would do with it.
 */

// What a migrated record's old address belongs to here
const ENTITY_OF: Readonly<Record<string, string>> = {
  product: CATALOG_ENTITY_TYPES.product,
  category: CATALOG_ENTITY_TYPES.category,
  brand: CATALOG_ENTITY_TYPES.brand,
}

const PAGE = 1000

/**
 * The migrated records' old addresses into the inventory: a product's,
 * a category's, a brand's tied to what it became; an old page's on its
 * own, for the owner to decide. How many were read.
 */
export async function inventoryFromItems(container: Container, source: string): Promise<number> {
  const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
  let read = 0
  for (let skip = 0; ; skip += PAGE) {
    const items = await migration.listMigrationItems(
      { source, old_url: { $ne: null } },
      { select: ["kind", "target_id", "status", "old_url"], skip, take: PAGE, order: { id: "ASC" } }
    )
    const urls: InventoryUrl[] = []
    for (const item of items) {
      const old = item.old_url ? oldAddressOf(item.old_url) : null
      const entity = item.status === "done" && item.target_id ? ENTITY_OF[item.kind] : undefined
      if (old) {
        urls.push({
          ...old,
          origin: "source",
          ...(entity ? { entity_type: entity, entity_id: item.target_id } : {}),
        })
      }
    }
    await migration.addUrls(urls)
    read += items.length
    if (items.length < PAGE) {
      return read
    }
  }
}

export type AddressState =
  | { state: "live" }
  | { state: "redirected"; location: string }
  | { state: "gone" }
  | { state: "not_found" }

/** What the address answers here today, as a storefront request would get it. */
export async function stateOf(container: Container, path: string): Promise<AddressState> {
  const request = parseRequestPath(path)
  if (!request) {
    return { state: "not_found" }
  }
  const { resolution } = await followPath(container as MedusaContainer, request, {
    countHits: false,
  })
  switch (resolution.type) {
    case "entity":
      return { state: "live" }
    case "redirect":
      return { state: "redirected", location: resolution.location }
    case "gone":
      return { state: "gone" }
    case "not_found":
      return { state: "not_found" }
  }
}

export type AddressAction =
  "covered" | "reserve" | "redirect" | "gone" | "undecided" | "unsupported"

/**
 * What an apply does with an address: nothing when it answers already;
 * its record's path when it moved as one; the owner's 301 or 410; an
 * address with a query cannot be a rule (a server rule must take it).
 */
export function actionOf(
  row: { query: string | null; entity_id: string | null; decision: string; target: string | null },
  state: AddressState
): AddressAction {
  if (state.state !== "not_found") {
    return "covered"
  }
  if (row.query) {
    return "unsupported"
  }
  if (row.decision === "redirect" && row.target) {
    return "redirect"
  }
  if (row.decision === "gone") {
    return "gone"
  }
  return row.entity_id ? "reserve" : "undecided"
}
