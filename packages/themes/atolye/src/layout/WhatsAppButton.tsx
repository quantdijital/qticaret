import { MessageCircle } from "lucide-react"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * A chat with the shop on WhatsApp (design.md § WhatsApp button): a 56 px
 * square in the WhatsApp token, 16 px from the right, 16 px above the
 * bottom bar on a phone. The layout leaves it out where it would cover
 * the work (the checkout, the cart, a preview); the stylesheet hides it
 * while a drawer is open or a page has its own fixed buy bar
 * (`[data-sticky-buy]`, the product page). A plain link.
 */
export function WhatsAppButton({
  href,
  label,
  aboveBottomNav,
}: {
  href: string
  label: string
  aboveBottomNav: boolean
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      aria-label={label}
      data-whatsapp=""
      className={cn(
        "at-whatsapp fixed right-4 z-(--z-raised) inline-flex size-14 items-center justify-center bg-whatsapp text-whatsapp-ink lg:right-6 lg:bottom-6",
        aboveBottomNav ? "bottom-[calc(4.5rem+env(safe-area-inset-bottom))]" : "bottom-4"
      )}
    >
      <MessageCircle className="size-6" aria-hidden="true" strokeWidth={1.75} />
    </a>
  )
}
