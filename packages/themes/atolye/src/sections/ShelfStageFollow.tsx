"use client"

import { useEffect, useRef } from "react"

/** From 1024 px the stage stands beside the list; below it, above it, and nothing follows. */
const BESIDE = "(min-width: 64rem)"
/** A pointer crossing rows on its way elsewhere does not flash each one on the stage. */
const PAUSE_MS = 90

/**
 * A stage list's one island (`StageShelf`, adr/0049 Ek 2026-11-16): the
 * row under a mouse or a pen, or holding the keyboard's focus, takes the
 * stage, and stays there once the pointer leaves (the tab pattern: the
 * last chosen holds). A touch opens the row's link as on any card, so
 * nothing changes under a finger. The stage's other photographs wait
 * unloaded (`hidden`, lazy) until the pointer or the focus enters the
 * list's shelf. The server's HTML is the state before any of it: the
 * first on the stage and its row marked.
 */
export function ShelfStageFollow() {
  const mark = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const root = mark.current?.closest<HTMLElement>(".gf-stage-list")
    if (!root) {
      return
    }
    const beside = window.matchMedia(BESIDE)
    let warm = false
    let timer: number | undefined
    const warmUp = () => {
      if (warm || !beside.matches) {
        return
      }
      warm = true
      for (const image of root.querySelectorAll<HTMLImageElement>("[data-stage] img")) {
        image.setAttribute("loading", "eager")
      }
    }
    const show = (at: string) => {
      if (!beside.matches || root.dataset["on"] === at) {
        return
      }
      root.dataset["on"] = at
      for (const panel of root.querySelectorAll<HTMLElement>("[data-stage]")) {
        panel.hidden = panel.dataset["stage"] !== at
      }
      for (const row of root.querySelectorAll<HTMLElement>("[data-pick]")) {
        const on = row.dataset["pick"] === at
        row.toggleAttribute("data-on", on)
        const link = row.querySelector("a")
        if (on) {
          link?.setAttribute("aria-current", "true")
        } else {
          link?.removeAttribute("aria-current")
        }
      }
    }
    const rowOf = (target: EventTarget | null) =>
      target instanceof Element ? target.closest<HTMLElement>("[data-pick]") : null
    const over = (event: PointerEvent) => {
      const at = rowOf(event.target)?.dataset["pick"]
      window.clearTimeout(timer)
      if (event.pointerType === "touch" || at === undefined) {
        return
      }
      warmUp()
      timer = window.setTimeout(() => {
        show(at)
      }, PAUSE_MS)
    }
    // A finger's tap focuses the row's link on its way to the product: not a choice
    let touched = false
    const press = (event: PointerEvent) => {
      touched = event.pointerType === "touch"
    }
    const key = () => {
      touched = false
    }
    const focus = (event: FocusEvent) => {
      warmUp()
      const at = rowOf(event.target)?.dataset["pick"]
      if (at !== undefined && !touched) {
        window.clearTimeout(timer)
        show(at)
      }
    }
    root.addEventListener("pointerover", over)
    root.addEventListener("focusin", focus)
    root.addEventListener("pointerdown", press)
    document.addEventListener("keydown", key)
    return () => {
      window.clearTimeout(timer)
      root.removeEventListener("pointerover", over)
      root.removeEventListener("focusin", focus)
      root.removeEventListener("pointerdown", press)
      document.removeEventListener("keydown", key)
    }
  }, [])
  return <span ref={mark} hidden />
}
