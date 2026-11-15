import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import WholesaleOrderLink from "../../links/wholesale-account-order"
import { WHOLESALE_MODULE } from "../../modules/wholesale"
import { wholesale } from "./steps/account-rows"

/**
 * Wholesale orders (ADR-0068 Ek 2026-11-15 (2)): stamped when placed,
 * read by the order lists. The stamp is a module link order ↔ wholesaler
 * (`links/wholesale-account-order.ts`), written by the server only.
 */

type Container = Pick<MedusaContainer, "resolve">

interface LinkRow {
  order_id?: string | null
  wholesale_account_id?: string | null
}

/** The order's customer's active wholesale account, linked to the order; null for a retail one. */
export async function stampWholesaleOrder(
  container: Container,
  orderId: string
): Promise<{ order_id: string; account_id: string } | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "customer_id"],
    filters: { id: orderId },
  })
  const customerId = (data[0] as { customer_id?: string | null } | undefined)?.customer_id
  if (!customerId) {
    return null
  }
  const [account] = await wholesale(container).listWholesaleAccounts(
    { customer_id: customerId, status: "active" },
    { select: ["id"], take: 1 }
  )
  if (!account) {
    return null
  }
  await container.resolve(ContainerRegistrationKeys.LINK).create({
    [Modules.ORDER]: { order_id: orderId },
    [WHOLESALE_MODULE]: { wholesale_account_id: account.id },
  })
  return { order_id: orderId, account_id: account.id }
}

export async function unstampWholesaleOrder(
  container: Container,
  stamp: { order_id: string; account_id: string }
): Promise<void> {
  await container.resolve(ContainerRegistrationKeys.LINK).dismiss({
    [Modules.ORDER]: { order_id: stamp.order_id },
    [WHOLESALE_MODULE]: { wholesale_account_id: stamp.account_id },
  })
}

/**
 * The wholesale orders among `orderIds` (or of one wholesaler, or all),
 * each with its wholesaler. A shop's wholesale orders are read in one go,
 * as its orders are for the list (`MAX_ORDERS_READ`).
 */
export async function wholesaleOrders(
  container: Container,
  filters: { order_ids?: string[]; account_id?: string }
): Promise<Map<string, string>> {
  if (filters.order_ids?.length === 0) {
    return new Map()
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: WholesaleOrderLink.entryPoint,
    fields: ["order_id", "wholesale_account_id"],
    filters: {
      ...(filters.order_ids ? { order_id: filters.order_ids } : {}),
      ...(filters.account_id ? { wholesale_account_id: filters.account_id } : {}),
    },
  })
  return new Map(
    (data as LinkRow[]).flatMap((row) =>
      row.order_id && row.wholesale_account_id ? [[row.order_id, row.wholesale_account_id]] : []
    )
  )
}

/** The wholesalers' names for the list: the company, else the contact, from the customer record. */
export async function wholesalerNames(
  container: Container,
  accountIds: string[]
): Promise<Map<string, string | null>> {
  const ids = [...new Set(accountIds)]
  if (ids.length === 0) {
    return new Map()
  }
  const accounts = await wholesale(container).listWholesaleAccounts(
    { id: ids },
    { select: ["id", "customer_id", "company_name", "contact_name"], take: null, withDeleted: true }
  )
  const customerIds = accounts.flatMap((account) => account.customer_id ?? [])
  const { data } = customerIds.length
    ? await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "customer",
        fields: ["id", "company_name", "first_name", "last_name"],
        filters: { id: customerIds },
      })
    : { data: [] }
  const customers = new Map(
    (
      data as {
        id: string
        company_name?: string | null
        first_name?: string | null
        last_name?: string | null
      }[]
    ).map((row) => [row.id, row])
  )
  return new Map(
    accounts.map((account) => {
      const customer = account.customer_id ? customers.get(account.customer_id) : undefined
      const person = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ")
      const name = [customer?.company_name, person, account.company_name, account.contact_name]
        .map((text) => text?.trim() ?? "")
        .find((text) => text !== "")
      return [account.id, name ?? null]
    })
  )
}
