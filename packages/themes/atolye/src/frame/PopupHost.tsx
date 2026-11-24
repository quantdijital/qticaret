"use client"

import { Suspense, lazy } from "react"
import type { PlaceOrderResult, PopupSetup } from "@qticaret/ui"
import { usePopup } from "@qticaret/ui/hooks/use-popup"
import type { PopupWords } from "./popup-words"

// The dialog's code comes only once a pop-up is due, never with the page
const PopupDialog = lazy(() => import("./PopupDialog"))

/** The cookie question's card (`ConsentFrame`), while it is on screen. */
const openConsent = () => document.querySelector("[data-cookie-banner]:not([hidden])")

/**
 * Calls `go` once the cookie question is answered (adr/0080 §4: a pop-up
 * never stands over it): at once when it is not on screen, else when its
 * card hides (answered, or closed after the footer's link opened it).
 */
export function whenConsentClear(go: () => void): () => void {
  const banner = openConsent()
  if (!banner) {
    go()
    return () => undefined
  }
  const watch = new MutationObserver(() => {
    if (banner.hasAttribute("hidden") || !banner.isConnected) {
      watch.disconnect()
      go()
    }
  })
  watch.observe(banner, { attributes: true, attributeFilter: ["hidden"] })
  return () => {
    watch.disconnect()
  }
}

/**
 * The shop's pop-ups (adr/0080 §6), once in the layout while the shop has
 * them on: nothing drawn and nothing loaded with the page. Once the page
 * is up and the cookie question answered, the shared rules choose at most
 * one pop-up for this page view (`usePopup`); only then the dialog's code
 * loads and draws it. The focus it had goes back when it closes.
 */
export function PopupHost({
  setup,
  member,
  words,
  privacyPath,
  subscribe,
}: {
  setup: PopupSetup
  /** Signed in as a customer: a pop-up's membership targeting. */
  member: boolean
  words: PopupWords
  privacyPath: string | null
  subscribe?: ((state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>) | undefined
}) {
  const { shown, open, close, act } = usePopup({ setup, member, whenClear: whenConsentClear })
  if (!shown) {
    return null
  }
  return (
    <Suspense fallback={null}>
      <PopupDialog
        key={shown.popup.id}
        popup={shown.popup}
        mode={shown.mode}
        open={open}
        onClose={close}
        onAct={act}
        words={words}
        privacyPath={privacyPath}
        subscribe={subscribe}
      />
    </Suspense>
  )
}
