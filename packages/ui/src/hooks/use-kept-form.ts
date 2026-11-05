import { startTransition, useActionState, useEffect, useRef } from "react"
import type { SyntheticEvent } from "react"
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
 * `<form {...form}>`; `state` and `pending` as `useActionState` gives them.
 */
export function useKeptForm(action: FormAction, initial: ActionResult = INITIAL) {
  const [state, dispatch, pending] = useActionState(action, initial)
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
    pending,
    form: {
      action: dispatch,
      onSubmit: (event: SubmitFormEvent) => {
        event.preventDefault()
        sent.current = event.currentTarget
        const fields = sentFields(event)
        startTransition(() => {
          dispatch(fields)
        })
      },
    },
  }
}
