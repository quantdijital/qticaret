"use client"

import { useEffect, useEffectEvent } from "react"
import { setPageContext, track } from "./client"
import type { AnalyticsEvent, PageContext } from "./events"

/**
 * A page's own events, sent once it shows (and again only when they
 * change: a refreshed page with the same products sends nothing new; with
 * `sendOn`, only when that changes: the cart page's `view_cart` is not
 * sent again as its lines change). `once` makes them once per browser (a
 * purchase, a sign-up). The page's context waits for later events while
 * the page is on screen.
 */
export function TrackEvents({
  events,
  context = null,
  once = null,
  sendOn,
}: {
  events: AnalyticsEvent[]
  context?: PageContext | null
  once?: string | null
  sendOn?: string
}) {
  const key = JSON.stringify(events)
  const contextKey = JSON.stringify(context)
  const send = useEffectEvent(() => {
    for (const event of JSON.parse(key) as AnalyticsEvent[]) {
      track(event, once ? `${once}:${event.name}` : null)
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
