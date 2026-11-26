import type { MedusaContainer } from "@medusajs/framework/types"
import { serverErrorMessage } from "../../../lib/errors/messages"
import { errorSummary, logger } from "../../../lib/logging"
import type { SheetCell } from "../../../lib/sheets"
import { publishGate } from "../../seo/advisor/publish-gate"
import { writeErrorText } from "../write-error"
import type { BulkAction, BulkChange, BulkEditInput } from "./change"
import { planContext } from "./context"
import { planBulkChange } from "./plan"
import type { BulkDiff, BulkPlan, PlanContext } from "./plan"
import { bulkProducts } from "./products"
import type { BulkProduct } from "./products"
import { bulkRow, problemOf } from "./report"
import type { BulkProblem } from "./report"
import { runProducts } from "./scope"
import type { RunProducts } from "./scope"
import { writeBulkChange } from "./write"
import type { WriteOrigin } from "./write"

export interface BulkEditSummary {
  action: BulkAction
  /** Products named (or found in the scope); those gone are `skipped`. */
  products: number
  changed: number
  unchanged: number
  skipped: number
  failed: number
  /** The first products left out or failed, with why (the report has every one). */
  problems: BulkProblem[]
}

export interface BulkEditHooks {
  progress: (percent: number) => Promise<void>
  /** The run in the audit log as it starts and as it ends (adr/0011). */
  audit: (action: "started" | "finished", changes: Record<string, unknown>) => Promise<void>
  /** A product it changed, with each field before and after, once it is written. */
  auditProduct: (productId: string, diff: BulkDiff) => Promise<void>
  origin: WriteOrigin
}

// Products are read this many at a time, each just before it is written: a
// sale or an edit made while the run goes on is what its plan starts from
const PRODUCT_CHUNK = 20

type Counts = Omit<BulkEditSummary, "action" | "products" | "problems">
type IsBlocked = ((id: string) => Promise<boolean>) | null

// One product: planned, held by the publish gate, or written
async function applyOne(
  container: MedusaContainer,
  product: BulkProduct,
  plan: BulkPlan,
  context: { origin: WriteOrigin; isBlocked: IsBlocked }
): Promise<{ outcome: keyof Counts; message: string | null }> {
  if (plan.kind === "unchanged") {
    return { outcome: "unchanged", message: null }
  }
  if (plan.kind === "skipped") {
    return { outcome: "skipped", message: serverErrorMessage(plan.key, "tr") }
  }
  try {
    // Taking a product live passes the SEO gate as the product route's would
    if (plan.write.action === "status" && plan.write.status === "published" && context.isBlocked) {
      if (await context.isBlocked(product.id)) {
        return { outcome: "skipped", message: serverErrorMessage("seo.publish_gate_blocked", "tr") }
      }
    }
    await writeBulkChange(container, product.id, plan.write, context.origin)
    return { outcome: "changed", message: null }
  } catch (error) {
    logger.warn({
      event: "catalog.bulk_edit_product_failed",
      productId: product.id,
      err: errorSummary(error),
    })
    return { outcome: "failed", message: writeErrorText(error) }
  }
}

// A change written stays written: its audit entry failing is logged, not undone
async function auditWritten(hooks: BulkEditHooks, productId: string, diff: BulkDiff) {
  try {
    await hooks.auditProduct(productId, diff)
  } catch (error) {
    logger.error({ event: "audit.write_failed", productId, err: errorSummary(error) })
  }
}

/** Every product named, a chunk at a time; a row each, in the order named. */
async function applyAll(
  container: MedusaContainer,
  change: BulkChange,
  products: RunProducts,
  hooks: BulkEditHooks,
  context: PlanContext & { isBlocked: IsBlocked }
) {
  const counts: Counts = { changed: 0, unchanged: 0, skipped: 0, failed: 0 }
  const rows: SheetCell[][] = []
  const changed: string[] = []
  const problems: BulkProblem[] = []
  const note = (problem: BulkProblem | null) => {
    if (problem) {
      problems.push(problem)
    }
  }
  let done = 0
  for await (const chunk of products.chunks) {
    const found = new Map(
      (await bulkProducts(container, chunk, change.action)).map((product) => [product.id, product])
    )
    for (const id of chunk) {
      const product = found.get(id)
      if (!product) {
        // Deleted since the panel listed it
        counts.skipped += 1
        const missing = serverErrorMessage("bulk_edit.product_missing", "tr")
        rows.push(bulkRow({ handle: id, title: null }, "skipped", missing))
        note(problemOf(problems, { handle: id, title: null }, "skipped", missing))
        continue
      }
      const plan = planBulkChange(product, change, context)
      const { outcome, message } = await applyOne(container, product, plan, {
        origin: hooks.origin,
        isBlocked: context.isBlocked,
      })
      counts[outcome] += 1
      rows.push(bulkRow(product, outcome, message))
      note(problemOf(problems, product, outcome, message))
      if (outcome === "changed" && plan.kind === "write") {
        changed.push(product.id)
        await auditWritten(hooks, product.id, plan.diff)
      }
    }
    done += chunk.length
    // A scope's count is read as it starts: a product made meanwhile may pass it
    await hooks.progress(5 + Math.floor(Math.min(1, done / Math.max(1, products.total)) * 95))
  }
  return { counts, rows, changed, done, problems }
}

/**
 * Applies one change to the products named (F3.10), one product at a time,
 * each in its own run: a product the change cannot take costs that product,
 * not the rest. Each product written has its own audit entry; the run's
 * entry as it ends names them all. Named products are at most 1,000; an
 * add-on template's scope (the whole catalogue, a category) is read a
 * page at a time and has no cap (2026-11-23).
 */
export async function runBulkEdit(
  container: MedusaContainer,
  input: BulkEditInput,
  hooks: BulkEditHooks
): Promise<{ summary: BulkEditSummary; rows: SheetCell[][] }> {
  const { change } = input
  const context = await planContext(container, change, true)
  const products = await runProducts(container, input, PRODUCT_CHUNK)
  const isBlocked =
    change.action === "status" && change.status === "published"
      ? await publishGate(container)
      : null
  await hooks.progress(5)
  await hooks.audit("started", {
    change,
    products: products.total,
    ...(input.scope ? { scope: input.scope } : {}),
  })
  let finished: Record<string, unknown> = { interrupted: true }
  try {
    const { counts, rows, changed, done, problems } = await applyAll(
      container,
      change,
      products,
      hooks,
      {
        ...context,
        isBlocked,
      }
    )
    finished = { ...counts, product_ids: changed }
    return {
      summary: { action: change.action, products: done, ...counts, problems },
      rows,
    }
  } finally {
    // However the run ended; the products' own entries say what was written before a crash
    await hooks.audit("finished", finished)
  }
}
