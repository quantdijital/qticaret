"use client"

import { useState, useTransition } from "react"
import type { SyntheticEvent } from "react"
import type { TurnstileGate } from "@qticaret/types"
import type { ChallengeResult } from "@qticaret/ui"
import { useTurnstile } from "@qticaret/ui/hooks/use-turnstile"
import { sendGated } from "@qticaret/ui/lib/gate"

const INITIAL: ChallengeResult = { ok: false, error: null, challenge: null }

/**
 * A form sent to an action behind the backend's bot checks (adr/0044 and
 * its Ek 2026-11-24): Turnstile's token for `gate` (with the first send
 * when `eager`, else once asked), a proof of work solved in the browser;
 * the form sent again with the answer. The fields stay as typed. Put
 * `slot` inside the form (the widget's place, drawn only when wanted) and
 * `warm` on the form's first touch for an every-send gate.
 */
export function useChallengeForm(
  action: (state: ChallengeResult, form: FormData) => Promise<ChallengeResult>,
  gate?: { action: TurnstileGate; eager?: boolean; className?: string }
) {
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [pending, start] = useTransition()
  const turnstile = useTurnstile(gate?.action ?? "login", {
    eager: gate?.eager ?? false,
    ...(gate?.className ? { className: gate.className } : {}),
  })
  const handle = gate ? turnstile.gate : null

  function submit(form: FormData) {
    setError(null)
    start(async () => {
      const result = await sendGated((sent) => action(INITIAL, sent), form, handle, {
        checking: setChecking,
      })
      if (result.error) {
        setError(result.error)
      }
    })
  }

  return {
    error,
    checking,
    pending,
    slot: gate ? turnstile.slot : null,
    warm: gate ? turnstile.warm : () => undefined,
    onSubmit: (event: SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
      event.preventDefault()
      submit(new FormData(event.currentTarget))
    },
  }
}
