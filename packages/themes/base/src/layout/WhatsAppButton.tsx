import { MessageCircle } from "lucide-react"

/** A chat with the shop on WhatsApp, at the corner of every page; a plain link. */
export function WhatsAppButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      aria-label={label}
      className="fixed right-4 bottom-4 z-40 flex size-14 items-center justify-center rounded-full bg-[#25d366] text-white shadow-lg transition-transform hover:scale-105 sm:right-6 sm:bottom-6"
    >
      <MessageCircle className="size-7" aria-hidden="true" />
    </a>
  )
}
