import type { MedusaContainer } from "@medusajs/framework/types"
import { productsOf } from "../../../lib/catalog-sheet"
import type { SheetProduct } from "../../../lib/catalog-sheet"
import { ValidationError, isPlanLimitError } from "../../../lib/errors"
import { productAllowance } from "../../../lib/plan-limits"
import { errorSummary, logger } from "../../../lib/logging"
import type { Assessment } from "../../../lib/seo/advisor"
import { readSheet } from "../../../lib/sheets"
import type { SheetCell } from "../../../lib/sheets"
import { publishGate } from "../../seo/advisor/publish-gate"
import { shopOf } from "../../seo/payload-sources"
import { writeErrorText } from "../write-error"
import { sheetAssessment } from "./advisor"
import { importProductWorkflow } from "./import-product"
import { planImport } from "./plan"
import type { ImportPlan } from "./plan"
import { importReferences } from "./references"
import { limitedRow, measuresNote, problemRow, productRow, seoSummary } from "./report"
import type { SeoSummary } from "./report"
import type { ImportReferences } from "./references"

/** A sheet's size an import takes (F3.9 KK: 1,000 rows; five times that fits). */
export const IMPORT_LIMITS = { maxRows: 5_000, maxCells: 200 } as const

export type ImportMode = "check" | "apply"

export interface ImportSummary {
  mode: ImportMode
  rows: number
  /** Products the sheet would make and change (check), or made and changed (apply). */
  create: number
  update: number
  /** Products that exist and that the sheet leaves as they are. */
  unchanged: number
  /** Rows with a problem, and products a write refused (apply). */
  problems: number
  failed: number
  /**
   * New products past the package's product limit (adr/0061 Ek C14): left
   * out and reported, the rest of the sheet still written.
   */
  limited: number
  unknown_columns: string[]
  /** New products' SEO standing (check). */
  seo: SeoSummary | null
}

interface Planned {
  sheet: SheetProduct
  plan: ImportPlan
}

/** What an applied import writes to the audit log, before and after (adr/0011). */
export type ImportAudit = (
  action: "started" | "finished",
  changes: Record<string, unknown>
) => Promise<void>

// The handles an audit entry names, within its size budget
const MAX_AUDITED_HANDLES = 500

/** What a run reports to, and where its writes come from (the job, its requester). */
export interface ImportHooks {
  progress: (percent: number) => Promise<void>
  audit: ImportAudit
  origin: { job_id: string | null; actor_id: string | null }
}

/** A product that exists and that nothing in its rows changes. */
const isUnchanged = (plan: ImportPlan): boolean =>
  plan.productId !== null &&
  Object.keys(plan.product).length === 0 &&
  plan.variantUpdates.length === 0 &&
  plan.variantCreates.length === 0 &&
  plan.brandId === undefined &&
  plan.primaryCategoryId === undefined &&
  plan.seo === null &&
  plan.summaryDoc === undefined &&
  plan.attributes === null &&
  plan.stock.length === 0 &&
  plan.costs.length === 0

// A product that exists going live (the plan holds the status only when it changes)
const goesLive = (plan: ImportPlan): boolean =>
  plan.productId !== null && plan.product["status"] === "published"

async function applyPlans(
  container: MedusaContainer,
  planned: readonly Planned[],
  context: ImportHooks & { locationId: string | null }
) {
  const rows: SheetCell[][] = []
  const counts = { create: 0, update: 0, failed: 0, limited: 0 }
  const written: string[] = []
  const limited: string[] = []
  const isBlocked = await publishGate(container)
  // New products the package still allows; changes to existing ones are never held back
  let allowance = await productAllowance(container)
  // A new product past the limit: reported, not written
  const leaveOut = (plan: ImportPlan) => {
    counts.limited += 1
    limited.push(plan.handle)
    rows.push(limitedRow(plan.line, plan.handle))
  }
  try {
    for (const [index, { plan }] of planned.entries()) {
      const isNew = plan.productId === null
      if (isNew && allowance !== null && allowance <= 0) {
        leaveOut(plan)
      } else {
        try {
          // A draft taken live passes the SEO gate as the product route's would
          if (isBlocked && goesLive(plan) && (await isBlocked(plan.productId ?? ""))) {
            throw new ValidationError("seo.publish_gate_blocked", { field: "status" })
          }
          await importProductWorkflow(container).run({
            input: { plan, location_id: context.locationId, ...context.origin },
          })
          counts[isNew ? "create" : "update"] += 1
          if (isNew && allowance !== null) {
            allowance -= 1
          }
          written.push(plan.handle)
          rows.push(
            productRow(plan.line, plan.handle, isNew ? "created" : "updated", measuresNote(plan))
          )
        } catch (error) {
          if (isPlanLimitError(error)) {
            // Another write took the last places meanwhile: the other new ones wait too
            allowance = 0
            leaveOut(plan)
          } else {
            counts.failed += 1
            logger.warn({
              event: "catalog.import_product_failed",
              handle: plan.handle,
              err: errorSummary(error),
            })
            rows.push(
              productRow(plan.line, plan.handle, "failed", { message: writeErrorText(error) })
            )
          }
        }
      }
      await context.progress(10 + Math.floor(((index + 1) / planned.length) * 90))
    }
  } finally {
    // What was written, however the run ended
    await context.audit("finished", { ...counts, handles: written.slice(0, MAX_AUDITED_HANDLES) })
  }
  return { rows, counts, limited }
}

