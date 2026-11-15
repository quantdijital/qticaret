/**
 * Medusa's own routes round the wholesale module (ADR-0068 §9): a write
 * through them to a group or price list the module owns would put a
 * customer in a wholesale group unasked and unrecorded, or change prices
 * the module writes; a price whose own rule names a wholesale group would
 * price its members outside the module. A read of the module's group or
 * list is answered as missing: its members and prices are the owner's and
 * admin's, read through the wholesale screens. Each route is named here
 * with what it is checked by; `api/http/wholesale-guard.ts` applies them,
 * and a unit test holds every Medusa write route under these paths to it.
 */

export interface OwnedRecords {
  priceListIds: ReadonlySet<string>
  groupIds: ReadonlySet<string>
}

export type GuardCheck =
  /** `:id` is a customer group; read or written, the module's is refused. */
  | "group"
  /** `:id` is a price list, likewise; any rule in the body is checked too. */
  | "price_list"
  /** The body adds or removes groups (`add`, `remove`). */
  | "memberships"
  /** Any rule in the body (a new list's, a price's) naming a customer group. */
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
  // A variant's own prices may carry rules too (Medusa's `rules` on a price)
  { matcher: "/admin/products", check: "rules" },
  { matcher: "/admin/products/*", check: "rules" },
]

/** The checks that also answer a read of the module's record as missing. */
export const READ_GUARDED: ReadonlySet<GuardCheck> = new Set(["group", "price_list"])

/**
 * The ids a rule's value names, in each form Medusa takes: one id, a list
 * of ids, `{ operator, value }`, or a list of those.
 */
function idsOf(value: unknown, depth = 0): string[] {
  if (depth > 3) {
    return []
  }
  if (typeof value === "string") {
    return [value]
  }
  if (Array.isArray(value)) {
    return value.flatMap((each) => idsOf(each, depth + 1))
  }
  if (typeof value === "object" && value !== null) {
    return idsOf((value as { value?: unknown }).value, depth + 1)
  }
  return []
}

/** The groups one set of rules names: `{ "customer.groups.id": … }`. */
export function groupsOfRules(rules: unknown): string[] {
  if (typeof rules !== "object" || rules === null || Array.isArray(rules)) {
    return []
  }
  return idsOf((rules as Record<string, unknown>)[GROUPS_RULE])
}

// A product body nests prices under variants; a batch under create/update
const MAX_DEPTH = 8

/** The groups every `rules` anywhere in a body names: a list's, its prices', variants' prices'. */
export function groupsInBody(body: unknown, depth = 0): string[] {
  if (depth > MAX_DEPTH || typeof body !== "object" || body === null) {
    return []
  }
  if (Array.isArray(body)) {
    return body.flatMap((each) => groupsInBody(each, depth + 1))
  }
  return Object.entries(body).flatMap(([key, value]) =>
    key === "rules"
      ? [...groupsOfRules(value), ...groupsInBody(value, depth + 1)]
      : groupsInBody(value, depth + 1)
  )
}

/** The groups a membership change names: `{ add: [ids], remove: [ids] }`. */
export function groupsOfMemberships(body: unknown): string[] {
  const { add, remove } = (body ?? {}) as { add?: unknown; remove?: unknown }
  return [...idsOf(add), ...idsOf(remove)]
}

export interface GuardRequest {
  method: string
  /** The route's `:id`, when it has one. */
  id: string | undefined
  body: unknown
}

const isRead = (method: string) => ["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())

/** Whether this request writes a record the wholesale module owns, or a rule naming one. */
export function touchesOwned(check: GuardCheck, request: GuardRequest, owned: OwnedRecords) {
  if (isRead(request.method)) {
    return false
  }
  const ownGroup = (id: string) => owned.groupIds.has(id)
  const ruled = () => groupsInBody(request.body).some(ownGroup)
  switch (check) {
    case "group":
      return request.id !== undefined && ownGroup(request.id)
    case "memberships":
      return groupsOfMemberships(request.body).some(ownGroup)
    case "rules":
      return ruled()
    case "price_list":
      return (request.id !== undefined && owned.priceListIds.has(request.id)) || ruled()
  }
}

/** Whether this request reads the module's group or list by its id: answered as missing. */
export function readsOwned(check: GuardCheck, request: GuardRequest, owned: OwnedRecords) {
  if (!isRead(request.method) || request.id === undefined || !READ_GUARDED.has(check)) {
    return false
  }
  return check === "group" ? owned.groupIds.has(request.id) : owned.priceListIds.has(request.id)
}
