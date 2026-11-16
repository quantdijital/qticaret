import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { visibleTriggers } from "../../lib/notifications/access"
import {
  READ_STATE_KEY,
  feedFilters,
  isUnread,
  readFloor,
  readStateOf,
} from "../../lib/notifications/feed"
import type { AlertGroup, AlertState, ReadState } from "../../lib/notifications/feed"
import { STAFF_ROLES_MODULE } from "../../modules/staff-roles"
import type StaffRolesModuleService from "../../modules/staff-roles/service"
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

/** The bell's few newest alerts; the page has the rest. */
export const BELL_SIZE = 20

/**
 * Who reads: what their user record keeps of it, and the alert kinds their
 * role does not get, the role read here on the server (adr/0040).
 */
export async function readerOf(
  container: Container,
  userId: string
): Promise<{ state: ReadState; floor: Date | null; visible: string[] | null; stored: unknown }> {
  const [user, role] = await Promise.all([
    container
      .resolve(Modules.USER)
      .retrieveUser(userId, { select: ["id", "created_at", "metadata"] }),
    container.resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE).roleOf(userId),
  ])
  const state = readStateOf(user.metadata)
  return {
    state,
    floor: readFloor(state, user.created_at),
    visible: visibleTriggers(role),
    // The state as kept, for a mark to put back if it fails
    stored: user.metadata?.[READ_STATE_KEY],
  }
}

const WHOLESALE_KIND = "wholesale_order"

/**
 * A wholesaler's order names its wholesaler as the order lists do (closed
 * and erased ones too), read now: the row itself keeps only the ids.
 * Whether any was named: such a page is a recorded read (adr/0011).
 */
async function withWholesalers(
  container: Container,
  rows: AlertRow[]
): Promise<{ rows: AlertRow[]; named: boolean }> {
  const accounts = rows.flatMap((row) =>
    row.data?.["kind"] === WHOLESALE_KIND && typeof row.data["account_id"] === "string"
      ? [row.data["account_id"]]
      : []
  )
  if (accounts.length === 0) {
    return { rows, named: false }
  }
  const names = await wholesalerNames(container, accounts)
  return {
    named: true,
    rows: rows.map((row) => {
      const account = row.data?.["account_id"]
      if (row.data?.["kind"] !== WHOLESALE_KIND || typeof account !== "string") {
        return row
      }
      return { ...row, data: { ...row.data, company: names.get(account) ?? null } }
    }),
  }
}

/**
 * What a row never shows, on the page or in the bell: a contact message's
 * server-worded Turkish texts, which older rows wrote with the sender's
 * name (the panel words it from the subject).
 */
const LEFT_OUT: Readonly<Record<string, readonly string[]>> = {
  contact_message: ["title", "description"],
}

/** The bell leaves a wholesaler's out too (its account; the page names the company). */
const BELL_LEAVES_OUT: Readonly<Record<string, readonly string[]>> = {
  ...LEFT_OUT,
  [WHOLESALE_KIND]: ["account_id", "company"],
}

function without(
  data: Record<string, unknown> | null,
  table: Readonly<Record<string, readonly string[]>>
): Record<string, unknown> | null {
  const out = data ? table[String(data["kind"])] : undefined
  if (!data || !out) {
    return data
  }
  return Object.fromEntries(Object.entries(data).filter(([key]) => !out.includes(key)))
}

const bellData = (data: Record<string, unknown> | null) => without(data, BELL_LEAVES_OUT)

type Reader = Awaited<ReturnType<typeof readerOf>>

async function page(
  container: Container,
  reader: Reader,
  input: { state: AlertState; group: AlertGroup | null; offset: number; limit: number }
) {
  const service = container.resolve(Modules.NOTIFICATION)
  const seen = { readState: reader.state, floor: reader.floor, visible: reader.visible }
  const filters = feedFilters({ ...seen, state: input.state, group: input.group })
  const unreadFilters = feedFilters({ ...seen, state: "unread", group: null })
  const [[rows, count], [, unread]] = await Promise.all([
    filters
      ? service.listAndCountNotifications(filters, {
          select: ["id", "created_at", "data"],
          order: { created_at: "DESC" },
          skip: input.offset,
          take: input.limit,
        })
      : Promise.resolve([[], 0] as [never[], number]),
    unreadFilters
      ? service.listAndCountNotifications(unreadFilters, { select: ["id"], take: 1 })
      : Promise.resolve([[], 0] as [never[], number]),
  ])
  const shaped: AlertRow[] = rows.map((row) => ({
    id: row.id,
    created_at: row.created_at,
    data: without(row.data ?? null, LEFT_OUT),
    read: !isUnread(row, reader.state, reader.floor),
  }))
  return { rows: shaped, count, unread }
}

/**
 * One person's page of the shop's alerts (adr/0020), newest first: read
 * or not by them, filtered by group, without the kinds their role does
 * not get. `named`: a wholesaler was named on it, which the route records.
 */
export async function listAlerts(
  container: Container,
  input: {
    userId: string
    state: AlertState
    group: AlertGroup | null
    offset: number
    limit: number
  }
): Promise<AlertPage & { named: boolean }> {
  const reader = await readerOf(container, input.userId)
  const { rows, count, unread } = await page(container, reader, input)
  const named = await withWholesalers(container, rows)
  return {
    notifications: named.rows,
    count,
    unread,
    offset: input.offset,
    limit: input.limit,
    named: named.named,
  }
}

/**
 * The bell (polled every minute): the count and the newest few, with no
 * one's personal data in them, so it is no recorded read and never waits
 * on the audit log. Nothing asked changes that: it takes no parameters.
 */
export async function bellAlerts(
  container: Container,
  userId: string
): Promise<{ notifications: AlertRow[]; unread: number }> {
  const reader = await readerOf(container, userId)
  const { rows, unread } = await page(container, reader, {
    state: "all",
    group: null,
    offset: 0,
    limit: BELL_SIZE,
  })
  return { notifications: rows.map((row) => ({ ...row, data: bellData(row.data) })), unread }
}
