import { MessageCircle } from "lucide-react"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * A chat with the shop on WhatsApp: a 56 px round button in the WhatsApp
 * token, 16 px from the right, above the bottom bar on a phone. The
 * layout leaves it out where it would cover the work; the stylesheet
 * hides it while a sheet is open or a page has its own fixed buy bar.
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
      className={cn(
        "fixed right-4 z-(--z-raised) inline-flex size-14 items-center justify-center rounded-pill bg-whatsapp text-whatsapp-ink shadow-float lg:right-6 lg:bottom-6",
        aboveBottomBar ? "bottom-[calc(5rem+env(safe-area-inset-bottom))]" : "bottom-4"
      )}
    >
      <MessageCircle className="size-6" aria-hidden="true" strokeWidth={2} />
    </a>
  )
}
