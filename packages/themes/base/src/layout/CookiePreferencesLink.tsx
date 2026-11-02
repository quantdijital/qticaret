"use client"

import type { MouseEvent } from "react"
import { COOKIE_PREFERENCES_EVENT } from "./cookie-events"

/**
 * The footer's "cookie preferences" (D9): opens the banner again where the
 * visitor is; without script, or with no banner on the page, it is a plain
 * link to `/cerez-tercihleri`, which asks the same.
 */
export function CookiePreferencesLink({ label, className }: { label: string; className?: string }) {
  const reopen = (event: MouseEvent<HTMLAnchorElement>) => {
    // A new tab, or a click someone else handled, is the link's own
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }
    const asked = new Event(COOKIE_PREFERENCES_EVENT, { cancelable: true })
    if (!window.dispatchEvent(asked)) {
      event.preventDefault()
    }
  }
  return (
    <a href="/cerez-tercihleri" onClick={reopen} className={className}>
      {label}
    </a>
  )
}
