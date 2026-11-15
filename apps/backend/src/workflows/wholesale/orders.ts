import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import WholesaleOrderLink from "../../links/wholesale-account-order"
import { WHOLESALE_MODULE } from "../../modules/wholesale"
import { wholesale } from "./steps/account-rows"

/**
 * Wholesale orders (ADR-0068 Ek 2026-11-15 (2)): stamped when placed
 * (`subscribers/wholesale-order-stamp.ts` on `order.placed`), read by the
 * order lists. The stamp is a module link order ↔ wholesaler
 * (`links/wholesale-account-order.ts`), written by the server only.
 */

type Container = Pick<MedusaContainer, "resolve">

interface LinkRow {
  order_id?: string | null
  wholesale_account_id?: string | null
}

const time = (value: Date | string | null | undefined) => (value ? new Date(value).getTime() : null)

/**
 * Whether the account sold at wholesale at that moment: bound and active
 * by then, not closed before it. Read from the account's own dates, so a
 * stamp written a little after the order (the event's subscriber) decides
 * as of the order's placing, not of now.
 */
export function wholesaleAt(
  account: {
    status: string
    activated_at?: Date | string | null
    deactivated_at?: Date | string | null
  },
  placedAt: Date | string
): boolean {
  const placed = new Date(placedAt).getTime()
  const activated = time(account.activated_at)
  const closed = time(account.deactivated_at)
  if (account.status === "pending" || activated === null || activated > placed) {
    return false
  }
  return closed === null || closed > placed
}

/**
 * The order linked to the wholesaler its customer was when it was placed;
 * null for a retail order. A second run (a repeated event) finds the link
 * and writes nothing.
 */
export async function stampWholesaleOrder(
  container: Container,
  orderId: string
): Promise<{ order_id: string; account_id: string } | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "customer_id", "created_at"],
    filters: { id: orderId },
  })
  const order = data[0] as { customer_id?: string | null; created_at?: Date | string } | undefined
  if (!order?.customer_id || !order.created_at) {
    return null
  }
  const placedAt = order.created_at
  const [account] =
    // Deleted ones too: one deleted after the order still sold at wholesale when it was placed
    // (review L4); its closing time, written on deletion, decides
    (
      await wholesale(container).listWholesaleAccounts(
        { customer_id: order.customer_id },
        {
          select: ["id", "status", "activated_at", "deactivated_at"],
          take: null,
          withDeleted: true,
        }
      )
    ).filter((each) => wholesaleAt(each, placedAt))
  if (!account) {
    return null
  }
  if ((await wholesaleOrders(container, { order_ids: [orderId] })).size > 0) {
    return null
  }
  await container.resolve(ContainerRegistrationKeys.LINK).create({
    [Modules.ORDER]: { order_id: orderId },
    [WHOLESALE_MODULE]: { wholesale_account_id: account.id },
  })
  return { order_id: orderId, account_id: account.id }
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
    {
      select: ["id", "customer_id", "company_name", "contact_name", "deleted_at"],
      take: null,
      withDeleted: true,
    }
  )
  // A deleted wholesaler is named by the company kept on its row only (review L2): never the
  // customer record it no longer belongs to, whose names may be a person's
  const live = accounts.filter((account) => !account.deleted_at)
  const customerIds = live.flatMap((account) => account.customer_id ?? [])
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
      if (account.deleted_at) {
        return [account.id, account.company_name?.trim() ? account.company_name.trim() : null]
      }
      const customer = account.customer_id ? customers.get(account.customer_id) : undefined
      const person = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ")
      const name = [customer?.company_name, person, account.company_name, account.contact_name]
        .map((text) => text?.trim() ?? "")
        .find((text) => text !== "")
      return [account.id, name ?? null]
    })
  )
}
