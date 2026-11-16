"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"
import { SHOP_EVENT } from "@qticaret/ui/lib/shop-events"
import type { ShopEvent } from "@qticaret/ui/lib/shop-events"
import type { CartSnapshot } from "@/lib/analytics/cart-changes"
import { configureAnalytics, eventOf, selectionOf, track, watchCart } from "@/lib/analytics/client"
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
 * tags load, withdrawn ones stop. The cart the frame shows (only while a
 * tag is allowed) tells what went in or out; a click on a list's card is
 * its `select_item`; the theme's "payment chosen" signal becomes its event.
 */
export function AnalyticsScripts({
  ga4,
  meta,
  adSignals,
  amounts,
  nonce,
  cart,
}: {
  ga4: string | null
  meta: string | null
  adSignals: boolean
  /** False in a signed-in wholesaler's session: events go without prices (ADR-0068 §7). */
  amounts: boolean
  nonce: string | undefined
  cart: CartSnapshot
}) {
  useEffect(() => {
    configureAnalytics({ ga4, meta, adSignals, amounts }, nonce)
  }, [ga4, meta, adSignals, amounts, nonce])
  // After the tags are configured (effects run in order): the cart's look needs the answer
  const cartKey = JSON.stringify(cart)
  useEffect(() => {
    watchCart(JSON.parse(cartKey) as CartSnapshot)
  }, [cartKey, ga4, meta])
  useEffect(() => {
    const signals = (signal: Event) => {
      const event = eventOf((signal as CustomEvent<ShopEvent>).detail)
      if (event) {
        track(event)
      }
    }
    // Captured before the router's own handler turns the click into a navigation
    const clicks = (click: MouseEvent) => {
      const event = selectionOf(click.target)
      if (event) {
        track(event)
      }
    }
    window.addEventListener(SHOP_EVENT, signals)
    document.addEventListener("click", clicks, { capture: true, passive: true })
    return () => {
      window.removeEventListener(SHOP_EVENT, signals)
      document.removeEventListener("click", clicks, { capture: true })
    }
  }, [])
  return (
    <Suspense fallback={null}>
      <PageViews />
    </Suspense>
  )
}
