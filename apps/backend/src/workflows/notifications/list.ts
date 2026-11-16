import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { feedFilters, isUnread, readFloor, readStateOf } from "../../lib/notifications/feed"
import type { AlertGroup, AlertState, ReadState } from "../../lib/notifications/feed"
import { wholesalerNames } from "../wholesale/orders"

type Container = Pick<MedusaContainer, "resolve">

export interface AlertRow {
  id: string
  created_at: Date | string
  data: Record<string, unknown> | null
  read: boolean
}

export interface AlertPage {
  notifications: AlertRow[]
  count: number
  /** The person's unread alerts, whatever the page's filters: the bell's number. */
  unread: number
  offset: number
  limit: number
}

/** Who reads, and what their user record keeps of it. */
export async function readerOf(
  container: Container,
  userId: string
): Promise<{ state: ReadState; floor: Date | null; metadata: Record<string, unknown> }> {
  const user = await container
    .resolve(Modules.USER)
    .retrieveUser(userId, { select: ["id", "created_at", "metadata"] })
  const metadata = user.metadata ?? {}
  const state = readStateOf(metadata)
  return { state, floor: readFloor(state, user.created_at), metadata }
}

/**
 * A wholesaler's order names its wholesaler as the order lists do (closed
 * and erased ones too), read now: the row itself keeps only the ids.
 */
async function withWholesalers(container: Container, rows: AlertRow[]): Promise<AlertRow[]> {
  const accounts = rows.flatMap((row) =>
    row.data?.["kind"] === "wholesale_order" && typeof row.data["account_id"] === "string"
      ? [row.data["account_id"]]
      : []
  )
  if (accounts.length === 0) {
    return rows
  }
  const names = await wholesalerNames(container, accounts)
  return rows.map((row) => {
    const account = row.data?.["account_id"]
    if (row.data?.["kind"] !== "wholesale_order" || typeof account !== "string") {
      return row
    }
    return { ...row, data: { ...row.data, company: names.get(account) ?? null } }
  })
}

/**
 * One person's page of the shop's alerts (adr/0020), newest first: read
 * or not by them, filtered by group, without the kinds their role does
 * not see (a wholesaler's order for a role that sees no wholesalers).
 */
export async function listAlerts(
  container: Container,
  input: {
    userId: string
    seesWholesale: boolean
    state: AlertState
    group: AlertGroup | null
    offset: number
    limit: number
  }
): Promise<AlertPage> {
  const { state, floor } = await readerOf(container, input.userId)
  const service = container.resolve(Modules.NOTIFICATION)
  const page = feedFilters({
    state: input.state,
    group: input.group,
    readState: state,
    floor,
    seesWholesale: input.seesWholesale,
  })
  const unreadFilter = feedFilters({
    state: "unread",
    group: null,
    readState: state,
    floor,
    seesWholesale: input.seesWholesale,
  })
  const select = ["id", "created_at", "data"]
  const [[rows, count], unread] = await Promise.all([
    page
      ? service.listAndCountNotifications(page, {
          select,
          order: { created_at: "DESC" },
          skip: input.offset,
          take: input.limit,
        })
      : Promise.resolve([[], 0] as [never[], number]),
    unreadFilter
      ? service.listAndCountNotifications(unreadFilter, { select: ["id"], take: 1 })
      : Promise.resolve([[], 0] as [never[], number]),
  ])
  const shaped = rows.map((row) => ({
    id: row.id,
    created_at: row.created_at,
    data: row.data ?? null,
    read: !isUnread(row, state, floor),
  }))
  return {
    notifications: await withWholesalers(container, shaped),
    count,
    unread: unread[1],
    offset: input.offset,
    limit: input.limit,
  }
}
