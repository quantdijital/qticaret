/**
 * A wholesaler's account (ADR-0068 §3, §10): its invitation's life, the
 * name moved to the customer record, and the groups its customer is in.
 * Pure: the workflows read and write, these decide.
 */

export type AccountStatus = "pending" | "active" | "inactive"

/** An invitation not taken up is deleted after this many days (decision 13); a resend starts it again. */
export const INVITE_DAYS = 90

const DAY = 24 * 60 * 60 * 1000

/** When an invitation sent at `invitedAt` stops being taken up. */
export const inviteExpiresAt = (invitedAt: Date): Date =>
  new Date(invitedAt.getTime() + INVITE_DAYS * DAY)

/** Whether an invitation may still be taken up at `now`. */
export const isInviteLive = (invitedAt: Date | string | null, now: Date): boolean =>
  invitedAt !== null && inviteExpiresAt(new Date(invitedAt)) > now

/** The cut-off: a pending account invited before it is past its 90 days. */
export const inviteCutoff = (now: Date): Date => new Date(now.getTime() - INVITE_DAYS * DAY)

/** An address as accounts are kept and matched: trimmed, lower case. */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase()

/** "Ayşe Nur Yılmaz" → first "Ayşe Nur", last "Yılmaz"; one word is a first name. */
export function splitContactName(name: string | null | undefined): {
  first_name: string | null
  last_name: string | null
} {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) {
    return { first_name: null, last_name: null }
  }
  if (words.length === 1) {
    return { first_name: words[0] ?? null, last_name: null }
  }
  return { first_name: words.slice(0, -1).join(" "), last_name: words.at(-1) ?? null }
}

export interface CustomerNames {
  first_name: string | null
  last_name: string | null
  company_name: string | null
}

const blank = (value: string | null | undefined) => (value ?? "").trim() === ""

/**
 * What the account's company and contact give the customer record once
 * it is active (ADR-0068 §1): only the fields it has left blank. The
 * customer's own words are never overwritten.
 */
export function namesToFill(
  customer: CustomerNames,
  account: { company_name: string | null; contact_name: string | null }
): Partial<CustomerNames> {
  const contact = splitContactName(account.contact_name)
  const fill: Partial<CustomerNames> = {}
  if (blank(customer.company_name) && !blank(account.company_name)) {
    fill.company_name = account.company_name?.trim() ?? null
  }
  if (blank(customer.first_name) && blank(customer.last_name) && contact.first_name) {
    fill.first_name = contact.first_name
    fill.last_name = contact.last_name
  }
  return fill
}

/** The groups an account's customer belongs to: its level's and its own; none unless active. */
export function desiredGroups(input: {
  status: AccountStatus
  tierGroupId: string | null
  privateGroupId: string | null
}): string[] {
  if (input.status !== "active") {
    return []
  }
  return [input.tierGroupId, input.privateGroupId].filter((id): id is string => !!id)
}

export interface MembershipPlan {
  add: string[]
  remove: string[]
}

/**
 * From the customer's groups now to the account's: a wholesale group it
 * should not be in goes, one it should be in comes. An active wholesaler
 * leaves every segment's group too (Ek 2026-11-15 4: a segment's list
 * ties with the level's), so a cheaper segment price never reaches them.
 */
export function membershipPlan(input: {
  current: readonly string[]
  wholesale: ReadonlySet<string>
  segments: ReadonlySet<string>
  desired: readonly string[]
}): MembershipPlan {
  const current = new Set(input.current)
  const desired = new Set(input.desired)
  const add = [...desired].filter((id) => !current.has(id))
  const remove = [...current].filter(
    (id) =>
      (input.wholesale.has(id) && !desired.has(id)) ||
      (desired.size > 0 && input.segments.has(id) && !desired.has(id))
  )
  return { add: add.sort(), remove: remove.sort() }
}

export const isEmptyMembershipPlan = (plan: MembershipPlan): boolean =>
  plan.add.length + plan.remove.length === 0

/** What may be done to an account in each state (ADR-0068 §3). */
export const ACCOUNT_ACTIONS = {
  deactivate: ["active"],
  reactivate: ["inactive"],
  resend: ["pending"],
  delete: ["pending"],
} as const satisfies Record<string, readonly AccountStatus[]>

export type AccountAction = keyof typeof ACCOUNT_ACTIONS

export const allows = (action: AccountAction, status: AccountStatus): boolean =>
  (ACCOUNT_ACTIONS[action] as readonly AccountStatus[]).includes(status)

/** An account sells at wholesale through its level, its own list, or both; never neither. */
export const hasPriceSource = (account: {
  tier_id: string | null
  private_price_list_id: string | null
}): boolean => account.tier_id !== null || account.private_price_list_id !== null
