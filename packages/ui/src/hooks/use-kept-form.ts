import { startTransition, useActionState, useEffect, useRef, useState } from "react"
import type { SyntheticEvent } from "react"
import { afterPaint } from "../lib/after-paint"
import type { ActionResult, FormAction } from "../theme"

const INITIAL: ActionResult = { ok: false, error: null }

export type SubmitFormEvent = SyntheticEvent<HTMLFormElement, SubmitEvent>

/** The form's fields as sent, with the button that sent it (as the browser posts them). */
export function sentFields(event: SubmitFormEvent): FormData {
  return new FormData(event.currentTarget, event.nativeEvent.submitter)
}

/**
 * Sends a form without emptying what was typed. React 19 resets a form
 * whose `action` is a function as soon as the action settles, refused or
 * not: a refused review, code or address came back with its fields
 * blank. Here the form goes through `onSubmit` instead (the browser's own
 * send stopped, the action dispatched in a transition), so a refusal
 * leaves every field as the shopper left it and only an accepted send
 * empties the form. `action` stays on the form for the page before its
 * script runs.
 *
 * The send is pending from the press: the button says so in the very
 * next frame, and the action starts once that frame is drawn
 * (`afterPaint`): starting a server action (the fields, their encoding,
 * the router) is not part of the press's own task (INP, docs/21).
 *
 * `<form {...form}>`; `state` as `useActionState` gives it, `pending`
 * from the press until the action settles.
 */
export function useKeptForm(action: FormAction, initial: ActionResult = INITIAL) {
  const [state, dispatch, pending] = useActionState(action, initial)
  // Pressed, its action not yet started: pending all the same
  const [waiting, setWaiting] = useState(false)
  if (waiting && pending) {
    setWaiting(false)
  }
  // The form last sent: emptied once its action accepts it
  const sent = useRef<HTMLFormElement | null>(null)
  useEffect(() => {
    if (state.ok) {
      sent.current?.reset()
      sent.current = null
    }
  }, [state])
  return {
    state,
    pending: pending || waiting,
    form: {
      action: dispatch,
      onSubmit: (event: SubmitFormEvent) => {
        event.preventDefault()
        sent.current = event.currentTarget
        const fields = sentFields(event)
        setWaiting(true)
        afterPaint(() => {
          startTransition(() => {
            dispatch(fields)
          })
        })
      },
    },
  }
}
