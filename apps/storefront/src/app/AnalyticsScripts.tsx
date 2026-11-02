"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"
import { SHOP_EVENT } from "@qticaret/ui/lib/shop-events"
import type { ShopEvent } from "@qticaret/ui/lib/shop-events"
import { configureAnalytics, eventOf, track } from "@/lib/analytics/client"
import { safeLocation } from "@/lib/analytics/events"

/** A page view per route: the router changes pages without a load. */
function PageViews() {
  const pathname = usePathname()
  const search = useSearchParams().toString()
  useEffect(() => {
    track({
      name: "page_view",
      location: safeLocation(window.location.href),
      referrer: safeLocation(document.referrer),
      title: document.title,
    })
  }, [pathname, search])
  return null
}

/**
 * The conversion tags (docs/20 "vitrin dönüşüm olayları", D9): GA4 and
 * Meta's pixel, each only when the shop connected it and this visitor's
 * cookie answer allows it (the frame passes null otherwise; nothing loads
 * before). A new answer reaches here as the frame re-renders: allowed
 * tags load, withdrawn ones stop. The theme's signals (added to cart,
 * payment chosen) become events here.
 */
export function AnalyticsScripts({
  ga4,
  meta,
  adSignals,
  nonce,
}: {
  ga4: string | null
  meta: string | null
  adSignals: boolean
  nonce: string | undefined
}) {
  useEffect(() => {
    configureAnalytics({ ga4, meta, adSignals }, nonce)
  }, [ga4, meta, adSignals, nonce])
  useEffect(() => {
    const listener = (signal: Event) => {
      const event = eventOf((signal as CustomEvent<ShopEvent>).detail)
      if (event) {
        track(event)
      }
    }
    window.addEventListener(SHOP_EVENT, listener)
    return () => {
      window.removeEventListener(SHOP_EVENT, listener)
    }
  }, [])
  return (
    <Suspense fallback={null}>
      <PageViews />
    </Suspense>
  )
}
