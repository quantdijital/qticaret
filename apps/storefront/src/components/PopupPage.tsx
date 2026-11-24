"use client"

import { useEffect } from "react"
import type { PopupPageKind } from "@qticaret/ui"
import { markPopupPage } from "@qticaret/ui/lib/popup-client"

/**
 * A page says what it is for the shop's pop-ups (adr/0080 §3): the home
 * page, a category, a product, a content page. Draws nothing. A page that
 * says nothing is "other"; the blocked pages (cart, checkout, payment,
 * account) are known from their address alone.
 */
export function PopupPage({ kind }: { kind: PopupPageKind }) {
  useEffect(() => {
    markPopupPage(kind)
  }, [kind])
  return null
}
