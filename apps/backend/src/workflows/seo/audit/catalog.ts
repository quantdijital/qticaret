import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { finding } from "../../../lib/seo/audit"
import type { AuditFinding, AuditItem } from "../../../lib/seo/audit"
import { SEO_ADVISOR_MODULE } from "../../../modules/seo-advisor"
import type SeoAdvisorModuleService from "../../../modules/seo-advisor/service"
import { SEO_REDIRECTS_MODULE } from "../../../modules/seo-redirects"
import type SeoRedirectsModuleService from "../../../modules/seo-redirects/service"
import { followPath } from "../redirects/resolve"
import { suggestTargets } from "../redirects/suggest"
import { MAX_LISTED, labelsOf, namesOf } from "./records"

const DAY_MS = 24 * 60 * 60 * 1000
const PAGE = 1_000

// docs/14 S-404-01: asked for at least this often in all, and again within the week
const NOT_FOUND_MIN_HITS = 10
const NOT_FOUND_DAYS = 7
// Each path is resolved again (a rule may answer it now): the most asked-for first
const NOT_FOUND_SCANNED = 1_000
// Suggestions cost a few queries each: the most asked-for paths get one
const SUGGESTED = 50

/**
 * S-404-01: paths asked for often that still answer 404 and were asked
 * for this week too, each with the page it likely meant. Paths beyond the
 * ones resolved again count as still open.
 */
export async function notFoundFinding(
  container: MedusaContainer,
  now: Date
): Promise<AuditFinding | null> {
  const [rows, total] = await container
    .resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE)
    .listAndCountSeoNotFounds(
      {
        hits: { $gte: NOT_FOUND_MIN_HITS },
        last_seen_at: { $gte: new Date(now.getTime() - NOT_FOUND_DAYS * DAY_MS) },
      },
      { order: { hits: "DESC", last_seen_at: "DESC" }, take: NOT_FOUND_SCANNED }
    )
  const open: AuditItem[] = []
  for (const row of rows) {
    const { resolution } = await followPath(
      container,
      { path: row.path, query: new URLSearchParams() },
      { countHits: false }
    )
    // A rule or a page answers it now: done, whatever the log says
    if (resolution.type !== "not_found") {
      continue
    }
    const [best] = open.length < SUGGESTED ? await suggestTargets(container, row.path, 1) : []
    open.push({ reason: "missing", subject: row.path, count: row.hits, target: best?.path })
  }
  return finding("S-404-01", open.slice(0, MAX_LISTED), open.length + (total - rows.length))
}

/** S-DUP-01: live pages of one kind that show the same title or description, own or from the template. */
export async function duplicateFinding(container: MedusaContainer): Promise<AuditFinding | null> {
  const advisor = container.resolve<SeoAdvisorModuleService>(SEO_ADVISOR_MODULE)
  const items: AuditItem[] = []
  let total = 0
  for (const text of ["title", "description"] as const) {
    const groups = await advisor.duplicateGroups(text, MAX_LISTED / 2)
    total += groups[0]?.groups ?? 0
    for (const group of groups) {
      const names = await namesOf(container, group.entity_type, group.ids)
      const first = group.ids[0]
      items.push({
        reason: text,
        subject: labelsOf(group.ids.flatMap((id) => names.get(id) ?? [])).join(" · "),
        count: group.pages,
        entity: first ? { kind: group.entity_type, id: first } : undefined,
      })
    }
  }
  return finding("S-DUP-01", items, total)
}

interface OrphanRow {
  id: string
  title: string
  categories?: unknown[] | null
}

/** S-ORPHAN-01: live products in no category (no way to them but search and links). */
export async function orphanFinding(container: MedusaContainer): Promise<AuditFinding | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const items: AuditItem[] = []
  let count = 0
  for (let skip = 0; ; skip += PAGE) {
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "title", "categories.id"],
      filters: { status: "published" },
      pagination: { skip, take: PAGE, order: { id: "ASC" } },
    })
    for (const row of data as OrphanRow[]) {
      if ((row.categories ?? []).filter(Boolean).length > 0) {
        continue
      }
      count += 1
      if (items.length < MAX_LISTED) {
        items.push({
          reason: "no_category",
          subject: row.title,
          entity: { kind: "product", id: row.id },
        })
      }
    }
    if (data.length < PAGE) {
      break
    }
  }
  return finding("S-ORPHAN-01", items, count)
}
