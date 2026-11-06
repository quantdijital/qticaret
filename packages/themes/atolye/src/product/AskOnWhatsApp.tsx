import { ArrowUpRight } from "lucide-react"
import type { Translate } from "@qticaret/ui"
import { WhatsAppGlyph } from "../parts/WhatsAppGlyph"

/**
 * Asking about this product on WhatsApp (owner 2026-11-06: "WhatsApp
 * butonu daha belirgin ve UX/UI açısından daha verimli kurgulanabilir"):
 * a full-width secondary button in the purchase group, 12 px under "add to
 * cart" (owner 2026-11-06: the column's 24 px seam left it detached),
 * WhatsApp's own mark in its green on a green-tinted fill with a green
 * edge, the chat opening with the product's name and address written in
 * (`whatsappHref`, the shop's number). No promise of how fast the shop
 * answers: the shop sets none.
 */
export function AskOnWhatsApp({ href, t }: { href: string; t: Translate }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="flex min-h-12 w-full items-center justify-center gap-2.5 rounded-pill border border-whatsapp bg-whatsapp/8 px-5 py-2.5 text-md font-semibold text-text no-underline transition-colors duration-(--dur-micro) hover:bg-whatsapp/16 active:translate-y-px"
    >
      <WhatsAppGlyph className="size-6 text-whatsapp" />
      {t("product.whatsapp_button")}
      <ArrowUpRight className="size-4 text-text-2" aria-hidden="true" strokeWidth={2} />
      <span className="sr-only">{t("product.new_tab")}</span>
    </a>
  )
}
