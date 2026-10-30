import type { ICustomerModuleService, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { ACCOUNTING_MODULE } from "../../../modules/accounting"
import type AccountingModuleService from "../../../modules/accounting/service"
import { RETURN_REQUESTS_MODULE } from "../../../modules/return-requests"
import type ReturnRequestsModuleService from "../../../modules/return-requests/service"

type Container = Pick<MedusaContainer, "resolve">

/** An order this recent that is neither delivered nor canceled is still under way. */
const OPEN_ORDER_DAYS = 90

/**
 * The customer's records: the one the request names and the guest records
 * under the same e-mail (orders placed while signed out). A request is the
 * person's, whichever record holds their data.
 */
export async function customerRecords(container: Container, customerId: string) {
  const customers = container.resolve<ICustomerModuleService>(Modules.CUSTOMER)
  const [named] = await customers.listCustomers(
    { id: customerId },
    { select: ["id", "email"], take: 1, withDeleted: true }
  )
  const email = named?.email.trim()
  if (!email) {
    return [customerId]
  }
  const same = await customers.listCustomers(
    { email: [...new Set([email, email.toLowerCase()])], has_account: false },
    { select: ["id"], withDeleted: true }
  )
  return [...new Set([customerId, ...same.map((row) => row.id)])]
}

/**
 * Why the customer cannot be erased yet, or null (adr/0041 §6): an order
 * still under way would lose the address it ships to, a return its notes,
 * the books a sale not yet sent to the accounting program.
 */
export async function erasureBlocker(
  container: Container,
  customerIds: string[],
  now: Date
): Promise<string | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "status", "created_at", "fulfillments.delivered_at", "fulfillments.canceled_at"],
    filters: { customer_id: customerIds },
  })
  const orders = data as unknown as {
    id: string
    status: string
    created_at: string | Date
    fulfillments?: ({ delivered_at?: unknown; canceled_at?: unknown } | null)[] | null
  }[]
  const since = now.getTime() - OPEN_ORDER_DAYS * 86_400_000
  // Delivered: it went out and every parcel arrived (Medusa's own status is not read)
  const delivered = (order: (typeof orders)[number]) => {
    const parcels = (order.fulfillments ?? []).filter((parcel) => parcel && !parcel.canceled_at)
    return parcels.length > 0 && parcels.every((parcel) => parcel?.delivered_at)
  }
  const underWay = orders.some(
    (order) =>
      order.status !== "canceled" &&
      !delivered(order) &&
      new Date(order.created_at).getTime() > since
  )
  if (underWay) {
    return "privacy_requests.orders_open"
  }
  const orderIds = orders.map((order) => order.id)
  if (orderIds.length === 0) {
    return null
  }
  const [returns, syncs] = await Promise.all([
    container
      .resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
      .listReturnRequests(
        { order_id: orderIds, status: ["requested", "approved", "received"] },
        { select: ["id"], take: 1 }
      ),
    container
      .resolve<AccountingModuleService>(ACCOUNTING_MODULE)
      .listAccountingSyncs(
        { source_type: ["sale", "cancel"], source_id: orderIds, status: "pending" },
        { select: ["id"], take: 1 }
      ),
  ])
  if (returns.length > 0) {
    return "privacy_requests.returns_open"
  }
  return syncs.length > 0 ? "privacy_requests.accounting_pending" : null
}
