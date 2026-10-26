import type { MedusaContainer } from "@medusajs/framework/types"
import { containsPattern } from "../../../lib/security"
import { toSlug } from "../../../lib/seo"
import { URL_REGISTRY_MODULE } from "../../../modules/url-registry"
import type UrlRegistryModuleService from "../../../modules/url-registry/service"
import { CATALOG_LOCALE } from "../../catalog/entity-paths"
import { liveOwnerKeys } from "../live-records"

/**
 * Where a 404 probably meant to go (docs/13 §4, docs/14 §3.9): live pages
 * whose last segment looks like the missing one's, as a slug (`/Şef-Bıçağı`
 * and `/urun/sef-bicagi-20cm` are close). Words of the missing slug narrow
 * the registry by index; the closest by letter pairs are offered.
 */

export interface Suggestion {
  path: string
  entity_type: string
  entity_id: string
  /** 0–1: how alike the two slugs are. */
  score: number
}

const MIN_SCORE = 0.4
const MAX_CANDIDATES = 60
const MIN_WORD = 3
const STEM = 4

const lastSegment = (path: string): string => path.slice(path.lastIndexOf("/") + 1)

function pairs(text: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (let index = 0; index < text.length - 1; index += 1) {
    const pair = text.slice(index, index + 2)
    counts.set(pair, (counts.get(pair) ?? 0) + 1)
  }
  return counts
}

/** Sørensen–Dice over letter pairs: 1 for the same slug, near 0 for unrelated ones. */
export function slugSimilarity(a: string, b: string): number {
  if (a === b) {
    return a === "" ? 0 : 1
  }
  const left = pairs(a)
  const right = pairs(b)
  let shared = 0
  for (const [pair, count] of left) {
    shared += Math.min(count, right.get(pair) ?? 0)
  }
  const total = a.length - 1 + (b.length - 1)
  return total > 0 ? (2 * shared) / total : 0
}

export async function suggestTargets(
  container: MedusaContainer,
  path: string,
  limit = 3
): Promise<Suggestion[]> {
  const slug = toSlug(lastSegment(path))
  const words = slug
    .split("-")
    .filter((word) => word.length >= MIN_WORD)
    .sort((a, b) => b.length - a.length)
    .slice(0, 4)
  if (words.length === 0) {
    return []
  }
  // A word's first letters too, so a typo at its end (`giyimm`) still finds `giyim`
  const fragments = [
    ...new Set(
      words.flatMap((word) => (word.length > STEM ? [word, word.slice(0, STEM)] : [word]))
    ),
  ]
  const registry = container.resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
  const entries = await registry.listUrlEntries(
    {
      locale: CATALOG_LOCALE,
      status: "active",
      $or: fragments.map((fragment) => ({ path: { $ilike: containsPattern(fragment) } })),
    },
    { take: MAX_CANDIDATES, select: ["path", "entity_type", "entity_id"] }
  )
  const scored = entries
    .map((entry) => ({
      path: entry.path,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      score: Math.round(slugSimilarity(slug, lastSegment(entry.path)) * 100) / 100,
    }))
    .filter((each) => each.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score || a.path.length - b.path.length)
  const live = await liveOwnerKeys(container, scored)
  return scored.filter((each) => live.has(`${each.entity_type}:${each.entity_id}`)).slice(0, limit)
}
