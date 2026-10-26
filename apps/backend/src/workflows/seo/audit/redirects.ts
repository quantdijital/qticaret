import type { MedusaContainer } from "@medusajs/framework/types"
import { finding, redirectItem } from "../../../lib/seo/audit"
import type { AuditFinding, AuditItem, PathAnswer } from "../../../lib/seo/audit"
import { parseRequestPath } from "../../../lib/seo/redirects"
import { SEO_REDIRECTS_MODULE } from "../../../modules/seo-redirects"
import type SeoRedirectsModuleService from "../../../modules/seo-redirects/service"
import { URL_REGISTRY_MODULE } from "../../../modules/url-registry"
import type UrlRegistryModuleService from "../../../modules/url-registry/service"
import { CATALOG_LOCALE } from "../../catalog/entity-paths"
import { followPath } from "../redirects/resolve"
import { AUDIT_KINDS, MAX_LISTED, kindOfType, namesOf } from "./records"

// Two resolutions per rule: the most followed rules are checked first, up to here
const MAX_FOLLOWED = 2_000
// Old paths a record keeps before the audit names it (each one answers with a 301)
const CROWDED_PATHS = 10
const REGISTRY_PAGE = 5_000

async function answerOf(container: MedusaContainer, raw: string): Promise<PathAnswer | undefined> {
  const request = parseRequestPath(raw)
  if (!request) {
    return undefined
  }
  const { resolution } = await followPath(container, request, { countHits: false })
  return resolution.type
}

/** Rules a live page hides, whose target is missing, gone or redirects again, or no one follows. */
async function ruleItems(container: MedusaContainer, now: Date): Promise<AuditItem[]> {
  const rules = await container
    .resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE)
    .listSeoRedirects(
      {},
      {
        select: ["source", "match", "target", "hit_count", "last_hit_at", "created_at"],
        order: { hit_count: "DESC", id: "ASC" },
      }
    )
  const items: AuditItem[] = []
  for (const [index, rule] of rules.entries()) {
    // A prefix's or a pattern's source and target are not pages themselves
    const isFollowed = rule.match === "exact" && index < MAX_FOLLOWED
    const item = redirectItem(
      {
        source: rule.source,
        target: rule.target,
        hits: rule.hit_count,
        lastHitAt: rule.last_hit_at ? new Date(rule.last_hit_at) : null,
        createdAt: new Date(rule.created_at),
        sourceAnswer: isFollowed ? await answerOf(container, rule.source) : undefined,
        targetAnswer:
          isFollowed && rule.target ? await answerOf(container, rule.target) : undefined,
      },
      now
    )
    if (item) {
      items.push(item)
    }
  }
  return items
}

/**
 * Records holding many old paths, most first: each keeps a redirect alive.
 * Deleted records are left out (their paths answer 410 or go to a successor).
 */
async function crowdedItems(container: MedusaContainer): Promise<AuditItem[]> {
  const registry = container.resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
  const counts = new Map<string, { type: string; id: string; paths: number }>()
  for (let skip = 0; ; skip += REGISTRY_PAGE) {
    const entries = await registry.listUrlEntries(
      { locale: CATALOG_LOCALE, status: "reserved" },
      {
        select: ["id", "entity_type", "entity_id"],
        skip,
        take: REGISTRY_PAGE,
        order: { id: "ASC" },
      }
    )
    for (const entry of entries) {
      const key = `${entry.entity_type}:${entry.entity_id}`
      const owner = counts.get(key) ?? { type: entry.entity_type, id: entry.entity_id, paths: 0 }
      owner.paths += 1
      counts.set(key, owner)
    }
    if (entries.length < REGISTRY_PAGE) {
      break
    }
  }
  const crowded = [...counts.values()].filter((owner) => owner.paths >= CROWDED_PATHS)
  const items: AuditItem[] = []
  for (const kind of AUDIT_KINDS) {
    const owners = crowded.filter((owner) => kindOfType(owner.type) === kind)
    const names = await namesOf(
      container,
      kind,
      owners.map((owner) => owner.id)
    )
    for (const owner of owners) {
      const named = names.get(owner.id)
      if (named) {
        items.push({
          reason: "crowded",
          subject: named.name,
          count: owner.paths,
          entity: { kind, id: owner.id },
        })
      }
    }
  }
  return items.sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
}

/** S-REDIR-01: redirect rules to tidy, and records whose old paths pile up. */
export async function redirectFinding(
  container: MedusaContainer,
  now: Date
): Promise<AuditFinding | null> {
  const items = [...(await ruleItems(container, now)), ...(await crowdedItems(container))]
  return finding("S-REDIR-01", items.slice(0, MAX_LISTED), items.length)
}
