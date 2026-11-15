/**
 * A wholesaler's account (ADR-0068 §3, §10): its invitation's life, the
 * name moved to the customer record, and the groups its customer is in.
 * Pure: the workflows read and write, these decide.
 */

export type AccountStatus = "pending" | "active" | "inactive"

/** An invitation not taken up is deleted after this many days (decision 13); a resend starts it again. */
export const INVITE_DAYS = 90

/**
 * However often it is resent, an invitation ends this many days after the
 * account was opened (its first invitation): a resend restarts the 90 days
 * up to this cap, never past it (security review L2).
 */
export const INVITE_CAP_DAYS = 180

/** Resends one invitation may have (the first send not counted). */
export const MAX_RESENDS = 5

/** The shortest time between two sends of one invitation. */
export const RESEND_COOLDOWN_MS = 60 * 60 * 1000

const DAY = 24 * 60 * 60 * 1000

/** An invitation's sends: the last one and the first (the account's opening). */
export interface InviteDates {
  invitedAt: Date | string | null
  openedAt: Date | string
}

/** When an invitation stops being taken up: 90 days from its last send, at most 180 from the first. */
export function inviteExpiresAt(dates: { invitedAt: Date | string; openedAt: Date | string }) {
  const last = new Date(dates.invitedAt).getTime() + INVITE_DAYS * DAY
  const cap = new Date(dates.openedAt).getTime() + INVITE_CAP_DAYS * DAY
  return new Date(Math.min(last, cap))
}

/** Whether an invitation may still be taken up at `now`. */
export const isInviteLive = (dates: InviteDates, now: Date): boolean =>
  dates.invitedAt !== null &&
  inviteExpiresAt({ invitedAt: dates.invitedAt, openedAt: dates.openedAt }) > now

/** The cut-offs: invited last before the first, or opened before the second, it is past its days. */
export const inviteCutoff = (now: Date): { invitedBefore: Date; openedBefore: Date } => ({
  invitedBefore: new Date(now.getTime() - INVITE_DAYS * DAY),
  openedBefore: new Date(now.getTime() - INVITE_CAP_DAYS * DAY),
})

/**
 * Why a resend is refused now, or null (security review L2): an hour
 * since the last send, five resends at most, and never for an invitation
 * already past its days (it is deleted; open the wholesaler anew).
 */
export function resendRefusal(
  account: { invited_at: Date | string | null; created_at: Date | string; invite_count: number },
  now: Date
): string | null {
  if (!isInviteLive({ invitedAt: account.invited_at, openedAt: account.created_at }, now)) {
    return "wholesale.invite_expired"
  }
  if (account.invite_count > MAX_RESENDS) {
    return "wholesale.invite_limit"
  }
  const last = account.invited_at ? new Date(account.invited_at).getTime() : 0
  return now.getTime() - last < RESEND_COOLDOWN_MS ? "wholesale.invite_too_soon" : null
}

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
