import type { ContactRole } from "./kinds"

interface ContactLike {
  id: string
  role: ContactRole
  is_primary_billing: boolean
}

/**
 * Where the primary billing mark goes when a contact is saved (adr/0061
 * §2: one per shop; the payment reminders go to them, C16). Asked for, it
 * moves here from whoever had it; not asked, the contact keeps what it had,
 * and the first contact of a shop that has none gets it (filled in, not
 * asked).
 */
export function primaryOnSave(
  all: readonly ContactLike[],
  contactId: string | null,
  asked: boolean | undefined
): { primary: boolean; demote: string[] } {
  const before = all.find((each) => each.id === contactId)
  const others = all.filter((each) => each.id !== contactId)
  const primary =
    asked ??
    (before?.is_primary_billing === true || !others.some((each) => each.is_primary_billing))
  return {
    primary,
    demote: primary ? others.filter((each) => each.is_primary_billing).map((each) => each.id) : [],
  }
}

/**
 * Who takes the primary billing mark when its holder is removed: the
 * oldest billing contact, else the oldest one left (`all` oldest first).
 */
export function heirOnRemoval(all: readonly ContactLike[], contactId: string): string | null {
  const removed = all.find((each) => each.id === contactId)
  if (!removed?.is_primary_billing) {
    return null
  }
  const rest = all.filter((each) => each.id !== contactId)
  return (rest.find((each) => each.role === "billing") ?? rest[0])?.id ?? null
}
