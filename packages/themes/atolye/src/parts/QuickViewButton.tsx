"use client"

import { Eye } from "lucide-react"
import type { CardQuickViewTrigger } from "@qticaret/types"
import { cn } from "@qticaret/ui/lib/utils"
import { QUICK_VIEW_SOON_EVENT, askQuickView } from "../frame/events"

/**
 * A card's "Hızlı bak" (adr/0049 Ek 2026-11-15): a real button beside the
 * card's link, never instead of it (the product's address stays the one
 * link a crawler follows). Pressed, it asks the layout's dialog to show
 * the product; with no dialog on the page it goes to the product's page.
 * On the photo's top right corner, above the card's link: `hover` a pill
 * with its word shown while the card is pointed at or focused (a touch
 * screen, with nothing to point, shows the 44 px icon always); `icon` the
 * 44 px icon always; `inline` (the compact card) the icon at the row's end.
 * Absolutely placed, or in a row of its own size: nothing moves when it shows.
 */
export function QuickViewButton({
  productId,
  title,
  path,
  trigger,
  inline = false,
  words,
}: {
  productId: string
  title: string
  path: string
  trigger: CardQuickViewTrigger
  inline?: boolean
  words: { open: string; label: string }
}) {
  const hover = trigger === "hover" && !inline
  return (
    <button
      type="button"
      data-quick-view={inline ? "inline" : trigger}
      aria-label={words.label}
      aria-haspopup="dialog"
      className={cn(
        "gf-quick-view z-(--z-raised) inline-flex shrink-0 items-center justify-center gap-1.5 bg-field text-text shadow-float hover:bg-paper-2",
        inline
          ? "relative size-11 rounded-pill"
          : "absolute top-2 right-2 min-h-11 min-w-11 rounded-pill",
        hover && "px-3 text-sm font-semibold"
      )}
      onPointerEnter={() => {
        window.dispatchEvent(new Event(QUICK_VIEW_SOON_EVENT))
      }}
      onFocus={() => {
        window.dispatchEvent(new Event(QUICK_VIEW_SOON_EVENT))
      }}
      onClick={(event) => {
        // Safari leaves a clicked button unfocused: the dialog gives the focus back to it
        event.currentTarget.focus()
        if (!askQuickView({ productId, title, path })) {
          window.location.assign(path)
        }
      }}
    >
      <Eye className="size-5 shrink-0" aria-hidden="true" strokeWidth={1.75} />
      {hover && (
        <span aria-hidden="true" className="gf-quick-view-word">
          {words.open}
        </span>
      )}
    </button>
  )
}
