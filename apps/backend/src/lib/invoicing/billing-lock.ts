import type { MedusaContainer } from "@medusajs/framework/types"
import { EINVOICE_MODULE } from "../../modules/einvoice"
import type EinvoiceModuleService from "../../modules/einvoice/service"

/** A sale invoice in these states names the buyer as it was: its billing address stays. */
export const BILLING_LOCKING_STATUSES = ["issuing", "issued"] as const

/** Fields that tell whether the provider already holds the invoice's buyer. */
const PROVIDER_FIELDS = [
  "listed_at",
  "reported_at",
  "external_id",
  "job_id",
  "document_id",
] as const

export type BillingLockRow = { status: string } & Partial<
  Record<(typeof PROVIDER_FIELDS)[number], unknown>
>

/**
 * Whether this sale invoice keeps the billing address. Issued or issuing,
 * always. A pending or failed one too once the provider holds its draft:
 * BirFatura pulled it (`listed_at`) or reported it (`reported_at`), or a
 * queued provider made its record (`external_id`, `job_id`, `document_id`);
 * a later try goes on from that record, never with a new address (security
 * review 2026-11-26). Untouched, it is drafted later with the address as it
 * then is. The panel's order page shows the issued/issuing part (PR #413).
 */
export function locksBilling(row: BillingLockRow): boolean {
  if ((BILLING_LOCKING_STATUSES as readonly string[]).includes(row.status)) {
    return true
  }
  if (row.status !== "pending" && row.status !== "failed") {
    return false
  }
  return PROVIDER_FIELDS.some((field) => row[field] !== null && row[field] !== undefined)
}

/** Whether any of the order's sale invoices keeps its billing address. */
export async function isBillingLocked(
  container: MedusaContainer,
  orderId: string
): Promise<boolean> {
  const rows = await container.resolve<EinvoiceModuleService>(EINVOICE_MODULE).listInvoices(
    {
      order_id: orderId,
      kind: "sale",
      status: [...BILLING_LOCKING_STATUSES, "pending", "failed"],
    },
    { select: ["id", "status", ...PROVIDER_FIELDS] }
  )
  return rows.some((row) => locksBilling(row))
}
