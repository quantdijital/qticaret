import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { ValidationError, isValidationError } from "../../lib/errors"
import { logger } from "../../lib/logging"
import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"
import { URL_REGISTRY_MODULE } from "../../modules/url-registry"
import type UrlRegistryModuleService from "../../modules/url-registry/service"
import type { PathClaim } from "../../modules/url-registry/service"
import {
  CATALOG_ENTITY_TYPES,
  CATALOG_LOCALE,
  claimMissing,
  unclaimPaths,
} from "../catalog/entity-paths"
import { categoryRows, subtreeIn } from "./landing-facet"
import { LANDINGS_LOCK } from "./landing-originality"

export interface PathedLanding {
  id: string
  category_id: string
  handle: string
  /** Live before this save: an old path it leaves answers with a 301. */
  was_live: boolean
}

/** The categories' active paths, by id. */
async function categoryPaths(
  container: MedusaContainer,
  ids: string[]
): Promise<Map<string, string>> {
  const entries = ids.length
    ? await container.resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE).listUrlEntries(
        {
          locale: CATALOG_LOCALE,
          entity_type: CATALOG_ENTITY_TYPES.category,
          entity_id: ids,
          status: "active",
        },
        { select: ["entity_id", "path"] }
      )
    : []
  return new Map(entries.map((entry) => [entry.entity_id, entry.path]))
}

/**
 * Claims a landing page's path: its category's path and its handle
 * (`/kategori/bicak/paslanmaz-celik`, docs/13 §2.2). A category with no
 * path yet refuses the save; a path held by another page too.
 */
export async function claimLandingPath(
  container: MedusaContainer,
  landing: PathedLanding
): Promise<PathClaim[]> {
  const base = (await categoryPaths(container, [landing.category_id])).get(landing.category_id)
  if (!base) {
    throw new ValidationError("content.landing_category_unlisted", { field: "category_id" })
  }
  const path = `${base}/${landing.handle}`
  return claimMissing(container, [
    {
      entity_type: CATALOG_ENTITY_TYPES.landing,
      entity_id: landing.id,
      path,
      accepted: [path],
      replaced: landing.was_live ? "reserve" : "free",
    },
  ])
}

async function categoriesBelow(
  container: MedusaContainer,
  categoryIds: string[] | "all"
): Promise<string[] | null> {
  if (categoryIds === "all") {
    return null
  }
  const rows = await categoryRows(container)
  return [...new Set(categoryIds.flatMap((id) => subtreeIn(rows, id, false)))]
}

// A page whose new path is taken keeps its old one, logged; anything else fails the move
async function claimEach(
  container: MedusaContainer,
  landings: { id: string; category_id: string; handle: string; published_at: Date | null }[],
  claims: PathClaim[]
): Promise<void> {
  for (const landing of landings) {
    try {
      claims.push(
        ...(await claimLandingPath(container, {
          id: landing.id,
          category_id: landing.category_id,
          handle: landing.handle,
          was_live: Boolean(landing.published_at),
        }))
      )
    } catch (error) {
      if (!isValidationError(error)) {
        throw error
      }
      logger.warn({
        event: "content.landing_path_skipped",
        landingId: landing.id,
        reason: error.safeMessage,
      })
    }
  }
}

/**
 * Landing pages follow their category: after its path (or one above it)
 * moved, each claims its new path and the old one answers with a 301. A
 * page whose new path is taken keeps its old one, logged, so a category
 * move never fails for it. Under the landing pages' lock, so no save
 * claims in between; a failure undoes the claims made so far.
 */
export async function claimLandingsBelow(
  container: MedusaContainer,
  categoryIds: string[] | "all"
): Promise<PathClaim[]> {
  return container.resolve(Modules.LOCKING).execute(
    LANDINGS_LOCK.key,
    async () => {
      const categories = await categoriesBelow(container, categoryIds)
      if (categories?.length === 0) {
        return []
      }
      const landings = await container
        .resolve<ContentModuleService>(CONTENT_MODULE)
        .listLandingPages(categories ? { category_id: categories } : {}, {
          select: ["id", "category_id", "handle", "published_at"],
        })
      const claims: PathClaim[] = []
      try {
        await claimEach(container, landings, claims)
      } catch (error) {
        await unclaimPaths(container, claims)
        throw error
      }
      return claims
    },
    { timeout: LANDINGS_LOCK.timeout }
  )
}
