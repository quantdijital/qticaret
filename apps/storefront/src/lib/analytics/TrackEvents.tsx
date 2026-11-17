"use client"

import { useEffect, useEffectEvent } from "react"
import { noteAmounts, setPageContext, track } from "./client"
import type { AnalyticsEvent, PageContext } from "./events"

/**
 * A page's own events, sent once it shows (and again only when they
 * change: a refreshed page with the same products sends nothing new; with
 * `sendOn`, only when that changes: the cart page's `view_cart` is not
 * sent again as its lines change). `once` makes them once per browser (a
 * purchase, a sign-up). The page's context waits for later events while
 * the page is on screen.
 *
 * `visitorAmounts` is the server's word, asked on this page's request
 * (`visitorAmounts()` in `tags.ts`), on whether this visitor's events carry
 * amounts (ADR-0068 §7; slice 5 review L1): the frame is not drawn again on
 * a soft navigation, so its word may be older than a customer made a
 * wholesaler meanwhile. It is noted before the events go and holds for the
 * events after them (`noteAmounts`). `amounts` false is the page's own
 * word for these events only (a wholesale order's purchase, review L2).
 */
export function TrackEvents({
  events,
  context = null,
  once = null,
  sendOn,
  visitorAmounts,
  amounts = true,
}: {
  events: AnalyticsEvent[]
  context?: PageContext | null
  once?: string | null
  sendOn?: string
  visitorAmounts: boolean
  amounts?: boolean
}) {
  const key = JSON.stringify(events)
  const contextKey = JSON.stringify(context)
  useEffect(() => {
    noteAmounts(visitorAmounts)
  }, [visitorAmounts])
  const send = useEffectEvent(() => {
    for (const event of JSON.parse(key) as AnalyticsEvent[]) {
      track(event, once ? `${once}:${event.name}` : null, amounts)
    }
  })
  const trigger = sendOn ?? key
  useEffect(() => {
    send()
  }, [trigger])
  useEffect(() => {
    const page = JSON.parse(contextKey) as PageContext | null
    if (!page) {
      return
    }
    setPageContext(page)
    return () => {
      setPageContext(null)
    }
  }, [contextKey])
  return null
}
