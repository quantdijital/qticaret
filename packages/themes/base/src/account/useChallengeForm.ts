"use client"

import { useState, useTransition } from "react"
import type { SyntheticEvent } from "react"
import type { ChallengeResult } from "@qticaret/ui"
import { challengeAnswer, solveChallenge } from "@qticaret/ui/lib/challenge"

const INITIAL: ChallengeResult = { ok: false, error: null, challenge: null }

/**
 * A form sent to an action that may answer with a proof of work
 * (adr/0044): the browser solves it and sends the form once more, with
 * the answer in `challenge`. The fields stay as typed: the form is not
 * reset by the action.
 */
export function useChallengeForm(
  action: (state: ChallengeResult, form: FormData) => Promise<ChallengeResult>
) {
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [pending, start] = useTransition()

  function submit(form: FormData) {
    setError(null)
    start(async () => {
      let result = await action(INITIAL, form)
      if (result.challenge) {
        setChecking(true)
        try {
          const nonce = await solveChallenge(result.challenge)
          form.set("challenge", challengeAnswer(result.challenge.token, nonce))
          result = await action(INITIAL, form)
        } catch {
          result = { ok: false, error: "errors.challenge_failed", challenge: null }
        } finally {
          setChecking(false)
        }
      }
      if (result.error) {
        setError(result.error)
      }
    })
  }

  return {
    error,
    checking,
    pending,
    onSubmit: (event: SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
      event.preventDefault()
      submit(new FormData(event.currentTarget))
    },
  }
}
