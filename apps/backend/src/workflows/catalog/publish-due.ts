import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { dueForPublish, withFailure, withoutSchedule } from "../../lib/catalog/publish-schedule"
import type { Metadata, ScheduledProduct } from "../../lib/catalog/publish-schedule"
import { errorSummary, logger } from "../../lib/logging"
import { AUDIT_LOG_MODULE } from "../../modules/audit-log"
import type AuditLogModuleService from "../../modules/audit-log/service"
import { publishGate } from "../seo/advisor/publish-gate"

// Drafts are read a page at a time; a shop holds few
const PAGE = 200

export const SEO_GATE_REASON = "seo.publish_gate_blocked"
export const PUBLISH_FAILED_REASON = "publish_schedule.failed"

export interface PublishDueResult {
  published: string[]
  held: string[]
  failed: string[]
}

async function draftsWithPlans(container: MedusaContainer): Promise<ScheduledProduct[]> {
  const products = container.resolve(Modules.PRODUCT)
  const drafts: ScheduledProduct[] = []
  for (let skip = 0; ; skip += PAGE) {
    const page = await products.listProducts(
      { status: "draft" },
      { select: ["id", "status", "metadata"], take: PAGE, skip, order: { id: "ASC" } }
    )
    drafts.push(...(page as ScheduledProduct[]))
    if (page.length < PAGE) {
      return drafts
    }
  }
}

async function audit(container: MedusaContainer, productId: string, action: string) {
  await container
    .resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
    .record({
      kind: "system",
      action,
      resource_type: "product",
      resource_id: productId,
      outcome: 200,
      changes: {},
    })
    .catch((error: unknown) => {
      logger.warn({ event: "catalog.publish_schedule_audit_failed", err: errorSummary(error) })
    })
}

/**
 * Publishes the drafts whose planned moment has come (S2), each through
 * Medusa's own product update, so the address registry, the search index,
 * the SEO advisor and the sitemap see a publish as by hand. The SEO
 * publish gate holds as it does for a person (docs/14 §2): a held product
 * stays a draft, its plan cleared and the reason kept for the product
 * page. One product's failure costs that product only.
 */
export async function publishDueProducts(
  container: MedusaContainer,
  now: number = Date.now()
): Promise<PublishDueResult> {
  const due = dueForPublish(await draftsWithPlans(container), now)
  const result: PublishDueResult = { published: [], held: [], failed: [] }
  if (due.length === 0) {
    return result
  }
  const isBlocked = await publishGate(container)
  for (const product of due) {
    const metadata: Metadata = product.metadata ?? {}
    try {
      if (isBlocked && (await isBlocked(product.id))) {
        const failure = { at: new Date(now).toISOString(), reason: SEO_GATE_REASON }
        await updateProductsWorkflow(container).run({
          input: {
            selector: { id: product.id },
            update: { metadata: withFailure(metadata, failure) },
          },
        })
        result.held.push(product.id)
        await audit(container, product.id, "catalog.publish_schedule_held")
        continue
      }
      await updateProductsWorkflow(container).run({
        input: {
          selector: { id: product.id },
          update: { status: "published", metadata: withoutSchedule(metadata) },
        },
      })
      result.published.push(product.id)
      await audit(container, product.id, "catalog.publish_schedule_published")
    } catch (error) {
      result.failed.push(product.id)
      logger.error({
        event: "catalog.publish_schedule_failed",
        product_id: product.id,
        err: errorSummary(error),
      })
      // Not tried again each minute: the page says it did not go live
      const failure = { at: new Date(now).toISOString(), reason: PUBLISH_FAILED_REASON }
      await container
        .resolve(Modules.PRODUCT)
        .updateProducts(product.id, { metadata: withFailure(metadata, failure) })
        .catch((cause: unknown) => {
          logger.error({ event: "catalog.publish_schedule_mark_failed", err: errorSummary(cause) })
        })
    }
  }
  return result
}
