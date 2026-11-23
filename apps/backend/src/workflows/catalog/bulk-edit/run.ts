import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { chunksOf } from "../../../lib/catalog"
import { templateSourceOf } from "../../../lib/catalog/addons"
import { ValidationError } from "../../../lib/errors"
import { serverErrorMessage } from "../../../lib/errors/messages"
import { errorSummary, logger } from "../../../lib/logging"
import type { SheetCell } from "../../../lib/sheets"
import { publishGate } from "../../seo/advisor/publish-gate"
import { writeErrorText } from "../write-error"
import type { BulkAction, BulkChange, BulkEditInput } from "./change"
import { planBulkChange } from "./plan"
import type { BulkDiff, BulkPlan, PlanContext } from "./plan"
import { bulkProducts } from "./products"
import type { BulkProduct } from "./products"
import { bulkRow } from "./report"
import { writeBulkChange } from "./write"
import type { WriteOrigin } from "./write"

export interface BulkEditSummary {
  action: BulkAction
  /** Products named; those gone are `skipped`. */
  products: number
  changed: number
  unchanged: number
  skipped: number
  failed: number
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

type Counts = Omit<BulkEditSummary, "action" | "products">
type IsBlocked = ((id: string) => Promise<boolean>) | null

// What the run needs of the shop: the change's category, the default warehouse
async function planContext(container: MedusaContainer, change: BulkChange): Promise<PlanContext> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  if (change.action === "category") {
    const { data } = await query.graph({
      entity: "product_category",
      fields: ["id"],
      filters: { id: change.category_id },
    })
    if (data.length === 0) {
      throw new ValidationError("bulk_edit.category_unknown", { field: "category_id" })
    }
  }
  if (change.action === "addon_template") {
    const { data } = await query.graph({
      entity: "addon_template",
      fields: ["id", "name", "addons"],
    })
    const templates = new Map(
      (data as { id: string; name: string; addons?: unknown }[]).map((row) => [
        row.id,
        templateSourceOf(row),
      ])
    )
    if (!templates.has(change.template_id)) {
      throw new ValidationError("bulk_edit.addon_template_unknown", { field: "template_id" })
    }
    return { locationId: null, addonTemplates: templates }
  }
  if (change.action !== "stock") {
    return { locationId: null }
  }
  const { data } = await query.graph({ entity: "store", fields: ["default_location_id"] })
  const locationId = (data[0] as { default_location_id?: string | null } | undefined)
    ?.default_location_id
  if (!locationId) {
    throw new ValidationError("bulk_edit.no_location")
  }
  return { locationId }
}

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
  input: BulkEditInput,
  hooks: BulkEditHooks,
  context: PlanContext & { isBlocked: IsBlocked }
) {
  const { change } = input
  const counts: Counts = { changed: 0, unchanged: 0, skipped: 0, failed: 0 }
  const rows: SheetCell[][] = []
  const changed: string[] = []
  let done = 0
  for (const chunk of chunksOf(input.product_ids, PRODUCT_CHUNK)) {
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
        continue
      }
      const plan = planBulkChange(product, change, context)
      const { outcome, message } = await applyOne(container, product, plan, {
        origin: hooks.origin,
        isBlocked: context.isBlocked,
      })
      counts[outcome] += 1
      rows.push(bulkRow(product, outcome, message))
      if (outcome === "changed" && plan.kind === "write") {
        changed.push(product.id)
        await auditWritten(hooks, product.id, plan.diff)
      }
    }
    done += chunk.length
    await hooks.progress(5 + Math.floor((done / input.product_ids.length) * 95))
  }
  return { counts, rows, changed }
}

/**
 * Applies one change to the products named (F3.10), one product at a time,
 * each in its own run: a product the change cannot take costs that product,
 * not the rest. Each product written has its own audit entry; the run's
 * entry as it ends names them all (a run takes at most 1,000).
 */
export async function runBulkEdit(
  container: MedusaContainer,
  input: BulkEditInput,
  hooks: BulkEditHooks
): Promise<{ summary: BulkEditSummary; rows: SheetCell[][] }> {
  const { change } = input
  const context = await planContext(container, change)
  const isBlocked =
    change.action === "status" && change.status === "published"
      ? await publishGate(container)
      : null
  await hooks.progress(5)
  await hooks.audit("started", { change, products: input.product_ids.length })
  let finished: Record<string, unknown> = { interrupted: true }
  try {
    const { counts, rows, changed } = await applyAll(container, input, hooks, {
      ...context,
      isBlocked,
    })
    finished = { ...counts, product_ids: changed }
    return {
      summary: { action: change.action, products: input.product_ids.length, ...counts },
      rows,
    }
  } finally {
    // However the run ended; the products' own entries say what was written before a crash
    await hooks.audit("finished", finished)
  }
}
