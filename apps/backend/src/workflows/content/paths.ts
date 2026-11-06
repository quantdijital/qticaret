import type { MedusaContainer } from "@medusajs/framework/types"
import { pagePath, postAuthorPath, postPath } from "../../lib/seo"
import type { ContentKind, ContentTermKind } from "../../modules/content/service"
import type { PathClaim } from "../../modules/url-registry/service"
import { CATALOG_ENTITY_TYPES, claimMissing } from "../catalog/entity-paths"
import { termPath } from "./term-rules"

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

export interface PathedTerm {
  id: string
  kind: ContentTermKind
  handle: string
  /** It had live posts before this save: its archive was public, so a path it leaves answers with a 301. */
  was_live: boolean
}

/**
 * Claims a blog category's or tag's archive path (adr/0019 ek 2026-11-03):
 * `/blog/kategori/{handle}` or `/blog/etiket/{handle}`, whatever the URL
 * style. An archive that had live posts keeps a changed handle's old path
 * for its 301; an empty one frees it.
 */
export async function claimTermPaths(
  container: MedusaContainer,
  terms: PathedTerm[]
): Promise<PathClaim[]> {
  return claimMissing(
    container,
    terms.map((term) => {
      const path = termPath(term)
      return {
        entity_type: termEntityType(term.kind),
        entity_id: term.id,
        path,
        accepted: [path],
        replaced: term.was_live ? "reserve" : "free",
      }
    })
  )
}

export interface PathedAuthor {
  id: string
  handle: string
  /** They had live posts before this save: their page was public, so a path it leaves answers with a 301. */
  was_live: boolean
}

/**
 * Claims a blog author's page path (adr/0060): `/blog/yazar/{handle}`,
 * whatever the URL style. An author who had live posts keeps a changed
 * handle's old path for its 301; one who had none frees it.
 */
export async function claimAuthorPaths(
  container: MedusaContainer,
  authors: PathedAuthor[]
): Promise<PathClaim[]> {
  return claimMissing(
    container,
    authors.map((author) => {
      const path = postAuthorPath(author.handle)
      return {
        entity_type: CATALOG_ENTITY_TYPES.post_author,
        entity_id: author.id,
        path,
        accepted: [path],
        replaced: author.was_live ? "reserve" : "free",
      }
    })
  )
}

/** A term's type in the URL registry and the SEO payload. */
export const termEntityType = (kind: ContentTermKind): string =>
  kind === "category" ? CATALOG_ENTITY_TYPES.post_category : CATALOG_ENTITY_TYPES.post_tag
