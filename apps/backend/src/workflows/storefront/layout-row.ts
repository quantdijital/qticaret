import type { MedusaContainer } from "@medusajs/framework/types"
import type { LayoutDocument } from "../../lib/storefront/layout"
import { STOREFRONT_LAYOUT_MODULE } from "../../modules/storefront-layout"
import type StorefrontLayoutModuleService from "../../modules/storefront-layout/service"

// The document as the JSON column takes it
export const json = (doc: LayoutDocument) => doc as unknown as Record<string, unknown>

export const layouts = (container: Pick<MedusaContainer, "resolve">) =>
  container.resolve<StorefrontLayoutModuleService>(STOREFRONT_LAYOUT_MODULE)

export interface LayoutRow {
  id: string
  draft: unknown
  published: unknown
  published_at: Date | null
  published_by: string | null
  revision: number
}

/** What a public read keys its cache on: the live revision, never the documents. */
export interface LayoutEdition {
  id: string
  revision: number
  /** Whether a design was ever published (else the default design shows). */
  published: boolean
}

/**
 * The design record's id and live revision only (security review
 * 2026-11-19, S2): a public read looks up its cache with these, and reads
 * the documents themselves only when the cache misses.
 */
export async function layoutEdition(
  container: Pick<MedusaContainer, "resolve">
): Promise<LayoutEdition | null> {
  const [row] = await layouts(container).listStorefrontLayouts(
    {},
    { select: ["id", "revision", "published_at"], take: 1 }
  )
  return row ? { id: row.id, revision: row.revision, published: row.published_at !== null } : null
}

/** The shop's one design record, if it has made one. */
export async function layoutRow(
  container: Pick<MedusaContainer, "resolve">
): Promise<LayoutRow | null> {
  const [row] = await layouts(container).listStorefrontLayouts({}, { take: 1 })
  return (row as LayoutRow | undefined) ?? null
}
