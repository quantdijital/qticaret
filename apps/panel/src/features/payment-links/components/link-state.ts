import { useEffect, useState } from "react"
import type { LinkStatus, PaymentLinkSummary } from "@/features/payment-links/api/types"

type Lifetime = Pick<PaymentLinkSummary, "status" | "expires_at">

// setTimeout's longest wait; a link lives seven days at most, far within it
const LONGEST_WAIT_MS = 2_147_483_647

/** A link that may still open, until its end: open, or repriced (`draft`). */
const isLive = (status: LinkStatus) => status === "open" || status === "draft"

/**
 * A link's state as the customer meets it: one past its end is `expired`,
 * though the hourly expiry job has not yet written so (adr/0051 §12, as
 * its sweep takes open and repriced links alike). The backend says the
 * same when it reads; this way both agree, whichever answers first.
 */
export function shownStatus(link: Lifetime, now: number = Date.now()): LinkStatus {
  return isLive(link.status) && new Date(link.expires_at).getTime() <= now ? "expired" : link.status
}

/**
 * Draws the screen again the moment a live link ends, so its badge, its
 * share card and its actions turn together while the page is open.
 */
export function useExpiryRedraw(link: Lifetime): void {
  const [, redraw] = useState(0)
  const end = new Date(link.expires_at).getTime()
  const live = isLive(link.status)
  useEffect(() => {
    const wait = end - Date.now()
    if (!live || Number.isNaN(wait) || wait < 0 || wait > LONGEST_WAIT_MS) {
      return undefined
    }
    const timer = window.setTimeout(() => {
      redraw((count) => count + 1)
    }, wait + 1)
    return () => {
      window.clearTimeout(timer)
    }
  }, [end, live])
}
