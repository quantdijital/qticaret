"use client"

import type { ReactNode } from "react"
import { forgetQuickViews } from "@qticaret/ui/lib/quick-view"

/**
 * The sign-out form. Signing out is a soft navigation (the page lives on),
 * so the quick views kept for the signed-in customer's prices are
 * forgotten as the form is sent. A component, so the account's server
 * markup can hold it; the action reaches it as the storefront's own.
 */
export function SignOutForm({
  action,
  children,
}: {
  action: (form: FormData) => Promise<void>
  children: ReactNode
}) {
  return (
    <form action={action} onSubmit={forgetQuickViews}>
      {children}
    </form>
  )
}
