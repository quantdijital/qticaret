import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ValidationError } from "../../../lib/errors"
import { serverErrorMessage } from "../../../lib/errors/messages"
import { errorSummary, logger } from "../../../lib/logging"
import type { SheetCell } from "../../../lib/sheets"
import { publishGate } from "../../seo/advisor/publish-gate"
import { writeErrorText } from "../write-error"
import type { BulkAction, BulkChange, BulkEditInput } from "./change"
import { planBulkChange } from "./plan"
import type { BulkPlan, PlanContext } from "./plan"
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
  /** What the run writes to the audit log, as it starts and as it ends (adr/0011). */
  audit: (action: "started" | "finished", changes: Record<string, unknown>) => Promise<void>
  origin: WriteOrigin
}

// The products an audit entry names, within its size budget
const MAX_AUDITED_PRODUCTS = 500

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

type Counts = Omit<BulkEditSummary, "action" | "products">

// One product: planned, held by the publish gate, or written
async function applyOne(
  container: MedusaContainer,
  product: BulkProduct,
  plan: BulkPlan,
  context: { origin: WriteOrigin; isBlocked: ((id: string) => Promise<boolean>) | null }
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

/**
 * Applies one change to the products named (F3.10), one product at a time,
 * each in its own run: a product the change cannot take costs that product,
 * not the rest. Returns the summary and the report's rows, in the order named.
 */
export async function runBulkEdit(
  container: MedusaContainer,
  input: BulkEditInput,
  hooks: BulkEditHooks
): Promise<{ summary: BulkEditSummary; rows: SheetCell[][] }> {
  const { change } = input
  const context = await planContext(container, change)
  const products = await bulkProducts(container, input.product_ids, change.action)
  const isBlocked =
    change.action === "status" && change.status === "published"
      ? await publishGate(container)
      : null
  await hooks.progress(5)
  await hooks.audit("started", { change, products: input.product_ids.length })
  const counts: Counts = { changed: 0, unchanged: 0, skipped: 0, failed: 0 }
  const rows: SheetCell[][] = []
  const changed: string[] = []
  try {
    for (const [index, product] of products.entries()) {
      const plan = planBulkChange(product, change, context)
      const { outcome, message } = await applyOne(container, product, plan, {
        origin: hooks.origin,
        isBlocked,
      })
      counts[outcome] += 1
      if (outcome === "changed") {
        changed.push(product.id)
      }
      rows.push(bulkRow(product, outcome, message))
      await hooks.progress(5 + Math.floor(((index + 1) / products.length) * 95))
    }
  } finally {
    await hooks.audit("finished", {
      ...counts,
      product_ids: changed.slice(0, MAX_AUDITED_PRODUCTS),
    })
  }
  // Named but gone (deleted since the panel listed them)
  const found = new Set(products.map((product) => product.id))
  for (const id of input.product_ids.filter((each) => !found.has(each))) {
    counts.skipped += 1
    rows.push(
      bulkRow(
        { handle: id, title: null },
        "skipped",
        serverErrorMessage("bulk_edit.product_missing", "tr")
      )
    )
  }
  return {
    summary: { action: change.action, products: input.product_ids.length, ...counts },
    rows,
  }
}
