/**
 * Medusa's own routes round the wholesale module (ADR-0068 §9): a write
 * through them to a group or price list the module owns would put a
 * customer in a wholesale group unasked and unrecorded, or change prices
 * the module writes. Each such route is named here with what it is
 * checked by; `api/http/wholesale-guard.ts` applies them, and a unit test
 * holds every Medusa write route under these paths to the list.
 */

export interface OwnedRecords {
  priceListIds: ReadonlySet<string>
  groupIds: ReadonlySet<string>
}

export type GuardCheck =
  /** `:id` is a customer group. */
  | "group"
  /** `:id` is a price list; a list's new rules are checked too. */
  | "price_list"
  /** The body adds or removes groups (`add`, `remove`). */
  | "memberships"
  /** The body's `rules` name customer groups (a new list). */
  | "rules"

export interface GuardedRoute {
  matcher: string
  check: GuardCheck
}

export const GROUPS_RULE = "customer.groups.id"

export const GUARDED_ROUTES: readonly GuardedRoute[] = [
  { matcher: "/admin/customer-groups/:id", check: "group" },
  { matcher: "/admin/customer-groups/:id/*", check: "group" },
  { matcher: "/admin/customers/:id/customer-groups", check: "memberships" },
  { matcher: "/admin/price-lists", check: "rules" },
  { matcher: "/admin/price-lists/:id", check: "price_list" },
  { matcher: "/admin/price-lists/:id/*", check: "price_list" },
]

const strings = (value: unknown): string[] => {
  if (typeof value === "string") {
    return [value]
  }
  return Array.isArray(value)
    ? value.filter((each): each is string => typeof each === "string")
    : []
}

/** The groups a list's rules name: `{ "customer.groups.id": [ids] }`, or one id. */
export function groupsOfRules(rules: unknown): string[] {
  if (typeof rules !== "object" || rules === null) {
    return []
  }
  return strings((rules as Record<string, unknown>)[GROUPS_RULE])
}

/** The groups a membership change names: `{ add: [ids], remove: [ids] }`. */
export function groupsOfMemberships(body: unknown): string[] {
  const { add, remove } = (body ?? {}) as { add?: unknown; remove?: unknown }
  return [...strings(add), ...strings(remove)]
}

export interface GuardRequest {
  method: string
  /** The route's `:id`, when it has one. */
  id: string | undefined
  body: unknown
}

/** Whether this request writes a record the wholesale module owns. Reads always pass. */
export function touchesOwned(check: GuardCheck, request: GuardRequest, owned: OwnedRecords) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) {
    return false
  }
  const ownGroup = (id: string) => owned.groupIds.has(id)
  const body = (request.body ?? {}) as { rules?: unknown }
  switch (check) {
    case "group":
      return request.id !== undefined && ownGroup(request.id)
    case "memberships":
      return groupsOfMemberships(request.body).some(ownGroup)
    case "rules":
      return groupsOfRules(body.rules).some(ownGroup)
    case "price_list":
      return (
        (request.id !== undefined && owned.priceListIds.has(request.id)) ||
        groupsOfRules(body.rules).some(ownGroup)
      )
  }
}
