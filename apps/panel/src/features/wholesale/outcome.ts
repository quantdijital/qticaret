import { useState } from "react"
import type { BillingOutcome, CreatedAccount, MessageOutcome } from "./api/types"

/**
 * What happened when a wholesaler was opened (ADR-0068 §3), carried to
 * its page for one look: active at once or invited, whether the e-mail
 * went, whether the tax details were written. Kept in memory only: a
 * reload of the page no longer says it.
 */
export interface CreateOutcome {
  status: "active" | "pending"
  message: MessageOutcome
  billing: BillingOutcome
  /** Whether tax details were typed at all (none typed: nothing to say about them). */
  taxTyped: boolean
}

const outcomes = new Map<string, CreateOutcome>()

export function rememberOutcome(made: CreatedAccount, taxTyped: boolean): void {
  outcomes.set(made.account.id, {
    status: made.account.status === "active" ? "active" : "pending",
    message: made.message,
    billing: made.billing_profile,
    taxTyped,
  })
}

/** The outcome for the account, once; dismissing forgets it. */
export function useOutcome(id: string): [CreateOutcome | null, () => void] {
  const [outcome, setOutcome] = useState(() => outcomes.get(id) ?? null)
  return [
    outcome,
    () => {
      outcomes.delete(id)
      setOutcome(null)
    },
  ]
}

/** The outcome's sentences as i18n keys, and whether any of them is a warning. */
export function outcomeLines(outcome: CreateOutcome): { keys: string[]; warning: boolean } {
  const O = "wholesale.outcome"
  const keys = [
    outcome.status === "active"
      ? outcome.message === "sent"
        ? `${O}.activeSent`
        : `${O}.activeNotSent`
      : outcome.message === "sent"
        ? `${O}.invitedSent`
        : `${O}.invitedNotSent`,
  ]
  if (outcome.taxTyped) {
    keys.push(`${O}.billing.${outcome.billing}`)
  }
  return { keys, warning: outcome.message === "not_sent" }
}
