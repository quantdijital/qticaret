import type { MedusaContainer } from "@medusajs/framework/types"
import { uniqueViolationKeys } from "../../lib/errors"
import { parseSource } from "../../lib/seo/redirects"
import type { StepProgress } from "../../lib/migration/types"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import { SEO_REDIRECTS_MODULE } from "../../modules/seo-redirects"
import type SeoRedirectsModuleService from "../../modules/seo-redirects/service"
import { SEO_SITEMAPS_MODULE } from "../../modules/seo-sitemaps"
import type SeoSitemapsModuleService from "../../modules/seo-sitemaps/service"
import { URL_REGISTRY_MODULE } from "../../modules/url-registry"
import type UrlRegistryModuleService from "../../modules/url-registry/service"
import { CATALOG_LOCALE } from "../catalog/entity-paths"
import type { ImportRow } from "../seo/redirects/csv"
import { importRedirectsWorkflow } from "../seo/redirects/workflows"
import { actionOf, stateOf } from "./urls"
import type { AddressAction } from "./urls"

type Container = Pick<MedusaContainer, "resolve">

const PAGE = 500

interface Row {
  id: string
  path: string
  query: string | null
  entity_type: string | null
  entity_id: string | null
  decision: string
  target: string | null
}

/**
 * An old path kept for the record it moved as (adr/0017): resolution sends
 * it on to the record's path, wherever that moves later. A path another
 * record holds stays its.
 */
async function reserve(container: Container, row: Row): Promise<string> {
  // As a rule's source would be checked: never the home page, a backend path or a reserved word
  if (!parseSource(row.path, "exact").ok) {
    return "migration.url_path_reserved"
  }
  const registry = container.resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
  const owner = { entity_type: row.entity_type ?? "", entity_id: row.entity_id ?? "" }
  const [held] = await registry.listUrlEntries(
    { locale: CATALOG_LOCALE, path: row.path },
    { take: 1, select: ["entity_type", "entity_id"] }
  )
  if (held) {
    const same = held.entity_type === owner.entity_type && held.entity_id === owner.entity_id
    return same ? "covered" : "migration.url_path_taken"
  }
  try {
    await registry.createUrlEntries({
      locale: CATALOG_LOCALE,
      path: row.path,
      ...owner,
      status: "reserved",
    })
    return "reserved"
  } catch (error) {
    if (uniqueViolationKeys(error)?.includes("path")) {
      return "migration.url_path_taken"
    }
    throw error
  }
}

/**
 * The owner's 301s and 410s through the redirect file import (adr/0017's
 * checks: no live page taken, no loop, no gone target), as one file: a
 * dry run names the rows it refuses, the rest are written. Each row's
 * outcome by its address id.
 */
async function writeRules(
  container: Container,
  rows: readonly Row[]
): Promise<Map<string, string>> {
  const outcomes = new Map<string, string>()
  const lines: ImportRow[] = rows.map((row, index) => ({
    line: index + 1,
    rule: {
      source: row.path,
      match: "exact",
      target: row.decision === "gone" ? null : row.target,
      status: row.decision === "gone" ? 410 : 301,
      query_policy: "keep",
    },
  }))
  if (lines.length === 0) {
    return outcomes
  }
  const run = (rowsToRun: ImportRow[], dryRun: boolean) =>
    importRedirectsWorkflow(container as MedusaContainer).run({
      input: { rows: rowsToRun, dry_run: dryRun, origin: "migration" },
    })
  const { result: checked } = await run(lines, true)
  const refused = new Map(checked.problems.map((problem) => [problem.line, problem.key]))
  const accepted = lines.filter((line) => !refused.has(line.line))
  // The file is written whole or not at all: a refusal only the writing finds leaves none
  const written = accepted.length > 0 ? (await run(accepted, false)).result : null
  const unwritten = (written?.problems.length ?? 0) > 0
  rows.forEach((row, index) => {
    const line = index + 1
    outcomes.set(
      row.id,
      refused.get(line) ??
        (unwritten
          ? "migration.url_rules_refused"
          : row.decision === "gone"
            ? "gone"
            : "redirected")
    )
  })
  return outcomes
}

export type ApplyCounts = Record<AddressAction | "taken" | "refused", number>

/**
 * Applies the address inventory (F14.7, adr/0042 §8): what answers already
 * is left; a moved record's old path is kept for it; the owner's 301s and
 * 410s become rules; the rest waits for a decision. Each address keeps
 * what was done with it. The storefront forgets its cached answers.
 */
export async function applyUrls(
  container: Container,
  progress: StepProgress
): Promise<ApplyCounts> {
  const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
  const counts: ApplyCounts = {
    covered: 0,
    reserve: 0,
    redirect: 0,
    gone: 0,
    undecided: 0,
    unsupported: 0,
    taken: 0,
    refused: 0,
  }
  const total = await migration.listAndCountMigrationUrls({}, { take: 1 }).then(([, n]) => n)
  const now = new Date()
  for (let skip = 0; skip < total; skip += PAGE) {
    const rows = (await migration.listMigrationUrls(
      {},
      {
        select: ["id", "path", "query", "entity_type", "entity_id", "decision", "target"],
        skip,
        take: PAGE,
        order: { id: "ASC" },
      }
    )) as Row[]
    const outcomes = new Map<string, string>()
    const rules: Row[] = []
    for (const row of rows) {
      const action = actionOf(row, await stateOf(container, row.path))
      counts[action] += 1
      if (action === "reserve") {
        const outcome = await reserve(container, row)
        counts.taken += outcome === "migration.url_path_taken" ? 1 : 0
        counts.refused += outcome === "migration.url_path_reserved" ? 1 : 0
        outcomes.set(row.id, outcome)
      } else if (action === "redirect" || action === "gone") {
        rules.push(row)
      } else {
        outcomes.set(row.id, action)
      }
    }
    for (const [id, outcome] of await writeRules(container, rules)) {
      counts.refused += outcome === "redirected" || outcome === "gone" ? 0 : 1
      outcomes.set(id, outcome)
    }
    await migration.updateMigrationUrls(
      [...outcomes].map(([id, outcome]) => ({ id, outcome, applied_at: now }))
    )
    await progress(Math.min(skip + PAGE, total), total)
  }
  await Promise.all([
    container.resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE).invalidateResolutions(),
    container.resolve<SeoSitemapsModuleService>(SEO_SITEMAPS_MODULE).markDirty(),
  ])
  return counts
}
