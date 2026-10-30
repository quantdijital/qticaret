import type { MedusaContainer } from "@medusajs/framework/types"
import { ValidationError } from "../../lib/errors"
import { isBackendPath, normalizePath } from "../../lib/seo/redirects"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import { actionOf, stateOf } from "./urls"

type Container = Pick<MedusaContainer, "resolve">

export const URL_FILTERS = ["all", "undecided", "matched", "decided", "unsupported"] as const
export type UrlFilter = (typeof URL_FILTERS)[number]

const PAGE = 50
// KK3: the addresses with the most clicks that must all answer before cutover
export const TOP_ADDRESSES = 100

const FILTERS: Readonly<Record<UrlFilter, Record<string, unknown>>> = {
  all: {},
  undecided: { entity_id: null, decision: "auto", query: null },
  matched: { entity_id: { $ne: null } },
  decided: { decision: ["redirect", "gone"] },
  unsupported: { query: { $ne: null } },
}

const FIELDS = [
  "id",
  "address",
  "path",
  "query",
  "origins",
  "clicks",
  "entity_type",
  "entity_id",
  "decision",
  "target",
  "outcome",
  "applied_at",
]

/** A page of the inventory, the most clicked first, each with what it answers today and what an apply would do. */
export async function urlPage(container: Container, filter: UrlFilter, offset: number) {
  const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
  const [rows, count] = await migration.listAndCountMigrationUrls(FILTERS[filter], {
    select: FIELDS,
    skip: offset,
    take: PAGE,
    order: { clicks: "DESC", address: "ASC" },
  })
  const urls = []
  for (const row of rows) {
    const state = await stateOf(container, row.path)
    urls.push({ ...row, ...state, action: actionOf(row, state) })
  }
  return { urls, count, offset, limit: PAGE }
}

/**
 * Where the cutover stands (KK3): the inventory's counts, and the most
 * clicked addresses (Search Console's) that answer nothing here yet. Not
 * ready without Search Console's clicks, nor while one of the top
 * addresses would be a 404 (a query address the owner decided on is
 * theirs to give a server rule).
 */
export async function urlSummary(container: Container) {
  const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
  const count = async (filter: UrlFilter) =>
    (await migration.listAndCountMigrationUrls(FILTERS[filter], { take: 1, select: ["id"] }))[1]
  const top = await migration.listMigrationUrls(
    { clicks: { $gt: 0 } },
    {
      select: ["address", "path", "query", "decision", "clicks"],
      take: TOP_ADDRESSES,
      order: { clicks: "DESC" },
    }
  )
  const unanswered: { address: string; clicks: number | null }[] = []
  for (const row of top) {
    // A query address no rule can take counts once the owner has seen it (a server rule's)
    const seen = row.query !== null && row.decision !== "auto"
    if (!seen && (await stateOf(container, row.path)).state === "not_found") {
      unanswered.push({ address: row.address, clicks: row.clicks })
    }
  }
  return {
    total: await count("all"),
    matched: await count("matched"),
    decided: await count("decided"),
    undecided: await count("undecided"),
    unsupported: await count("unsupported"),
    top: { checked: top.length, unanswered },
    ready: top.length > 0 && unanswered.length === 0,
  }
}

/**
 * The owner's decision for an address: a 301 to a page here that answers
 * (a live page, not one more redirect to follow), gone (410), or back to
 * what its record says. Takes effect at the next apply.
 */
export async function decideUrl(
  container: Container,
  id: string,
  decision: { decision: "auto" | "gone" } | { decision: "redirect"; target: string },
  by: string | null
) {
  const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
  const row = await migration.retrieveMigrationUrl(id, { select: ["id", "path"] })
  let target: string | null = null
  if (decision.decision === "redirect") {
    target = normalizePath(decision.target)
    if (
      !target ||
      target === row.path ||
      isBackendPath(target) ||
      (await stateOf(container, target)).state !== "live"
    ) {
      throw new ValidationError("migration.url_target_not_live", { field: "target" })
    }
  }
  return migration.updateMigrationUrls({
    id,
    decision: decision.decision,
    target,
    decided_by: by,
  })
}
