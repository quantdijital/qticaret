"use client"

import { startTransition } from "react"
import type { ComponentProps } from "react"
import { sentFields } from "@qticaret/ui/hooks/use-kept-form"
import { afterPaint } from "@qticaret/ui/lib/after-paint"

/**
 * A plain form for an action that answers with a page (a redirect, the
 * refusal in the address), drawn by a server component: React 19 would
 * empty its fields once the action settles, so a refused gift recipient
 * or add-on pick lost what was typed. Sent in a transition instead, the
 * fields stay until the page that comes back draws them again. `action`
 * stays on the form for the page before its script runs. The action
 * starts once the press's own frame is drawn (`afterPaint`, INP).
 */
export function KeptForm({
  action,
  ...props
}: Omit<ComponentProps<"form">, "action" | "onSubmit"> & {
  action: (form: FormData) => Promise<void>
}) {
  return (
    <form
      {...props}
      action={action}
      onSubmit={(event) => {
        event.preventDefault()
        const fields = sentFields(event)
        // What the press changes (a card closing) is drawn before the action starts
        afterPaint(() => {
          startTransition(async () => {
            await action(fields)
          })
        })
      }}
    />
  )
}
