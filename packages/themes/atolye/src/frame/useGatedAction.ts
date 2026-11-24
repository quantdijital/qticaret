"use client"

import { useCallback } from "react"
import type { TurnstileGate } from "@qticaret/types"
import type { ActionResult, FormAction } from "@qticaret/ui"
import { useTurnstile } from "@qticaret/ui/hooks/use-turnstile"
import { sendGated } from "@qticaret/ui/lib/gate"

/**
 * A plain form action (`useKeptForm`'s) behind a past-the-limit gate
 * (adr/0044 Ek 2026-11-24): asked, the token is got and the form sent
 * once more; a proof of work likewise. `slot` goes inside the form.
 */
export function useGatedAction(action: FormAction, gate: TurnstileGate) {
  const { gate: handle, slot } = useTurnstile(gate)
  const gated = useCallback(
    (state: ActionResult, form: FormData) =>
      sendGated((sent) => action(state, sent), form, { own: gate, gates: { [gate]: handle } }),
    [action, gate, handle]
  )
  return { action: gated, slot }
}
