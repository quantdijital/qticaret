import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  USAGE_REPORT_VERSION,
  usagePeriodOf,
  usageReportSchema,
} from "@qticaret/types/control-plane"
import type { UsageReport } from "@qticaret/types/control-plane"
import { CONTENT_DRAFTS_MODULE } from "../../modules/content-drafts"
import type ContentDraftsModuleService from "../../modules/content-drafts/service"
import { MEDIA_MODULE } from "../../modules/media"
import type MediaModuleService from "../../modules/media/service"
import type { Release } from "./release"

/**
 * The shop's hourly usage report's numbers (adr/0061 §5.4, Ek C13): totals
 * only, each one cheap (a count of one row read, one sum). No person,
 * address, e-mail, order line or amount is read, and the report's strict
 * schema could carry none (`usageReportSchema`; monthly revenue is not
 * sent, the owner's decision).
 */

const HOUR_MS = 60 * 60 * 1000
// Turkey has kept UTC+3 all year since 2016 (lib/dashboard/period.ts)
const TURKEY_OFFSET_MS = 3 * HOUR_MS
const MB = 1024 * 1024
// Orders that are not orders yet, or no more (the dashboard's own list)
const NOT_ORDERS = ["draft", "archived"]

/** The calendar month in Turkey at `now`, `YYYY-MM` (the contract's rule, both ends). */
export const turkishMonth = (now: Date): string => usagePeriodOf(now)

/** The instant the month in Turkey began, at `now`. */
export function startOfTurkishMonth(now: Date): Date {
  const local = new Date(now.getTime() + TURKEY_OFFSET_MS)
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - TURKEY_OFFSET_MS)
}

/** Stored bytes as whole megabytes, rounded up: a started megabyte counts (the limit's unit). */
export const megabytesOf = (bytes: number): number => (bytes <= 0 ? 0 : Math.ceil(bytes / MB))

export interface UsageCounts {
  products: number
  orders_this_month: number
  staff: number
  storage_mb: number
  llm_credits_this_month: number
  last_order_at: Date | null
}

/**
 * The counts, read now. Products: every product not deleted (drafts too:
 * they are what the `products` limit counts). Orders: placed this Turkish
 * month, drafts and archived left out. Staff: the shop's users. Storage:
 * the media library's stored masters. LLM: content drafts counted in the
 * month's row (adr/0005: one draft, one credit).
 */
type Resolver = Pick<MedusaContainer, "resolve">

const ORDERS = { status: { $nin: NOT_ORDERS }, is_draft_order: false }

// One count each, shared with the plan limits' checks (adr/0061 Ek C14)

/** Products not deleted, drafts too. */
export const countProducts = (container: Resolver): Promise<number> =>
  container
    .resolve(Modules.PRODUCT)
    .listAndCountProducts({}, { select: ["id"], take: 1 })
    .then(([, count]) => count)

/** Orders placed this Turkish month, drafts and archived left out. */
export const countOrdersThisMonth = (container: Resolver, now: Date): Promise<number> =>
  container
    .resolve(ContainerRegistrationKeys.QUERY)
    .graph({
      entity: "order",
      fields: ["id"],
      filters: { ...ORDERS, created_at: { $gte: startOfTurkishMonth(now) } },
      pagination: { skip: 0, take: 1 },
    })
    .then((answer) => answer.metadata?.count ?? answer.data.length)

/** The shop's users. */
export const countStaff = (container: Resolver): Promise<number> =>
  container
    .resolve(Modules.USER)
    .listAndCountUsers({}, { select: ["id"], take: 1 })
    .then(([, count]) => count)

/** The media library's stored masters, in bytes. */
export const storedBytes = (container: Resolver): Promise<number> =>
  container.resolve<MediaModuleService>(MEDIA_MODULE).storedBytes()

/** Content drafts counted this Turkish month (adr/0005: one draft, one credit). */
export const draftsThisMonth = (container: Resolver, now: Date): Promise<number> =>
  container.resolve<ContentDraftsModuleService>(CONTENT_DRAFTS_MODULE).usedIn(turkishMonth(now))

export async function readUsageCounts(container: Resolver, now: Date): Promise<UsageCounts> {
  const [products, monthOrders, lastOrder, staff, bytes, drafts] = await Promise.all([
    countProducts(container),
    countOrdersThisMonth(container, now),
    container
      .resolve(ContainerRegistrationKeys.QUERY)
      .graph({
        entity: "order",
        fields: ["created_at"],
        filters: ORDERS,
        pagination: { skip: 0, take: 1, order: { created_at: "DESC" } },
      })
      .then((answer) => (answer.data[0] as { created_at?: Date | string } | undefined)?.created_at),
    countStaff(container),
    storedBytes(container),
    draftsThisMonth(container, now),
  ])
  return {
    products,
    orders_this_month: monthOrders,
    staff,
    storage_mb: megabytesOf(bytes),
    llm_credits_this_month: drafts,
    last_order_at: lastOrder ? new Date(lastOrder) : null,
  }
}

/**
 * The report as sent: built from the counts and checked against the
 * contract's strict schema before it leaves (a shape the control plane
 * would refuse is not sent). Throws on a report that does not pass.
 */
export function buildUsageReport(
  tenantId: string,
  counts: UsageCounts,
  release: Release,
  now: Date
): UsageReport {
  return usageReportSchema.parse({
    version: USAGE_REPORT_VERSION,
    tenant_id: tenantId,
    reported_at: now.toISOString(),
    period: turkishMonth(now),
    counts: {
      products: counts.products,
      orders_this_month: counts.orders_this_month,
      staff: counts.staff,
      storage_mb: counts.storage_mb,
      llm_credits_this_month: counts.llm_credits_this_month,
    },
    last_order_at: counts.last_order_at ? counts.last_order_at.toISOString() : null,
    release: { version: release.version, commit: release.commit },
  })
}