// The rows a check reports: what each product would be, a new one's SEO standing
async function checkPlans(
  container: MedusaContainer,
  planned: readonly Planned[],
  refs: ImportReferences
) {
  const shop = await shopOf(container)
  const assessments: Assessment[] = []
  // As the apply would: new products past the package's limit are left out (adr/0061 Ek C14)
  let allowance = await productAllowance(container)
  let limited = 0
  const rows = planned.map(({ sheet, plan }) => {
    if (!plan.productId && allowance !== null) {
      if (allowance <= 0) {
        limited += 1
        return limitedRow(plan.line, plan.handle)
      }
      allowance -= 1
    }
    const assessment = plan.productId ? undefined : sheetAssessment(sheet, refs, shop)
    if (assessment) {
      assessments.push(assessment)
    }
    const outcome = plan.productId ? "update" : "create"
    return productRow(plan.line, plan.handle, outcome, {
      ...measuresNote(plan),
      ...(assessment ? { assessment } : {}),
    })
  })
  return { rows, limited, seo: seoSummary(assessments) }
}

/** The sheet read and grouped, each product checked against the shop. */
async function planSheet(container: MedusaContainer, buffer: Buffer) {
  const read = await readSheet(buffer, IMPORT_LIMITS)
  if (!read.ok) {
    throw new ValidationError(read.key)
  }
  const sheet = productsOf(read.header, read.rows)
  const refs = await importReferences(container, sheet.products)
  const problemRows = sheet.problems.map((problem) =>
    problemRow(problem, sheet.handles.get(problem.line))
  )
  const planned: Planned[] = []
  for (const product of sheet.products) {
    const { plan, problems } = planImport(product, refs)
    problemRows.push(...problems.map((problem) => problemRow(problem, product.handle)))
    if (plan) {
      planned.push({ sheet: product, plan })
    }
  }
  return { rows: read.rows.length, sheet, refs, planned, problemRows }
}

/**
 * Reads the sheet, checks every product against the shop and, applying,
 * writes the ones without a problem, one at a time. Returns the summary
 * and the report's rows, the file's order.
 */
export async function runImport(
  container: MedusaContainer,
  buffer: Buffer,
  mode: ImportMode,
  hooks: ImportHooks
): Promise<{ summary: ImportSummary; rows: SheetCell[][]; limited: string[] }> {
  const { rows, sheet, refs, planned: all, problemRows } = await planSheet(container, buffer)
  await hooks.progress(10)
  const planned = all.filter(({ plan }) => !isUnchanged(plan))
  const unchanged = all.length - planned.length
  const creates = planned.filter(({ plan }) => !plan.productId).length
  const checked = mode === "check" ? await checkPlans(container, planned, refs) : null
  if (mode === "apply") {
    await hooks.audit("started", { rows, create: creates, update: planned.length - creates })
  }
  const applied =
    mode === "apply"
      ? await applyPlans(container, planned, { locationId: refs.shop.locationId, ...hooks })
      : null
  const unchangedRows = all
    .filter(({ plan }) => isUnchanged(plan))
    .map(({ plan }) => productRow(plan.line, plan.handle, "unchanged", measuresNote(plan)))
  const summary: ImportSummary = {
    mode,
    rows,
    unchanged,
    ...(applied?.counts ?? {
      create: creates - (checked?.limited ?? 0),
      update: planned.length - creates,
      failed: 0,
      limited: checked?.limited ?? 0,
    }),
    // Rows, not problems: a row can have several
    problems: new Set(problemRows.map((row) => row[0])).size,
    unknown_columns: sheet.unknownColumns,
    seo: checked?.seo ?? null,
  }
  const reported = [...problemRows, ...unchangedRows, ...(checked?.rows ?? applied?.rows ?? [])]
  return {
    summary,
    rows: reported.sort((a, b) => Number(a[0]) - Number(b[0])),
    // The new products the package's limit left out (the move from an old site names them)
    limited: applied?.limited ?? [],
  }
}
