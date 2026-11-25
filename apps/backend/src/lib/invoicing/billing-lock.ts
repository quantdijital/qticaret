import type { MedusaContainer } from "@medusajs/framework/types"
import { EINVOICE_MODULE } from "../../modules/einvoice"
import type EinvoiceModuleService from "../../modules/einvoice/service"

/**
 * A sale invoice in these states names the buyer as it was: its billing
 * address stays. The panel's order page reads the same rule from
 * `/admin/invoices` (`useInvoiced` in people-cards.tsx, PR #413); a pending
 * or failed invoice is drafted later and takes the address as it then is.
 */
export const BILLING_LOCKING_STATUSES = ["issuing", "issued"] as const

/** Whether the order's sale invoice is issued or being issued. */
export async function isBillingLocked(
  container: MedusaContainer,
  orderId: string
): Promise<boolean> {
  const [invoice] = await container
    .resolve<EinvoiceModuleService>(EINVOICE_MODULE)
    .listInvoices(
      { order_id: orderId, kind: "sale", status: [...BILLING_LOCKING_STATUSES] },
      { select: ["id"], take: 1 }
    )
  return Boolean(invoice)
}
