"use client"

import { Suspense, lazy, useEffect, useRef, useState } from "react"
import type { QuickViewSetup } from "@qticaret/ui"
import { QUICK_VIEW_EVENT, QUICK_VIEW_SOON_EVENT, quickViewAsked } from "./events"
import type { QuickViewAsk } from "./events"
import type { QuickViewWords } from "./quick-view-words"

// The dialog's code comes with the first look (or the pointer on a button), never with the page
const loadDialog = () => import("./QuickViewDialog")
const QuickViewDialog = lazy(loadDialog)

/** The element that has the focus, if any. */
const focusedElement = () =>
  document.activeElement instanceof HTMLElement ? document.activeElement : null

/**
 * The cards' quick view (adr/0049 Ek 2026-11-15), once in the layout while
 * the shop has it on: it hears a card's "Hızlı bak" (`qt:quick-view`),
 * keeps what had the focus to give it back, and shows the dialog, whose
 * code it loads only then. Nothing drawn until the first look.
 */
export function QuickViewHost({ setup, words }: { setup: QuickViewSetup; words: QuickViewWords }) {
  const [asked, setAsked] = useState<QuickViewAsk | null>(null)
  const [open, setOpen] = useState(false)
  const opener = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const show = (event: Event) => {
      const ask = quickViewAsked(event)
      if (!ask) {
        return
      }
      event.preventDefault()
      opener.current = focusedElement()
      setAsked(ask)
      setOpen(true)
    }
    const soon = () => {
      void loadDialog()
    }
    window.addEventListener(QUICK_VIEW_EVENT, show)
    window.addEventListener(QUICK_VIEW_SOON_EVENT, soon, { once: true })
    return () => {
      window.removeEventListener(QUICK_VIEW_EVENT, show)
      window.removeEventListener(QUICK_VIEW_SOON_EVENT, soon)
    }
  }, [])
  if (!asked) {
    return null
  }
  return (
    <Suspense fallback={null}>
      <QuickViewDialog
        key={asked.productId}
        ask={asked}
        open={open}
        onOpenChange={setOpen}
        opener={opener}
        setup={setup}
        words={words}
      />
    </Suspense>
  )
}
