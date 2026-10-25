import type { MedusaContainer } from "@medusajs/framework/types"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ValidationError, isConflictError, isValidationError } from "../../../../lib/errors"
import { SEO_REDIRECTS_MODULE } from "../../../../modules/seo-redirects"
import type SeoRedirectsModuleService from "../../../../modules/seo-redirects/service"
import { toRedirectRule } from "../../../../modules/seo-redirects/service"
import type { SeoRedirectRecord } from "../../../../modules/seo-redirects/service"
import { loopingLines } from "../csv"
import type { ImportRow, RowProblem } from "../csv"
import { checkAgainstShop, checkRuleSet, fieldsOfRule, retargets, storedFields } from "../plan"
import type { RedirectFields } from "../plan"

export interface ImportRedirectsInput {
  rows: ImportRow[]
  /** Checks and counts without keeping anything. */
  dry_run: boolean
}

export interface ImportResult {
  created: number
  updated: number
  problems: RowProblem[]
}

interface Undo {
  created: string[]
  updated: { id: string; previous: RedirectFields }[]
  retargeted: { id: string; target: string }[]
}

type Service = SeoRedirectsModuleService

async function revert(service: Service, undo: Undo): Promise<void> {
  for (const each of [...undo.retargeted].reverse()) {
    await service.updateSeoRedirects(each)
  }
  for (const each of [...undo.updated].reverse()) {
    await service.updateSeoRedirects({ id: each.id, ...each.previous })
  }
  if (undo.created.length > 0) {
    await service.deleteSeoRedirects(undo.created)
  }
  await service.invalidatePatterns()
}

interface CheckedRow {
  line: number
  fields: RedirectFields
  existing: SeoRedirectRecord | undefined
}

/**
 * One row, as a rule saved in the panel would be checked, without writing:
 * a rule with the same source and kind is updated (a file is imported
 * again); the same rule twice in a file is a mistake.
 */
async function checkRow(
  container: MedusaContainer,
  row: ImportRow,
  seen: Set<string>
): Promise<CheckedRow> {
  const service = container.resolve<Service>(SEO_REDIRECTS_MODULE)
  const stored = storedFields(row.rule)
  const key = `${stored.match} ${stored.source}`
  if (seen.has(key)) {
    throw new ValidationError("seo.redirect_duplicate_row", { field: "source" })
  }
  seen.add(key)
  const [existing] = await service.listSeoRedirects(
    { source: stored.source, match: stored.match },
    { take: 1 }
  )
  const id = existing?.id ?? null
  await checkRuleSet(container, stored, id)
  return { line: row.line, fields: await checkAgainstShop(container, stored, id), existing }
}

/** Writes a checked row and closes the chains it ends, so the next rows see it. */
async function writeRow(container: MedusaContainer, row: CheckedRow, undo: Undo): Promise<void> {
  const service = container.resolve<Service>(SEO_REDIRECTS_MODULE)
  const { fields, existing } = row
  const moved = await retargets(container, fields, existing?.id ?? null)
  if (existing) {
    await service.updateSeoRedirects({ id: existing.id, ...fields })
    undo.updated.push({ id: existing.id, previous: fieldsOfRule(toRedirectRule(existing)) })
  } else {
    const created = await service.createSeoRedirects({ ...fields, origin: "import" })
    undo.created.push(created.id)
  }
  if (moved.length > 0) {
    await service.updateSeoRedirects(
      moved.map(({ id: movedId, target }) => ({ id: movedId, target }))
    )
    undo.retargeted.push(
      ...moved.map(({ id: movedId, previous }) => ({ id: movedId, target: previous }))
    )
  }
  if (fields.match === "pattern") {
    await service.invalidatePatterns()
  }
}

function problemOf(error: unknown, line: number): RowProblem | null {
  if (isValidationError(error)) {
    return { line, key: error.safeMessage, field: error.field }
  }
  return isConflictError(error) ? { line, key: error.safeMessage } : null
}

/**
 * Imports a redirect file (docs/13 §4) all or nothing: a row that fails
 * is reported by its line and every row written is taken back. A dry run
 * writes nothing: rows are checked against the shop as it is, and loops
 * the file closes within itself are found in memory. Kept rows are taken
 * back by the compensation if a later step fails.
 */
export const importRedirectsStep = createStep(
  "seo-import-redirects",
  async (input: ImportRedirectsInput, { container }) => {
    const service = container.resolve<Service>(SEO_REDIRECTS_MODULE)
    const undo: Undo = { created: [], updated: [], retargeted: [] }
    const result: ImportResult = { created: 0, updated: 0, problems: [] }
    const seen = new Set<string>()
    const checked: CheckedRow[] = []
    try {
      for (const row of input.rows) {
        try {
          const ready = await checkRow(container, row, seen)
          if (!input.dry_run && result.problems.length === 0) {
            await writeRow(container, ready, undo)
          }
          checked.push(ready)
          result[ready.existing ? "updated" : "created"] += 1
        } catch (error) {
          const problem = problemOf(error, row.line)
          if (!problem) {
            throw error
          }
          result.problems.push(problem)
        }
      }
    } catch (error) {
      await revert(service, undo)
      throw error
    }
    if (input.dry_run) {
      result.problems.push(
        ...loopingLines(checked).map((line) => ({ line, key: "seo.redirect_loop" }))
      )
    }
    const kept = result.problems.length === 0 && !input.dry_run
    if (!kept) {
      await revert(service, undo)
    }
    return new StepResponse(result, kept ? undo : null)
  },
  async (undo, { container }) => {
    if (undo) {
      await revert(container.resolve<Service>(SEO_REDIRECTS_MODULE), undo)
    }
  }
)
