/**
 * The panel's bell and its page (adr/0020): Medusa's `feed` channel, read
 * per staff member. What each one has read is theirs (`ReadState`); the
 * kinds of alert are grouped by the `trigger_type` their writers set.
 */

/** A wholesaler's order (ADR-0068): only for the roles that see wholesalers. */
export const WHOLESALE_ORDER_TRIGGER = "wholesale.order_placed"

/** The groups the page filters by, each the `trigger_type` prefixes that write into it. */
export const ALERT_GROUPS = {
  orders: ["orders.", "returns."],
  wholesale: ["wholesale."],
  payments: ["payments.", "payment_links."],
  stock: ["stock."],
  invoices: ["einvoice.", "accounting."],
  messages: ["contact_message.", "messaging.", "campaigns."],
  system: ["webhooks.", "integration_credentials.", "migration."],
} as const satisfies Record<string, readonly string[]>

export type AlertGroup = keyof typeof ALERT_GROUPS
export const ALERT_GROUP_NAMES = Object.keys(ALERT_GROUPS) as AlertGroup[]

export const ALERT_STATES = ["all", "unread", "read"] as const
export type AlertState = (typeof ALERT_STATES)[number]

/**
 * What one staff member has read: everything up to `until` (the last "all
 * read"), and these ids after it. Kept on their user record's metadata.
 */
export interface ReadState {
  until: string | null
  ids: string[]
}

export const READ_STATE_KEY = "qt_alerts_read"
/** Ids read one by one after the last "all read"; past this the oldest go. */
export const MAX_READ_IDS = 1000

const isoOrNull = (value: unknown): string | null =>
  typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null

/** The state kept on a user's metadata; anything unreadable reads as nothing read. */
export function readStateOf(metadata: Record<string, unknown> | null | undefined): ReadState {
  const raw = metadata?.[READ_STATE_KEY]
  if (!raw || typeof raw !== "object") {
    return { until: null, ids: [] }
  }
  const { until, ids } = raw as { until?: unknown; ids?: unknown }
  return {
    until: isoOrNull(until),
    ids: Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [],
  }
}

/**
 * The floor below which nothing counts as unread: the last "all read", or
 * the day the person joined (a newcomer is not handed the shop's past).
 */
export function readFloor(state: ReadState, joinedAt: Date | string | null): Date | null {
  const times = [state.until, joinedAt]
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter((time) => !Number.isNaN(time))
  return times.length > 0 ? new Date(Math.max(...times)) : null
}

/** These ids read too; the oldest dropped past the cap. */
export function withRead(state: ReadState, ids: readonly string[]): ReadState {
  const merged = [...state.ids, ...ids.filter((id) => !state.ids.includes(id))]
  return { until: state.until, ids: merged.slice(-MAX_READ_IDS) }
}

/** Everything up to `until` read: the ids before it are no longer needed. */
export const allReadUntil = (until: Date): ReadState => ({ until: until.toISOString(), ids: [] })

export function isUnread(
  alert: { id: string; created_at: Date | string },
  state: ReadState,
  floor: Date | null
): boolean {
  if (state.ids.includes(alert.id)) {
    return false
  }
  return floor === null || new Date(alert.created_at).getTime() > floor.getTime()
}

type Filter = Record<string, unknown>

/** Rows with no `trigger_type` are kept by an exclusion: `NOT IN` alone would drop them. */
const notIn = (values: readonly string[]): Filter => ({
  $or: [{ trigger_type: null }, { trigger_type: { $nin: [...values] } }],
})

const unreadFilter = (state: ReadState, floor: Date | null): Filter[] => [
  ...(floor ? [{ created_at: { $gt: floor } }] : []),
  ...(state.ids.length > 0 ? [{ id: { $nin: state.ids } }] : []),
]

/** Null when nothing is read yet: no row can match. */
const readFilter = (state: ReadState, floor: Date | null): Filter | null => {
  const read: Filter[] = [
    ...(floor ? [{ created_at: { $lte: floor } }] : []),
    ...(state.ids.length > 0 ? [{ id: state.ids }] : []),
  ]
  return read.length > 0 ? { $or: read } : null
}

/**
 * The notification module's filter for one person's page of the feed:
 * the group, read or unread, and the kinds their role does not see left
 * out on the server. Null: no row can match (nothing read yet).
 */
export function feedFilters(input: {
  state: AlertState
  group: AlertGroup | null
  readState: ReadState
  floor: Date | null
  seesWholesale: boolean
}): Filter | null {
  const parts: Filter[] = []
  if (input.group) {
    parts.push({
      $or: ALERT_GROUPS[input.group].map((prefix) => ({ trigger_type: { $like: `${prefix}%` } })),
    })
  }
  if (!input.seesWholesale) {
    parts.push(notIn([WHOLESALE_ORDER_TRIGGER]))
  }
  if (input.state === "unread") {
    parts.push(...unreadFilter(input.readState, input.floor))
  } else if (input.state === "read") {
    const read = readFilter(input.readState, input.floor)
    if (!read) {
      return null
    }
    parts.push(read)
  }
  return { channel: "feed", ...(parts.length > 0 ? { $and: parts } : {}) }
}
