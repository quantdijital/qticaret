"use client"

import { useEffect } from "react"
import { setPageContext, track } from "./client"
import type { AnalyticsEvent, PageContext } from "./events"

/**
 * A page's own events, sent once it shows (and again only when they
 * change: a refreshed page with the same products sends nothing new).
 * `once` makes them once per tab (a purchase, a sign-up). The page's
 * context waits for the theme's signals while the page is on screen.
 */
export function TrackEvents({
  events,
  context = null,
  once = null,
}: {
  events: AnalyticsEvent[]
  context?: PageContext | null
  once?: string | null
}) {
  const key = JSON.stringify(events)
  const contextKey = JSON.stringify(context)
  useEffect(() => {
    for (const event of JSON.parse(key) as AnalyticsEvent[]) {
      track(event, once ? `${once}:${event.name}` : null)
    }
  }, [key, once])
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
