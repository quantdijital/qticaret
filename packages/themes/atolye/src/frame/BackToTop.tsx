"use client"

import { ArrowUp } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { BackToTopView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

const REDUCED = "(prefers-reduced-motion: reduce)"
/** Where the page's gutter (48 px, `tokens.css`) holds the 40 px face: wider than 1024 px. */
const WIDE = "(min-width: 64.0625rem)"
/** Narrower, how long it stays once the visitor stops scrolling up (third audit). */
const IDLE_MS = 1800

/**
 * Where the button stands: 4 px in from its corner; wider than 1024 px a
 * 40 px face inside the page's 48 px gutter, so it never covers the
 * content's edge (Tezgâh audits K-10, Y-02); at 1024 px and below the
 * gutter is 24 or 16 px and no face fits: a 32 px see-through face, as
 * little over the content as it can be (third audit, see `BackToTop`); on a
 * phone above the bottom bar; above the WhatsApp button when both are on
 * the right (56 px and a 16 px gap), so the two never overlap. Written
 * whole for Tailwind.
 */
function placeOf(side: BackToTopView["side"], aboveBottomBar: boolean, overWhatsApp: boolean) {
  const corner = side === "left" ? "left-1" : "right-1"
  if (overWhatsApp) {
    return cn(
      corner,
      aboveBottomBar ? "bottom-[calc(9.5rem+env(safe-area-inset-bottom))]" : "bottom-22",
      "lg:bottom-24"
    )
  }
  return cn(
    corner,
    aboveBottomBar ? "bottom-[calc(5rem+env(safe-area-inset-bottom))]" : "bottom-3",
    "lg:bottom-6"
  )
}

/**
 * A floating "Yukarı çık" button (the footer's `back_to_top`, adr/0049 Ek
 * 2026-11-15): a 40 px round or square face on the field colour with a
 * hairline and the theme's one floating shadow. It shows once the visitor
 * has scrolled a screen's height down and hides at the top (hidden, it is
 * out of the tab order). Where the gutter cannot hold it (1024 px and
 * below) it shows only while the visitor scrolls back up and hides as they
 * scroll on down, so it never rests over the content they read or a
 * card's button (Tezgâh audit Y-02); there it is smaller and see-through
 * and goes again once they stop scrolling, unless pointed at or focused
 * (third audit); pressing it scrolls to the top, at once under
 * reduced motion, and a keyboard press moves the focus to the page's
 * first stop (the skip link). It stays clear of the fixed parts: above the
 * bottom bar and the WhatsApp button, hidden while a drawer, the live
 * search or the product page's buy bar is open (`frame.css`); the layout
 * leaves it out while the cookie question waits.
 */
export function BackToTop({
  view,
  label,
  aboveBottomBar,
  overWhatsApp,
}: {
  view: BackToTopView
  label: string
  aboveBottomBar: boolean
  overWhatsApp: boolean
}) {
  const [shown, setShown] = useState(false)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let frame = 0
    let last = window.scrollY
    let goingUp = false
    let idle = 0
    const wide = window.matchMedia(WIDE)
    const check = () => {
      frame = 0
      const y = window.scrollY
      // A few pixels either way are a jitter, not a direction
      if (Math.abs(y - last) > 4) {
        goingUp = y < last
        last = y
      }
      const show = y > window.innerHeight && (wide.matches || goingUp)
      setShown(show)
      window.clearTimeout(idle)
      if (show && !wide.matches) {
        // Narrow, it rests over the content: away once the scrolling stops
        idle = window.setTimeout(() => {
          if (!button.current?.matches(":hover, :focus-visible")) {
            setShown(false)
          }
        }, IDLE_MS)
      }
    }
    const schedule = () => {
      frame ||= window.requestAnimationFrame(check)
    }
    check()
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule, { passive: true })
    return () => {
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
      window.cancelAnimationFrame(frame)
      window.clearTimeout(idle)
    }
  }, [])

  return (
    <button
      ref={button}
      type="button"
      aria-label={label}
      title={label}
      data-back-to-top=""
      data-shown={shown ? "" : undefined}
      onClick={(event) => {
        const reduced = window.matchMedia(REDUCED).matches
        window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" })
        // A keyboard press (no pointer, so no click count): the focus goes to the top too
        if (event.detail === 0) {
          document.querySelector<HTMLElement>(".gf-skip")?.focus({ preventScroll: true })
        }
      }}
      className={cn(
        "fixed z-(--z-raised) inline-flex size-8 items-center justify-center border border-rule bg-field text-text shadow-float hover:border-edge min-[64.0625rem]:size-10",
        view.shape === "square" ? "rounded-inner" : "rounded-pill",
        placeOf(view.side, aboveBottomBar, overWhatsApp),
        !view.mobile && "max-lg:hidden"
      )}
    >
      <ArrowUp className="size-4 min-[64.0625rem]:size-5" aria-hidden="true" strokeWidth={1.75} />
    </button>
  )
}
