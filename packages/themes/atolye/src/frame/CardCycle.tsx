"use client"

import { useEffect } from "react"

/** How long each photo stays before the next fades in. */
const STEP_MS = 1400
/** The fade's own length (`--dur-long`) and a little more: the photo under it goes once covered. */
const FADE_MS = 480

const STRIP = ".gf-card-slides[data-cycle]"
const MORE = ".gf-card-slide--more"
/** On the photo shown now; on the one after it, so it loads unseen before its turn. */
const ON = "data-on"
const NEXT = "data-next"

/**
 * A card's photos in turn while a mouse rests on it (`hover_cycle`, sahip
 * 2026-11-26; `CardPhoto`, `card.css`): the second shows on hover as
 * always, then every photo after it, one each ~1.4 s, each fading in over
 * the one before, and back to the second; the first again once the mouse
 * leaves. One listener on the document serves every card, those a client
 * navigation adds included; nothing runs until a mouse is over a card
 * that has more than two photos. A touch screen, a pen, and a shopper who
 * asks for less motion get today's second photo alone. Only the photo
 * shown and the one after it are in the layout, so the browser fetches
 * none sooner.
 */
export function CardCycle() {
  useEffect(() => {
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)")
    let card: Element | null = null
    let timers: number[] = []

    const stop = () => {
      for (const timer of timers) {
        window.clearTimeout(timer)
      }
      timers = []
      card?.querySelectorAll(MORE).forEach((slide) => {
        slide.removeAttribute(ON)
        slide.removeAttribute(NEXT)
      })
      card = null
    }

    const run = (slides: Element[]) => {
      // -1: the second photo, under them all
      let at = -1
      const step = () => {
        const shown = slides[at]
        const next = at + 1 < slides.length ? at + 1 : -1
        const coming = slides[next]
        if (coming) {
          coming.removeAttribute(NEXT)
          coming.setAttribute(ON, "")
          // The one it covers leaves once covered, so only one stands over the second
          if (shown) {
            timers.push(
              window.setTimeout(() => {
                shown.removeAttribute(ON)
              }, FADE_MS)
            )
          }
        } else {
          // Back to the second: the last fades out over it
          shown?.removeAttribute(ON)
        }
        slides[next + 1]?.setAttribute(NEXT, "")
        at = next
        timers.push(window.setTimeout(step, STEP_MS))
      }
      slides[0]?.setAttribute(NEXT, "")
      timers.push(window.setTimeout(step, STEP_MS))
    }

    const over = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !(event.target instanceof Element)) {
        return
      }
      const pointed = event.target.closest(".gf-card")
      if (pointed === card) {
        return
      }
      stop()
      const strip = pointed?.querySelector(STRIP)
      if (!pointed || !strip || calm.matches) {
        return
      }
      card = pointed
      run([...strip.querySelectorAll(MORE)])
    }

    const out = (event: PointerEvent) => {
      if (card && !(event.relatedTarget instanceof Node && card.contains(event.relatedTarget))) {
        stop()
      }
    }

    document.addEventListener("pointerover", over)
    document.addEventListener("pointerout", out)
    return () => {
      document.removeEventListener("pointerover", over)
      document.removeEventListener("pointerout", out)
      stop()
    }
  }, [])
  return null
}
