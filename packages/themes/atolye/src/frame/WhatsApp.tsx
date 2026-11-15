import { cn } from "@qticaret/ui/lib/utils"
import { WhatsAppGlyph } from "../parts/WhatsAppGlyph"

/**
 * A chat with the shop on WhatsApp: a 56 px round button in the WhatsApp
 * green with WhatsApp's own white glyph, named "WhatsApp'tan yazın"; the
 * token, 16 px from the right, above the bottom bar on a phone. The
 * layout leaves it out where it would cover the work; the stylesheet
 * hides it while a sheet is open or a page has its own fixed buy bar,
 * and lets it step aside while the page scrolls down, while a phone's
 * listing grid passes under its pinned pills, while a control of a part
 * the page marks is under it (`WhatsAppClear`: the product's photographs
 * and buy column) and while a field is being typed in (`frame.css`); it
 * comes back as soon as the visitor turns or the control moves on.
 */
export function WhatsApp({
  href,
  label,
  aboveBottomBar,
}: {
  href: string
  label: string
  aboveBottomBar: boolean
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      aria-label={label}
      data-whatsapp=""
      // Edged for `shadow: none` (adr/0067 S2): the green fill is its own edge, no ring round it
      className={cn(
        "fixed right-4 z-(--z-raised) inline-flex size-14 items-center justify-center rounded-button bg-whatsapp text-whatsapp-ink shadow-float-edged lg:right-6 lg:bottom-6",
        aboveBottomBar ? "bottom-[calc(5rem+env(safe-area-inset-bottom))]" : "bottom-4"
      )}
    >
      <WhatsAppGlyph className="size-7" />
    </a>
  )
}
