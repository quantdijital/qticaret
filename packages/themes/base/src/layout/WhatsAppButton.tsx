import { MessageCircle } from "lucide-react"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * A chat with the shop on WhatsApp, at the corner of every page; a plain
 * link. On phones it sits above the bottom bar when there is one.
 */
export function WhatsAppButton({
  href,
  label,
  aboveBottomNav = false,
}: {
  href: string
  label: string
  aboveBottomNav?: boolean
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      aria-label={label}
      className={cn(
        "fixed right-4 z-40 flex size-13 items-center justify-center rounded-full bg-[#1f9d55] text-white shadow-lg shadow-black/15 ring-4 ring-background/60 transition-transform hover:scale-105 sm:right-6",
        aboveBottomNav
          ? "bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:bottom-6"
          : "bottom-4 sm:bottom-6"
      )}
    >
      <MessageCircle className="size-6" aria-hidden="true" />
    </a>
  )
}
