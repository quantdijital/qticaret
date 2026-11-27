"use client"

import { ArrowUp } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { BackToTopView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

const REDUCED = "(prefers-reduced-motion: reduce)"
/** Where the page's gutter (48 px, `tokens.css`) holds the 40 px face: wider than 1024 px. */
const WIDE = "(min-width: 64.0625rem)"
/** Where the gutter is 16 px and the rails run to the screen's edge (`tokens.css`). */
const NARROW = "(max-width: 40rem)"

/**
 * How the button stands, by the page's gutter, so it never covers the
 * content column (Tezgâh audits K-10, Y-02, the fourth's "binme"):
 * - `corner`, wider than 1024 px: a 40 px face 4 px in from its corner,
 *   inside the 48 px gutter;
 * - `tab`, 641 to 1024 px: a 20 × 44 px tab against the screen's edge,
 *   inside the 24 px gutter;
 * - `dock`, 640 px and below: the gutter is 16 px and the shelves' rails
 *   run to the edge, so no floating face clears them; the button sits on
 *   the footer's top rule instead, in the empty band between the page and
 *   the footer's first line, and scrolls with the page.
 */
type Mode = "corner" | "tab" | "dock"

/**
 * The side's class by the mode, written whole for Tailwind: the corner 4 px
 * in from the container's edge, so on a screen wider than the container it
 * stays in the content's own gutter, not out in the margin.
 */
const SIDES = {
  left: {
    tab: "left-0",
    corner: "left-[max(0.25rem,calc((100%_-_var(--container))_/_2_+_0.25rem))]",
    dock: "left-1",
  },
  right: {
    tab: "right-0",
    corner: "right-[max(0.25rem,calc((100%_-_var(--container))_/_2_+_0.25rem))]",
    dock: "right-1",
  },
} as const

/**
 * Where a fixed button stands: on a phone above the bottom bar; above the
 * WhatsApp button when both are on the right (56 px and a 16 px gap), so
 * the two never overlap. Written whole for Tailwind.
 */
function bottomOf(aboveBottomBar: boolean, overWhatsApp: boolean) {
  if (overWhatsApp) {
    return cn(
      aboveBottomBar ? "bottom-[calc(9.5rem+env(safe-area-inset-bottom))]" : "bottom-22",
      "lg:bottom-24"
    )
  }
  return cn(
    aboveBottomBar ? "bottom-[calc(5rem+env(safe-area-inset-bottom))]" : "bottom-3",
    "lg:bottom-6"
  )
}

function shapeOf(mode: Mode, view: BackToTopView) {
  const round = view.shape !== "square"
  if (mode !== "tab") {
    return cn("size-10", round ? "rounded-pill" : "rounded-inner")
  }
  // Open on the screen's side: a tab pulled out of the edge
  if (view.side === "left") {
    return cn("h-11 w-5 border-l-0", round ? "rounded-r-pill" : "rounded-r-inner")
  }
  return cn("h-11 w-5 border-r-0", round ? "rounded-l-pill" : "rounded-l-inner")
}

/** The footer's top, in the coordinates of the button's containing block. */
function dockTopOf(button: HTMLElement): number | null {
  const footer = document.querySelector<HTMLElement>("#icerik ~ footer")
  if (!footer) {
    return null
  }
  const parent = button.offsetParent
  const origin =
    parent instanceof HTMLElement && getComputedStyle(parent).position !== "static"
      ? parent.getBoundingClientRect().top
      : document.documentElement.getBoundingClientRect().top
  // Centred on the rule: half in the footer's gap, half in its top padding
  return Math.round(footer.getBoundingClientRect().top - origin - button.offsetHeight / 2)
}

/**
 * A floating "Yukarı çık" button (the footer's `back_to_top`, adr/0049 Ek
 * 2026-11-15): a 40 px round or square face on the field colour with a
 * hairline and the theme's one floating shadow (see `Mode` for where it
 * stands at each width). It shows once the visitor has scrolled a screen's
 * height down and hides at the top (hidden, it is out of the tab order);
 * pressing it scrolls to the top, at once under reduced motion, and a
 * keyboard press moves the focus to the page's first stop (the skip link).
 * It stays clear of the fixed parts: above the bottom bar and the WhatsApp
 * button, hidden while a drawer, the live search or the product page's buy
 * bar is open (`frame.css`); docked on the footer it is one of the footer's
 * controls the WhatsApp button steps aside from (`data-gf-clear`,
 * `WhatsAppClear`); the layout leaves it out while the cookie question waits.
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
  const [mode, setMode] = useState<Mode>("corner")
  const [dockTop, setDockTop] = useState<number | null>(null)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let frame = 0
    const wide = window.matchMedia(WIDE)
    const narrow = window.matchMedia(NARROW)
    const check = () => {
      frame = 0
      const next: Mode = wide.matches ? "corner" : narrow.matches ? "dock" : "tab"
      const top = next === "dock" && button.current ? dockTopOf(button.current) : null
      setMode(next)
      setDockTop(top)
      setShown(window.scrollY > window.innerHeight && (next !== "dock" || top !== null))
    }
    const schedule = () => {
      frame ||= window.requestAnimationFrame(check)
    }
    check()
    // The footer moves as the page above it grows (pictures, opened parts)
    const sized = new ResizeObserver(schedule)
    sized.observe(document.body)
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule, { passive: true })
    return () => {
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
      sized.disconnect()
      window.cancelAnimationFrame(frame)
    }
  }, [])

  const docked = mode === "dock"
  return (
    <button
      ref={button}
      type="button"
      aria-label={label}
      title={label}
      data-back-to-top=""
      data-mode={mode}
      data-shown={shown ? "" : undefined}
      data-gf-clear={docked ? "" : undefined}
      style={docked && dockTop !== null ? { top: dockTop } : undefined}
      onClick={(event) => {
        const reduced = window.matchMedia(REDUCED).matches
        window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" })
        // A keyboard press (no pointer, so no click count): the focus goes to the top too
        if (event.detail === 0) {
          document.querySelector<HTMLElement>(".gf-skip")?.focus({ preventScroll: true })
        }
      }}
      className={cn(
        "z-(--z-raised) inline-flex items-center justify-center border border-rule bg-field text-text shadow-float-edged hover:border-edge",
        docked ? "absolute" : cn("fixed", bottomOf(aboveBottomBar, overWhatsApp)),
        SIDES[view.side === "left" ? "left" : "right"][mode],
        shapeOf(mode, view),
        !view.mobile && "max-lg:hidden"
      )}
    >
      <ArrowUp
        className={mode === "tab" ? "size-3.5" : "size-5"}
        aria-hidden="true"
        strokeWidth={1.75}
      />
    </button>
  )
}
