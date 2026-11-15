import { useState } from "react"
import type { BillingOutcome, CreatedAccount, PasswordOutcome } from "./api/types"

/**
 * What happened when a wholesaler was opened (ADR-0068 Ek 2026-11-15
 * (2)), carried to its page for one look: the password set, the
 * unconfirmed sign-up taken over, or the customer's own password kept;
 * whether the tax details were written. Kept in memory only: a reload of
 * the page no longer says it, and the password itself is never in it.
 */
export interface CreateOutcome {
  password: PasswordOutcome
  billing: BillingOutcome
  /** Whether tax details were typed at all (none typed: nothing to say about them). */
  taxTyped: boolean
}

const outcomes = new Map<string, CreateOutcome>()

export function rememberOutcome(made: CreatedAccount, taxTyped: boolean): void {
  outcomes.set(made.account.id, {
    password: made.password,
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

/** The outcome's sentences as i18n keys, and whether one is worth a second look (a take-over). */
export function outcomeLines(outcome: CreateOutcome): { keys: string[]; warning: boolean } {
  const O = "wholesale.outcome"
  const keys = [`${O}.password.${outcome.password}`]
  if (outcome.taxTyped) {
    keys.push(`${O}.billing.${outcome.billing}`)
  }
  return { keys, warning: outcome.password === "replaced" }
}
