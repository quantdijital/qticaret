import { MessageCircle } from "lucide-react"

/** A chat with the shop on WhatsApp, at the corner of every page; a plain link. */
export function WhatsAppButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      aria-label={label}
      className="fixed right-4 bottom-4 z-40 flex size-13 items-center justify-center rounded-full bg-[#1f9d55] text-white shadow-lg shadow-black/15 ring-4 ring-background/60 transition-transform hover:scale-105 sm:right-6 sm:bottom-6"
    >
      <MessageCircle className="size-6" aria-hidden="true" />
    </a>
  )
}
