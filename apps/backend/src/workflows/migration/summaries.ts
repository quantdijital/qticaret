import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { chunksOf } from "../../lib/catalog/ids"
import type { SummaryDoc } from "../../lib/catalog/summary"
import type { SourceProduct, StepProblem } from "../../lib/migration/types"
import { AUDIT_LOG_MODULE } from "../../modules/audit-log"
import type AuditLogModuleService from "../../modules/audit-log/service"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import { canonical, writeTexts } from "./descriptions"

type Container = Pick<MedusaContainer, "resolve">

/**
 * Short descriptions (adr/0055 Ek 2026-11-06) for the products a run
 * moved, from the export's excerpts as the shop wrote them, through the
 * catalog save the panel uses:
 * - a product whose short description the shop changed in the panel (the
 *   audit log's catalog saves say so; emptied, too) is the shop's own and
 *   is left as it is;
 * - else a product without one gets it, and one whose short description
 *   is still exactly the bullet list the 2026-11-05 build made of its
 *   excerpt (`legacy`) gets it in that list's place;
 * - any other is the shop's own too.
 * Safe to run again: one already the excerpt as written is found, not
 * written.
 */

const READ_CHUNK = 200
const CATALOG_SAVE = "POST /admin/products/:id/catalog"
const SUMMARY_FIELDS: ReadonlySet<string> = new Set(["summary", "summary_doc"])

export interface SummaryFill {
  /** Products in the source. */
  read: number
  /** Had none: written (would be, in a dry run). */
  filled: number
  /** Still the 2026-11-05 build's bullet list: written over (would be). */
  replaced: number
  /** Already the excerpt as written. */
  same: number
  /** The shop's own: changed in the panel, or not what that build wrote. Left as it is. */
  kept: number
  /** Not moved by a run (or not done). */
  skipped: number
  /** No short description in the source. */
  empty: number
  /** Gone since, or the save refused. */
  failed: number
  problems: StepProblem[]
  /** The source keys of the products kept as the shop's own. */
  keptKeys: string[]
}

async function currentSummaries(container: Container, ids: readonly string[]) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const found = new Map<string, unknown>()
  for (const chunk of chunksOf(ids, READ_CHUNK)) {
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "product_extension.summary_doc"],
      filters: { id: [...chunk] },
    })
    for (const row of data as {
      id: string
      product_extension?: { summary_doc?: unknown } | null
    }[]) {
      found.set(row.id, row.product_extension?.summary_doc ?? null)
    }
  }
  return found
}

interface CatalogChange {
  fields?: unknown
  diff?: unknown
  write_failed?: unknown
}

/** Whether a catalog save changed the short description (or may have: its change set was lost). */
function touchedSummary(changes: CatalogChange | null): boolean {
  if (!changes || changes.write_failed === true) {
    return true
  }
  const fields: unknown[] = Array.isArray(changes.fields) ? changes.fields : []
  const sent = fields.some((field) => typeof field === "string" && SUMMARY_FIELDS.has(field))
  if (!sent) {
    return false
  }
  const diff = changes.diff
  return (
    diff === null ||
    typeof diff !== "object" ||
    Object.keys(diff).some((key) => SUMMARY_FIELDS.has(key))
  )
}

/** The products whose short description the shop changed in the panel, by the audit log. */
async function editedInPanel(container: Container, ids: readonly string[]): Promise<Set<string>> {
  const audit = container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
  const edited = new Set<string>()
  for (const chunk of chunksOf(ids, READ_CHUNK)) {
    const entries = await audit.listAuditEntries(
      { action: CATALOG_SAVE, resource_type: "product", resource_id: [...chunk] },
      { select: ["resource_id", "changes"] }
    )
    for (const entry of entries) {
      if (entry.resource_id && touchedSummary(entry.changes)) {
        edited.add(entry.resource_id)
      }
    }
  }
  return edited
}

export async function fillSummaries(
  container: Container,
  sourceId: string,
  products: readonly SourceProduct[],
  legacy: ReadonlyMap<string, SummaryDoc>,
  apply: boolean
): Promise<SummaryFill> {
  const fill: SummaryFill = {
    read: products.length,
    filled: 0,
    replaced: 0,
    same: 0,
    kept: 0,
    skipped: 0,
    empty: 0,
    failed: 0,
    problems: [],
    keptKeys: [],
  }
  const targets = await container.resolve<MigrationModuleService>(MIGRATION_MODULE).targetsOf(
    sourceId,
    "product",
    products.map((product) => product.source_key)
  )
  const idOf = (product: SourceProduct) => {
    const target = targets.get(product.source_key)
    return target?.status === "done" ? target.target_id : null
  }
  const ids = products.flatMap((product) => idOf(product) ?? [])
  const current = await currentSummaries(container, ids)
  const edited = await editedInPanel(container, ids)
  for (const product of products) {
    const doc = product.summary_doc ?? null
    const id = idOf(product)
    const now = id ? current.get(id) : undefined
    if (!doc) {
      fill.empty += 1
      continue
    }
    if (!id) {
      fill.skipped += 1
      continue
    }
    if (now === undefined) {
      fill.failed += 1
      fill.problems.push({ source_key: product.source_key, key: "migration.product_gone" })
      continue
    }
    if (now !== null && canonical(now) === canonical(doc)) {
      fill.same += 1
      continue
    }
    const before = legacy.get(product.source_key)
    // A save in the panel makes it the shop's, an emptied one too
    const outcome = edited.has(id)
      ? null
      : now === null
        ? "filled"
        : before && canonical(now) === canonical(before)
          ? "replaced"
          : null
    if (!outcome) {
      fill.kept += 1
      fill.keptKeys.push(product.source_key)
      continue
    }
    const problem = apply
      ? await writeTexts(container, id, { summary_doc: doc }, product.source_key)
      : null
    if (problem) {
      fill.failed += 1
      fill.problems.push(problem)
    } else {
      fill[outcome] += 1
    }
  }
  return fill
}
