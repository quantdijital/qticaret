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
  /** When the live revision went live (ISO); null: never published. */
  published_at: string | null
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
  if (!row) {
    return null
  }
  const at = row.published_at ? new Date(row.published_at).toISOString() : null
  return { id: row.id, revision: row.revision, published: at !== null, published_at: at }
}

/**
 * A cache key for the live design: its revision and the moment it went
 * live (second security review 2026-11-19). A publication rolled back
 * after a read gives its number back, and the next one takes it again:
 * the moment tells the two apart, so a failed one's document is never
 * served under the number.
 */
export const editionKey = (edition: LayoutEdition): string =>
  `revision:${String(edition.revision)}@${edition.published_at ?? "never"}`

/** The shop's one design record, if it has made one. */
export async function layoutRow(
  container: Pick<MedusaContainer, "resolve">
): Promise<LayoutRow | null> {
  const [row] = await layouts(container).listStorefrontLayouts({}, { take: 1 })
  return (row as LayoutRow | undefined) ?? null
}
