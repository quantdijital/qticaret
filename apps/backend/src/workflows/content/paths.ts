import type { MedusaContainer } from "@medusajs/framework/types"
import { pagePath, postPath } from "../../lib/seo"
import type { ContentKind } from "../../modules/content/service"
import type { PathClaim } from "../../modules/url-registry/service"
import { CATALOG_ENTITY_TYPES, claimMissing } from "../catalog/entity-paths"

export interface PathedEntry {
  id: string
  kind: ContentKind
  handle: string
  /** Live before this save: its URL was public, so a path it leaves answers with a 301. */
  was_live: boolean
}

export const contentPath = (entry: { kind: ContentKind; handle: string }): string =>
  entry.kind === "post" ? postPath(entry.handle) : pagePath(entry.handle)

/**
 * Claims a content page's or blog post's path (F3.16). The URL style does
 * not move these. One that had been live leaves a changed handle's old path
 * reserved for its 301; one that never was (even if it goes live in this
 * very save) frees it.
 */
export async function claimContentPaths(
  container: MedusaContainer,
  entries: PathedEntry[]
): Promise<PathClaim[]> {
  return claimMissing(
    container,
    entries.map((entry) => {
      const path = contentPath(entry)
      return {
        entity_type: CATALOG_ENTITY_TYPES[entry.kind],
        entity_id: entry.id,
        path,
        accepted: [path],
        replaced: entry.was_live ? "reserve" : "free",
      }
    })
  )
}
