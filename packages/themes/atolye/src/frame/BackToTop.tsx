"use client"

import { ArrowUp } from "lucide-react"
import { useEffect, useState } from "react"
import type { BackToTopView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

const REDUCED = "(prefers-reduced-motion: reduce)"

/**
 * Where the button stands: its corner, 16 px in; from 1024 px 4 px in, a
 * 40 px face inside the page's 48 px gutter, so it never covers the
 * content's edge (Tezgâh audit K-10); on a
 * phone above the bottom bar; above the WhatsApp button when both are on
 * the right (56 px and a 16 px gap), so the two never overlap. Written
 * whole for Tailwind.
 */
function placeOf(side: BackToTopView["side"], aboveBottomBar: boolean, overWhatsApp: boolean) {
  const corner = side === "left" ? "left-4 lg:left-1" : "right-4 lg:right-1"
  if (overWhatsApp) {
    return cn(
      corner,
      aboveBottomBar ? "bottom-[calc(9.5rem+env(safe-area-inset-bottom))]" : "bottom-22",
      "lg:bottom-24"
    )
  }
  return cn(
    corner,
    aboveBottomBar ? "bottom-[calc(5rem+env(safe-area-inset-bottom))]" : "bottom-4",
    "lg:bottom-6"
  )
}

/**
 * A floating "Yukarı çık" button (the footer's `back_to_top`, adr/0049 Ek
 * 2026-11-15): a 48 px round or square face on the field colour with a
 * hairline and the theme's one floating shadow. It shows once the visitor
 * has scrolled a screen's height down and hides at the top (hidden, it is
 * out of the tab order); pressing it scrolls to the top, at once under
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

  useEffect(() => {
    let frame = 0
    const check = () => {
      frame = 0
      setShown(window.scrollY > window.innerHeight)
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
    }
  }, [])

  return (
    <button
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
        "fixed z-(--z-raised) inline-flex size-12 items-center lg:size-10 justify-center border border-rule bg-field text-text shadow-float hover:border-edge",
        view.shape === "square" ? "rounded-inner" : "rounded-pill",
        placeOf(view.side, aboveBottomBar, overWhatsApp),
        !view.mobile && "max-lg:hidden"
      )}
    >
      <ArrowUp className="size-5" aria-hidden="true" strokeWidth={1.75} />
    </button>
  )
}
