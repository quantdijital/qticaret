"use client"

import { useEffect, useRef } from "react"

/**
 * The theme editor's preview only (adr/0065 §2, `qt:section:select`): a
 * rail selected in the editor while its tab is not the one shown checks
 * that tab's pill, so the rail has a box to scroll to and frame. A live
 * page never hears the event, so this does nothing there.
 */
export function ShelfTabsReveal() {
  const mark = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const tabs = mark.current?.closest(".gf-tabs")
    if (!tabs) {
      return
    }
    const open = (event: Event) => {
      if (!(event.target instanceof Element)) {
        return
      }
      // The first rail is the shelf's own section: its mark sits around the tabs
      const panel = tabs.contains(event.target) ? event.target.closest("[data-panel]") : null
      const index = panel instanceof HTMLElement ? (panel.dataset["panel"] ?? "0") : "0"
      for (const radio of tabs.querySelectorAll<HTMLInputElement>(".gf-tab-row input")) {
        if (radio.value === index && /^\d+$/.test(index)) {
          radio.checked = true
        }
      }
    }
    const root = tabs.closest("[data-qs]") ?? tabs
    root.addEventListener("qt:section:select", open)
    return () => {
      root.removeEventListener("qt:section:select", open)
    }
  }, [])
  return <span ref={mark} hidden />
}
